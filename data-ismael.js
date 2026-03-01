/**
 * PERSON A1 — Ismael: HPD Complaints + DOB Cross-Reference
 * Address search, building report card, resolution times, repeat offender detection.
 * Datasets: ygpa-z7cr (HPD, 15.8M) + eabe-havv (DOB Complaints, 3M) + 3h2n-5cm9 (DOB Violations, 2.5M)
 */

const HPD_API = "https://data.cityofnewyork.us/resource/ygpa-z7cr.json";
const DOB_COMP_API = "https://data.cityofnewyork.us/resource/eabe-havv.json";
const DOB_VIOL_API = "https://data.cityofnewyork.us/resource/3h2n-5cm9.json";

async function q(base, params) {
  const url = new URL(base);
  for (const [k,v] of Object.entries(params)) if(v) url.searchParams.set(k,v);
  const r = await fetch(url); if(!r.ok) throw new Error(`API ${r.status}`); return r.json();
}

// ========== ADDRESS SEARCH ==========

function parseAddress(input) {
  const s = input.trim().toUpperCase().replace(/\./g, '').replace(/['"]/g, '');
  const match = s.match(/^(\d+[-\w]*)\s+(.+?)(?:,\s*(BRONX|BROOKLYN|MANHATTAN|QUEENS|STATEN ISLAND))?$/);
  if (!match) return null;
  return { number: match[1], street: match[2].replace(/\s+/g, ' ').trim(), borough: match[3] || null };
}

async function searchBuilding(input) {
  const addr = parseAddress(input);
  if (!addr) return { error: "Enter address like: 1000 Grand Concourse" };

  const where = `upper(street_name)='${addr.street}' AND house_number='${addr.number}'` +
    (addr.borough ? ` AND borough='${addr.borough}'` : '');

  const check = await q(HPD_API, {
    "$select": "house_number, street_name, borough, building_id, count(*) as total",
    "$where": where, "$group": "house_number, street_name, borough, building_id",
    "$order": "total DESC", "$limit": 5
  });

  if (!check.length) return { error: `No HPD complaints for "${input}". Try exact street name from a lease.` };
  const best = check[0];
  return {
    address: `${best.house_number} ${best.street_name}`,
    borough: best.borough, buildingId: best.building_id,
    totalComplaints: parseInt(best.total),
    matches: check.map(r => ({ address: `${r.house_number} ${r.street_name}`, borough: r.borough, total: parseInt(r.total) }))
  };
}

// ========== HPD BUILDING REPORT ==========

async function getHPDReport(streetName, houseNumber, borough) {
  const where = `upper(street_name)='${streetName.toUpperCase()}' AND house_number='${houseNumber}'` +
    (borough ? ` AND borough='${borough}'` : '');

  const [byCategory, heatByYear, avgDays, openTickets, recent] = await Promise.all([
    q(HPD_API, {
      "$select": "major_category, complaint_status, count(*) as total",
      "$where": where, "$group": "major_category, complaint_status",
      "$order": "total DESC", "$limit": 30
    }),
    q(HPD_API, {
      "$select": "date_extract_y(received_date) as year, count(*) as total",
      "$where": `${where} AND (major_category='HEAT/HOT WATER' OR major_category='HEATING')`,
      "$group": "year", "$order": "year DESC", "$limit": 10
    }),
    q(HPD_API, {
      "$select": "major_category, avg(date_diff_d(complaint_status_date,received_date)) as avg_days, count(*) as total",
      "$where": `${where} AND complaint_status='CLOSE'`,
      "$group": "major_category", "$order": "avg_days DESC", "$limit": 15
    }),
    q(HPD_API, {
      "$select": "received_date, major_category, type, problem_code, minor_category",
      "$where": `${where} AND complaint_status='OPEN'`,
      "$order": "received_date DESC", "$limit": 20
    }),
    q(HPD_API, {
      "$select": "received_date, complaint_status_date, major_category, type, complaint_status, problem_code",
      "$where": where, "$order": "received_date DESC", "$limit": 10
    })
  ]);

  // Categories
  const cats = {};
  byCategory.forEach(r => {
    const c = r.major_category;
    if (!cats[c]) cats[c] = { open: 0, closed: 0 };
    if (r.complaint_status === 'OPEN') cats[c].open = parseInt(r.total);
    else cats[c].closed += parseInt(r.total);
  });
  const categoryList = Object.entries(cats)
    .map(([cat, v]) => ({ category: cat, open: v.open, closed: v.closed, total: v.open + v.closed }))
    .sort((a, b) => b.total - a.total);

  // Heat winters
  const heatYears = heatByYear.map(r => ({ year: r.year, total: parseInt(r.total) }));
  const heatWinters = heatYears.filter(y => parseInt(y.year) >= 2018).length;
  const totalHeat = heatYears.reduce((s, y) => s + y.total, 0);

  // Resolution times
  const resolution = avgDays.filter(r => parseInt(r.total) > 2).map(r => ({
    category: r.major_category, avgDays: parseFloat(r.avg_days).toFixed(1), total: parseInt(r.total)
  }));

  // Open tickets
  const now = new Date();
  const open = openTickets.map(r => ({
    received: r.received_date?.substring(0, 10), category: r.major_category,
    priority: r.type, problem: r.problem_code || r.minor_category || "",
    daysOpen: Math.floor((now - new Date(r.received_date)) / 86400000)
  }));

  // Recent
  const recentList = recent.map(r => ({
    received: r.received_date?.substring(0, 10),
    closed: r.complaint_status_date?.substring(0, 10) || null,
    category: r.major_category, priority: r.type,
    status: r.complaint_status, problem: r.problem_code || ""
  }));

  return { categoryList, heatYears, heatWinters, totalHeat, resolution, open, recent: recentList };
}

// ========== DOB CROSS-REFERENCE ==========

async function getDOBComplaints(streetName, houseNumber) {
  const raw = await q(DOB_COMP_API, {
    "$select": "complaint_category, status, date_entered, disposition_date, unit, count(*) as total",
    "$where": `house_street='${streetName}' AND house_number='${houseNumber}'`,
    "$group": "complaint_category, status, date_entered, disposition_date, unit",
    "$order": "date_entered DESC", "$limit": 20
  });
  return raw.map(r => ({
    category: r.complaint_category, status: r.status,
    entered: r.date_entered, disposed: r.disposition_date,
    unit: r.unit, total: parseInt(r.total || 1)
  }));
}

async function getDOBViolations(streetName, houseNumber) {
  const raw = await q(DOB_VIOL_API, {
    "$select": "violation_type, violation_category, description, issue_date",
    "$where": `street='${streetName}' AND house_number='${houseNumber}'`,
    "$order": "issue_date DESC", "$limit": 20
  });
  return raw.map(r => ({
    type: r.violation_type, category: r.violation_category,
    description: r.description?.substring(0, 80), issueDate: r.issue_date
  }));
}

// ========== BUILDING GRADE ==========

function gradeBuilding(hpd, dobComplaints, dobViolations) {
  let score = 100;
  const reasons = [];

  if (hpd.heatWinters >= 5) { score -= 30; reasons.push(`Heat complaints ${hpd.heatWinters} winters running — chronic repeat offender`); }
  else if (hpd.heatWinters >= 3) { score -= 15; reasons.push(`Heat complaints ${hpd.heatWinters} out of recent winters`); }

  if (hpd.open.length >= 5) { score -= 25; reasons.push(`${hpd.open.length} unresolved HPD tickets right now`); }
  else if (hpd.open.length >= 1) { score -= 10; reasons.push(`${hpd.open.length} open HPD ticket(s)`); }

  const heatRes = hpd.resolution.find(r => r.category === 'HEAT/HOT WATER' || r.category === 'HEATING');
  if (heatRes && parseFloat(heatRes.avgDays) > 30) { score -= 20; reasons.push(`Heat repairs avg ${heatRes.avgDays} days (city avg ~8 days)`); }
  else if (heatRes && parseFloat(heatRes.avgDays) > 14) { score -= 10; reasons.push(`Heat repairs avg ${heatRes.avgDays} days`); }

  const totalAll = hpd.categoryList.reduce((s, c) => s + c.total, 0);
  if (totalAll > 500) { score -= 15; reasons.push(`${totalAll.toLocaleString()} total HPD complaints on record`); }
  else if (totalAll > 100) { score -= 5; }

  const activeViol = dobViolations.filter(v => v.category && v.category.includes('ACTIVE'));
  if (activeViol.length >= 5) { score -= 15; reasons.push(`${activeViol.length} active DOB violations`); }
  else if (activeViol.length >= 1) { score -= 5; reasons.push(`${activeViol.length} active DOB violation(s)`); }

  if (dobComplaints.length >= 10) { score -= 10; reasons.push(`${dobComplaints.length}+ DOB complaints on record`); }

  score = Math.max(0, Math.min(100, score));
  let letter, color;
  if (score >= 80) { letter = 'A'; color = '#4ecca3'; }
  else if (score >= 60) { letter = 'B'; color = '#3498db'; }
  else if (score >= 40) { letter = 'C'; color = '#f0a500'; }
  else if (score >= 20) { letter = 'D'; color = '#e67e22'; }
  else { letter = 'F'; color = '#e94560'; }

  return { score, letter, color, reasons };
}

// ========== CITYWIDE CONTEXT ==========

async function getCitywideContext() {
  const [hpdOpen, hpdHeatAvg] = await Promise.all([
    q(HPD_API, { "$select": "count(*) as total", "$where": "complaint_status='OPEN'" }),
    q(HPD_API, { "$select": "avg(date_diff_d(complaint_status_date,received_date)) as avg_days",
      "$where": "complaint_status='CLOSE' AND received_date>='2023-01-01' AND major_category IN('HEAT/HOT WATER','HEATING')" })
  ]);
  return {
    totalOpen: parseInt(hpdOpen[0]?.total || 0),
    cityHeatAvg: parseFloat(hpdHeatAvg[0]?.avg_days || 0).toFixed(1)
  };
}

// ========== FULL BUILDING LOOKUP ==========

async function lookupBuilding(input) {
  const search = await searchBuilding(input);
  if (search.error) return search;

  const [hpd, dobComp, dobViol, citywide] = await Promise.all([
    getHPDReport(search.address.split(' ').slice(1).join(' '), search.address.split(' ')[0], search.borough),
    getDOBComplaints(search.address.split(' ').slice(1).join(' '), search.address.split(' ')[0]),
    getDOBViolations(search.address.split(' ').slice(1).join(' '), search.address.split(' ')[0]),
    getCitywideContext()
  ]);

  const grade = gradeBuilding(hpd, dobComp, dobViol);

  return { search, hpd, dobComplaints: dobComp, dobViolations: dobViol, citywide, grade };
}
