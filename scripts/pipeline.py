"""
xScout Data Pipeline — Stage 1
Fetches StatsBomb open data and processes it into a dashboard-ready players.json.

Data Source: StatsBomb Open Data (La Liga 2015/16)
Output: data/players.json
"""

import json
import os
import sys
import warnings
from pathlib import Path

import pandas as pd
from statsbombpy import sb

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
COMPETITION_ID = 11       # La Liga
SEASON_ID = 27            # 2015/16
MIN_MINUTES = 450         # Minimum minutes to qualify (5 full matches)
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"
OUTPUT_FILE = OUTPUT_DIR / "players.json"


def fetch_matches():
    """Fetch all matches for the selected competition and season."""
    print(f"[1/6] Fetching matches for La Liga 2015/16 ...")
    matches = sb.matches(competition_id=COMPETITION_ID, season_id=SEASON_ID)
    print(f"       Found {len(matches)} matches.")
    return matches


def fetch_all_events(matches):
    """Fetch event-level data for every match. Returns a single concatenated DataFrame."""
    print(f"[2/6] Fetching events for {len(matches)} matches (this may take a few minutes) ...")
    all_events = []
    for idx, match_id in enumerate(matches["match_id"]):
        try:
            events = sb.events(match_id=match_id)
            events["match_id"] = match_id
            all_events.append(events)
        except Exception as e:
            print(f"       ⚠ Skipped match {match_id}: {e}")
        if (idx + 1) % 50 == 0:
            print(f"       ... processed {idx + 1}/{len(matches)} matches")
    events_df = pd.concat(all_events, ignore_index=True)
    print(f"       Total events collected: {len(events_df):,}")
    return events_df


def calculate_minutes(events_df, matches):
    """
    Estimate minutes played per player.
    Uses substitution events to adjust from full-match minutes.
    """
    print("[3/6] Calculating minutes played per player ...")

    # Get match durations (approximate: use last event minute per match)
    match_durations = (
        events_df.groupby("match_id")["minute"]
        .max()
        .reset_index()
        .rename(columns={"minute": "match_duration"})
    )

    # All players who appeared in events
    player_events = events_df[events_df["player"].notna()][["match_id", "player", "player_id"]].drop_duplicates()

    # Merge with match durations — default: played full match
    player_minutes = player_events.merge(match_durations, on="match_id", how="left")

    # Substitution adjustments
    subs = events_df[events_df["type"] == "Substitution"].copy()
    if not subs.empty:
        # Player subbed OFF: played from 0 to sub minute
        subs_off = subs[["match_id", "player", "player_id", "minute"]].copy()
        subs_off = subs_off.rename(columns={"minute": "sub_off_minute"})

        # Player subbed ON: played from sub minute to end
        if "substitution_replacement" in subs.columns:
            subs_on = subs[["match_id", "substitution_replacement", "minute"]].copy()
            subs_on = subs_on.rename(columns={
                "substitution_replacement": "player",
                "minute": "sub_on_minute"
            })
        else:
            subs_on = pd.DataFrame()

        # Merge sub off times
        player_minutes = player_minutes.merge(
            subs_off[["match_id", "player_id", "sub_off_minute"]],
            on=["match_id", "player_id"],
            how="left"
        )

        # Merge sub on times
        if not subs_on.empty:
            player_minutes = player_minutes.merge(
                subs_on[["match_id", "player", "sub_on_minute"]],
                on=["match_id", "player"],
                how="left"
            )
        else:
            player_minutes["sub_on_minute"] = float("nan")

        # Calculate actual minutes per match
        player_minutes["minutes"] = player_minutes.apply(
            lambda row: (
                row["sub_off_minute"]
                if pd.notna(row.get("sub_off_minute"))
                else (
                    row["match_duration"] - row["sub_on_minute"]
                    if pd.notna(row.get("sub_on_minute"))
                    else row["match_duration"]
                )
            ),
            axis=1,
        )
    else:
        player_minutes["minutes"] = player_minutes["match_duration"]

    # Sum across all matches
    total_minutes = (
        player_minutes.groupby(["player", "player_id"])["minutes"]
        .sum()
        .reset_index()
        .rename(columns={"minutes": "minutes_played"})
    )

    print(f"       Tracked {len(total_minutes)} unique players.")
    return total_minutes


def aggregate_metrics(events_df, minutes_df):
    """
    Aggregate raw event counts per player across all matches.
    Returns a DataFrame with raw counts ready for per-90 conversion.
    """
    print("[4/6] Aggregating player metrics ...")

    players = minutes_df.copy()

    # ── Shots & xG ──
    shots = events_df[events_df["type"] == "Shot"]
    shot_counts = shots.groupby("player_id").size().reset_index(name="shots")
    goals = shots[shots["shot_outcome"] == "Goal"].groupby("player_id").size().reset_index(name="goals")
    xg = shots.groupby("player_id")["shot_statsbomb_xg"].sum().reset_index(name="total_xg")

    # ── Passes ──
    passes = events_df[events_df["type"] == "Pass"]
    total_passes = passes.groupby("player_id").size().reset_index(name="total_passes")
    completed_passes = passes[passes["pass_outcome"].isna()].groupby("player_id").size().reset_index(name="completed_passes")

    # Progressive passes (move ball at least 10m towards goal)
    # Simplified: passes in the final third
    prog_passes = passes[passes["pass_end_location"].notna()].copy()
    if not prog_passes.empty:
        try:
            prog_passes["end_x"] = prog_passes["pass_end_location"].apply(
                lambda loc: loc[0] if isinstance(loc, (list, tuple)) and len(loc) >= 2 else None
            )
            prog_passes = prog_passes[prog_passes["end_x"].notna()]
            prog_passes = prog_passes[prog_passes["end_x"] >= 80]
            prog_pass_counts = prog_passes.groupby("player_id").size().reset_index(name="prog_passes")
        except Exception:
            prog_pass_counts = pd.DataFrame(columns=["player_id", "prog_passes"])
    else:
        prog_pass_counts = pd.DataFrame(columns=["player_id", "prog_passes"])

    # Key passes (passes that led to a shot / goal assist)
    key_passes = passes[
        (passes["pass_goal_assist"] == True) | (passes["pass_shot_assist"] == True)
    ].groupby("player_id").size().reset_index(name="key_passes")

    # ── Dribbles ──
    dribbles = events_df[events_df["type"] == "Dribble"]
    successful_dribbles = dribbles[dribbles["dribble_outcome"] == "Complete"]
    dribble_counts = successful_dribbles.groupby("player_id").size().reset_index(name="dribbles")

    # ── Pressures ──
    pressures = events_df[events_df["type"] == "Pressure"]
    pressure_counts = pressures.groupby("player_id").size().reset_index(name="pressures")

    # Press success: check if next event after pressure is a recovery/turnover
    # Simplified: count pressures that have a counterpress tag
    press_success_counts = pressures[
        pressures.get("counterpress", pd.Series(dtype=bool)).fillna(False) == True
    ].groupby("player_id").size().reset_index(name="press_successes") if "counterpress" in pressures.columns else pd.DataFrame(columns=["player_id", "press_successes"])

    # ── Aerial duels ──
    aerial_total = pd.DataFrame(columns=["player_id", "aerial_total"])
    aerial_wins = pd.DataFrame(columns=["player_id", "aerial_wins"])
    try:
        duels = events_df[events_df["type"] == "Duel"].copy()
        if not duels.empty and "duel_type" in duels.columns:
            aerial_duels = duels[duels["duel_type"].astype(str).str.contains("Aerial", case=False, na=False)]
            if not aerial_duels.empty:
                aerial_total = aerial_duels.groupby("player_id").size().reset_index(name="aerial_total")
                if "duel_outcome" in aerial_duels.columns:
                    won_mask = aerial_duels["duel_outcome"].astype(str).str.contains("Won|Success", case=False, na=False)
                    aerial_wins = aerial_duels[won_mask].groupby("player_id").size().reset_index(name="aerial_wins")
    except Exception as e:
        print(f"       ⚠ Aerial duel calculation skipped: {e}")

    # ── Carries (distance) ──
    carries = events_df[events_df["type"] == "Carry"]
    if not carries.empty and "carry_end_location" in carries.columns:
        try:
            carries = carries.copy()
            carries["start_x"] = carries["location"].apply(
                lambda loc: loc[0] if isinstance(loc, (list, tuple)) and len(loc) >= 2 else 0
            )
            carries["start_y"] = carries["location"].apply(
                lambda loc: loc[1] if isinstance(loc, (list, tuple)) and len(loc) >= 2 else 0
            )
            carries["end_x"] = carries["carry_end_location"].apply(
                lambda loc: loc[0] if isinstance(loc, (list, tuple)) and len(loc) >= 2 else 0
            )
            carries["end_y"] = carries["carry_end_location"].apply(
                lambda loc: loc[1] if isinstance(loc, (list, tuple)) and len(loc) >= 2 else 0
            )
            carries["distance"] = ((carries["end_x"] - carries["start_x"]) ** 2 +
                                   (carries["end_y"] - carries["start_y"]) ** 2) ** 0.5
            carry_distance = carries.groupby("player_id")["distance"].sum().reset_index(name="carry_distance")
        except Exception:
            carry_distance = pd.DataFrame(columns=["player_id", "carry_distance"])
    else:
        carry_distance = pd.DataFrame(columns=["player_id", "carry_distance"])

    # ── Merge all metrics ──
    metric_dfs = [
        shot_counts, goals, xg, total_passes, completed_passes,
        prog_pass_counts, key_passes, dribble_counts,
        pressure_counts, press_success_counts,
        aerial_total, aerial_wins, carry_distance,
    ]
    for mdf in metric_dfs:
        if not mdf.empty:
            players = players.merge(mdf, on="player_id", how="left")

    players = players.fillna(0)
    print(f"       Aggregated metrics for {len(players)} players.")
    return players


def compute_per90_and_normalize(players_df):
    """
    Convert raw counts to per-90 values, then normalise each metric
    to a 0–100 scale across the player pool.
    """
    print("[5/6] Computing per-90 metrics and normalizing ...")

    # Filter minimum minutes
    df = players_df[players_df["minutes_played"] >= MIN_MINUTES].copy()
    print(f"       {len(df)} players meet the {MIN_MINUTES}-minute threshold.")

    per90_factor = df["minutes_played"] / 90.0

    # Ensure all expected raw columns exist (default to 0)
    for col in ["shots", "goals", "total_xg", "prog_passes", "total_passes",
                "completed_passes", "key_passes", "dribbles", "pressures",
                "press_successes", "aerial_total", "aerial_wins", "carry_distance"]:
        if col not in df.columns:
            df[col] = 0

    # Per-90 metrics
    df["shots_p90"] = df["shots"] / per90_factor
    df["xg_p90"] = df["total_xg"] / per90_factor
    df["shot_conversion"] = df.apply(
        lambda r: (r["goals"] / r["shots"] * 100) if r["shots"] > 0 else 0, axis=1
    )
    df["prog_passes_p90"] = df["prog_passes"] / per90_factor
    df["pass_completion"] = df.apply(
        lambda r: (r["completed_passes"] / r["total_passes"] * 100) if r["total_passes"] > 0 else 0, axis=1
    )
    df["key_passes_p90"] = df["key_passes"] / per90_factor
    df["dribbles_p90"] = df["dribbles"] / per90_factor
    df["pressures_p90"] = df["pressures"] / per90_factor
    df["press_success"] = df.apply(
        lambda r: (r["press_successes"] / r["pressures"] * 100) if r["pressures"] > 0 else 0, axis=1
    )
    df["aerial_win_rate"] = df.apply(
        lambda r: (r["aerial_wins"] / r["aerial_total"] * 100) if r["aerial_total"] > 0 else 0, axis=1
    )
    df["distance_p90"] = df["carry_distance"] / per90_factor

    # Metrics to normalise (0-100 scale)
    metrics_to_normalize = [
        "shots_p90", "xg_p90", "shot_conversion",
        "prog_passes_p90", "pass_completion", "key_passes_p90",
        "dribbles_p90", "pressures_p90", "press_success",
        "aerial_win_rate", "distance_p90",
    ]

    for metric in metrics_to_normalize:
        mn, mx = df[metric].min(), df[metric].max()
        if mx > mn:
            df[metric] = ((df[metric] - mn) / (mx - mn) * 100).round(1)
        else:
            df[metric] = 50.0  # If all values are the same

    print("       Normalisation complete.")
    return df


def derive_position(events_df, player_id):
    """Derive simplified position (FW/MF/DF/GK) from StatsBomb position data."""
    player_events = events_df[events_df["player_id"] == player_id]
    if "position" in player_events.columns:
        positions = player_events["position"].dropna()
        if not positions.empty:
            most_common = positions.mode().iloc[0] if not positions.mode().empty else ""
            pos_str = str(most_common).lower()
            if any(kw in pos_str for kw in ["forward", "striker", "wing"]):
                return "FW"
            elif any(kw in pos_str for kw in ["midfield", "midfielder"]):
                return "MF"
            elif any(kw in pos_str for kw in ["back", "defender", "center back"]):
                return "DF"
            elif "keeper" in pos_str or "goalkeeper" in pos_str:
                return "GK"
    return "MF"  # default fallback


def export_json(df, events_df):
    """
    Format the final DataFrame to the agreed schema and write to players.json.
    """
    print("[6/6] Exporting players.json ...")

    output_fields = [
        "name", "player_id", "position", "age", "minutes_played",
        "shots_p90", "xg_p90", "shot_conversion",
        "prog_passes_p90", "pass_completion", "key_passes_p90",
        "dribbles_p90", "pressures_p90", "press_success",
        "aerial_win_rate", "distance_p90",
    ]

    # Derive positions
    df["position"] = df["player_id"].apply(lambda pid: derive_position(events_df, pid))

    # Rename player column
    df = df.rename(columns={"player": "name"})

    # Approximate age (season 2015/16, assume average age ~25 as placeholder)
    if "age" not in df.columns:
        df["age"] = 25  # Will be refined if birth_date data is available

    df["minutes_played"] = df["minutes_played"].astype(int)
    df["player_id"] = df["player_id"].astype(int)

    # Select and round
    output = df[output_fields].copy()
    for col in output.select_dtypes(include=["float64"]).columns:
        output[col] = output[col].round(1)

    # Sort by name
    output = output.sort_values("name").reset_index(drop=True)

    # Write JSON
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    records = output.to_dict(orient="records")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    print(f"       ✅ Exported {len(records)} players to {OUTPUT_FILE}")
    return records


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  xScout Data Pipeline — StatsBomb → players.json")
    print("=" * 60)
    print()

    # Step 1: Fetch matches
    matches = fetch_matches()

    # Step 2: Fetch all events
    events_df = fetch_all_events(matches)

    # Step 3: Calculate minutes played
    minutes_df = calculate_minutes(events_df, matches)

    # Step 4: Aggregate metrics
    players_df = aggregate_metrics(events_df, minutes_df)

    # Step 5: Per-90 + normalise
    normalised_df = compute_per90_and_normalize(players_df)

    # Step 6: Export
    export_json(normalised_df, events_df)

    print()
    print("Pipeline complete! 🎉")


if __name__ == "__main__":
    main()
