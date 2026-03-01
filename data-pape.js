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
    "$select": "class, count(*) as total",
    "$group": "class",
    "$order": "total DESC"
  });
  return raw.map(r => ({ class: r.class, total: parseInt(r.total) }));
}

/** NYCHA violations by development — worst buildings */
async function nychaWorstDevelopments(limit = 10) {
  const raw = await q(NYCHA_API, {
    "$select": "development, count(*) as total, " +
      "sum(case(class='C',1,true,0)) as class_c",
    "$group": "development",
    "$order": "total DESC",
    "$limit": limit
  });
  return raw.map(r => ({
    development: r.development,
    total: parseInt(r.total),
    classC: parseInt(r.class_c || 0)
  }));
}

/** NYCHA violations by type — what's actually broken */
async function nychaByType(limit = 10) {
  const raw = await q(NYCHA_API, {
    "$select": "novdescription, class, count(*) as total",
    "$group": "novdescription, class",
    "$order": "total DESC",
    "$limit": limit
  });
  return raw.map(r => ({
    description: r.novdescription,
    class: r.class,
    total: parseInt(r.total)
  }));
}

/** NYCHA violations trend — are things getting better or worse? */
async function nychaTrend() {
  const raw = await q(NYCHA_API, {
    "$select": "date_extract_y(inspectiondate) as yr, count(*) as total, " +
      "sum(case(class='C',1,true,0)) as class_c",
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

/** Top landlords by open violations across DHS shelters */
async function shelterWorstLandlords(limit = 10) {
  const raw = await q(SCORECARD_API, {
    "$select": "landlord, count(*) as buildings, " +
      "sum(total_open_violations) as total_viol",
    "$where": "landlord IS NOT NULL",
    "$group": "landlord",
    "$order": "buildings DESC",
    "$limit": 50
  });
  return raw
    .map(r => ({
      landlord: r.landlord,
      buildings: parseInt(r.buildings || 0),
      totalViolations: parseInt(r.total_viol || 0)
    }))
    .sort((a, b) => b.totalViolations - a.totalViolations)
    .slice(0, limit);
}

/** Shelter violations by agency — who's citing what */
async function shelterViolationsByAgency() {
  const raw = await q(SCORECARD_API, {
    "$select": "sum(total_open_violations) as total, " +
      "sum(open_hpd_violations) as hpd, " +
      "sum(open_dob_violations) as dob, " +
      "sum(open_fdny_violations) as fdny, " +
      "sum(open_dohmh_violations) as dohmh",
    "$limit": 1
  });
  if (!raw.length) return null;
  const r = raw[0];
  return {
    total: parseInt(r.total || 0),
    hpd: parseInt(r.hpd || 0),
    dob: parseInt(r.dob || 0),
    fdny: parseInt(r.fdny || 0),
    dohmh: parseInt(r.dohmh || 0)
  };
}

/** Shelter scorecard — worst individual buildings */
async function shelterWorstBuildings(limit = 10) {
  const raw = await q(SCORECARD_API, {
    "$select": "building_address, landlord, borough, " +
      "total_open_violations, open_hpd_violations, open_dob_violations, " +
      "highpriority_open_monthly_hpd",
    "$order": "total_open_violations DESC",
    "$limit": limit
  });
  return raw.map(r => ({
    address: r.building_address,
    landlord: r.landlord,
    borough: r.borough,
    totalViolations: parseInt(r.total_open_violations || 0),
    hpdViolations: parseInt(r.open_hpd_violations || 0),
    dobViolations: parseInt(r.open_dob_violations || 0),
    highPriorityHPD: parseInt(r.highpriority_open_monthly_hpd || 0)
  }));
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
