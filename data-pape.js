/**
 * PERSON A2 — Pape: DHS Shelters + NYCHA Violations
 * Shelter census (85K+ people, 29K kids) + NYCHA inspection violations
 * Dataset: k46n-sa2m (DHS Daily Report) + im9z-53hg (NYCHA Violations)
 */

const DHS_API = "https://data.cityofnewyork.us/resource/k46n-sa2m.json";
const NYCHA_API = "https://data.cityofnewyork.us/resource/im9z-53hg.json";

// Reuse the query helper from data-ismael.js (loaded first)
// async function q() is already defined

// ========== DHS Shelter Census ==========

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

// ========== NYCHA Violations (HPD inspections of NYCHA) ==========

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
