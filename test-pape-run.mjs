#!/usr/bin/env node
/**
 * Node script to test Pape data functions against live NYC Open Data APIs.
 * Run: node test-pape-run.mjs
 */
const DHS_API = "https://data.cityofnewyork.us/resource/k46n-sa2m.json";
const NYCHA_API = "https://data.cityofnewyork.us/resource/im9z-53hg.json";
const SCORECARD_API = "https://data.cityofnewyork.us/resource/dvaj-b7yx.json";

async function q(base, params) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

const SCORECARD_OPEN_COLS = ["highpriority_open_monthly_dob","highpriority_open_monthly_hpd","highpriority_open_monthly_fdny","highpriority_open_monthly_dohmh","mediumpriority_open_monthly_dob","mediumpriority_open_monthly_hpd","mediumpriority_open_monthly_fdny","mediumpriority_open_monthly_dohmh","lowestpriority_open_monthly_dob","lowestpriority_open_monthly_hpd","lowestpriority_open_monthly_fdny","lowestpriority_open_monthly_dohmh","commissionerorder_open_monthly_dob","commissionerorder_open_monthly_hpd","commissionerorder_open_monthly_fdny","commissionerorder_open_monthly_dohmh"];
function scorecardRowTotal(r) { return SCORECARD_OPEN_COLS.reduce((s, col) => s + (parseInt(r[col]) || 0), 0); }
function scorecardRowByAgency(r) {
  return { hpd: [r.highpriority_open_monthly_hpd,r.mediumpriority_open_monthly_hpd,r.lowestpriority_open_monthly_hpd,r.commissionerorder_open_monthly_hpd].reduce((s,c)=>s+(parseInt(c)||0),0),
    dob: [r.highpriority_open_monthly_dob,r.mediumpriority_open_monthly_dob,r.lowestpriority_open_monthly_dob,r.commissionerorder_open_monthly_dob].reduce((s,c)=>s+(parseInt(c)||0),0),
    fdny: [r.highpriority_open_monthly_fdny,r.mediumpriority_open_monthly_fdny,r.lowestpriority_open_monthly_fdny,r.commissionerorder_open_monthly_fdny].reduce((s,c)=>s+(parseInt(c)||0),0),
    dohmh: [r.highpriority_open_monthly_dohmh,r.mediumpriority_open_monthly_dohmh,r.lowestpriority_open_monthly_dohmh,r.commissionerorder_open_monthly_dohmh].reduce((s,c)=>s+(parseInt(c)||0),0) };
}
async function fetchScorecardRows() {
  const select = ["landlord","borough","dhs_bld_id","shelter_name_all",...SCORECARD_OPEN_COLS].join(", ");
  const rows = []; let offset = 0;
  let batch;
  do {
    batch = await q(SCORECARD_API, { "$select": select, "$limit": 50000, "$offset": offset });
    rows.push(...batch);
    offset += batch.length;
  } while (batch.length === 50000);
  return rows;
}

const tests = [
  { name: "dhsLatest", run: async () => {
    const raw = await q(DHS_API, { "$order": "date_of_census DESC", "$limit": 1 });
    if (!raw.length) return null;
    const r = raw[0];
    return { date: r.date_of_census?.substring(0, 10), totalIndividuals: parseInt(r.total_individuals_in_shelter || 0), totalChildren: parseInt(r.total_children_in_shelter || 0) };
  }},
  { name: "dhsTrend(12)", run: async () => {
    const raw = await q(DHS_API, { "$select": "date_extract_y(date_of_census) as yr, date_extract_m(date_of_census) as mo, avg(total_individuals_in_shelter) as avg_pop", "$group": "yr, mo", "$order": "yr DESC, mo DESC", "$limit": 12 });
    return raw.length;
  }},
  { name: "dhsPeakVsNow", run: async () => {
    const [latest, peak] = await Promise.all([q(DHS_API, { "$order": "date_of_census DESC", "$limit": 1 }), q(DHS_API, { "$select": "max(total_individuals_in_shelter) as peak", "$limit": 1 })]);
    return { current: latest[0]?.total_individuals_in_shelter, peak: peak[0]?.peak };
  }},
  { name: "nychaByClass", run: async () => {
    const raw = await q(NYCHA_API, { "$select": "hzrd_clas, count(viol_seq_no) as total", "$group": "hzrd_clas", "$order": "total DESC" });
    return raw.map(r => ({ class: r.hzrd_clas, total: r.total }));
  }},
  { name: "nychaWorstDevelopments(10)", run: async () => {
    const raw = await q(NYCHA_API, { "$select": "development_name, count(viol_seq_no) as total", "$group": "development_name", "$order": "total DESC", "$limit": 10 });
    return raw.length;
  }},
  { name: "nychaByType(10)", run: async () => {
    const raw = await q(NYCHA_API, { "$select": "viol_desc, hzrd_clas, count(viol_seq_no) as total", "$group": "viol_desc, hzrd_clas", "$order": "total DESC", "$limit": 10 });
    return raw.length;
  }},
  { name: "nychaTrend", run: async () => {
    const raw = await q(NYCHA_API, { "$select": "date_extract_y(insp_dt) as yr, count(viol_seq_no) as total", "$group": "yr", "$order": "yr DESC", "$limit": 10 });
    return raw.length;
  }},
  { name: "shelterWorstLandlords(10)", run: async () => {
    const raw = await fetchScorecardRows();
    const byLandlord = {};
    for (const r of raw) {
      if (!r.landlord) continue;
      if (!byLandlord[r.landlord]) byLandlord[r.landlord] = { buildings: new Set(), totalViolations: 0 };
      byLandlord[r.landlord].buildings.add(r.dhs_bld_id);
      byLandlord[r.landlord].totalViolations += scorecardRowTotal(r);
    }
    return Object.entries(byLandlord).map(([landlord, v]) => ({ landlord, buildings: v.buildings.size, totalViolations: v.totalViolations })).sort((a, b) => b.totalViolations - a.totalViolations).slice(0, 10);
  }},
  { name: "shelterViolationsByAgency", run: async () => {
    const raw = await fetchScorecardRows();
    const totals = { total: 0, hpd: 0, dob: 0, fdny: 0, dohmh: 0 };
    for (const r of raw) {
      totals.total += scorecardRowTotal(r);
      const a = scorecardRowByAgency(r);
      totals.hpd += a.hpd; totals.dob += a.dob; totals.fdny += a.fdny; totals.dohmh += a.dohmh;
    }
    return totals;
  }},
  { name: "shelterWorstBuildings(10)", run: async () => {
    const raw = await fetchScorecardRows();
    const byBuilding = {};
    for (const r of raw) {
      const id = r.dhs_bld_id || r.shelter_name_all;
      if (!id) continue;
      if (!byBuilding[id]) byBuilding[id] = { address: r.shelter_name_all, landlord: r.landlord, borough: r.borough, totalViolations: 0, hpdViolations: 0, dobViolations: 0 };
      const t = scorecardRowTotal(r);
      const a = scorecardRowByAgency(r);
      byBuilding[id].totalViolations += t;
      byBuilding[id].hpdViolations += a.hpd;
      byBuilding[id].dobViolations += a.dob;
    }
    return Object.values(byBuilding).sort((a, b) => b.totalViolations - a.totalViolations).slice(0, 10);
  }},
];

console.log("Pape Data Layer — Running tests against NYC Open Data...\n");
let ok = 0, err = 0;
for (const t of tests) {
  try {
    const result = await t.run();
    console.log(`\x1b[32m✓\x1b[0m ${t.name}`);
    if (typeof result === "object" && result !== null && Object.keys(result).length <= 5) {
      console.log("  ", JSON.stringify(result));
    } else if (typeof result === "number") {
      console.log("  ", result, "rows");
    }
    ok++;
  } catch (e) {
    console.log(`\x1b[31m✗\x1b[0m ${t.name}: ${e.message}`);
    err++;
  }
}
console.log(`\n${ok} passed, ${err} failed`);
