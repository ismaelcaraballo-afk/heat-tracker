# Heat Tracker — NYC Housing Maintenance Crisis Tool

## Team
- **Ismael** — Data layer (HPD complaints + DOB cross-reference), presentation open/close
- **Pape** — Data layer (DHS shelters + NYCHA violations + shelter scorecard)
- **Beatrice** — Rendering layer (app.js), UI, charts, report card

---

## The Pitch (3 Minutes)

### ISMAEL (60 sec) — The Problem

"Open your phone. Google your landlord's address. What do you find? Nothing useful.

There are 15.8 million HPD complaints in NYC Open Data. 3 million DOB complaints. 85,000 people sleeping in DHS shelters tonight — 30,000 of them children. NYCHA has 2,273 open violations, 393 of them Class C — immediately dangerous to life.

The data exists. It's all public. But no one has connected it for the people who need it most — tenants.

That's what Heat Tracker does."

### PAPE (60 sec) — The Data

"We pull from four city agencies in real time — no downloads, no PDFs.

**HPD** — 15.8 million complaint records. We calculate resolution times, track repeat offenders by winter, and flag buildings with chronic heat failures.

**DOB** — 3 million complaints and 2.5 million violations. We cross-reference by address so you see the FULL picture of what's wrong with a building — not just what HPD knows.

**DHS** — Daily shelter census. Right now, [LIVE NUMBER] people are in shelter. We track the trend and show how close we are to the all-time peak.

**NYCHA** — 2,273 violations from HPD inspections of public housing. 393 Class C — heat, lead, mold, structural. The buildings the city owns are failing too.

We cross-reference all of this by address. One search. Every agency."

### BEATRICE (30 sec) — The Solution

"Heat Tracker is a tool, not a dashboard.

A tenant types in their address and gets a building report card — letter grade A through F. It shows how many heat complaints have been filed, how long the landlord takes to fix them, whether DOB has violations on file, and how the building compares to the city average.

At the bottom: direct links to file a 311 complaint, check the DOB record, and know your rights."

### ISMAEL (30 sec) — Why Fund This

"We are not showing you data. We are giving tenants a weapon.

Before signing a lease — look up the building. Living without heat — see how many others filed before you. Going to housing court — print the report card.

Every data point is live from NYC Open Data. No API key. No backend. Pure public data, made useful.

Heat Tracker. Because the city has the data. Tenants deserve access to it."

---

## Stat Reference (for Q&A)

| Stat | Value | Source |
|------|-------|--------|
| HPD complaints on record | 15.8M | ygpa-z7cr |
| DOB complaints on record | 3.06M | eabe-havv |
| DOB violations on record | 2.47M | 3h2n-5cm9 |
| People in DHS shelter (latest) | ~85,770 | k46n-sa2m |
| Children in shelter | ~29,880 | k46n-sa2m |
| All-time shelter peak | 89,558 | k46n-sa2m |
| NYCHA violations (HPD inspections) | 2,273 | im9z-53hg |
| NYCHA Class C (hazardous) | 393 | im9z-53hg |
| HPD emergency avg resolution | 10.5 days | Calculated from ygpa-z7cr |
| HPD-managed buildings avg | 53.9 days (4x worse) | Calculated from ygpa-z7cr + kj4p-ruqc |
| Oldest open HPD ticket | Jan 3, 2020 | ygpa-z7cr |

## Anticipated Q&A

**"Why not just use HPD Online?"**
HPD Online shows individual complaints. We cross-reference HPD + DOB + grade the building. No other tool does that.

**"What about NYCHA tenants?"**
HPD doesn't take complaints for NYCHA buildings — those go through NYCHA Customer Care. Our dashboard shows NYCHA violation data from HPD inspections, and the DHS shelter crisis data. The building lookup works for all HPD-jurisdiction buildings (private landlords + HPD-managed).

**"Is this real-time?"**
Yes. Every query hits the live Socrata API. Data is as current as NYC Open Data publishes it (usually within 24-48 hours).

**"How do you calculate the grade?"**
Multi-factor: heat complaint winters (repeat offender check), open tickets right now, avg resolution time vs city average, total complaint volume, active DOB violations. Weighted scoring, letter grade A-F.

## File Structure

```
heat-tracker/
├── data-ismael.js   ← Ismael: HPD + DOB cross-reference, address search, building grade
├── data-pape.js     ← Pape: DHS shelter, NYCHA violations, shelter scorecard
├── data.js          ← Glue: combines both data layers
├── app.js           ← Beatrice: rendering, charts, search UI, report card
├── index.html       ← Full tool (dashboard + building lookup)
├── PITCH.md         ← This file
└── README.md        ← Setup + architecture
```
