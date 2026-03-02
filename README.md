<p align="center">
  <img src="https://img.shields.io/badge/Football%20Analytics-xScout-00e5ff?style=for-the-badge&logo=soccer&logoColor=white" alt="xScout Logo" />
</p>

<h1 align="center">⚽ xScout Dashboard v2.0</h1>

<h3 align="center">Advanced Football Scouting Analytics & Player Profiling Platform</h3>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/D3.js-Data%20Visualization-F9A03C?style=flat-square&logo=d3dotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Google%20Charts-Analytics-4285F4?style=flat-square&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Data-StatsBomb%20Open-FF6B6B?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIj48L2NpcmNsZT48cGF0aCBkPSJNMTIgNnYxMiI+PC9wYXRoPjxwYXRoIGQ9Ik02IDEyaDEyIj48L3BhdGg+PC9zdmc+" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
</p>

<p align="center">
  <b>Transform Raw Data Into Tactical Insights.</b><br/>
  Analyze player performance → Compare tactical profiles → Identify role fits → Discover similar talents using advanced statistical modeling and interactive visualizations.
</p>

---

## 📸 Screenshots

| Player Overview | Player Comparison | Role Analysis |
|:---:|:---:|:---:|
| Attribute breakdown + radar profiling | Head-to-head metrics + difference analysis | Role suitability scoring |
| ![Overview](https://placehold.co/300x200/1e2d42/00e5ff?text=Player+Profile) | ![Comparison](https://placehold.co/300x200/1e2d42/ff5e3a?text=Player+vs+Player) | ![Role Fit](https://placehold.co/300x200/1e2d42/b8ff57?text=Role+Analysis) |

---

## ✨ Features

### 🎯 Core Intelligence
- **Multi-Dimensional Player Profiling** — Combines 11 key performance metrics across attacking, creative, defensive, and physical dimensions for comprehensive evaluation.
- **Role-Based Analysis** — Evaluate players against 7 predefined tactical roles (Poacher, Target Man, Winger, etc.) with weighted scoring algorithms.
- **Euclidean Similarity Engine** — Find statistically similar players based on performance vector distances across all metrics.

### 🔬 Advanced Visualizations
- **Interactive Radar Charts** — Spider diagrams showing player strengths across 6 composite categories with dynamic coloring.
- **Positional Heatmaps** — Algorithmic mockups of player activity patterns with intensity-based clustering visualization.
- **Passing Network Graphs** — Animated connection diagrams showing pass distribution and frequency patterns.
- **Attribute Breakdown Charts** — Bar graphs with color-coded performance tiers and professional styling.

### 🚀 Scouting Workflow
- **Global Filtering System** — Filter by gender, competition, season, and country to narrow down player pools.
- **Real-Time Comparison** — Side-by-side player analysis with visual difference highlighting.
- **Performance Trending** — Track metrics over time with normalized per-90 minute calculations.
- **Export-Ready Reports** — Generate printable scouting reports with visual evidence and statistical breakdowns.

### 🖥️ Premium Dashboard
- **Modern Dark Theme** — Professional UI with glass-morphism effects and consistent color palette.
- **Responsive Design** — Adapts to different screen sizes with mobile-friendly layouts.
- **Smooth Animations** — Cascading transitions and micro-interactions for premium user experience.
- **Cross-Browser Compatibility** — Works seamlessly across Chrome, Firefox, Safari, and Edge.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HTML5 Frontend                       │
│              (dashboard/index.html — UI)                │
└─────────────────────┬───────────────────────────────────┘
                      │ DOM Events & State Management
┌─────────────────────▼───────────────────────────────────┐
│                   JavaScript Engine                     │
│                (dashboard/app.js — Logic)               │
├─────────────────────────────────────────────────────────┤
│                Visualization Layer                      │
│        D3.js Charts + Google Charts Integration         │
├─────────────────────────────────────────────────────────┤
│                    Data Pipeline                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ Data Fetch   │ │ Processing   │ │ Normalization    │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ Role Scoring │ │ Similarity   │ │ Filtering        │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                     Data Layer                          │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │ players.json     │  │ Cache System                │  │
│  │ (1.9MB)          │  │ (Individual Player Files)   │  │
│  └──────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend UI** | HTML5, CSS3 (Custom Properties), JavaScript ES6+ |
| **Data Visualization** | D3.js (Radar Charts, Heatmaps), Google Charts (Bar Graphs) |
| **State Management** | Vanilla JavaScript with Global Variables |
| **Data Processing** | Python 3, pandas, statsbombpy |
| **Data Source** | StatsBomb Open Data API |
| **Styling Framework** | Custom CSS with DM Sans/DM Mono Fonts |
| **Deployment** | Static File Server (Python http.server) |

---

## 📁 Project Structure

```
xScout/
├── dashboard/
│   ├── index.html        # Main dashboard application
│   ├── app.js           # Core application logic & visualizations
│   └── style.css        # Custom styling & responsive design
│
├── data/
│   ├── players.json     # Processed player statistics (1.9MB)
│   └── cache/           # Individual player data files
│       └── {player_id}_{season}.json
│
├── scripts/
│   └── pipeline.py      # Data processing pipeline
│
├── requirements.txt     # Python dependencies
├── README.md           # Project documentation
└── xScout_PRD.docx     # Product requirements documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+**
- **Modern Web Browser** (Chrome, Firefox, Safari, Edge)
- **Local Server Environment** (Built-in Python server recommended)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/xscout.git
cd xscout

# 2. Create a virtual environment
python -m venv .venv

# 3. Activate the virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt
```

### Running the Application

#### Option 1: Local Development Server
```bash
# Start Python's built-in HTTP server
python -m http.server 8000

# Navigate to http://localhost:8000/dashboard
```

#### Option 2: Direct File Access
```bash
# Open dashboard/index.html directly in your browser
# Note: Some features may not work due to CORS restrictions
```

---

## 📖 How It Works

```
Data Pipeline Execution
    │
    ▼
StatsBomb API Fetch ──► Event Processing ──► Per-90 Normalization
    │
    ▼
JSON Data Generation ──► Dashboard Loading
    │
    ▼
Player Selection ──► Dynamic Visualization Rendering
    │
    ├──► Radar Chart Generation (D3.js)
    ├──► Attribute Bars (Google Charts)
    ├──► Heatmap Creation (Algorithmic Mockup)
    └──► Network Diagrams (Animated SVG)
            │
            ▼
        Interactive Analysis
            │
            ├──► Role Fit Scoring
            ├──► Player Comparison
            └──► Similarity Matching
```

---

## 🤖 Key Algorithms

| Component | Methodology | Purpose |
|-------|---------|-----------|
| **Role Fit Engine** | Weighted Metric Scoring | Match players to tactical positions |
| **Similarity Detector** | Euclidean Distance | Find statistically comparable players |
| **Normalization Engine** | Per-90 Minute Calculation | Standardize playing time differences |
| **Visualization Engine** | D3.js + SVG Animation | Create interactive performance charts |

---

## ⚙️ Configuration

Key settings can be modified in `dashboard/app.js`:

```javascript
// Performance metrics configuration
const METRICS = [
  'shots_p90', 'xg_p90', 'shot_conversion',
  'prog_passes_p90', 'pass_completion', 'key_passes_p90',
  'dribbles_p90', 'pressures_p90', 'press_success',
  'aerial_win_rate', 'distance_p90'
];

// Role templates with weighted importance
const ROLES = {
  'Poacher': { shot_conversion: 0.30, xg_p90: 0.25, ... },
  'Target Man': { aerial_win_rate: 0.30, xg_p90: 0.25, ... }
};

// Visualization thresholds
function getBarColor(val) {
  if (val >= 85) return '#b8ff57';  // Excellent
  if (val >= 70) return '#00e5ff';  // Good
  if (val >= 55) return '#ffd166';  // Average
  return '#ff5e3a';                 // Below Average
}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/player-analytics`)
3. Commit your changes (`git commit -m 'Add advanced heatmap visualization'`)
4. Push to the branch (`git push origin feature/player-analytics`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ using JavaScript, D3.js & Python<br/>
  <b>xScout</b> — Transforming Data Into Tactical Excellence.
</p>
