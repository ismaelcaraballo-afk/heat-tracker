/**
 * GLUE FILE — Loads data from both layers and combines into one object
 * data-ismael.js: HPD complaints + HPD-managed buildings (loaded first)
 * data-pape.js:   DHS shelters + NYCHA violations (loaded second)
 *
 * Both files define their own async functions. This file wires them
 * together into loadAllData() which app.js calls.
 */

async function getHeroStats() {
  const [openPriority, dhsNow] = await Promise.all([hpdOpenByPriority(), dhsLatest()]);
  const totalOpen = openPriority.reduce((s, t) => s + t.total, 0);
  const emergencyOpen = openPriority.find(t => t.priority === 'EMERGENCY')?.total || 0;
  return {
    hpdOpenTotal: totalOpen, hpdEmergencyOpen: emergencyOpen,
    shelterTotal: dhsNow.total, shelterChildren: dhsNow.children
  };
}

async function loadAllData() {
  const [hero, avgByType, avgByPriority, avgByBoro, openByType, oldest, shelterTrend, peakVsNow, nycha] = await Promise.all([
    getHeroStats(), hpdAvgDaysByType(), hpdAvgDaysByPriority(), hpdAvgDaysByBorough(),
    hpdOpenByType(), hpdOldestOpen(15), dhsShelterTrend(), dhsPeakVsNow(), nychaViolations()
  ]);
  const hpdManaged = await hpdManagedStats();
  return { hero, avgByType, avgByPriority, avgByBoro, openByType, oldest, shelterTrend, peakVsNow, hpdManaged, nycha };
}
