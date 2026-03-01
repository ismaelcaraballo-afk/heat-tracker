/**
 * Heat Tracker — Data Glue Layer
 * Combines data-ismael.js (HPD + DOB) and data-pape.js (DHS + NYCHA + Shelter Scorecard)
 * into a single interface for app.js to call.
 *
 * Load order: data-ismael.js → data-pape.js → data.js → app.js
 */

// ========== HERO STATS (dashboard top row) ==========

async function getHeroStats() {
  const [citywide, pape] = await Promise.all([
    getCitywideContext(),
    getPapeHeroStats()
  ]);
  return {
    // HPD (from data-ismael.js)
    hpdOpenTotal: citywide.totalOpen,
    cityHeatAvgDays: citywide.cityHeatAvg,
    // DHS + NYCHA (from data-pape.js)
    shelterPop: pape.shelterPop,
    shelterChildren: pape.shelterChildren,
    shelterDate: pape.shelterDate,
    pctOfPeak: pape.pctOfPeak,
    nychaViolations: pape.nychaViolations,
    nychaClassC: pape.nychaClassC
  };
}

// ========== FULL DASHBOARD DATA (citywide view) ==========

async function loadDashboardData() {
  const [hero, dhsTrendData, nychaClassData, nychaDevs, nychaTypes, nychaTrendData] = await Promise.all([
    getHeroStats(),
    dhsTrend(12),
    nychaByClass(),
    nychaWorstDevelopments(10),
    nychaByType(10),
    nychaTrend()
  ]);

  // Try shelter data (may fail — scorecard is stale)
  let shelterLandlords = [], shelterAgencies = null, shelterBuildings = [];
  try {
    [shelterLandlords, shelterAgencies, shelterBuildings] = await Promise.all([
      shelterWorstLandlords(10),
      shelterViolationsByAgency(),
      shelterWorstBuildings(10)
    ]);
  } catch(e) { console.warn("Shelter scorecard data unavailable:", e.message); }

  return {
    hero,
    dhs: { trend: dhsTrendData },
    nycha: {
      byClass: nychaClassData,
      worstDevelopments: nychaDevs,
      byType: nychaTypes,
      trend: nychaTrendData
    },
    shelters: {
      worstLandlords: shelterLandlords,
      byAgency: shelterAgencies,
      worstBuildings: shelterBuildings
    }
  };
}

// ========== BUILDING LOOKUP (address search) ==========
// lookupBuilding() is defined in data-ismael.js — this is the main entry point
// app.js calls: lookupBuilding(addressInput) directly
