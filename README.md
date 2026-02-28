# xScout — Data Meets the Beautiful Game

An interactive football scouting dashboard that transforms StatsBomb event data into role-based comparisons, similarity detection, and visual performance profiling.

## Project Structure

```
DV_CIPAT/
├── scripts/          # Stage 1 — Python data pipeline
│   └── pipeline.py   # StatsBomb event processing
├── data/             # Pipeline output
│   └── players.json  # Dashboard-ready player data
├── dashboard/        # Stage 2 — Interactive HTML dashboard
│   ├── index.html    # Main dashboard page
│   ├── style.css     # Styles
│   └── app.js        # Application logic
├── requirements.txt  # Python dependencies
└── README.md
```

## Tech Stack

| Tool | Stage | Role |
|------|-------|------|
| Python 3 + pandas | Stage 1 | Event aggregation, per-90 stats, normalisation |
| statsbombpy | Stage 1 | StatsBomb data access |
| D3.js | Stage 2 | Radar (spider) charts |
| Google Charts | Stage 2 | Bar & grouped comparison charts |
| HTML5 / CSS3 / JS | Stage 2 | Dashboard layout & interactivity |

## Getting Started

### Stage 1 — Data Pipeline
```bash
pip install -r requirements.txt
python scripts/pipeline.py
```

### Stage 2 — Dashboard
Open `dashboard/index.html` in any modern browser.

## Dashboard Modules

1. **Player Overview** — Full single-player profile with attribute bars and radar chart
2. **Player Comparison** — Head-to-head dual radar and difference table
3. **Role Fit Analysis** — Score players against 7 tactical role templates
4. **Similar Player Finder** — Euclidean-distance-based scouting shortlist

## Data Source

[StatsBomb Open Data](https://github.com/statsbomb/open-data) — La Liga 2015/16
