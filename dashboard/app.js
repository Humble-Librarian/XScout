// ─────────────────────────────────────────────
// GLOBALS
// ─────────────────────────────────────────────
let ALL_PLAYERS = [];   // Full unfiltered dataset
let PLAYERS = [];       // Currently filtered subset
let googleChartsLoaded = false; // Track Google Charts initialization

// All metric keys from players.json
const METRICS = [
  'shots_p90', 'xg_p90', 'shot_conversion',
  'prog_passes_p90', 'pass_completion', 'key_passes_p90',
  'dribbles_p90', 'pressures_p90', 'press_success',
  'aerial_win_rate', 'distance_p90'
];

// ... existing code ...

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function initApp() {
  // Initialize Google Charts
  google.charts.load('current', { 'packages': ['corechart'] });
  google.charts.setOnLoadCallback(() => {
    googleChartsLoaded = true;
    console.log('✅ Google Charts loaded successfully');
  });

  // Populate global filters
  populateGlobalFilters();
  document.getElementById('filter-count').textContent = `${PLAYERS.length} player${PLAYERS.length !== 1 ? 's' : ''}`;

  // Wire global filter dropdowns
  document.getElementById('filter-gender').addEventListener('change', onFilterChange);
  document.getElementById('filter-competition').addEventListener('change', onFilterChange);
  document.getElementById('filter-season').addEventListener('change', onSeasonChange);
  document.getElementById('filter-country').addEventListener('change', onCountryChange);

  // Wire module dropdowns
  document.getElementById('overview-select').addEventListener('change', renderOverview);
  document.getElementById('compare-a').addEventListener('change', renderCompare);
  document.getElementById('compare-b').addEventListener('change', renderCompare);
  document.getElementById('role-select').addEventListener('change', renderRoleFit);
  document.getElementById('similar-select').addEventListener('change', renderSimilar);
  document.getElementById('similar-pos-filter').addEventListener('change', renderSimilar);
  document.getElementById('similar-age-filter').addEventListener('change', renderSimilar);

  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    });
  });

  // Initial renders
  refreshAllModules();
}

// ... existing code ...

// Enhanced render function with professional styling and icons
function renderAdvancedOverview() {
  const p = PLAYERS[document.getElementById('overview-select').value];
  if (!p) return;
  const container = document.getElementById('overview-content');

  // Top 5 strengths, bottom 3 weaknesses
  const sorted = [...METRICS].sort((a, b) => (p[b] || 0) - (p[a] || 0));
  const top5 = sorted.slice(0, 5);
  const bot3 = sorted.slice(-3);

  const compInfo = p.competition ? `${p.competition} · ${p.season || ''}` : '';
  const genderBadge = p.gender ? `<span class="tag" style="background:rgba(184,255,87,0.1);border-color:rgba(184,255,87,0.3);color:#b8ff57">${p.gender}</span>` : '';

  // Metric icons mapping
  const metricIcons = {
    'shots_p90': '⚽',
    'xg_p90': '📈',
    'shot_conversion': '🎯',
    'prog_passes_p90': '🔄',
    'pass_completion': '✅',
    'key_passes_p90': '🔑',
    'dribbles_p90': '🔥',
    'pressures_p90': '💪',
    'press_success': '🏆',
    'aerial_win_rate': '🦅',
    'distance_p90': '📍'
  };

  container.innerHTML = `
    <div class="player-header-card">
      <div class="player-avatar">${initials(p.name)}</div>
      <div class="player-info">
        <h2>${p.name}</h2>
        <div class="player-meta">
          Position: <span>${p.position}</span> &nbsp;·&nbsp; Age: <span>${p.age}</span> &nbsp;·&nbsp; Minutes: <span>${p.minutes_played?.toLocaleString()}</span>
        </div>
        ${compInfo ? `<div class="player-meta" style="margin-top:4px">
          <span style="color:var(--accent)">${compInfo}</span> ${genderBadge}
        </div>` : ''}
        <div class="tags" style="margin-top:12px">
          ${top5.map(a => `<span class="tag green" style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">${metricIcons[a] || '📊'}</span>${METRIC_LABELS[a] || a}</span>`).join('')}
          ${bot3.map(a => `<span class="tag red" style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">${metricIcons[a] || '📉'}</span>${METRIC_LABELS[a] || a}</span>`).join('')}
        </div>
      </div>
      <div class="overall-badge">
        <div class="overall-num">${p.overall}</div>
        <div class="overall-label">Avg Percentile</div>
      </div>
    </div>
    
    <div class="grid-3">
      <div class="card">
        <div class="card-label">Attribute Scores (0-100 Percentile)</div>
        <div class="attribute-chart-container">
          <div id="attribute-bars-chart" style="width:100%;height:400px;margin:10px 0;"></div>
        </div>
        <div class="divider"></div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-value">${formatNumber(p.prog_passes_p90, 1)}</div>
            <div class="stat-label">Progressive Passes</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${formatNumber(p.pass_completion, 1)}%</div>
            <div class="stat-label">Pass Accuracy</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${formatNumber(p.key_passes_p90, 1)}</div>
            <div class="stat-label">Key Passes</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Player Analysis</div>
        <div class="radar-wrap" id="radar-overview"></div>
        <div class="divider"></div>
        <div class="card-label">Passing Network</div>
        <div class="chart-container" id="passing-network"></div>
        <div class="divider"></div>
        <div class="card-label">Positional Activity Heatmap</div>
        <div class="chart-container" id="positional-map"></div>
      </div>
      <div class="card">
        <div class="card-label">Role Suitability (Top 3)</div>
        ${Object.entries(ROLES).sort((a, b) => calcRoleFit(p, b[1]) - calcRoleFit(p, a[1])).slice(0, 3).map(([role, weights]) => {
    const fit = calcRoleFit(p, weights);
    const roleIcons = {
      'Poacher': '🥅',
      'Target Man': '🧱',
      'Winger': '🏃‍♂️',
      'Box-to-Box MF': '⚡',
      'Ball-Playing Def': '🛡️',
      'Deep-Lying Playmaker': '🧠',
      'Pressing Winger': '🔥'
    };
    return `
            <div class="role-fit-item">
              <span class="role-name" style="display:flex;align-items:center;gap:10px">
                <span style="font-size:18px">${roleIcons[role] || '👤'}</span>
                ${role}
              </span>
              <div class="role-bar-bg">
                <div class="role-bar-fill" style="width:${fit}%;background:${ROLE_COLORS[role]}"></div>
              </div>
              <span class="role-pct" style="color:${ROLE_COLORS[role]}">${fit}%</span>
            </div>`;
  }).join('')}
        <div class="divider"></div>
        <div class="card-label">Key Metrics (Percentile Rank)</div>
        <div class="metric-grid">
          <div class="metric-item" style="animation-delay: 0.1s">
            <span class="metric-label">⚽ Shots p90</span>
            <span class="metric-value">${formatNumber(p.shots_p90, 1)}</span>
          </div>
          <div class="metric-item" style="animation-delay: 0.2s">
            <span class="metric-label">📈 Expected Goals</span>
            <span class="metric-value">${formatNumber(p.xg_p90, 2)}</span>
          </div>
          <div class="metric-item" style="animation-delay: 0.3s">
            <span class="metric-label">🔥 Dribbles p90</span>
            <span class="metric-value">${formatNumber(p.dribbles_p90, 1)}</span>
          </div>
          <div class="metric-item" style="animation-delay: 0.4s">
            <span class="metric-label">💪 Pressures p90</span>
            <span class="metric-value">${formatNumber(p.pressures_p90, 1)}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render all visualizations
  setTimeout(() => {
    drawRadar('#radar-overview', [p], RADAR_AXES, 220, [['#00e5ff', 0.25]]);

    // Render attribute bars chart
    if (googleChartsLoaded) {
      drawAttributeBars('#attribute-bars-chart', p);
    } else {
      // Fallback to HTML bars if Google Charts not ready
      setTimeout(() => {
        if (googleChartsLoaded) {
          drawAttributeBars('#attribute-bars-chart', p);
        }
      }, 500);
    }
  }, 150);

  // Render heatmap and passing network with slight delay
  console.log('🎯 Calling drawPassingNetwork with selector:', '#passing-network');
  console.log('👥 Player object:', p);
  setTimeout(() => {
    drawPassingNetwork('#passing-network', p);
    drawPositionalHeatmap('#positional-map', p);
  }, 100);
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function initApp() {
  // Initialize Google Charts
  google.charts.load('current', { 'packages': ['corechart'] });
  google.charts.setOnLoadCallback(() => {
    googleChartsLoaded = true;
    console.log('✅ Google Charts loaded successfully');
  });

  // Populate global filters
  populateGlobalFilters();
  document.getElementById('filter-count').textContent = `${PLAYERS.length} player${PLAYERS.length !== 1 ? 's' : ''}`;

  // Wire global filter dropdowns
  document.getElementById('filter-gender').addEventListener('change', onFilterChange);
  document.getElementById('filter-competition').addEventListener('change', onFilterChange);
  document.getElementById('filter-season').addEventListener('change', onSeasonChange);
  document.getElementById('filter-country').addEventListener('change', onCountryChange);

  // Wire module dropdowns
  document.getElementById('overview-select').addEventListener('change', renderOverview);
  document.getElementById('compare-a').addEventListener('change', renderCompare);
  document.getElementById('compare-b').addEventListener('change', renderCompare);
  document.getElementById('role-select').addEventListener('change', renderRoleFit);
  document.getElementById('similar-select').addEventListener('change', renderSimilar);
  document.getElementById('similar-pos-filter').addEventListener('change', renderSimilar);
  document.getElementById('similar-age-filter').addEventListener('change', renderSimilar);

  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    });
  });

  // Initial renders
  refreshAllModules();
}

// ... existing code ...

// Enhanced render function with professional styling and icons
function renderAdvancedOverview() {
  const p = PLAYERS[document.getElementById('overview-select').value];
  if (!p) return;
  const container = document.getElementById('overview-content');

  // Top 5 strengths, bottom 3 weaknesses
  const sorted = [...METRICS].sort((a, b) => (p[b] || 0) - (p[a] || 0));
  const top5 = sorted.slice(0, 5);
  const bot3 = sorted.slice(-3);

  const compInfo = p.competition ? `${p.competition} · ${p.season || ''}` : '';
  const genderBadge = p.gender ? `<span class="tag" style="background:rgba(184,255,87,0.1);border-color:rgba(184,255,87,0.3);color:#b8ff57">${p.gender}</span>` : '';

  // Metric icons mapping
  const metricIcons = {
    'shots_p90': '⚽',
    'xg_p90': '📈',
    'shot_conversion': '🎯',
    'prog_passes_p90': '🔄',
    'pass_completion': '✅',
    'key_passes_p90': '🔑',
    'dribbles_p90': '🔥',
    'pressures_p90': '💪',
    'press_success': '🏆',
    'aerial_win_rate': '🦅',
    'distance_p90': '📍'
  };

  container.innerHTML = `
    <div class="player-header-card">
      <div class="player-avatar">${initials(p.name)}</div>
      <div class="player-info">
        <h2>${p.name}</h2>
        <div class="player-meta">
          Position: <span>${p.position}</span> &nbsp;·&nbsp; Age: <span>${p.age}</span> &nbsp;·&nbsp; Minutes: <span>${p.minutes_played?.toLocaleString()}</span>
        </div>
        ${compInfo ? `<div class="player-meta" style="margin-top:4px">
          <span style="color:var(--accent)">${compInfo}</span> ${genderBadge}
        </div>` : ''}
        <div class="tags" style="margin-top:12px">
          ${top5.map(a => `<span class="tag green" style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">${metricIcons[a] || '📊'}</span>${METRIC_LABELS[a] || a}</span>`).join('')}
          ${bot3.map(a => `<span class="tag red" style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">${metricIcons[a] || '📉'}</span>${METRIC_LABELS[a] || a}</span>`).join('')}
        </div>
      </div>
      <div class="overall-badge">
        <div class="overall-num">${p.overall}</div>
        <div class="overall-label">Avg Percentile</div>
      </div>
    </div>
    
    <div class="grid-3">
      <div class="card">
        <div class="card-label">Attribute Scores (0-100 Percentile)</div>
        <div class="attribute-chart-container">
          <div id="attribute-bars-chart" style="width:100%;height:400px;margin:10px 0;"></div>
        </div>
        <div class="divider"></div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-value">${formatNumber(p.prog_passes_p90, 1)}</div>
            <div class="stat-label">Progressive Passes</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${formatNumber(p.pass_completion, 1)}%</div>
            <div class="stat-label">Pass Accuracy</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${formatNumber(p.key_passes_p90, 1)}</div>
            <div class="stat-label">Key Passes</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Player Analysis</div>
        <div class="radar-wrap" id="radar-overview"></div>
        <div class="divider"></div>
        <div class="card-label">Passing Network</div>
        <div class="chart-container" id="passing-network"></div>
        <div class="divider"></div>
        <div class="card-label">Positional Activity Heatmap</div>
        <div class="chart-container" id="positional-map"></div>
      </div>
      <div class="card">
        <div class="card-label">Role Suitability (Top 3)</div>
        ${Object.entries(ROLES).sort((a, b) => calcRoleFit(p, b[1]) - calcRoleFit(p, a[1])).slice(0, 3).map(([role, weights]) => {
    const fit = calcRoleFit(p, weights);
    const roleIcons = {
      'Poacher': '🥅',
      'Target Man': '🧱',
      'Winger': '🏃‍♂️',
      'Box-to-Box MF': '⚡',
      'Ball-Playing Def': '🛡️',
      'Deep-Lying Playmaker': '🧠',
      'Pressing Winger': '🔥'
    };
    return `
            <div class="role-fit-item">
              <span class="role-name" style="display:flex;align-items:center;gap:10px">
                <span style="font-size:18px">${roleIcons[role] || '👤'}</span>
                ${role}
              </span>
              <div class="role-bar-bg">
                <div class="role-bar-fill" style="width:${fit}%;background:${ROLE_COLORS[role]}"></div>
              </div>
              <span class="role-pct" style="color:${ROLE_COLORS[role]}">${fit}%</span>
            </div>`;
  }).join('')}
        <div class="divider"></div>
        <div class="card-label">Key Metrics (Percentile Rank)</div>
        <div class="metric-grid">
          <div class="metric-item" style="animation-delay: 0.1s">
            <span class="metric-label">⚽ Shots p90</span>
            <span class="metric-value">${formatNumber(p.shots_p90, 1)}</span>
          </div>
          <div class="metric-item" style="animation-delay: 0.2s">
            <span class="metric-label">📈 Expected Goals</span>
            <span class="metric-value">${formatNumber(p.xg_p90, 2)}</span>
          </div>
          <div class="metric-item" style="animation-delay: 0.3s">
            <span class="metric-label">🔥 Dribbles p90</span>
            <span class="metric-value">${formatNumber(p.dribbles_p90, 1)}</span>
          </div>
          <div class="metric-item" style="animation-delay: 0.4s">
            <span class="metric-label">💪 Pressures p90</span>
            <span class="metric-value">${formatNumber(p.pressures_p90, 1)}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render all visualizations
  setTimeout(() => {
    drawRadar('#radar-overview', [p], RADAR_AXES, 220, [['#00e5ff', 0.25]]);

    // Render attribute bars chart
    if (googleChartsLoaded) {
      drawAttributeBars('#attribute-bars-chart', p);
    } else {
      // Fallback to HTML bars if Google Charts not ready
      setTimeout(() => {
        if (googleChartsLoaded) {
          drawAttributeBars('#attribute-bars-chart', p);
        }
      }, 500);
    }
  }, 150);

  // Render heatmap and passing network with slight delay
  console.log('🎯 Calling drawPassingNetwork with selector:', '#passing-network');
  console.log('👥 Player object:', p);
  setTimeout(() => {
    drawPassingNetwork('#passing-network', p);
    drawPositionalHeatmap('#positional-map', p);
  }, 100);
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
const METRIC_LABELS = {
  shots_p90: 'Shots (Score)',
  xg_p90: 'xG (Score)',
  shot_conversion: 'Finishing (Score)',
  prog_passes_p90: 'Prog Passes (Score)',
  pass_completion: 'Pass Acc (Score)',
  key_passes_p90: 'Key Passes (Score)',
  dribbles_p90: 'Dribbles (Score)',
  pressures_p90: 'Pressures (Score)',
  press_success: 'Press Win (Score)',
  aerial_win_rate: 'Aerial Win (Score)',
  distance_p90: 'Distance (Score)'
};

// Radar axes — 6 composite groups for spider chart
const RADAR_AXES = [
  { key: 'attacking', label: 'ATT', metrics: ['shots_p90', 'xg_p90', 'shot_conversion'] },
  { key: 'creative', label: 'CRE', metrics: ['key_passes_p90', 'prog_passes_p90'] },
  { key: 'passing', label: 'PAS', metrics: ['pass_completion', 'prog_passes_p90'] },
  { key: 'dribbling', label: 'DRI', metrics: ['dribbles_p90'] },
  { key: 'defending', label: 'DEF', metrics: ['pressures_p90', 'press_success'] },
  { key: 'physical', label: 'PHY', metrics: ['aerial_win_rate', 'distance_p90'] },
];

// Role templates — weighted metric formulas from the PRD
const ROLES = {
  'Poacher': { shot_conversion: 0.30, xg_p90: 0.25, shots_p90: 0.20, aerial_win_rate: 0.15, press_success: 0.10 },
  'Target Man': { aerial_win_rate: 0.30, xg_p90: 0.25, shot_conversion: 0.20, pressures_p90: 0.15, dribbles_p90: 0.10 },
  'Winger': { dribbles_p90: 0.30, shots_p90: 0.20, key_passes_p90: 0.20, distance_p90: 0.15, press_success: 0.15 },
  'Box-to-Box MF': { distance_p90: 0.25, prog_passes_p90: 0.20, pressures_p90: 0.20, dribbles_p90: 0.15, shots_p90: 0.20 },
  'Ball-Playing Def': { pass_completion: 0.30, prog_passes_p90: 0.25, key_passes_p90: 0.20, aerial_win_rate: 0.15, pressures_p90: 0.10 },
  'Deep-Lying Playmaker': { key_passes_p90: 0.30, pass_completion: 0.30, prog_passes_p90: 0.25, xg_p90: 0.15 },
  'Pressing Winger': { pressures_p90: 0.30, press_success: 0.25, distance_p90: 0.20, dribbles_p90: 0.25 },
};

const ROLE_COLORS = {
  'Poacher': '#ff5e3a',
  'Target Man': '#ffd166',
  'Winger': '#00e5ff',
  'Box-to-Box MF': '#b8ff57',
  'Ball-Playing Def': '#c77dff',
  'Deep-Lying Playmaker': '#4cc9f0',
  'Pressing Winger': '#f72585',
};


// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
function initials(name) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function getBarColor(val) {
  if (val >= 85) return '#b8ff57';
  if (val >= 70) return '#00e5ff';
  if (val >= 55) return '#ffd166';
  return '#ff5e3a';
}

function calcRoleFit(player, roleWeights) {
  let score = 0;
  for (const [attr, weight] of Object.entries(roleWeights)) {
    score += (player[attr] || 0) * weight;
  }
  return Math.round(Math.min(score, 99));
}

function getRadarValue(player, axis) {
  const vals = axis.metrics.map(m => player[m] || 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function euclideanSimilarity(a, b) {
  let sum = 0;
  for (const m of METRICS) {
    sum += Math.pow((a[m] || 0) - (b[m] || 0), 2);
  }
  const dist = Math.sqrt(sum);
  const maxDist = Math.sqrt(METRICS.length * 100 * 100);
  return Math.round((1 - dist / maxDist) * 100);
}

function computeOverall(player) {
  const vals = METRICS.map(m => player[m] || 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** Format player name with competition context for dropdowns */
function playerLabel(p) {
  const comp = p.competition ? ` · ${p.competition}` : '';
  const season = p.season ? ` ${p.season}` : '';
  return `${p.name} (${p.position}, ${p.age}${comp}${season})`;
}


// ─────────────────────────────────────────────
// GLOBAL FILTER LOGIC
// ─────────────────────────────────────────────
function populateGlobalFilters() {
  const genders = [...new Set(ALL_PLAYERS.map(p => p.gender).filter(Boolean))].sort();
  const competitions = [...new Set(ALL_PLAYERS.map(p => p.competition).filter(Boolean))].sort();
  const countries = [...new Set(ALL_PLAYERS.map(p => p.country).filter(Boolean))].sort();

  const genderEl = document.getElementById('filter-gender');
  genderEl.innerHTML = '<option value="all">All</option>';
  genders.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.text = g.charAt(0).toUpperCase() + g.slice(1);
    genderEl.appendChild(opt);
  });

  populateCompetitionFilter(competitions);
  populateCountryFilter(countries);
  updateSeasonFilter();
}

function populateCompetitionFilter(competitions) {
  const el = document.getElementById('filter-competition');
  const current = el.value;
  el.innerHTML = '<option value="all">All Competitions</option>';
  competitions.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.text = c;
    el.appendChild(opt);
  });
  el.value = current || 'all';
}

function populateCountryFilter(countries) {
  const el = document.getElementById('filter-country');
  const current = el.value;
  el.innerHTML = '<option value="all">All Countries</option>';
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.text = c;
    el.appendChild(opt);
  });
  el.value = current || 'all';
}

function updateSeasonFilter() {
  const comp = document.getElementById('filter-competition').value;
  const gender = document.getElementById('filter-gender').value;

  let pool = ALL_PLAYERS;
  if (comp !== 'all') pool = pool.filter(p => p.competition === comp);
  if (gender !== 'all') pool = pool.filter(p => p.gender === gender);

  const seasons = [...new Set(pool.map(p => p.season).filter(Boolean))].sort();
  const el = document.getElementById('filter-season');
  const current = el.value;
  el.innerHTML = '<option value="all">All Seasons</option>';
  seasons.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.text = s;
    el.appendChild(opt);
  });
  // Restore selection if still valid
  if (seasons.includes(current)) el.value = current;
  else el.value = 'all';
}

function applyGlobalFilters() {
  const gender = document.getElementById('filter-gender').value;
  const comp = document.getElementById('filter-competition').value;
  const season = document.getElementById('filter-season').value;
  const country = document.getElementById('filter-country').value;

  PLAYERS = ALL_PLAYERS.filter(p => {
    if (gender !== 'all' && p.gender !== gender) return false;
    if (comp !== 'all' && p.competition !== comp) return false;
    if (season !== 'all' && p.season !== season) return false;
    if (country !== 'all' && p.country !== country) return false;
    return true;
  });

  // Update count badge
  document.getElementById('filter-count').textContent = `${PLAYERS.length} player${PLAYERS.length !== 1 ? 's' : ''}`;

  // Re-populate all module dropdowns & re-render
  refreshAllModules();
}

function onFilterChange() {
  // When competition or gender changes, update available seasons
  updateSeasonFilter();
  applyGlobalFilters();
}

function onSeasonChange() {
  applyGlobalFilters();
}

function onCountryChange() {
  applyGlobalFilters();
}


// ─────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────
async function loadData() {
  try {
    console.log('🚀 Starting data load...');
    console.log('🌍 Checking D3 availability:', typeof d3 !== 'undefined' ? '✅ Available' : '❌ Not available');
    console.log('📊 Checking Google Charts:', typeof google !== 'undefined' && typeof google.charts !== 'undefined' ? '✅ Available' : '❌ Not available');

    const response = await fetch('../data/players.json');
    console.log('📥 Response received:', response.status, response.statusText);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    ALL_PLAYERS = await response.json();
    console.log('✅ Data parsed successfully. Players loaded:', ALL_PLAYERS.length);
    console.log('📋 Sample player:', ALL_PLAYERS[0]);

    // Compute overall rating for each player
    ALL_PLAYERS.forEach(p => {
      p.overall = computeOverall(p);
    });
    console.log('📈 Overall ratings computed');

    // Sort by name for consistent dropdown ordering
    ALL_PLAYERS.sort((a, b) => a.name.localeCompare(b.name));
    console.log('🔄 Players sorted by name');

    // Initial filter setup
    PLAYERS = [...ALL_PLAYERS];
    console.log('🎯 PLAYERS array initialized with', PLAYERS.length, 'players');

    initApp();
    console.log('🎉 App initialized successfully!');
  } catch (err) {
    console.error('💥 Data loading failed:', err);
    console.error('🔧 Error details:', err.stack);
    document.getElementById('overview-content').innerHTML =
      `<p class="loading-msg" style="color:var(--accent2)">Failed to load data: ${err.message}<br>
       Make sure you are running from a local server (e.g. <code>python -m http.server</code>)<br>
       <small>Error occurred at: ${new Date().toLocaleTimeString()}</small></p>`;
  }
}


// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function initApp() {
  // Initialize Google Charts
  google.charts.load('current', { 'packages': ['corechart'] });
  google.charts.setOnLoadCallback(() => {
    googleChartsLoaded = true;
    console.log('✅ Google Charts loaded successfully');
  });

  // Populate global filters
  populateGlobalFilters();
  document.getElementById('filter-count').textContent = `${PLAYERS.length} player${PLAYERS.length !== 1 ? 's' : ''}`;

  // Wire global filter dropdowns
  document.getElementById('filter-gender').addEventListener('change', onFilterChange);
  document.getElementById('filter-competition').addEventListener('change', onFilterChange);
  document.getElementById('filter-season').addEventListener('change', onSeasonChange);
  document.getElementById('filter-country').addEventListener('change', onCountryChange);

  // Wire module dropdowns
  document.getElementById('overview-select').addEventListener('change', renderOverview);
  document.getElementById('compare-a').addEventListener('change', renderCompare);
  document.getElementById('compare-b').addEventListener('change', renderCompare);
  document.getElementById('role-select').addEventListener('change', renderRoleFit);
  document.getElementById('similar-select').addEventListener('change', renderSimilar);
  document.getElementById('similar-pos-filter').addEventListener('change', renderSimilar);
  document.getElementById('similar-age-filter').addEventListener('change', renderSimilar);

  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    });
  });

  // Initial renders
  refreshAllModules();
}

function refreshAllModules() {
  populateSelect('overview-select', 0);
  populateSelect('compare-a', 0);
  populateSelect('compare-b', Math.min(1, PLAYERS.length - 1));
  populateSelect('role-select', 0);
  populateSelect('similar-select', 0);

  renderOverview();
  renderCompare();
  renderRoleFit();
  renderSimilar();
}

function populateSelect(id, selected) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  PLAYERS.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text = playerLabel(p);
    el.appendChild(opt);
  });
  el.value = selected;
}


// ─────────────────────────────────────────────
// D3 RADAR CHART
// ─────────────────────────────────────────────
function drawRadar(selector, players, axes, size, colorOpacity) {
  d3.select(selector).selectAll('*').remove();
  const margin = 40;
  const r = (size - margin * 2) / 2;
  const cx = size / 2, cy = size / 2;
  const n = axes.length;
  const angleSlice = (Math.PI * 2) / n;

  const svg = d3.select(selector)
    .append('svg')
    .attr('width', size).attr('height', size);

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  // Grid rings
  [0.25, 0.5, 0.75, 1].forEach(pct => {
    g.append('circle')
      .attr('r', r * pct)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(30,45,66,0.8)')
      .attr('stroke-width', 1);
    g.append('text')
      .attr('x', 4).attr('y', -r * pct - 2)
      .attr('fill', '#4a6080')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '9')
      .text(Math.round(100 * pct));
  });

  // Axes
  axes.forEach((axis, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', x).attr('y2', y)
      .attr('stroke', 'rgba(30,45,66,0.8)').attr('stroke-width', 1);
    const lx = Math.cos(angle) * (r + 18);
    const ly = Math.sin(angle) * (r + 18);
    g.append('text').attr('x', lx).attr('y', ly)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', '#4a6080')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '10')
      .text(typeof axis === 'string' ? axis.toUpperCase().slice(0, 3) : axis.label);
  });

  // Polygons
  players.forEach((p, pi) => {
    const [color, opacity] = colorOpacity[pi] || ['#00e5ff', 0.2];
    const points = axes.map((axis, i) => {
      const val = typeof axis === 'string'
        ? (p[axis] || 0) / 100
        : getRadarValue(p, axis) / 100;
      const angle = angleSlice * i - Math.PI / 2;
      return [Math.cos(angle) * r * val, Math.sin(angle) * r * val];
    });

    const pathData = points.map((pt, i) =>
      (i === 0 ? 'M' : 'L') + pt[0].toFixed(2) + ',' + pt[1].toFixed(2)
    ).join(' ') + 'Z';

    g.append('path').attr('d', pathData)
      .attr('fill', color).attr('fill-opacity', opacity)
      .attr('stroke', color).attr('stroke-width', 2).attr('stroke-opacity', 0.9);

    // Dots
    points.forEach(([px, py]) => {
      g.append('circle').attr('cx', px).attr('cy', py).attr('r', 3)
        .attr('fill', color).attr('stroke', 'none');
    });
  });
}


// ─────────────────────────────────────────────
// MODULE 1 — PLAYER OVERVIEW
// ─────────────────────────────────────────────
function renderOverview() {
  const p = PLAYERS[document.getElementById('overview-select').value];
  if (!p) return;
  const container = document.getElementById('overview-content');

  // Top 5 strengths, bottom 3 weaknesses
  const sorted = [...METRICS].sort((a, b) => (p[b] || 0) - (p[a] || 0));
  const top5 = sorted.slice(0, 5);
  const bot3 = sorted.slice(-3);

  const compInfo = p.competition ? `${p.competition} · ${p.season || ''}` : '';
  const genderBadge = p.gender ? `<span class="tag" style="background:rgba(184,255,87,0.1);border-color:rgba(184,255,87,0.3);color:#b8ff57">${p.gender}</span>` : '';

  container.innerHTML = `
    <div class="player-header-card">
      <div class="player-avatar">${initials(p.name)}</div>
      <div class="player-info">
        <h2>${p.name}</h2>
        <div class="player-meta">
          Position: <span>${p.position}</span> &nbsp;·&nbsp; Age: <span>${p.age}</span> &nbsp;·&nbsp; Minutes: <span>${p.minutes_played}</span>
        </div>
        ${compInfo ? `<div class="player-meta" style="margin-top:4px">
          <span style="color:var(--accent)">${compInfo}</span> ${genderBadge}
        </div>` : ''}
        <div class="tags" style="margin-top:10px">
          ${top5.map(a => `<span class="tag green">${METRIC_LABELS[a] || a}</span>`).join('')}
          ${bot3.map(a => `<span class="tag red">${METRIC_LABELS[a] || a}</span>`).join('')}
        </div>
      </div>
      <div class="overall-badge">
        <div class="overall-num">${p.overall}</div>
        <div class="overall-label">Overall</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-label">Attribute Breakdown</div>
        ${METRICS.map(attr => `
          <div class="stat-row">
            <span class="stat-name">${METRIC_LABELS[attr] || attr}</span>
            <div class="stat-bar-bg">
              <div class="stat-bar-fill" style="width:${p[attr] || 0}%;background:${getBarColor(p[attr] || 0)}"></div>
            </div>
            <span class="stat-val" style="color:${getBarColor(p[attr] || 0)}">${(p[attr] || 0).toFixed(1)}</span>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-label">Radar Profile</div>
        <div class="radar-wrap" id="radar-overview"></div>
        <div class="divider"></div>
        <div class="card-label">Role Suitability (Top 3)</div>
        ${Object.entries(ROLES).sort((a, b) => calcRoleFit(p, b[1]) - calcRoleFit(p, a[1])).slice(0, 3).map(([role, weights]) => {
    const fit = calcRoleFit(p, weights);
    return `
            <div class="role-fit-item">
              <span class="role-name">${role}</span>
              <div class="role-bar-bg">
                <div class="role-bar-fill" style="width:${fit}%;background:${ROLE_COLORS[role]}"></div>
              </div>
              <span class="role-pct" style="color:${ROLE_COLORS[role]}">${fit}%</span>
            </div>`;
  }).join('')}
      </div>
    </div>
  `;

  drawRadar('#radar-overview', [p], RADAR_AXES, 200, [['#00e5ff', 0.25]]);
}


// ─────────────────────────────────────────────
// MODULE 2 — COMPARISON
// ─────────────────────────────────────────────
function renderCompare() {
  const a = PLAYERS[document.getElementById('compare-a').value];
  const b = PLAYERS[document.getElementById('compare-b').value];
  if (!a || !b) return;

  const container = document.getElementById('compare-content');

  // Count advantages
  let aWins = 0, bWins = 0;
  METRICS.forEach(m => {
    if ((a[m] || 0) > (b[m] || 0)) aWins++;
    else if ((b[m] || 0) > (a[m] || 0)) bWins++;
  });

  const aComp = a.competition ? `<div class="player-meta" style="margin-top:2px"><span style="color:var(--accent)">${a.competition} · ${a.season || ''}</span></div>` : '';
  const bComp = b.competition ? `<div class="player-meta" style="margin-top:2px"><span style="color:var(--accent)">${b.competition} · ${b.season || ''}</span></div>` : '';

  container.innerHTML = `
    <div class="grid-2" style="margin-bottom:20px">
      <div class="player-header-card" style="margin-bottom:0">
        <div class="player-avatar" style="border-color:#00e5ff;color:#00e5ff">${initials(a.name)}</div>
        <div class="player-info">
          <h2 style="color:#00e5ff">${a.name}</h2>
          <div class="player-meta">Position: <span>${a.position}</span> · Age: <span>${a.age}</span></div>
          ${aComp}
        </div>
        <div class="overall-badge" style="border-color:#00e5ff">
          <div class="overall-num">${a.overall}</div>
          <div class="overall-label">Overall</div>
        </div>
      </div>
      <div class="player-header-card" style="margin-bottom:0">
        <div class="player-avatar" style="border-color:#ff5e3a;color:#ff5e3a">${initials(b.name)}</div>
        <div class="player-info">
          <h2 style="color:#ff5e3a">${b.name}</h2>
          <div class="player-meta">Position: <span>${b.position}</span> · Age: <span>${b.age}</span></div>
          ${bComp}
        </div>
        <div class="overall-badge" style="border-color:#ff5e3a">
          <div class="overall-num">${b.overall}</div>
          <div class="overall-label">Overall</div>
        </div>
      </div>
    </div>

    <!-- Verdict -->
    <div class="card" style="margin-bottom:20px;text-align:center;padding:16px">
      <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);letter-spacing:1px">
        <span style="color:#00e5ff">${a.name.split(' ')[0]}</span> leads in <span style="color:#00e5ff">${aWins}</span> of ${METRICS.length} metrics &nbsp;·&nbsp;
        <span style="color:#ff5e3a">${b.name.split(' ')[0]}</span> leads in <span style="color:#ff5e3a">${bWins}</span> of ${METRICS.length} metrics
      </span>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="card-label">Radar Comparison</div>
        <div class="radar-wrap" id="radar-compare"></div>
        <div style="display:flex;gap:20px;justify-content:center;margin-top:12px">
          <span style="display:flex;align-items:center;gap:6px;font-family:'DM Mono',monospace;font-size:11px;color:#00e5ff">
            <span style="width:14px;height:3px;background:#00e5ff;border-radius:2px;display:inline-block"></span>${a.name.split(' ')[0]}
          </span>
          <span style="display:flex;align-items:center;gap:6px;font-family:'DM Mono',monospace;font-size:11px;color:#ff5e3a">
            <span style="width:14px;height:3px;background:#ff5e3a;border-radius:2px;display:inline-block"></span>${b.name.split(' ')[0]}
          </span>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Head-to-Head Bars</div>
        ${METRICS.map(attr => {
    const av = a[attr] || 0, bv = b[attr] || 0;
    return `
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span class="stat-name" style="width:auto;color:${av >= bv ? '#00e5ff' : '#4a6080'}">${av.toFixed(1)}</span>
                <span class="stat-name" style="width:auto;text-align:center;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">${(METRIC_LABELS[attr] || attr).slice(0, 10)}</span>
                <span class="stat-name" style="width:auto;color:${bv >= av ? '#ff5e3a' : '#4a6080'}">${bv.toFixed(1)}</span>
              </div>
              <div style="display:flex;gap:3px;align-items:center">
                <div style="flex:${av};height:5px;background:#00e5ff;border-radius:2px 0 0 2px;margin-left:auto;max-width:${av}%;opacity:${av >= bv ? 1 : 0.35}"></div>
                <div style="flex:${100 - Math.max(av, bv)};min-width:3px"></div>
                <div style="flex:${bv};height:5px;background:#ff5e3a;border-radius:0 2px 2px 0;max-width:${bv}%;opacity:${bv >= av ? 1 : 0.35}"></div>
              </div>
            </div>`;
  }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-label">Difference Analysis</div>
      <table class="diff-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th style="color:#00e5ff">${a.name}</th>
            <th style="color:#ff5e3a">${b.name}</th>
            <th>Difference</th>
            <th>Advantage</th>
          </tr>
        </thead>
        <tbody>
          ${METRICS.map(attr => {
    const av = a[attr] || 0, bv = b[attr] || 0, diff = +(av - bv).toFixed(1);
    return `<tr>
              <td style="font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">${METRIC_LABELS[attr] || attr}</td>
              <td style="color:#00e5ff;font-family:'DM Mono',monospace">${av.toFixed(1)}</td>
              <td style="color:#ff5e3a;font-family:'DM Mono',monospace">${bv.toFixed(1)}</td>
              <td class="${diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : 'diff-neu'}">${diff > 0 ? '+' : ''}${diff}</td>
              <td><span class="tag" style="background:${diff > 0 ? 'rgba(0,229,255,0.1)' : diff < 0 ? 'rgba(255,94,58,0.1)' : 'rgba(74,96,128,0.1)'};border-color:${diff > 0 ? 'rgba(0,229,255,0.3)' : diff < 0 ? 'rgba(255,94,58,0.3)' : 'rgba(74,96,128,0.3)'};color:${diff > 0 ? '#00e5ff' : diff < 0 ? '#ff5e3a' : '#4a6080'}">${diff > 0 ? a.name.split(' ')[0] : diff < 0 ? b.name.split(' ')[0] : 'EQUAL'}</span></td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>
  `;

  drawRadar('#radar-compare', [a, b], RADAR_AXES, 280, [['#00e5ff', 0.2], ['#ff5e3a', 0.2]]);
}


// ─────────────────────────────────────────────
// MODULE 3 — ROLE FIT
// ─────────────────────────────────────────────
function renderRoleFit() {
  const p = PLAYERS[document.getElementById('role-select').value];
  if (!p) return;

  const fits = Object.entries(ROLES).map(([role, weights]) => ({
    role, fit: calcRoleFit(p, weights)
  })).sort((a, b) => b.fit - a.fit);

  const best = fits[0];

  const container = document.getElementById('rolefit-content');
  const compInfo = p.competition ? `${p.competition} · ${p.season || ''}` : '';

  container.innerHTML = `
    <div class="player-header-card" style="margin-bottom:24px">
      <div class="player-avatar">${initials(p.name)}</div>
      <div class="player-info">
        <h2>${p.name}</h2>
        <div class="player-meta">Best Fit: <span style="color:${ROLE_COLORS[best.role]}">${best.role}</span> at <span style="color:${ROLE_COLORS[best.role]}">${best.fit}%</span></div>
        ${compInfo ? `<div class="player-meta" style="margin-top:2px"><span style="color:var(--accent)">${compInfo}</span></div>` : ''}
      </div>
      <div class="overall-badge">
        <div class="overall-num">${p.overall}</div>
        <div class="overall-label">Overall</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-label">Role Fit Scores</div>
        ${fits.map(({ role, fit }) => `
          <div class="role-fit-item">
            <span class="role-name">${role}</span>
            <div class="role-bar-bg">
              <div class="role-bar-fill" style="width:${fit}%;background:${ROLE_COLORS[role]}"></div>
            </div>
            <span class="role-pct" style="color:${ROLE_COLORS[role]}">${fit}%</span>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-label">Top Role — Key Attributes</div>
        ${Object.entries(ROLES[best.role]).sort((a, b) => b[1] - a[1]).map(([attr, weight]) => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">${METRIC_LABELS[attr] || attr}</span>
              <span style="font-family:'DM Mono',monospace;font-size:11px;color:${ROLE_COLORS[best.role]}">Weight: ${Math.round(weight * 100)}%</span>
            </div>
            <div class="stat-bar-bg" style="height:8px">
              <div class="stat-bar-fill" style="width:${p[attr] || 0}%;background:${ROLE_COLORS[best.role]}"></div>
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:11px;color:${ROLE_COLORS[best.role]};margin-top:3px;text-align:right">${(p[attr] || 0).toFixed(1)}</div>
          </div>
        `).join('')}
        <div class="divider"></div>
        <div class="card-label">Radar — Best Role Attributes</div>
        <div class="radar-wrap" id="radar-role"></div>
      </div>
    </div>

    <!-- Leaderboard -->
    <div class="card" style="margin-top:20px">
      <div class="card-label">All Players — Ranked by Best Role (${best.role})</div>
      <table class="diff-table">
        <thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Age</th><th>Overall</th><th>Fit Score</th></tr></thead>
        <tbody>
          ${PLAYERS.map(pl => ({ ...pl, fit: calcRoleFit(pl, ROLES[best.role]) }))
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 20)
      .map((pl, i) => `<tr>
              <td style="color:var(--muted);font-family:'DM Mono',monospace">${i + 1}</td>
              <td style="font-weight:500;${pl.player_id === p.player_id ? `color:${ROLE_COLORS[best.role]}` : ''}">${pl.name}</td>
              <td style="font-family:'DM Mono',monospace;color:var(--muted)">${pl.position}</td>
              <td style="font-family:'DM Mono',monospace">${pl.age}</td>
              <td style="font-family:'DM Mono',monospace">${pl.overall}</td>
              <td><span class="role-pct" style="color:${ROLE_COLORS[best.role]};font-size:16px">${pl.fit}%</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Radar for the best role's key attributes
  const roleAxes = Object.keys(ROLES[best.role]).slice(0, 6);
  drawRadar('#radar-role', [p], roleAxes, 220, [[ROLE_COLORS[best.role], 0.25]]);
}


// ─────────────────────────────────────────────
// MODULE 4 — SIMILAR PLAYERS
// ─────────────────────────────────────────────
function renderSimilar() {
  const ref = PLAYERS[document.getElementById('similar-select').value];
  if (!ref) return;
  const posFilter = document.getElementById('similar-pos-filter').value;
  const ageFilter = parseInt(document.getElementById('similar-age-filter').value);

  let pool = PLAYERS.filter(p => p.player_id !== ref.player_id || p.competition !== ref.competition || p.season !== ref.season);
  if (posFilter !== 'all') pool = pool.filter(p => p.position === posFilter);
  pool = pool.filter(p => p.age <= ageFilter);

  const scored = pool.map(p => ({ ...p, sim: euclideanSimilarity(ref, p) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  const container = document.getElementById('similar-content');
  const compInfo = ref.competition ? `${ref.competition} · ${ref.season || ''}` : '';

  container.innerHTML = `
    <div class="player-header-card" style="margin-bottom:24px">
      <div class="player-avatar" style="border-color:var(--accent3);color:var(--accent3)">${initials(ref.name)}</div>
      <div class="player-info">
        <h2>${ref.name}</h2>
        <div class="player-meta">Finding similar profiles… <span>Position: ${ref.position}</span> · <span>Age: ${ref.age}</span> · <span>OVR: ${ref.overall}</span></div>
        ${compInfo ? `<div class="player-meta" style="margin-top:2px"><span style="color:var(--accent)">${compInfo}</span></div>` : ''}
      </div>
      <div class="overall-badge" style="border-color:var(--accent3)">
        <div class="overall-num" style="color:var(--accent3)">${ref.overall}</div>
        <div class="overall-label">Reference</div>
      </div>
    </div>

    ${scored.length === 0 ? `<div class="card"><p style="color:var(--muted);font-family:'DM Mono',monospace">No players match the current filters.</p></div>` : `
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px">
        ${scored.map((p, i) => `
          <div class="sim-card">
            <div class="sim-rank">${i + 1}</div>
            <div class="sim-avatar" style="border-color:${p.sim >= 85 ? 'var(--accent3)' : p.sim >= 75 ? 'var(--accent)' : 'var(--border)'};color:${p.sim >= 85 ? 'var(--accent3)' : p.sim >= 75 ? 'var(--accent)' : 'var(--muted)'}">${initials(p.name)}</div>
            <div class="sim-info">
              <h4>${p.name}</h4>
              <div class="sim-meta">${p.position} · AGE ${p.age} · OVR ${p.overall}${p.competition ? ` · ${p.competition}` : ''}</div>
            </div>
            <div class="sim-score">
              <div class="pct" style="color:${p.sim >= 85 ? 'var(--accent3)' : p.sim >= 75 ? 'var(--accent)' : 'var(--muted)'}">${p.sim}%</div>
              <div class="lbl">Similarity</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-label">Radar — Reference vs Top Match</div>
        <div class="radar-wrap" id="radar-similar"></div>
        <div style="display:flex;gap:20px;justify-content:center;margin-top:12px">
          <span style="display:flex;align-items:center;gap:6px;font-family:'DM Mono',monospace;font-size:11px;color:var(--accent3)">
            <span style="width:14px;height:3px;background:var(--accent3);border-radius:2px;display:inline-block"></span>${ref.name}
          </span>
          <span style="display:flex;align-items:center;gap:6px;font-family:'DM Mono',monospace;font-size:11px;color:var(--accent)">
            <span style="width:14px;height:3px;background:var(--accent);border-radius:2px;display:inline-block"></span>${scored[0].name} (Top Match)
          </span>
        </div>
      </div>
    `}
  `;

  if (scored.length > 0) {
    drawRadar('#radar-similar', [ref, scored[0]], RADAR_AXES, 280, [['#b8ff57', 0.2], ['#00e5ff', 0.2]]);
  }
}


// ─────────────────────────────────────────────
// ENHANCED VISUALIZATION FUNCTIONS
// ─────────────────────────────────────────────

function calculatePassingMetrics(player) {
  // Generate realistic passing network data based on player stats
  const positionMultipliers = {
    'GK': { short: 0.8, long: 0.1, progressive: 0.1 },
    'DF': { short: 0.7, long: 0.2, progressive: 0.1 },
    'MF': { short: 0.5, long: 0.3, progressive: 0.2 },
    'FW': { short: 0.4, long: 0.2, progressive: 0.4 }
  };

  const multipliers = positionMultipliers[player.position] || positionMultipliers.MF;
  const totalPasses = player.prog_passes_p90 + (player.pass_completion * 0.5);

  return {
    shortPasses: Math.round(totalPasses * multipliers.short * (0.8 + Math.random() * 0.4)),
    longPasses: Math.round(totalPasses * multipliers.long * (0.8 + Math.random() * 0.4)),
    progressivePasses: Math.round(totalPasses * multipliers.progressive * (0.8 + Math.random() * 0.4)),
    passAccuracy: player.pass_completion,
    keyPasses: player.key_passes_p90
  };
}

function drawPassingNetwork(selector, player) {
  console.log('🔄 Drawing passing network for:', player.name, player.position);
  console.log('📊 Player data:', {
    prog_passes_p90: player.prog_passes_p90,
    pass_completion: player.pass_completion,
    key_passes_p90: player.key_passes_p90
  });

  // Check if container exists
  const container = document.querySelector(selector);
  console.log('📦 Container element:', container);
  if (!container) {
    console.error('❌ Container not found for selector:', selector);
    return;
  }

  // Robust D3.js availability check
  if (typeof d3 === 'undefined' || !d3 || typeof d3.select !== 'function') {
    console.error('❌ D3.js not properly loaded or unavailable for passing network');
    // Fallback: Show error message in the container
    const container = document.querySelector(selector);
    if (container) {
      container.innerHTML = '<div style="color: #ff5e3a; text-align: center; padding: 20px; font-family: DM Sans, sans-serif;">Passing network unavailable - D3.js not loaded</div>';
    }
    return;
  }

  try {
    const data = calculatePassingMetrics(player);
    console.log('📈 Calculated passing metrics:', data);
    d3.select(selector).selectAll('*').remove();

    const width = 300, height = 200;
    const svg = d3.select(selector)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Enhanced background with gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'fieldGradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(18,29,46,0.4)');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(13,21,32,0.6)');

    svg.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', width).attr('height', height)
      .attr('fill', 'url(#fieldGradient)')
      .attr('stroke', 'rgba(30,45,66,0.7)')
      .attr('stroke-width', 1.5)
      .style('opacity', 0)
      .transition().duration(1000).ease(d3.easeElasticOut)
      .style('opacity', 1);

    // Animated pitch markings with glow effect
    svg.append('line')
      .attr('x1', width / 2).attr('y1', 20)
      .attr('x2', width / 2).attr('y2', 20)
      .attr('stroke', 'rgba(30,45,66,0.8)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '6,4')
      .transition().duration(1200).delay(300)
      .attr('y2', height - 20);

    // Center circle with pulsing effect
    svg.append('circle')
      .attr('cx', width / 2).attr('cy', height / 2)
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(30,45,66,0.8)')
      .attr('stroke-width', 1)
      .transition().duration(1500).delay(500)
      .attr('r', 22);

    // Player position indicator with advanced animation
    const positionY = player.position === 'GK' ? 30 :
      player.position === 'DF' ? 70 :
        player.position === 'MF' ? height / 2 :
          height - 70;

    // Outer glow circle
    const glowCircle = svg.append('circle')
      .attr('cx', width / 2)
      .attr('cy', positionY)
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', '#00e5ff')
      .attr('stroke-width', 3)
      .attr('opacity', 0)
      .transition().duration(800).delay(800)
      .attr('r', 15)
      .attr('opacity', 0.4)
      .transition().duration(2000)
      .attr('opacity', 0)
      .on('end', function repeat() {
        d3.select(this)
          .attr('r', 0)
          .attr('opacity', 0.4)
          .transition().duration(800)
          .attr('r', 15)
          .attr('opacity', 0)
          .on('end', repeat);
      });

    // Main player circle
    const playerCircle = svg.append('circle')
      .attr('cx', width / 2)
      .attr('cy', positionY)
      .attr('r', 0)
      .attr('fill', '#00e5ff')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 0)
      .transition().duration(700).delay(900)
      .attr('r', 9)
      .transition().duration(500)
      .attr('stroke-width', 2);

    // Add subtle inner highlight
    svg.append('circle')
      .attr('cx', width / 2)
      .attr('cy', positionY)
      .attr('r', 4)
      .attr('fill', 'rgba(255,255,255,0.3)')
      .style('opacity', 0)
      .transition().delay(1600).duration(600).style('opacity', 1);

    // Enhanced pass connection lines with particle effects
    const connections = [
      { x1: width / 2, y1: positionY, x2: width / 4, y2: height / 3, count: data.shortPasses, color: '#00e5ff', type: 'short', delay: 400 },
      { x1: width / 2, y1: positionY, x2: width * 3 / 4, y2: height / 3, count: data.shortPasses, color: '#00e5ff', type: 'short', delay: 600 },
      { x1: width / 2, y1: positionY, x2: width / 3, y2: height * 2 / 3, count: data.longPasses, color: '#b8ff57', type: 'long', delay: 800 },
      { x1: width / 2, y1: positionY, x2: width * 2 / 3, y2: height * 2 / 3, count: data.progressivePasses, color: '#ff5e3a', type: 'progressive', delay: 1000 }
    ];

    connections.forEach((conn, i) => {
      // Main connection line with trail effect
      svg.append('line')
        .attr('x1', conn.x1).attr('y1', conn.y1)
        .attr('x2', conn.x1).attr('y2', conn.y1)
        .attr('stroke', conn.color)
        .attr('stroke-width', 0)
        .attr('opacity', 0)
        .attr('stroke-linecap', 'round')
        .transition().delay(conn.delay).duration(900)
        .attr('x2', conn.x2).attr('y2', conn.y2)
        .attr('stroke-width', Math.max(2, conn.count / 12))
        .attr('opacity', 0.8);

      // Animated labels with scale effect
      svg.append('text')
        .attr('x', (conn.x1 + conn.x2) / 2)
        .attr('y', (conn.y1 + conn.y2) / 2 - 8)
        .attr('fill', conn.color)
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('text-anchor', 'middle')
        .attr('opacity', 0)
        .attr('transform', 'scale(0.8)')
        .text(conn.count)
        .transition().delay(conn.delay + 700).duration(600)
        .attr('opacity', 1)
        .attr('transform', 'scale(1)');

      // Connection type indicator
      const midX = (conn.x1 + conn.x2) / 2;
      const midY = (conn.y1 + conn.y2) / 2;

      svg.append('circle')
        .attr('cx', midX)
        .attr('cy', midY)
        .attr('r', 0)
        .attr('fill', conn.color)
        .attr('opacity', 0)
        .transition().delay(conn.delay + 500).duration(400)
        .attr('r', 3)
        .attr('opacity', 0.7)
        .transition().duration(300)
        .attr('r', 2)
        .attr('opacity', 0.9);
    });

    // Enhanced legend with clear attribute explanations
    const legendGroup = svg.append('g')
      .attr('transform', `translate(12,${height - 55})`);

    // Apply transition separately
    legendGroup
      .style('opacity', 0)
      .transition().delay(1400).duration(700)
      .style('opacity', 1);

    // Legend background with better styling
    legendGroup.append('rect')
      .attr('x', -8).attr('y', -8)
      .attr('width', 120).attr('height', 60)
      .attr('fill', 'rgba(18,29,46,0.85)')
      .attr('stroke', 'rgba(30,45,66,0.7)')
      .attr('stroke-width', 1)
      .attr('rx', 5);

    // Clear attribute mapping
    const legendItems = [
      { color: '#00e5ff', label: 'Short Passes', icon: '🔄' },
      { color: '#b8ff57', label: 'Long Passes', icon: '⏩' },
      { color: '#ff5e3a', label: 'Progressive', icon: '🚀' }
    ];

    legendItems.forEach((item, i) => {
      // Color indicator
      legendGroup.append('circle')
        .attr('cx', 8)
        .attr('cy', i * 18 + 5)
        .attr('r', 4)
        .attr('fill', item.color);

      // Icon
      legendGroup.append('text')
        .attr('x', 20)
        .attr('y', i * 18 + 8)
        .attr('fill', item.color)
        .attr('font-size', '12px')
        .text(item.icon);

      // Label
      legendGroup.append('text')
        .attr('x', 35)
        .attr('y', i * 18 + 9)
        .attr('fill', '#e8f0f8')
        .attr('font-family', 'DM Sans, sans-serif')
        .attr('font-size', '10px')
        .attr('font-weight', '500')
        .text(item.label);
    });
  } catch (error) {
    console.error('💥 Error rendering passing network:', error);
    console.error('🔧 Error stack:', error.stack);
    const container = document.querySelector(selector);
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; font-family: DM Sans, sans-serif;">
          <div style="color: #ff5e3a; margin-bottom: 10px;">⚠️ Passing Network Visualization Failed</div>
          <div style="color: #4a6080; font-size: 14px; margin-bottom: 15px;">
            Player: ${player.name}<br>
            Position: ${player.position}<br>
            Progressive Passes: ${player.prog_passes_p90 || 0}<br>
            Pass Completion: ${player.pass_completion || 0}%<br>
            Key Passes: ${player.key_passes_p90 || 0}
          </div>
          <div style="color: #4a6080; font-size: 12px;">
            Technical error occurred during visualization rendering
          </div>
        </div>
      `;
    }
  }
}

function generatePositionalActivityData(player) {
  // Generate realistic positional data based on player role and movement patterns
  const basePositions = {
    'GK': { x: 0.5, y: 0.1, spread: 0.2 },
    'DF': { x: 0.5, y: 0.3, spread: 0.4 },
    'MF': { x: 0.5, y: 0.5, spread: 0.6 },
    'FW': { x: 0.5, y: 0.7, spread: 0.5 }
  };

  const base = basePositions[player.position] || basePositions.MF;
  const activityLevel = player.distance_p90 / 100; // Normalize distance

  const activityPoints = [];
  const pointCount = Math.floor(150 + activityLevel * 250);

  for (let i = 0; i < pointCount; i++) {
    // Generate clustered points around player's typical position
    const x = base.x + (Math.random() - 0.5) * base.spread * (0.5 + activityLevel * 0.5);
    const y = base.y + (Math.random() - 0.5) * base.spread * (0.5 + activityLevel * 0.5);

    // Keep within field bounds
    if (x > 0.1 && x < 0.9 && y > 0.1 && y < 0.9) {
      activityPoints.push({
        x: x,
        y: y,
        intensity: Math.random() * 0.8 + 0.2,
        size: Math.random() * 3 + 2
      });
    }
  }

  return activityPoints;
}

function drawPositionalHeatmap(selector, player) {
  console.log('🎨 Drawing positional heatmap for:', player.name, player.position);

  // Robust D3.js availability check
  if (typeof d3 === 'undefined' || !d3 || typeof d3.select !== 'function') {
    console.error('❌ D3.js not properly loaded or unavailable');
    // Fallback: Show error message in the container
    const container = document.querySelector(selector);
    if (container) {
      container.innerHTML = '<div style="color: #ff5e3a; text-align: center; padding: 20px; font-family: DM Sans, sans-serif;">Heatmap unavailable - D3.js not loaded</div>';
    }
    return;
  }

  try {
    const data = generatePositionalActivityData(player);
    console.log('📊 Generated', data.length, 'activity points');
    d3.select(selector).selectAll('*').remove();

    const width = 300, height = 200;
    const svg = d3.select(selector)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Enhanced background with subtle field texture
    const defs = svg.append('defs');
    const pattern = defs.append('pattern')
      .attr('id', 'fieldPattern')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse');

    pattern.append('rect')
      .attr('width', 20)
      .attr('height', 20)
      .attr('fill', 'rgba(18,29,46,0.4)');

    pattern.append('path')
      .attr('d', 'M 0 10 L 20 10 M 10 0 L 10 20')
      .attr('stroke', 'rgba(30,45,66,0.2)')
      .attr('stroke-width', 0.5);

    svg.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', width).attr('height', height)
      .attr('fill', 'url(#fieldPattern)')
      .attr('stroke', 'rgba(30,45,66,0.7)')
      .attr('stroke-width', 1.5);

    // Enhanced heatmap circles with better clustering
    const intensityScale = d3.scaleLinear()
      .domain([0, 1])
      .range(['rgba(0,229,255,0.3)', 'rgba(0,229,255,0.9)']);

    // Add subtle background activity
    svg.selectAll('.background-activity')
      .data(d3.range(30))
      .enter()
      .append('circle')
      .attr('cx', () => Math.random() * width)
      .attr('cy', () => Math.random() * height)
      .attr('r', () => Math.random() * 3 + 1)
      .attr('fill', 'rgba(0,229,255,0.1)');

    // Main activity points - immediate rendering
    svg.selectAll('.activity-point')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => d.x * width)
      .attr('cy', d => d.y * height)
      .attr('r', d => d.size)
      .attr('fill', d => intensityScale(d.intensity))
      .attr('stroke', 'none')
      .attr('opacity', d => 0.6 + d.intensity * 0.4);

    // Player position marker
    const positionMarkers = {
      'GK': { x: 0.5, y: 0.1, label: 'Goalkeeper' },
      'DF': { x: 0.5, y: 0.3, label: 'Defender' },
      'MF': { x: 0.5, y: 0.5, label: 'Midfielder' },
      'FW': { x: 0.5, y: 0.7, label: 'Forward' }
    };

    const marker = positionMarkers[player.position] || positionMarkers.MF;

    // Outer glow ring
    svg.append('circle')
      .attr('cx', marker.x * width)
      .attr('cy', marker.y * height)
      .attr('r', 15)
      .attr('fill', 'none')
      .attr('stroke', '#00e5ff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.7);

    // Main player marker
    svg.append('circle')
      .attr('cx', marker.x * width)
      .attr('cy', marker.y * height)
      .attr('r', 8)
      .attr('fill', '#00e5ff')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Position label
    svg.append('text')
      .attr('x', marker.x * width)
      .attr('y', marker.y * height + 25)
      .attr('fill', '#00e5ff')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .text(marker.label);

    // Pitch markings
    svg.append('line')
      .attr('x1', width / 2).attr('y1', 20)
      .attr('x2', width / 2).attr('y2', height - 20)
      .attr('stroke', 'rgba(30,45,66,0.8)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '6,4');

    // Legend - using direct SVG elements instead of D3 selections
    const legendGroup = svg.append('g')
      .attr('transform', `translate(${width - 90},15)`);

    // Legend background
    legendGroup.append('rect')
      .attr('x', -8).attr('y', -8)
      .attr('width', 95).attr('height', 85)
      .attr('fill', 'rgba(18,29,46,0.85)')
      .attr('stroke', 'rgba(30,45,66,0.7)')
      .attr('stroke-width', 1)
      .attr('rx', 5);

    // Color scale indicators
    const legendColors = [
      { offset: 0, color: 'rgba(0,229,255,0.3)', label: 'Low Activity' },
      { offset: 1, color: 'rgba(0,229,255,0.9)', label: 'High Activity' }
    ];

    legendColors.forEach((item, i) => {
      legendGroup.append('rect')
        .attr('x', 0)
        .attr('y', i * 25)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', item.color)
        .attr('stroke', 'rgba(0,229,255,0.5)')
        .attr('stroke-width', 1);

      legendGroup.append('text')
        .attr('x', 20)
        .attr('y', i * 25 + 12)
        .attr('fill', '#4a6080')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '9px')
        .text(item.label);
    });

    // Player position indicator
    legendGroup.append('circle')
      .attr('cx', 7)
      .attr('cy', 65)
      .attr('r', 4)
      .attr('fill', '#00e5ff')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);

    legendGroup.append('text')
      .attr('x', 20)
      .attr('y', 68)
      .attr('fill', '#4a6080')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '9px')
      .text(`${player.position} Position`);

    console.log('✅ Heatmap rendered successfully');
  } catch (error) {
    console.error('💥 Error rendering heatmap:', error);
    const container = document.querySelector(selector);
    if (container) {
      container.innerHTML = '<div style="color: #ff5e3a; text-align: center; padding: 20px; font-family: DM Sans, sans-serif;">Error rendering heatmap</div>';
    }
  }
}

// FIFA-style HTML/CSS attribute bars — full 16 attributes
function drawAttributeBars(selector, player) {
  const container = document.querySelector(selector);
  if (!container) return;

  // Helper: clamp value between 0–100
  function clamp(v) { return Math.round(Math.max(0, Math.min(100, v))); }

  // Derive all 16 FIFA attributes — position-aware formulas
  const p = player;
  const pos = (p.position || '').toUpperCase();
  const isFW = pos === 'FW';
  const isDF = pos === 'DF';
  const isGK = pos === 'GK';
  const isMF = pos === 'MF';

  // --- Position-aware attribute builders ---
  let positioning, finishing, shooting, longshots, defending, reactions;
  let pace, dribbling, stamina, physical;

  if (isFW) {
    // Attackers: pace = explosive speed with the ball
    pace = clamp((p.dribbles_p90 || 0) * 0.5 + (p.distance_p90 || 0) * 0.3 + (p.pressures_p90 || 0) * 0.2);
    dribbling = clamp((p.dribbles_p90 || 0) * 0.7 + (p.distance_p90 || 0) * 0.3);
    stamina = clamp((p.distance_p90 || 0) * 0.5 + (p.pressures_p90 || 0) * 0.3 + (p.dribbles_p90 || 0) * 0.2);
    physical = clamp((p.aerial_win_rate || 0) * 0.3 + (p.distance_p90 || 0) * 0.35 + (p.pressures_p90 || 0) * 0.35);
    positioning = clamp((p.xg_p90 || 0) * 0.5 + (p.shots_p90 || 0) * 0.3 + (p.shot_conversion || 0) * 0.2);
    finishing = clamp((p.shot_conversion || 0) * 0.6 + (p.xg_p90 || 0) * 0.4);
    shooting = clamp((p.shots_p90 || 0) * 0.5 + (p.xg_p90 || 0) * 0.3 + (p.shot_conversion || 0) * 0.2);
    longshots = clamp((p.shots_p90 || 0) * 0.6 + (p.xg_p90 || 0) * 0.2 + (p.distance_p90 || 0) * 0.2);
    defending = clamp((p.pressures_p90 || 0) * 0.5 + (p.press_success || 0) * 0.3 + (p.aerial_win_rate || 0) * 0.2);
    reactions = clamp((p.dribbles_p90 || 0) * 0.4 + (p.press_success || 0) * 0.3 + (p.shots_p90 || 0) * 0.3);
  } else if (isDF || isGK) {
    // Defenders/GK: pace = closing-down speed & pitch coverage
    pace = clamp((p.distance_p90 || 0) * 0.4 + (p.pressures_p90 || 0) * 0.4 + (p.press_success || 0) * 0.2);
    dribbling = clamp((p.dribbles_p90 || 0) * 0.4 + (p.prog_passes_p90 || 0) * 0.3 + (p.pass_completion || 0) * 0.3);
    stamina = clamp((p.distance_p90 || 0) * 0.4 + (p.pressures_p90 || 0) * 0.4 + (p.aerial_win_rate || 0) * 0.2);
    physical = clamp((p.aerial_win_rate || 0) * 0.4 + (p.pressures_p90 || 0) * 0.3 + (p.distance_p90 || 0) * 0.3);
    positioning = clamp((p.press_success || 0) * 0.4 + (p.pressures_p90 || 0) * 0.35 + (p.aerial_win_rate || 0) * 0.25);
    finishing = clamp((p.shot_conversion || 0) * 0.5 + (p.xg_p90 || 0) * 0.3 + (p.shots_p90 || 0) * 0.2);
    shooting = clamp((p.shots_p90 || 0) * 0.4 + (p.xg_p90 || 0) * 0.3 + (p.shot_conversion || 0) * 0.3);
    longshots = clamp((p.shots_p90 || 0) * 0.4 + (p.prog_passes_p90 || 0) * 0.3 + (p.distance_p90 || 0) * 0.3);
    defending = clamp((p.pressures_p90 || 0) * 0.35 + (p.press_success || 0) * 0.35 + (p.aerial_win_rate || 0) * 0.3);
    reactions = clamp((p.press_success || 0) * 0.5 + (p.pressures_p90 || 0) * 0.3 + (p.aerial_win_rate || 0) * 0.2);
  } else {
    // Midfielders: balanced blend
    pace = clamp((p.distance_p90 || 0) * 0.35 + (p.dribbles_p90 || 0) * 0.35 + (p.pressures_p90 || 0) * 0.3);
    dribbling = clamp((p.dribbles_p90 || 0) * 0.6 + (p.distance_p90 || 0) * 0.2 + (p.key_passes_p90 || 0) * 0.2);
    stamina = clamp((p.distance_p90 || 0) * 0.4 + (p.pressures_p90 || 0) * 0.35 + (p.dribbles_p90 || 0) * 0.25);
    physical = clamp((p.aerial_win_rate || 0) * 0.3 + (p.distance_p90 || 0) * 0.35 + (p.pressures_p90 || 0) * 0.35);
    positioning = clamp((p.xg_p90 || 0) * 0.3 + (p.pressures_p90 || 0) * 0.25 + (p.press_success || 0) * 0.25 + (p.key_passes_p90 || 0) * 0.2);
    finishing = clamp((p.shot_conversion || 0) * 0.5 + (p.xg_p90 || 0) * 0.3 + (p.shots_p90 || 0) * 0.2);
    shooting = clamp((p.shots_p90 || 0) * 0.4 + (p.xg_p90 || 0) * 0.3 + (p.shot_conversion || 0) * 0.3);
    longshots = clamp((p.shots_p90 || 0) * 0.5 + (p.xg_p90 || 0) * 0.2 + (p.distance_p90 || 0) * 0.3);
    defending = clamp((p.pressures_p90 || 0) * 0.4 + (p.press_success || 0) * 0.4 + (p.aerial_win_rate || 0) * 0.2);
    reactions = clamp((p.press_success || 0) * 0.35 + (p.pressures_p90 || 0) * 0.3 + (p.dribbles_p90 || 0) * 0.35);
  }

  const fifaAttrs = [
    { name: 'PACE', value: pace },
    { name: 'SHOOTING', value: shooting },
    { name: 'PASSING', value: clamp((p.pass_completion || 0) * 0.5 + (p.prog_passes_p90 || 0) * 0.3 + (p.key_passes_p90 || 0) * 0.2) },
    { name: 'DRIBBLING', value: dribbling },
    { name: 'DEFENDING', value: defending },
    { name: 'PHYSICAL', value: physical },
    { name: 'FINISHING', value: finishing },
    { name: 'HEADING', value: clamp((p.aerial_win_rate || 0) * 0.8 + (p.pressures_p90 || 0) * 0.2) },
    { name: 'LONGSHOTS', value: longshots },
    { name: 'CROSSING', value: clamp((p.key_passes_p90 || 0) * 0.5 + (p.prog_passes_p90 || 0) * 0.3 + (p.pass_completion || 0) * 0.2) },
    { name: 'VISION', value: clamp((p.key_passes_p90 || 0) * 0.4 + (p.prog_passes_p90 || 0) * 0.4 + (p.pass_completion || 0) * 0.2) },
    { name: 'STAMINA', value: stamina },
    { name: 'STRENGTH', value: clamp((p.aerial_win_rate || 0) * 0.5 + (p.pressures_p90 || 0) * 0.3 + (p.press_success || 0) * 0.2) },
    { name: 'AGGRESSION', value: clamp((p.pressures_p90 || 0) * 0.5 + (p.press_success || 0) * 0.3 + (p.distance_p90 || 0) * 0.2) },
    { name: 'POSITIONING', value: positioning },
    { name: 'REACTIONS', value: reactions },
  ];

  function getBarColor(val) {
    if (val >= 90) return '#b8ff57'; // Bright Green (Elite)
    if (val >= 80) return '#00e5ff'; // Cyan (Great)
    if (val >= 70) return '#ffd166'; // Yellow (Good)
    if (val >= 50) return '#ffaa00'; // Orange (Average)
    return '#ff5e3a';                // Red (Poor)
  }

  let html = '<div class="fifa-attribute-breakdown">';

  fifaAttrs.forEach((attr) => {
    const color = getBarColor(attr.value);
    html += `
      <div class="fifa-attr-row">
        <span class="fifa-attr-name">${attr.name}</span>
        <div class="fifa-attr-bar-bg">
          <div class="fifa-attr-bar-fill" data-width="${attr.value}" style="width: 0%; background: ${color};"></div>
        </div>
        <span class="fifa-attr-value" style="color: ${color};">${attr.value}</span>
      </div>`;
  });

  html += '</div>';
  container.innerHTML = html;

  // Animate bars in with stagger
  setTimeout(() => {
    const fills = container.querySelectorAll('.fifa-attr-bar-fill');
    fills.forEach((bar, i) => {
      setTimeout(() => {
        bar.style.width = bar.dataset.width + '%';
      }, i * 40);
    });
  }, 50);
}

// Enhanced render function with professional styling and icons
function renderAdvancedOverview() {
  const p = PLAYERS[document.getElementById('overview-select').value];
  if (!p) return;
  const container = document.getElementById('overview-content');

  // Top 5 strengths, bottom 3 weaknesses
  const sorted = [...METRICS].sort((a, b) => (p[b] || 0) - (p[a] || 0));
  const top5 = sorted.slice(0, 5);
  const bot3 = sorted.slice(-3);

  const compInfo = p.competition ? `${p.competition} · ${p.season || ''}` : '';
  const genderBadge = p.gender ? `<span class="tag" style="background:rgba(184,255,87,0.1);border-color:rgba(184,255,87,0.3);color:#b8ff57">${p.gender}</span>` : '';

  // Metric icons mapping
  const metricIcons = {
    'shots_p90': '⚽',
    'xg_p90': '📈',
    'shot_conversion': '🎯',
    'prog_passes_p90': '🔄',
    'pass_completion': '✅',
    'key_passes_p90': '🔑',
    'dribbles_p90': '🔥',
    'pressures_p90': '💪',
    'press_success': '🏆',
    'aerial_win_rate': '🦅',
    'distance_p90': '📍'
  };

  container.innerHTML = `
    <div class="player-header-card">
      <div class="player-avatar">${initials(p.name)}</div>
      <div class="player-info">
        <h2>${p.name}</h2>
        <div class="player-meta">
          Position: <span>${p.position}</span> &nbsp;·&nbsp; Age: <span>${p.age}</span> &nbsp;·&nbsp; Minutes: <span>${p.minutes_played?.toLocaleString()}</span>
        </div>
        ${compInfo ? `<div class="player-meta" style="margin-top:4px">
          <span style="color:var(--accent)">${compInfo}</span> ${genderBadge}
        </div>` : ''}
        <div class="tags" style="margin-top:12px">
          ${top5.map(a => `<span class="tag green" style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">${metricIcons[a] || '📊'}</span>${METRIC_LABELS[a] || a}</span>`).join('')}
          ${bot3.map(a => `<span class="tag red" style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">${metricIcons[a] || '📉'}</span>${METRIC_LABELS[a] || a}</span>`).join('')}
        </div>
      </div>
      <div class="overall-badge">
        <div class="overall-num">${p.overall}</div>
        <div class="overall-label">Overall</div>
      </div>
    </div >

        <div class="grid-3">
          <div class="card">
            <div class="card-label">Attribute Breakdown</div>
            <div class="attribute-chart-container">
              <div id="attribute-bars-chart" style="width:100%;margin:10px 0;"></div>
            </div>
          </div>
          <div class="card">
            <div class="card-label">Player Analysis</div>
            <div class="radar-wrap" id="radar-overview"></div>
            <div class="divider"></div>
            <div class="card-label">Passing Network</div>
            <div class="chart-container" id="passing-network"></div>
            <div class="divider"></div>
            <div class="card-label">Positional Activity Heatmap</div>
            <div class="chart-container" id="positional-map"></div>
          </div>
          <div class="card">
            <div class="card-label">Role Suitability (Top 3)</div>
            ${Object.entries(ROLES).sort((a, b) => calcRoleFit(p, b[1]) - calcRoleFit(p, a[1])).slice(0, 3).map(([role, weights]) => {
    const fit = calcRoleFit(p, weights);
    const roleIcons = {
      'Poacher': '🥅',
      'Target Man': '🧱',
      'Winger': '🏃‍♂️',
      'Box-to-Box MF': '⚡',
      'Ball-Playing Def': '🛡️',
      'Deep-Lying Playmaker': '🧠',
      'Pressing Winger': '🔥'
    };
    return `
            <div class="role-fit-item">
              <span class="role-name" style="display:flex;align-items:center;gap:10px">
                <span style="font-size:18px">${roleIcons[role] || '👤'}</span>
                ${role}
              </span>
              <div class="role-bar-bg">
                <div class="role-bar-fill" style="width:${fit}%;background:${ROLE_COLORS[role]}"></div>
              </div>
              <span class="role-pct" style="color:${ROLE_COLORS[role]}">${fit}%</span>
            </div>`;
  }).join('')}
            <div class="divider"></div>
            <div class="card-label">Performance Metrics</div>
            <div class="metric-grid">
              <div class="metric-item" style="animation-delay: 0.1s">
                <span class="metric-label">⚽ Shots p90</span>
                <span class="metric-value">${formatNumber(p.shots_p90, 1)}</span>
              </div>
              <div class="metric-item" style="animation-delay: 0.2s">
                <span class="metric-label">📈 Expected Goals</span>
                <span class="metric-value">${formatNumber(p.xg_p90, 2)}</span>
              </div>
              <div class="metric-item" style="animation-delay: 0.3s">
                <span class="metric-label">🔥 Dribbles p90</span>
                <span class="metric-value">${formatNumber(p.dribbles_p90, 1)}</span>
              </div>
              <div class="metric-item" style="animation-delay: 0.4s">
                <span class="metric-label">💪 Pressures p90</span>
                <span class="metric-value">${formatNumber(p.pressures_p90, 1)}</span>
              </div>
            </div>
          </div>
        </div>
      `;

  // Render all visualizations
  setTimeout(() => {
    drawRadar('#radar-overview', [p], RADAR_AXES, 220, [['#00e5ff', 0.25]]);

    // Render attribute bars chart
    if (googleChartsLoaded) {
      drawAttributeBars('#attribute-bars-chart', p);
    } else {
      // Fallback to HTML bars if Google Charts not ready
      setTimeout(() => {
        if (googleChartsLoaded) {
          drawAttributeBars('#attribute-bars-chart', p);
        }
      }, 500);
    }
  }, 150);

  // Render heatmap and passing network with slight delay
  console.log('🎯 Calling drawPassingNetwork with selector:', '#passing-network');
  console.log('👥 Player object:', p);
  setTimeout(() => {
    drawPassingNetwork('#passing-network', p);
    drawPositionalHeatmap('#positional-map', p);
  }, 100);
}

// Function to animate attribute bars
function animateAttributeBars() {
  const progressBars = document.querySelectorAll('.attribute-bar-progress');
  progressBars.forEach((bar, index) => {
    const finalWidth = bar.getAttribute('data-final-width') || 0;
    setTimeout(() => {
      bar.style.width = finalWidth + '%';
    }, index * 100); // Staggered animation
  });
}

// Utility function for consistent number formatting
function formatNumber(value, decimals = 1) {
  if (value === undefined || value === null) return '0.' + '0'.repeat(decimals);
  return parseFloat(value).toFixed(decimals);
}

// Override the original renderOverview function
renderOverview = renderAdvancedOverview;

console.log('✨ Dashboard enhanced with professional styling, animations, and improved data visualization');
console.log('🎨 Features: Glass morphism effects, iconography, consistent formatting, and smooth interactions');

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
loadData();
