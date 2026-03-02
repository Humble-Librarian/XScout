"""
xScout Data Pipeline - Full StatsBomb Open Data
Fetches ALL competitions & seasons (male + female) from StatsBomb open data
and processes them into a dashboard-ready players.json.

Data Source: StatsBomb Open Data (all available competitions & seasons)
Output: data/players.json
"""

import json
import os
import sys
import time
import warnings
from pathlib import Path

import pandas as pd
from statsbombpy import sb

warnings.filterwarnings("ignore")

# Fix Windows console encoding
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# ---------------------------------------------
# CONFIGURATION
# ─────────────────────────────────────────────
MIN_MINUTES = 450         # Minimum minutes to qualify (5 full matches)
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_DIR = OUTPUT_DIR / "cache"
OUTPUT_FILE = OUTPUT_DIR / "players.json"


def fetch_all_competitions():
    """Fetch every competition/season combo available in StatsBomb open data."""
    print("[INIT] Fetching available competitions ...")
    comps = sb.competitions()
    print(f"       Found {len(comps)} competition/season combos.")
    print(f"       Genders: {comps['competition_gender'].unique().tolist()}")
    return comps


def fetch_matches(competition_id, season_id):
    """Fetch all matches for a given competition and season."""
    matches = sb.matches(competition_id=competition_id, season_id=season_id)
    return matches


def fetch_all_events(matches):
    """Fetch event-level data for every match. Returns a single concatenated DataFrame."""
    all_events = []
    for idx, match_id in enumerate(matches["match_id"]):
        try:
            events = sb.events(match_id=match_id)
            events["match_id"] = match_id
            all_events.append(events)
        except Exception as e:
            print(f"         [!] Skipped match {match_id}: {e}")
        if (idx + 1) % 50 == 0:
            print(f"         ... processed {idx + 1}/{len(matches)} matches")
    if not all_events:
        return pd.DataFrame()
    events_df = pd.concat(all_events, ignore_index=True)
    return events_df


def calculate_minutes(events_df, matches):
    """
    Estimate minutes played per player.
    Uses substitution events to adjust from full-match minutes.
    """
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

    return total_minutes


def aggregate_metrics(events_df, minutes_df):
    """
    Aggregate raw event counts per player across all matches.
    Returns a DataFrame with raw counts ready for per-90 conversion.
    """
    players = minutes_df.copy()

    # ── Shots & xG ──
    shots = events_df[events_df["type"] == "Shot"]
    shot_counts = shots.groupby("player_id").size().reset_index(name="shots")
    goals = shots[shots["shot_outcome"] == "Goal"].groupby("player_id").size().reset_index(name="goals")
    xg = shots.groupby("player_id")["shot_statsbomb_xg"].sum().reset_index(name="total_xg") if "shot_statsbomb_xg" in shots.columns else pd.DataFrame(columns=["player_id", "total_xg"])

    # ── Passes ──
    passes = events_df[events_df["type"] == "Pass"]
    total_passes = passes.groupby("player_id").size().reset_index(name="total_passes")
    completed_passes = passes[passes["pass_outcome"].isna()].groupby("player_id").size().reset_index(name="completed_passes")

    # Progressive passes (passes into the final third)
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
    key_pass_mask = pd.Series(False, index=passes.index)
    if "pass_goal_assist" in passes.columns:
        key_pass_mask = key_pass_mask | (passes["pass_goal_assist"] == True)
    if "pass_shot_assist" in passes.columns:
        key_pass_mask = key_pass_mask | (passes["pass_shot_assist"] == True)
    key_passes = passes[key_pass_mask].groupby("player_id").size().reset_index(name="key_passes")

    # ── Dribbles ──
    dribbles = events_df[events_df["type"] == "Dribble"]
    successful_dribbles = dribbles[dribbles["dribble_outcome"] == "Complete"]
    dribble_counts = successful_dribbles.groupby("player_id").size().reset_index(name="dribbles")

    # ── Pressures ──
    pressures = events_df[events_df["type"] == "Pressure"]
    pressure_counts = pressures.groupby("player_id").size().reset_index(name="pressures")

    # Press success
    press_success_counts = pd.DataFrame(columns=["player_id", "press_successes"])
    if "counterpress" in pressures.columns:
        press_success_counts = pressures[
            pressures["counterpress"].fillna(False) == True
        ].groupby("player_id").size().reset_index(name="press_successes")

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
    except Exception:
        pass

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
    return players


def compute_per90_and_normalize(players_df):
    """
    Convert raw counts to per-90 values, then normalise each metric
    to a 0–100 scale within this competition/season pool.
    """
    # Filter minimum minutes
    df = players_df[players_df["minutes_played"] >= MIN_MINUTES].copy()
    if df.empty:
        return df

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

    # Metrics to normalise (0-100 scale) — per-competition normalization
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


def format_players(df, events_df, competition_name, season_name, gender, country):
    """
    Format the final DataFrame to the agreed schema with competition metadata.
    Returns a list of dicts.
    """
    if df.empty:
        return []

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

    # Approximate age (placeholder)
    if "age" not in df.columns:
        df["age"] = 25

    df["minutes_played"] = df["minutes_played"].astype(int)
    df["player_id"] = df["player_id"].astype(int)

    # Select and round
    output = df[output_fields].copy()
    for col in output.select_dtypes(include=["float64"]).columns:
        output[col] = output[col].round(1)

    # Add competition metadata
    output["competition"] = competition_name
    output["season"] = season_name
    output["gender"] = gender
    output["country"] = country

    # Sort by name
    output = output.sort_values("name").reset_index(drop=True)

    records = output.to_dict(orient="records")
    return records


def process_competition_season(comp_row):
    """
    Process a single competition/season combination through the full pipeline.
    Returns a list of player dicts, or an empty list on failure.
    """
    comp_id = int(comp_row["competition_id"])
    season_id = int(comp_row["season_id"])
    comp_name = comp_row["competition_name"]
    season_name = comp_row["season_name"]
    gender = comp_row["competition_gender"]
    country = comp_row.get("country_name", "Unknown")

    cache_file = CACHE_DIR / f"{comp_id}_{season_id}.json"

    # Check cache
    if cache_file.exists():
        print(f"  >> Cache hit: {comp_name} {season_name} ({gender})")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    label = f"{comp_name} {season_name} ({gender}, {country})"
    print(f"\n  -> Processing: {label}")

    try:
        # Step 1: Fetch matches
        matches = fetch_matches(comp_id, season_id)
        if matches.empty:
            print(f"    [!] No matches found - skipping.")
            return []
        print(f"    Matches: {len(matches)}")

        # Step 2: Fetch events
        print(f"    Fetching events for {len(matches)} matches ...")
        events_df = fetch_all_events(matches)
        if events_df.empty:
            print(f"    [!] No events found - skipping.")
            return []
        print(f"    Events: {len(events_df):,}")

        # Step 3: Calculate minutes
        minutes_df = calculate_minutes(events_df, matches)
        print(f"    Tracked {len(minutes_df)} unique players.")

        # Step 4: Aggregate metrics
        players_df = aggregate_metrics(events_df, minutes_df)
        print(f"    Aggregated metrics for {len(players_df)} players.")

        # Step 5: Per-90 + normalise (per-competition normalization)
        normalised_df = compute_per90_and_normalize(players_df)
        qualified = len(normalised_df)
        print(f"    {qualified} players meet the {MIN_MINUTES}-min threshold.")

        if normalised_df.empty:
            print(f"    [!] No qualifying players - skipping.")
            # Save empty cache to avoid re-processing
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump([], f)
            return []

        # Step 6: Format
        records = format_players(
            normalised_df, events_df,
            comp_name, season_name, gender, country
        )
        print(f"    [OK] {len(records)} players exported.")

        # Save to cache
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False)

        return records

    except Exception as e:
        print(f"    [ERROR] Error processing {label}: {e}")
        return []


# ---------------------------------------------
# MAIN
# ---------------------------------------------
def main():
    print("=" * 70)
    print("  xScout Data Pipeline - All StatsBomb Open Data")
    print("  (all competitions, all seasons, male + female)")
    print("=" * 70)
    print()

    start_time = time.time()

    # Fetch all available competitions
    comps = fetch_all_competitions()

    all_players = []
    total = len(comps)

    for idx, (_, row) in enumerate(comps.iterrows()):
        comp_name = row["competition_name"]
        season_name = row["season_name"]
        gender = row["competition_gender"]
        print(f"\n{'-' * 60}")
        print(f"[{idx + 1}/{total}] {comp_name} - {season_name} ({gender})")
        print(f"{'-' * 60}")

        records = process_competition_season(row)
        all_players.extend(records)
        print(f"  Running total: {len(all_players)} players")

    # Write final merged JSON
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    all_players.sort(key=lambda p: p.get("name", ""))
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_players, f, indent=2, ensure_ascii=False)

    elapsed = time.time() - start_time
    print(f"\n{'=' * 70}")
    print(f"  Pipeline complete!")
    print(f"  Total players: {len(all_players)}")
    print(f"  Output: {OUTPUT_FILE}")
    print(f"  Time elapsed: {elapsed / 60:.1f} minutes")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
