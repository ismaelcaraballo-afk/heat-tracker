/**
 * PERSON A1 — Ismael: HPD Complaints + HPD-Managed Buildings
 * Private landlord repair queue (15.8M rows) + cross-reference HPD's own buildings
 * Dataset: ygpa-z7cr (HPD Complaints) + kj4p-ruqc (HPD Buildings Jurisdiction)
 */

const HPD_API = "https://data.cityofnewyork.us/resource/ygpa-z7cr.json";
const BLDG_API = "https://data.cityofnewyork.us/resource/kj4p-ruqc.json";

async function q(base, params) {
  const url = new URL(base);
  for (const [k,v] of Object.entries(params)) if(v) url.searchParams.set(k,v);
  const r = await fetch(url); if(!r.ok) throw new Error(`API ${r.status}`); return r.json();
}

// ========== HPD Private Landlord Complaints ==========

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

// ========== HPD-Managed Buildings (Cross-Ref) ==========

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
