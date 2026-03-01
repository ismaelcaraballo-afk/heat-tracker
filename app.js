/**
 * PERSON B — Beatrice: Rendering + UI Logic
 * Two modes:
 *   1. DASHBOARD — citywide crisis overview (loads on page open)
 *   2. BUILDING LOOKUP — tenant searches an address, gets a full report card
 *
 * Uses Chart.js 4.4.7 for visualizations.
 * All data comes from data-ismael.js, data-pape.js, and data.js.
 */

const USE_MOCK = false; // flip to true for offline dev

// ========== MOCK DATA (for offline dev) ==========
const MOCK_HERO = {
  hpdOpenTotal: 245000, cityHeatAvgDays: "8.2",
  shelterPop: 85770, shelterChildren: 29880, shelterDate: "2026-02-27",
  pctOfPeak: "95.8", nychaViolations: 2273, nychaClassC: 393
};
const MOCK_LOOKUP = {
  search: { address: "1000 GRAND CONCOURSE", borough: "BRONX", totalComplaints: 847, matches: [{ address: "1000 GRAND CONCOURSE", borough: "BRONX", total: 847 }] },
  hpd: {
    categoryList: [
      { category: "HEAT/HOT WATER", open: 3, closed: 312, total: 315 },
      { category: "PLUMBING", open: 1, closed: 180, total: 181 },
      { category: "PAINT/PLASTER", open: 0, closed: 95, total: 95 },
      { category: "DOOR/WINDOW", open: 0, closed: 62, total: 62 }
    ],
    heatYears: [
      { year: "2026", total: 18 }, { year: "2025", total: 42 }, { year: "2024", total: 38 },
      { year: "2023", total: 35 }, { year: "2022", total: 29 }, { year: "2021", total: 31 }
    ],
    heatWinters: 6, totalHeat: 315,
    resolution: [
      { category: "HEAT/HOT WATER", avgDays: "12.3", total: 280 },
      { category: "PLUMBING", avgDays: "18.7", total: 160 }
    ],
    open: [
      { received: "2026-01-15", category: "HEAT/HOT WATER", priority: "EMERGENCY", problem: "NO HEAT", daysOpen: 45 },
      { received: "2026-02-01", category: "PLUMBING", priority: "NON EMERGENCY", problem: "LEAK", daysOpen: 28 }
    ],
    recent: []
  },
  dobComplaints: [{ category: "05", status: "ACTIVE", entered: "2025-11-01", total: 1 }],
  dobViolations: [{ type: "LL-LOCAL LAW", category: "V-DOB VIOLATION", description: "FAILURE TO MAINTAIN", issueDate: "2025-09-15" }],
  grade: { score: 25, letter: "D", color: "#e67e22", reasons: [
    "Heat complaints 6 winters in a row — chronic repeat offender",
    "2 open HPD ticket(s)",
    "Heat repairs avg 12.3 days",
    "847 total complaints on record"
  ]},
  citywide: { totalOpen: 245000, cityHeatAvg: "8.2" }
};

// ========== UTILITIES ==========

function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function num(n) { return (n || 0).toLocaleString(); }

function destroyChart(canvasId) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
}

// ========== SEARCH HANDLER ==========

async function handleSearch(e) {
  if (e) e.preventDefault();
  const input = $('search-input').value.trim();
  if (!input) return;
  console.log("Searching for:", input);

  $('search-btn').disabled = true;
  $('search-btn').textContent = 'Searching...';
  hide('search-error');
  hide('report-card');

  try {
    const result = USE_MOCK ? MOCK_LOOKUP : await lookupBuilding(input);

    if (result.error) {
      $('search-error').textContent = result.error;
      show('search-error');
      return;
    }

    renderReportCard(result);
    show('report-card');
    $('report-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    $('search-error').textContent = `API error: ${err.message}. Try again.`;
    show('search-error');
  } finally {
    $('search-btn').disabled = false;
    $('search-btn').textContent = 'Look Up';
  }
}

// ========== REPORT CARD RENDERER ==========

function renderReportCard(data) {
  const { search, hpd, dobComplaints, dobViolations, grade, citywide } = data;

  // Header
  $('rc-address').textContent = search.address;
  $('rc-borough').textContent = search.borough;
  $('rc-total').textContent = `${num(search.totalComplaints)} HPD complaints on record`;

  // Grade badge
  $('rc-grade-letter').textContent = grade.letter;
  $('rc-grade-letter').style.background = grade.color;
  $('rc-grade-score').textContent = `Score: ${grade.score}/100`;
  $('rc-grade-reasons').innerHTML = grade.reasons.map(r => `<li>${r}</li>`).join('');

  // Heat winters chart
  renderHeatChart(hpd.heatYears);

  // Categories table
  $('rc-categories').innerHTML = hpd.categoryList.slice(0, 8).map(c =>
    `<tr>
      <td>${c.category}</td>
      <td class="num">${num(c.total)}</td>
      <td class="num">${c.open > 0 ? `<span class="open-tag">${c.open} OPEN</span>` : '—'}</td>
    </tr>`
  ).join('');

  // Resolution times
  $('rc-resolution').innerHTML = hpd.resolution.slice(0, 6).map(r => {
    const avg = parseFloat(r.avgDays);
    const cls = avg > 30 ? 'slow' : avg > 14 ? 'medium' : 'fast';
    return `<tr class="${cls}">
      <td>${r.category}</td>
      <td class="num">${r.avgDays} days</td>
      <td class="num">(${num(r.total)} resolved)</td>
    </tr>`;
  }).join('');

  // Open tickets
  if (hpd.open.length > 0) {
    show('rc-open-section');
    $('rc-open-tickets').innerHTML = hpd.open.map(t =>
      `<tr class="${t.daysOpen > 30 ? 'overdue' : ''}">
        <td>${t.received}</td>
        <td>${t.category}</td>
        <td>${t.priority}</td>
        <td class="num">${t.daysOpen} days</td>
      </tr>`
    ).join('');
  } else {
    hide('rc-open-section');
  }

  // DOB cross-reference
  const dobTotal = dobComplaints.length + dobViolations.length;
  if (dobTotal > 0) {
    show('rc-dob-section');
    let dobHTML = '';
    if (dobComplaints.length > 0) {
      dobHTML += '<h4>DOB Complaints</h4><ul>' +
        dobComplaints.slice(0, 5).map(c => `<li>Category ${c.category} — ${c.status} (${c.entered?.substring(0,10) || 'N/A'})</li>`).join('') +
        '</ul>';
    }
    if (dobViolations.length > 0) {
      dobHTML += '<h4>DOB Violations</h4><ul>' +
        dobViolations.slice(0, 5).map(v => `<li>${v.type}: ${v.description || 'N/A'} (${v.issueDate?.substring(0,10) || 'N/A'})</li>`).join('') +
        '</ul>';
    }
    $('rc-dob-data').innerHTML = dobHTML;
  } else {
    hide('rc-dob-section');
  }

  // Citywide comparison
  $('rc-city-open').textContent = num(citywide.totalOpen);
  $('rc-city-avg').textContent = `${citywide.cityHeatAvg} days`;

  // Action links
  const encodedAddr = encodeURIComponent(search.address + ', ' + search.borough + ', NY');
  $('rc-actions').innerHTML = `
    <a href="https://portal.311.nyc.gov/sr-step/?id=63b27f67-1b87-e811-a83f-000d3a33b3a3" target="_blank" class="action-btn file-complaint">File HPD Complaint (311)</a>
    <a href="https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=0&houseno=${search.address.split(' ')[0]}&street=${encodeURIComponent(search.address.split(' ').slice(1).join(' '))}" target="_blank" class="action-btn dob-lookup">Check DOB/BIS Record</a>
    <a href="https://hpdonline.nyc.gov/hpdonline/provide-information" target="_blank" class="action-btn hpd-online">HPD Online Portal</a>
    <a href="https://www.metcouncilonhousing.org/help-answers/heat-and-hot-water/" target="_blank" class="action-btn know-rights">Know Your Rights: Heat</a>
  `;
}

// ========== CHARTS ==========

function renderHeatChart(heatYears) {
  if (!heatYears || heatYears.length === 0) return;
  destroyChart('heat-chart');
  const labels = heatYears.map(y => y.year);
  const values = heatYears.map(y => y.total);
  new Chart($('heat-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Heat/Hot Water Complaints',
        data: values,
        backgroundColor: values.map(v => v > 30 ? '#e94560' : v > 15 ? '#f0a500' : '#4ecca3'),
        borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, title: { display: true, text: 'Heat Complaints by Winter', color: '#e0e0e0' } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#aaa' }, grid: { color: '#333' } },
        x: { ticks: { color: '#aaa' }, grid: { display: false } }
      }
    }
  });
}

function renderDHSTrendChart(trend) {
  if (!trend || trend.length === 0) return;
  destroyChart('dhs-chart');
  const labels = trend.map(t => `${t.year}-${String(t.month).padStart(2,'0')}`);
  new Chart($('dhs-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Total in Shelter', data: trend.map(t => t.avgPop), borderColor: '#e94560', fill: false, tension: 0.3 },
        { label: 'Children', data: trend.map(t => t.avgChildren), borderColor: '#f0a500', fill: false, tension: 0.3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { title: { display: true, text: 'DHS Shelter Population (Monthly Avg)', color: '#e0e0e0' } },
      scales: {
        y: { beginAtZero: false, ticks: { color: '#aaa', callback: v => num(v) }, grid: { color: '#333' } },
        x: { ticks: { color: '#aaa', maxRotation: 45 }, grid: { display: false } }
      }
    }
  });
}

function renderNYCHAChart(byClass) {
  if (!byClass || byClass.length === 0) return;
  destroyChart('nycha-chart');
  const colorMap = { 'A': '#4ecca3', 'B': '#3498db', 'C': '#e94560' };
  new Chart($('nycha-chart'), {
    type: 'doughnut',
    data: {
      labels: byClass.map(c => `Class ${c.class}`),
      datasets: [{ data: byClass.map(c => c.total), backgroundColor: byClass.map(c => colorMap[c.class] || '#888') }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'NYCHA Violations by Class', color: '#e0e0e0' },
        legend: { labels: { color: '#ccc' } }
      }
    }
  });
}

function renderNYCHADevsChart(devs) {
  if (!devs || devs.length === 0) return;
  destroyChart('nycha-devs-chart');
  new Chart($('nycha-devs-chart'), {
    type: 'bar',
    data: {
      labels: devs.map(d => d.development?.substring(0, 20) || 'Unknown'),
      datasets: [
        { label: 'Total Violations', data: devs.map(d => d.total), backgroundColor: '#3498db', borderRadius: 4 },
        { label: 'Class C (Hazardous)', data: devs.map(d => d.classC), backgroundColor: '#e94560', borderRadius: 4 }
      ]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { title: { display: true, text: 'Worst NYCHA Developments', color: '#e0e0e0' } },
      scales: {
        x: { stacked: false, ticks: { color: '#aaa' }, grid: { color: '#333' } },
        y: { ticks: { color: '#aaa', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ========== DASHBOARD RENDERER ==========

async function loadDashboard() {
  $('dash-loading').textContent = 'Loading citywide data from NYC Open Data...';
  show('dash-loading');

  try {
    const data = USE_MOCK ? { hero: MOCK_HERO, dhs: { trend: [] }, nycha: { byClass: [], worstDevelopments: [], trend: [] }, shelters: {} }
      : await loadDashboardData();

    const h = data.hero;

    // Hero stats
    $('stat-hpd-open').textContent = num(h.hpdOpenTotal);
    $('stat-heat-avg').textContent = `${h.cityHeatAvgDays} days`;
    $('stat-shelter').textContent = num(h.shelterPop);
    $('stat-children').textContent = num(h.shelterChildren);
    $('stat-nycha-viol').textContent = num(h.nychaViolations);
    $('stat-nycha-c').textContent = num(h.nychaClassC);

    // Charts
    renderDHSTrendChart(data.dhs.trend);
    renderNYCHAChart(data.nycha.byClass);
    renderNYCHADevsChart(data.nycha.worstDevelopments);

    // Shelter landlords table
    if (data.shelters.worstLandlords?.length > 0) {
      show('shelter-section');
      $('shelter-landlords').innerHTML = data.shelters.worstLandlords.map(l =>
        `<tr><td>${l.landlord}</td><td class="num">${num(l.buildings)}</td><td class="num">${num(l.totalViolations)}</td></tr>`
      ).join('');
    }

    hide('dash-loading');
    show('dashboard');
  } catch (err) {
    $('dash-loading').textContent = `Error loading dashboard: ${err.message}`;
    console.error(err);
  }
}

// ========== TAB SWITCHING ==========

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'search') {
    show('search-section');
    hide('dashboard-section');
    $('search-input').focus();
  } else {
    hide('search-section');
    show('dashboard-section');
  }
}

// ========== INIT ==========

async function main() {
  // Wire up search
  $('search-form').addEventListener('submit', handleSearch);

  // Wire up tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Start with dashboard
  switchTab('dashboard');
  await loadDashboard();
}

document.addEventListener('DOMContentLoaded', main);
