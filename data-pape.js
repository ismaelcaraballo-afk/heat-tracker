/**
 * PERSON A2 — Pape: DHS Shelters + NYCHA Violations + Shelter Repair Scorecard
 * System-wide housing crisis data — the OTHER side of NYC's maintenance failure.
 * HPD doesn't take complaints for NYCHA buildings (NYCHA Customer Care handles those).
 * HPD doesn't cover DHS shelters either (DHS has its own inspection regime).
 * This file captures what falls OUTSIDE the HPD system.
 *
 * Datasets:
 *   k46n-sa2m  — DHS Daily Report (shelter census, ~1,825 rows)
 *   im9z-53hg  — NYCHA Housing Violations from HPD inspections (2,273 rows)
 *   dvaj-b7yx  — Shelter Repair Scorecard (34K rows, data through Dec 2022)
 */

const DHS_API  = "https://data.cityofnewyork.us/resource/k46n-sa2m.json";
const NYCHA_API = "https://data.cityofnewyork.us/resource/im9z-53hg.json";
const SCORECARD_API = "https://data.cityofnewyork.us/resource/dvaj-b7yx.json";

// Reuses q() from data-ismael.js (loaded first)

// ========== DHS SHELTER DATA ==========

/** Latest DHS daily snapshot — how many people in shelter right now */
async function dhsLatest() {
  const raw = await q(DHS_API, {
    "$order": "date_of_census DESC",
    "$limit": 1
  });
  if (!raw.length) return null;
  const r = raw[0];
  return {
    date: r.date_of_census?.substring(0, 10),
    totalIndividuals: parseInt(r.total_individuals_in_shelter || 0),
    totalChildren: parseInt(r.total_children_in_shelter || 0),
    totalAdults: parseInt(r.total_adults_in_shelter || 0),
    totalFamilies: parseInt(r.total_individuals_in_families_with_children_in_shelter || 0),
    adultFamilies: parseInt(r.total_individuals_in_adult_families_in_shelter || 0)
  };
}

/** DHS shelter population trend — last N months */
async function dhsTrend(months = 12) {
  const raw = await q(DHS_API, {
    "$select": "date_extract_y(date_of_census) as yr, date_extract_m(date_of_census) as mo, " +
      "avg(total_individuals_in_shelter) as avg_pop, " +
      "max(total_individuals_in_shelter) as peak_pop, " +
      "avg(total_children_in_shelter) as avg_children",
    "$group": "yr, mo",
    "$order": "yr DESC, mo DESC",
    "$limit": months
  });
  return raw.map(r => ({
    year: r.yr, month: r.mo,
    avgPop: Math.round(parseFloat(r.avg_pop || 0)),
    peakPop: parseInt(r.peak_pop || 0),
    avgChildren: Math.round(parseFloat(r.avg_children || 0))
  })).reverse();
}

/** DHS peak vs current — how close are we to the all-time high? */
async function dhsPeakVsNow() {
  const [latest, peak] = await Promise.all([
    q(DHS_API, { "$order": "date_of_census DESC", "$limit": 1 }),
    q(DHS_API, {
      "$select": "max(total_individuals_in_shelter) as peak",
      "$limit": 1
    })
  ]);
  const now = parseInt(latest[0]?.total_individuals_in_shelter || 0);
  const max = parseInt(peak[0]?.peak || 0);
  return {
    current: now, peak: max,
    pctOfPeak: max > 0 ? ((now / max) * 100).toFixed(1) : "0",
    date: latest[0]?.date_of_census?.substring(0, 10)
  };
}

// ========== NYCHA VIOLATIONS (from HPD inspections) ==========

/** NYCHA violations by class — Class C = immediately hazardous */
async function nychaByClass() {
  const raw = await q(NYCHA_API, {
    "$select": "hzrd_clas, count(viol_seq_no) as total",
    "$group": "hzrd_clas",
    "$order": "total DESC"
  });
  return raw.map(r => ({ class: r.hzrd_clas, total: parseInt(r.total) }));
}

/** NYCHA violations by development — worst buildings */
async function nychaWorstDevelopments(limit = 10) {
  const raw = await q(NYCHA_API, {
    "$select": "development_name, count(viol_seq_no) as total, " +
      "sum(case(hzrd_clas='C',1,true,0)) as class_c",
    "$group": "development_name",
    "$order": "total DESC",
    "$limit": limit
  });
  return raw.map(r => ({
    development: r.development_name,
    total: parseInt(r.total),
    classC: parseInt(r.class_c || 0)
  }));
}

/** NYCHA violations by type — what's actually broken */
async function nychaByType(limit = 10) {
  const raw = await q(NYCHA_API, {
    "$select": "viol_desc, hzrd_clas, count(viol_seq_no) as total",
    "$group": "viol_desc, hzrd_clas",
    "$order": "total DESC",
    "$limit": limit
  });
  return raw.map(r => ({
    description: r.viol_desc,
    class: r.hzrd_clas,
    total: parseInt(r.total)
  }));
}

/** NYCHA violations trend — are things getting better or worse? */
async function nychaTrend() {
  const raw = await q(NYCHA_API, {
    "$select": "date_extract_y(insp_dt) as yr, count(viol_seq_no) as total, " +
      "sum(case(hzrd_clas='C',1,true,0)) as class_c",
    "$group": "yr",
    "$order": "yr DESC",
    "$limit": 10
  });
  return raw.map(r => ({
    year: r.yr,
    total: parseInt(r.total),
    classC: parseInt(r.class_c || 0)
  })).reverse();
}

// ========== SHELTER REPAIR SCORECARD ==========
// Note: data only goes through Dec 2022 — stale but still tells a story
// Schema (2025): monthly priority columns (highpriority_open_monthly_hpd, etc.) — values are text, so we fetch & aggregate in JS

const SCORECARD_OPEN_COLS = [
  "highpriority_open_monthly_dob", "highpriority_open_monthly_hpd", "highpriority_open_monthly_fdny", "highpriority_open_monthly_dohmh",
  "mediumpriority_open_monthly_dob", "mediumpriority_open_monthly_hpd", "mediumpriority_open_monthly_fdny", "mediumpriority_open_monthly_dohmh",
  "lowestpriority_open_monthly_dob", "lowestpriority_open_monthly_hpd", "lowestpriority_open_monthly_fdny", "lowestpriority_open_monthly_dohmh",
  "commissionerorder_open_monthly_dob", "commissionerorder_open_monthly_hpd", "commissionerorder_open_monthly_fdny", "commissionerorder_open_monthly_dohmh"
];

function scorecardRowTotal(r) {
  return SCORECARD_OPEN_COLS.reduce((s, col) => s + (parseInt(r[col]) || 0), 0);
}

function scorecardRowByAgency(r) {
  return {
    hpd: (parseInt(r.highpriority_open_monthly_hpd) || 0) + (parseInt(r.mediumpriority_open_monthly_hpd) || 0) + (parseInt(r.lowestpriority_open_monthly_hpd) || 0) + (parseInt(r.commissionerorder_open_monthly_hpd) || 0),
    dob: (parseInt(r.highpriority_open_monthly_dob) || 0) + (parseInt(r.mediumpriority_open_monthly_dob) || 0) + (parseInt(r.lowestpriority_open_monthly_dob) || 0) + (parseInt(r.commissionerorder_open_monthly_dob) || 0),
    fdny: (parseInt(r.highpriority_open_monthly_fdny) || 0) + (parseInt(r.mediumpriority_open_monthly_fdny) || 0) + (parseInt(r.lowestpriority_open_monthly_fdny) || 0) + (parseInt(r.commissionerorder_open_monthly_fdny) || 0),
    dohmh: (parseInt(r.highpriority_open_monthly_dohmh) || 0) + (parseInt(r.mediumpriority_open_monthly_dohmh) || 0) + (parseInt(r.lowestpriority_open_monthly_dohmh) || 0) + (parseInt(r.commissionerorder_open_monthly_dohmh) || 0)
  };
}

/** Fetch all scorecard rows (paginated) — used by shelter functions */
async function fetchScorecardRows() {
  const select = ["landlord", "borough", "dhs_bld_id", "shelter_name_all", ...SCORECARD_OPEN_COLS].join(", ");
  const rows = [];
  let offset = 0;
  const limit = 50000;
  let batch;
  do {
    batch = await q(SCORECARD_API, { "$select": select, "$limit": limit, "$offset": offset });
    rows.push(...batch);
    offset += batch.length;
  } while (batch.length === limit);
  return rows;
}

/** Top landlords by open violations across DHS shelters */
async function shelterWorstLandlords(limit = 10) {
  const raw = await fetchScorecardRows();
  const byLandlord = {};
  for (const r of raw) {
    if (!r.landlord) continue;
    if (!byLandlord[r.landlord]) byLandlord[r.landlord] = { buildings: new Set(), totalViolations: 0 };
    byLandlord[r.landlord].buildings.add(r.dhs_bld_id);
    byLandlord[r.landlord].totalViolations += scorecardRowTotal(r);
  }
  return Object.entries(byLandlord)
    .map(([landlord, v]) => ({ landlord, buildings: v.buildings.size, totalViolations: v.totalViolations }))
    .sort((a, b) => b.totalViolations - a.totalViolations)
    .slice(0, limit);
}

/** Shelter violations by agency — who's citing what */
async function shelterViolationsByAgency() {
  const raw = await fetchScorecardRows();
  const totals = { total: 0, hpd: 0, dob: 0, fdny: 0, dohmh: 0 };
  for (const r of raw) {
    const t = scorecardRowTotal(r);
    const a = scorecardRowByAgency(r);
    totals.total += t;
    totals.hpd += a.hpd;
    totals.dob += a.dob;
    totals.fdny += a.fdny;
    totals.dohmh += a.dohmh;
  }
  return totals;
}

/** Shelter scorecard — worst individual buildings */
async function shelterWorstBuildings(limit = 10) {
  const raw = await fetchScorecardRows();
  const byBuilding = {};
  for (const r of raw) {
    const id = r.dhs_bld_id || r.shelter_name_all;
    if (!id) continue;
    if (!byBuilding[id]) byBuilding[id] = { address: r.shelter_name_all, landlord: r.landlord, borough: r.borough, totalViolations: 0, hpdViolations: 0, dobViolations: 0, highPriorityHPD: 0 };
    const t = scorecardRowTotal(r);
    const a = scorecardRowByAgency(r);
    byBuilding[id].totalViolations += t;
    byBuilding[id].hpdViolations += a.hpd;
    byBuilding[id].dobViolations += a.dob;
    byBuilding[id].highPriorityHPD += (parseInt(r.highpriority_open_monthly_hpd) || 0);
  }
  return Object.values(byBuilding)
    .sort((a, b) => b.totalViolations - a.totalViolations)
    .slice(0, limit)
    .map(r => ({ address: r.address, landlord: r.landlord, borough: r.borough, totalViolations: r.totalViolations, hpdViolations: r.hpdViolations, dobViolations: r.dobViolations, highPriorityHPD: r.highPriorityHPD }));
}

// ========== PAPE'S COMBINED STATS (for hero section) ==========

async function getPapeHeroStats() {
  const [dhs, nychaClass, peak] = await Promise.all([
    dhsLatest(),
    nychaByClass(),
    dhsPeakVsNow()
  ]);

  const classC = nychaClass.find(r => r.class === 'C');
  const totalNycha = nychaClass.reduce((s, r) => s + r.total, 0);

  return {
    shelterPop: dhs?.totalIndividuals || 0,
    shelterChildren: dhs?.totalChildren || 0,
    shelterDate: dhs?.date || '',
    pctOfPeak: peak?.pctOfPeak || '0',
    nychaViolations: totalNycha,
    nychaClassC: classC?.total || 0
  };
}
