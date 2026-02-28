/**
 * xScout Dashboard — Application Logic
 * Loads players.json and powers all four dashboard modules.
 *
 * Modules:
 *   1. Player Overview – attribute bars, radar, role preview
 *   2. Player Comparison – dual radar, head-to-head bars, diff table
 *   3. Role Fit Analysis – weighted scoring, role bars, leaderboard
 *   4. Similar Player Finder – Euclidean distance, filters, cards
 */

// ─────────────────────────────────────────────
// GLOBALS
// ─────────────────────────────────────────────
let PLAYERS = [];

// All metric keys from players.json
const METRICS = [
  'shots_p90', 'xg_p90', 'shot_conversion',
  'prog_passes_p90', 'pass_completion', 'key_passes_p90',
  'dribbles_p90', 'pressures_p90', 'press_success',
  'aerial_win_rate', 'distance_p90'
];

// Human-friendly labels
const METRIC_LABELS = {
  shots_p90: 'Shots',
  xg_p90: 'xG',
  shot_conversion: 'Finishing',
  prog_passes_p90: 'Prog Passes',
  pass_completion: 'Pass Acc',
  key_passes_p90: 'Key Passes',
  dribbles_p90: 'Dribbles',
  pressures_p90: 'Pressures',
  press_success: 'Press Win',
  aerial_win_rate: 'Aerial Win',
  distance_p90: 'Distance'
};

// Radar axes — 6 composite groups for spider chart
const RADAR_AXES = [
  { key: 'attacking', label: 'ATT', metrics: ['shots_p90', 'xg_p90', 'shot_conversion'] },
  { key: 'creative',  label: 'CRE', metrics: ['key_passes_p90', 'prog_passes_p90'] },
  { key: 'passing',   label: 'PAS', metrics: ['pass_completion', 'prog_passes_p90'] },
  { key: 'dribbling', label: 'DRI', metrics: ['dribbles_p90'] },
  { key: 'defending', label: 'DEF', metrics: ['pressures_p90', 'press_success'] },
  { key: 'physical',  label: 'PHY', metrics: ['aerial_win_rate', 'distance_p90'] },
];

// Role templates — weighted metric formulas from the PRD
const ROLES = {
  'Poacher':              { shot_conversion: 0.30, xg_p90: 0.25, shots_p90: 0.20, aerial_win_rate: 0.15, press_success: 0.10 },
  'Target Man':           { aerial_win_rate: 0.30, xg_p90: 0.25, shot_conversion: 0.20, pressures_p90: 0.15, dribbles_p90: 0.10 },
  'Winger':               { dribbles_p90: 0.30, shots_p90: 0.20, key_passes_p90: 0.20, distance_p90: 0.15, press_success: 0.15 },
  'Box-to-Box MF':        { distance_p90: 0.25, prog_passes_p90: 0.20, pressures_p90: 0.20, dribbles_p90: 0.15, shots_p90: 0.20 },
  'Ball-Playing Def':     { pass_completion: 0.30, prog_passes_p90: 0.25, key_passes_p90: 0.20, aerial_win_rate: 0.15, pressures_p90: 0.10 },
  'Deep-Lying Playmaker': { key_passes_p90: 0.30, pass_completion: 0.30, prog_passes_p90: 0.25, xg_p90: 0.15 },
  'Pressing Winger':      { pressures_p90: 0.30, press_success: 0.25, distance_p90: 0.20, dribbles_p90: 0.25 },
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


// ─────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────
async function loadData() {
  try {
    const response = await fetch('../data/players.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    PLAYERS = await response.json();

    // Compute overall rating for each player
    PLAYERS.forEach(p => {
      p.overall = computeOverall(p);
    });

    // Sort by name for consistent dropdown ordering
    PLAYERS.sort((a, b) => a.name.localeCompare(b.name));

    initApp();
  } catch (err) {
    document.getElementById('overview-content').innerHTML =
      `<p class="loading-msg" style="color:var(--accent2)">Failed to load data: ${err.message}<br>
       Make sure you are running from a local server (e.g. <code>python -m http.server</code>)</p>`;
  }
}


// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function initApp() {
  populateSelect('overview-select', 0);
  populateSelect('compare-a', 0);
  populateSelect('compare-b', Math.min(1, PLAYERS.length - 1));
  populateSelect('role-select', 0);
  populateSelect('similar-select', 0);

  // Wire dropdowns
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
    opt.text = `${p.name} (${p.position}, ${p.age})`;
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

  container.innerHTML = `
    <div class="player-header-card">
      <div class="player-avatar">${initials(p.name)}</div>
      <div class="player-info">
        <h2>${p.name}</h2>
        <div class="player-meta">
          Position: <span>${p.position}</span> &nbsp;·&nbsp; Age: <span>${p.age}</span> &nbsp;·&nbsp; Minutes: <span>${p.minutes_played}</span>
        </div>
        <div class="tags" style="margin-top:10px">
          ${top5.map(a => `<span class="tag green">${METRIC_LABELS[a] || a}</span>`).join('')}
          ${bot3.map(a => `<span class="tag red">${METRIC_LABELS[a] || a}</span>`).join('')}
        </div>
      </div>
      <div class="overall-badge">
        <div class="overall-num">${p.overall}</div>
        <div class="overall-label">Overall</div>
      </div>
      <div class="player-number">${p.overall}</div>
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

  container.innerHTML = `
    <div class="grid-2" style="margin-bottom:20px">
      <div class="player-header-card" style="margin-bottom:0">
        <div class="player-avatar" style="border-color:#00e5ff;color:#00e5ff">${initials(a.name)}</div>
        <div class="player-info">
          <h2 style="color:#00e5ff">${a.name}</h2>
          <div class="player-meta">Position: <span>${a.position}</span> · Age: <span>${a.age}</span></div>
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
  container.innerHTML = `
    <div class="player-header-card" style="margin-bottom:24px">
      <div class="player-avatar">${initials(p.name)}</div>
      <div class="player-info">
        <h2>${p.name}</h2>
        <div class="player-meta">Best Fit: <span style="color:${ROLE_COLORS[best.role]}">${best.role}</span> at <span style="color:${ROLE_COLORS[best.role]}">${best.fit}%</span></div>
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

  let pool = PLAYERS.filter(p => p.player_id !== ref.player_id);
  if (posFilter !== 'all') pool = pool.filter(p => p.position === posFilter);
  pool = pool.filter(p => p.age <= ageFilter);

  const scored = pool.map(p => ({ ...p, sim: euclideanSimilarity(ref, p) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5);

  const container = document.getElementById('similar-content');

  container.innerHTML = `
    <div class="player-header-card" style="margin-bottom:24px">
      <div class="player-avatar" style="border-color:var(--accent3);color:var(--accent3)">${initials(ref.name)}</div>
      <div class="player-info">
        <h2>${ref.name}</h2>
        <div class="player-meta">Finding similar profiles… <span>Position: ${ref.position}</span> · <span>Age: ${ref.age}</span> · <span>OVR: ${ref.overall}</span></div>
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
              <div class="sim-meta">${p.position} · AGE ${p.age} · OVR ${p.overall}</div>
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
// BOOT
// ─────────────────────────────────────────────
loadData();
