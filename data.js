/**
 * PERSON A — Data Layer: Ticket Tracker
 * PROBLEM: NYC housing maintenance is failing at every level:
 *   - HPD (private landlords): 88K+ open repair tickets, emergencies take 10+ days
 *   - HPD-managed buildings: Take 53.9 days avg vs 14.3 for private (4x worse)
 *   - DHS shelters: 85,770 people in shelter (29,880 children), near record highs
 *   - NYCHA: Repairs go through NYCHA Customer Care (NOT 311/HPD) — separate system,
 *     data not on open portal. But HPD inspects NYCHA → 2,273 violations found.
 *
 * NOTE (from a former 311 operator): HPD complaints are NOT taken for NYCHA buildings.
 *   NYCHA has its own repair queue via MyNYCHA app / Customer Care. HPD does own/manage
 *   some buildings (CENTRAL MGT, 7A, HPD O SITE, ALT MGT) — those DO appear in HPD data.
 *
 * Datasets:
 *   ygpa-z7cr — HPD Complaints & Problems (15.8M rows, resolution dates)
 *   kj4p-ruqc — Buildings Subject to HPD Jurisdiction (managementprogram field)
 *   im9z-53hg — NYCHA Housing Violations (2,273 — HPD inspections of NYCHA)
 *   k46n-sa2m — DHS Daily Report (shelter census, 1,825 daily snapshots)
 *   erm2-nwe9 — 311 filtered to agency=DHS (267K homeless/encampment complaints)
 */

const HPD_API = "https://data.cityofnewyork.us/resource/ygpa-z7cr.json";
const BLDG_API = "https://data.cityofnewyork.us/resource/kj4p-ruqc.json";
const NYCHA_API = "https://data.cityofnewyork.us/resource/im9z-53hg.json";
const DHS_API = "https://data.cityofnewyork.us/resource/k46n-sa2m.json";
const SR311_API = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";

async function q(base, params) {
  const url = new URL(base);
  for (const [k,v] of Object.entries(params)) if(v) url.searchParams.set(k,v);
  const r = await fetch(url); if(!r.ok) throw new Error(`API ${r.status}`); return r.json();
}

// ========== LAYER 1: HPD Private Landlord Complaints ==========

async function hpdAvgDaysByType() {
  const raw = await q(HPD_API, {
    "$select": "major_category, avg(date_diff_d(complaint_status_date,received_date)) as avg_days, count(*) as total",
    "$where": "complaint_status='CLOSE' AND received_date>='2023-01-01'",
    "$group": "major_category", "$order": "avg_days DESC", "$limit": 12
  });
  return raw.filter(r => parseInt(r.total) > 500).map(r => ({
    type: r.major_category, avgDays: parseFloat(r.avg_days).toFixed(1), total: parseInt(r.total)
  }));
}

async function hpdAvgDaysByPriority() {
  const raw = await q(HPD_API, {
    "$select": "type, avg(date_diff_d(complaint_status_date,received_date)) as avg_days, count(*) as total",
    "$where": "complaint_status='CLOSE' AND received_date>='2023-01-01'",
    "$group": "type", "$order": "avg_days DESC"
  });
  return raw.map(r => ({
    priority: r.type, avgDays: parseFloat(r.avg_days).toFixed(1), total: parseInt(r.total)
  }));
}

async function hpdAvgDaysByBorough() {
  const raw = await q(HPD_API, {
    "$select": "borough, avg(date_diff_d(complaint_status_date,received_date)) as avg_days, count(*) as total",
    "$where": "complaint_status='CLOSE' AND received_date>='2023-01-01' AND borough IS NOT NULL",
    "$group": "borough", "$order": "avg_days DESC"
  });
  return raw.map(r => ({
    borough: r.borough, avgDays: parseFloat(r.avg_days).toFixed(1), total: parseInt(r.total)
  }));
}

async function hpdOpenByType() {
  const raw = await q(HPD_API, {
    "$select": "major_category, count(*) as total",
    "$where": "complaint_status='OPEN'",
    "$group": "major_category", "$order": "total DESC", "$limit": 12
  });
  return raw.map(r => ({ type: r.major_category, total: parseInt(r.total) }));
}

async function hpdOpenByPriority() {
  const raw = await q(HPD_API, {
    "$select": "type, count(*) as total",
    "$where": "complaint_status='OPEN'",
    "$group": "type", "$order": "total DESC"
  });
  return raw.map(r => ({ priority: r.type, total: parseInt(r.total) }));
}

async function hpdOldestOpen(limit = 15) {
  const raw = await q(HPD_API, {
    "$select": "received_date, major_category, type, borough, house_number, street_name, problem_code",
    "$where": "complaint_status='OPEN'",
    "$order": "received_date ASC", "$limit": limit
  });
  const now = new Date();
  return raw.map(r => {
    const daysOpen = Math.floor((now - new Date(r.received_date)) / 86400000);
    return {
      received: r.received_date?.substring(0, 10), type: r.major_category,
      priority: r.type, borough: r.borough || "?",
      address: `${r.house_number || ""} ${r.street_name || ""}`.trim(),
      problem: r.problem_code || "", daysOpen
    };
  });
}

// ========== LAYER 2: HPD-Managed Buildings (Cross-Ref) ==========

async function hpdManagedStats() {
  const bldgs = await q(BLDG_API, {
    "$select": "buildingid",
    "$where": "(managementprogram='CENTRAL MGT' OR managementprogram='7A' OR managementprogram='HPD O SITE' OR managementprogram='ALT MGT') AND recordstatus='Active'",
    "$limit": 1000
  });
  const ids = bldgs.map(r => r.buildingid);
  if (!ids.length) return { avgDays: 0, totalClosed: 0, totalOpen: 0, buildingCount: 0 };
  const inClause = ids.slice(0, 200).map(id => `'${id}'`).join(",");
  const [closed, open] = await Promise.all([
    q(HPD_API, {
      "$select": "avg(date_diff_d(complaint_status_date,received_date)) as avg_days, count(*) as total",
      "$where": `building_id in(${inClause}) AND complaint_status='CLOSE'`
    }),
    q(HPD_API, {
      "$select": "count(*) as total",
      "$where": `building_id in(${inClause}) AND complaint_status='OPEN'`
    })
  ]);
  return {
    avgDays: parseFloat(closed[0]?.avg_days || 0).toFixed(1),
    totalClosed: parseInt(closed[0]?.total || 0),
    totalOpen: parseInt(open[0]?.total || 0),
    buildingCount: ids.length
  };
}

// ========== LAYER 3: DHS Shelter Census ==========

async function dhsShelterTrend() {
  const raw = await q(DHS_API, {
    "$select": "date_of_census, total_individuals_in_shelter, total_children_in_shelter, single_adult_men_in_shelter, single_adult_women_in_shelter",
    "$order": "date_of_census DESC", "$limit": 60
  });
  return raw.reverse().map(r => ({
    date: r.date_of_census?.substring(0, 10),
    total: parseInt(r.total_individuals_in_shelter),
    children: parseInt(r.total_children_in_shelter),
    men: parseInt(r.single_adult_men_in_shelter),
    women: parseInt(r.single_adult_women_in_shelter)
  }));
}

async function dhsLatest() {
  const raw = await q(DHS_API, {
    "$select": "date_of_census, total_individuals_in_shelter, total_children_in_shelter, families_with_children_in_shelter, total_single_adults_in_shelter",
    "$order": "date_of_census DESC", "$limit": 1
  });
  const r = raw[0];
  return {
    date: r.date_of_census?.substring(0, 10),
    total: parseInt(r.total_individuals_in_shelter),
    children: parseInt(r.total_children_in_shelter),
    families: parseInt(r.families_with_children_in_shelter),
    singleAdults: parseInt(r.total_single_adults_in_shelter)
  };
}

async function dhsPeakVsNow() {
  const [peak, low] = await Promise.all([
    q(DHS_API, { "$select": "date_of_census, total_individuals_in_shelter", "$order": "total_individuals_in_shelter DESC", "$limit": 1 }),
    q(DHS_API, { "$select": "date_of_census, total_individuals_in_shelter", "$order": "total_individuals_in_shelter ASC", "$limit": 1 })
  ]);
  return {
    peak: { date: peak[0].date_of_census?.substring(0, 10), total: parseInt(peak[0].total_individuals_in_shelter) },
    low: { date: low[0].date_of_census?.substring(0, 10), total: parseInt(low[0].total_individuals_in_shelter) }
  };
}

// ========== LAYER 4: NYCHA Violations (HPD inspections of NYCHA) ==========

async function nychaViolations() {
  const [byDev, byClass, total] = await Promise.all([
    q(NYCHA_API, { "$select": "development_name, boro_nm, count(*) as total", "$group": "development_name, boro_nm", "$order": "total DESC", "$limit": 10 }),
    q(NYCHA_API, { "$select": "hzrd_clas, count(*) as total", "$group": "hzrd_clas", "$order": "total DESC" }),
    q(NYCHA_API, { "$select": "count(*) as total" })
  ]);
  return {
    byDevelopment: byDev.map(r => ({ name: r.development_name, borough: r.boro_nm, total: parseInt(r.total) })),
    byHazardClass: byClass.map(r => ({ cls: r.hzrd_clas, total: parseInt(r.total) })),
    totalViolations: parseInt(total[0]?.total || 0)
  };
}

// ========== HERO STATS ==========

async function getHeroStats() {
  const [openPriority, dhsNow] = await Promise.all([hpdOpenByPriority(), dhsLatest()]);
  const totalOpen = openPriority.reduce((s, t) => s + t.total, 0);
  const emergencyOpen = openPriority.find(t => t.priority === 'EMERGENCY')?.total || 0;
  return {
    hpdOpenTotal: totalOpen, hpdEmergencyOpen: emergencyOpen,
    shelterTotal: dhsNow.total, shelterChildren: dhsNow.children
  };
}

// ========== LOAD ALL ==========

async function loadAllData() {
  const [hero, avgByType, avgByPriority, avgByBoro, openByType, oldest, shelterTrend, peakVsNow, nycha] = await Promise.all([
    getHeroStats(), hpdAvgDaysByType(), hpdAvgDaysByPriority(), hpdAvgDaysByBorough(),
    hpdOpenByType(), hpdOldestOpen(15), dhsShelterTrend(), dhsPeakVsNow(), nychaViolations()
  ]);
  const hpdManaged = await hpdManagedStats();
  return { hero, avgByType, avgByPriority, avgByBoro, openByType, oldest, shelterTrend, peakVsNow, hpdManaged, nycha };
}
