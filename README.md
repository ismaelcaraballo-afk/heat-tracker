# Ticket Tracker — NYC Housing Maintenance Crisis

## Team
| Person | GitHub | Role |
|--------|--------|------|
| Ismael | ismaelcaraballo-afk | Person A — Data Layer (API calls, all queries) |
| Beatrice | b-mackenzie-alexander | Person B — Frontend (charts, tables, rendering) |
| Pape | papesy384 | Person C — Research + Pitch (solution, numbers, presentation) |

## Quick Start
```bash
cd ~/Documents/hackathon-nyc/ticket-tracker
python3 -m http.server 8000
# Open localhost:8000
```

## Architecture
```
index.html  — page structure, styles (all 3 touch this)
data.js     — Person A (Ismael): ALL API calls, returns clean arrays
app.js      — Person B (Beatrice): Chart.js rendering, tables, mock data
README.md   — Person C (Pape): research, pitch script, solution math
```

## The Pitch (Problem → Data → Solution → Fund Us)

### PROBLEM (30 sec)
NYC housing maintenance is failing at every level:
- 88K open HPD repair tickets for private landlord buildings
- Emergency repairs take 10.5 days to close
- Tickets open since January 2020 — 5 years unresolved
- HPD's own managed buildings take 53.9 days avg (4x worse than private)
- 85,770 people in DHS shelters tonight, 29,880 of them children
- NYCHA repairs go through a separate system (MyNYCHA) — not even in public data

### DATA INSIGHT (60 sec)
Show the charts. Key callouts:
1. "Emergency complaints take 10.5 days. IMMEDIATE emergencies take 3.6 days. Non-emergency? 24.9 days — almost a month."
2. "Manhattan waits 20.3 days avg. Queens waits 13.1. Same city, different service."
3. "HPD manages 943 buildings directly. Their avg resolution: 53.9 days. Private landlords they regulate: 14.3 days. The regulator is 4x worse."
4. "85,770 people in shelter. 29,880 children. Nearly doubled from 44K in 2021. Peak was 89,558 in Dec 2023."
5. "We found tickets filed January 3, 2020 that are STILL OPEN. Five years. No heat. No resolution."

### PROPOSED SOLUTION (60 sec)
1. **Severity-Based Triage Queue** — Auto-escalate tickets open 1+ year. Weight by vulnerability (elderly, children, disabled). No heat in winter cannot sit behind paint complaints.
2. **Fix HPD's Own Buildings First** — Dedicated rapid-repair team for the 943 HPD-managed buildings. You cannot fine landlords while your own buildings are 4x worse.
3. **Public Accountability Dashboard** — Real-time public dashboard. Every open ticket, days waiting, building owner. Tenants check before signing leases. Sunlight = disinfectant.

### WHY FUND US? (30 sec)
- Every open ticket = a family living in unsafe conditions
- NHTSA values each preventable death at $13.2M in societal cost
- HPD already has the data — we just made it visible
- The dashboard costs ~$50K to build and maintain. 88K families benefit immediately.
- "The data exists. The backlog is documented. The question is who will act on it."

## Datasets Used
| Dataset | ID | Rows | What |
|---------|-----|------|------|
| HPD Complaints & Problems | ygpa-z7cr | 15.8M | Private landlord complaints with resolution dates |
| Buildings Subject to HPD Jurisdiction | kj4p-ruqc | 374K | managementprogram field (PVT/NYCHA/CENTRAL MGT/7A/HPD O SITE) |
| NYCHA Housing Violations | im9z-53hg | 2,273 | HPD inspections of NYCHA buildings |
| DHS Daily Report | k46n-sa2m | 1,825 | Shelter census — daily snapshots |

## Key API Queries (For Reference)

### Avg resolution by priority (2023+)
```
NON EMERGENCY:        24.9 days  (878,879 closed)
EMERGENCY:            10.5 days  (1,618,335 closed)
IMMEDIATE EMERGENCY:   3.6 days  (99,426 closed)
```

### Open tickets by type
```
UNSANITARY CONDITION:  14,480
HEAT/HOT WATER:        14,154
PLUMBING:               9,650
DOOR/WINDOW:            7,024
WATER LEAK:             6,269
```

### HPD-Managed vs Private
```
HPD-managed buildings:  53.9 days avg (943 buildings)
Private landlords:      14.3 days avg (citywide)
Ratio:                  3.8x worse
```

### DHS Shelter (as of Feb 27, 2026)
```
Total in shelter:    85,770
Children:            29,880
Peak (Dec 10 2023):  89,558
Low (Aug 1 2021):    44,586
```

### Oldest open tickets
```
Filed Jan 3, 2020 — HEAT/HOT WATER — MANHATTAN — still OPEN
Filed Jan 4, 2020 — WATER LEAK — MANHATTAN — still OPEN
```

## Division of Work

### Person A — Ismael (data.js)
- [x] All API query functions written and tested
- [ ] Test each query loads in browser (open console, call loadAllData())
- [ ] Add any new queries the team needs during hackathon
- [ ] Help Person B debug if API data shape changes

### Person B — Beatrice (app.js + index.html styling)
- [ ] Verify all charts render with mock data (set USE_MOCK=true)
- [ ] Switch to live data (USE_MOCK=false) once Person A confirms
- [ ] Style tweaks — colors, layout, responsive
- [ ] Make sure the comparison cards (HPD-managed vs private) render clean

### Person C — Pape (research + pitch)
- [ ] Practice the pitch script above — time it (should be ~3 min total)
- [ ] Find 2-3 additional stats to strengthen the "Why Fund Us" section
- [ ] Write speaker notes for each slide/section
- [ ] Own the presentation delivery OR help build solution section in index.html
- [ ] Google: "NYC HPD response time audit" — there are city comptroller reports that back up our data
