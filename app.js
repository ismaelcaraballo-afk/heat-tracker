const USE_MOCK=false;
function fmtNum(n){return n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(0)}K`:n.toLocaleString()}
const C={red:"#e94560",orange:"#f0a500",blue:"#3498db",teal:"#4ecca3",purple:"#9b59b6",dark:"#0f3460",
  boros:["#e94560","#3498db","#f0a500","#9b59b6","#4ecca3"],
  types:["#e94560","#f0a500","#4ecca3","#3498db","#9b59b6","#e67e22","#1abc9c","#8e44ad","#2c3e50","#d35400","#27ae60","#c0392b"],
  priority:["#e94560","#f0a500","#4ecca3","#3498db"],
  hazard:["#f0a500","#e94560","#4ecca3"]};
Chart.defaults.color="#aaa";Chart.defaults.borderColor="#333";

function renderHero(h){
  const f=(id,v)=>{const e=document.querySelector(`#${id}`);e.querySelector(".number").textContent=v;e.classList.remove("loading")};
  f("stat-hpd-open",fmtNum(h.hpdOpenTotal));
  f("stat-emergency",fmtNum(h.hpdEmergencyOpen));
  f("stat-shelter",fmtNum(h.shelterTotal));
  f("stat-children",fmtNum(h.shelterChildren));
}

function renderAvgByType(d){
  new Chart(document.getElementById("chart-avg-type"),{type:"bar",data:{
    labels:d.map(x=>x.type?.substring(0,18)),
    datasets:[{data:d.map(x=>parseFloat(x.avgDays)),backgroundColor:d.map(x=>parseFloat(x.avgDays)>25?C.red:parseFloat(x.avgDays)>15?C.orange:C.teal),borderRadius:6}]
  },options:{plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:"Days to Close"}}}}});
}

function renderAvgByBoro(d){
  new Chart(document.getElementById("chart-avg-boro"),{type:"bar",data:{
    labels:d.map(x=>x.borough),datasets:[{data:d.map(x=>parseFloat(x.avgDays)),backgroundColor:C.boros,borderRadius:6}]
  },options:{plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:"Avg Days"}}}}});
}

function renderAvgByPriority(d){
  new Chart(document.getElementById("chart-avg-priority"),{type:"bar",data:{
    labels:d.map(x=>x.priority),datasets:[{data:d.map(x=>parseFloat(x.avgDays)),
    backgroundColor:d.map(x=>x.priority==='IMMEDIATE EMERGENCY'?C.red:x.priority==='EMERGENCY'?C.orange:C.blue),borderRadius:6}]
  },options:{plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:"Avg Days"}}}}});
}

function renderOpenByType(d){
  new Chart(document.getElementById("chart-open-type"),{type:"bar",data:{
    labels:d.map(x=>x.type?.substring(0,18)),datasets:[{data:d.map(x=>x.total),backgroundColor:C.types,borderRadius:4}]
  },options:{indexAxis:"y",plugins:{legend:{display:false}}}});
}

function renderOldest(d){
  const t=document.querySelector("#table-oldest tbody");
  t.innerHTML=d.map((r,i)=>{
    const cls=r.daysOpen>1000?"ancient":r.daysOpen>365?"old":"";
    return `<tr class="${cls}"><td>${i+1}</td><td class="bad">${r.daysOpen.toLocaleString()}d</td><td>${r.received}</td><td>${r.priority}</td><td>${r.type}</td><td>${r.borough}</td><td>${r.address}</td></tr>`;
  }).join("");
}

function renderHPDManaged(d){
  const el = document.getElementById("hpd-managed-stats");
  el.innerHTML = `
    <div class="compare-row">
      <div class="compare-card bad-card"><div class="compare-num">${d.avgDays} days</div><div class="compare-label">HPD-Managed Buildings</div><div class="compare-sub">${d.buildingCount} buildings (Central Mgmt, 7A, HPD-owned)</div></div>
      <div class="compare-card ok-card"><div class="compare-num">14.3 days</div><div class="compare-label">Private Landlord Buildings</div><div class="compare-sub">Citywide average (2023+)</div></div>
    </div>
    <p class="compare-verdict">HPD's own buildings take <strong>${(d.avgDays/14.3).toFixed(1)}x longer</strong> to resolve complaints than the private landlords they regulate. ${d.totalOpen} tickets still open.</p>`;
}

function renderShelterTrend(d){
  new Chart(document.getElementById("chart-shelter"),{type:"line",data:{
    labels:d.map(x=>x.date),datasets:[
      {label:"Total in Shelter",data:d.map(x=>x.total),borderColor:C.red,backgroundColor:C.red+"22",fill:true,tension:.3,pointRadius:0},
      {label:"Children",data:d.map(x=>x.children),borderColor:C.orange,backgroundColor:C.orange+"22",fill:true,tension:.3,pointRadius:0}
    ]
  },options:{plugins:{legend:{position:"top"}},scales:{y:{ticks:{callback:v=>fmtNum(v)}},x:{ticks:{maxTicksLimit:10}}}}});
}

function renderPeakVsNow(peak, now){
  const el = document.getElementById("dhs-peak");
  el.innerHTML = `
    <div class="compare-row">
      <div class="compare-card bad-card"><div class="compare-num">${fmtNum(peak.peak.total)}</div><div class="compare-label">Peak (${peak.peak.date})</div></div>
      <div class="compare-card warn-card"><div class="compare-num">${fmtNum(now)}</div><div class="compare-label">Today</div></div>
      <div class="compare-card ok-card"><div class="compare-num">${fmtNum(peak.low.total)}</div><div class="compare-label">Low (${peak.low.date})</div></div>
    </div>`;
}

function renderNYCHA(d){
  new Chart(document.getElementById("chart-nycha-dev"),{type:"bar",data:{
    labels:d.byDevelopment.map(x=>x.name?.substring(0,18)),
    datasets:[{data:d.byDevelopment.map(x=>x.total),backgroundColor:C.types,borderRadius:4}]
  },options:{indexAxis:"y",plugins:{legend:{display:false}}}});
  new Chart(document.getElementById("chart-nycha-class"),{type:"doughnut",data:{
    labels:d.byHazardClass.map(x=>`Class ${x.cls}`),
    datasets:[{data:d.byHazardClass.map(x=>x.total),backgroundColor:C.hazard}]
  },options:{plugins:{legend:{position:"bottom"}}}});
}

function getMockData(){
  return{hero:{hpdOpenTotal:88048,hpdEmergencyOpen:43962,shelterTotal:85770,shelterChildren:29880},
  avgByType:[{type:"APPLIANCE",avgDays:"31.3"},{type:"GENERAL",avgDays:"28.5"},{type:"WATER LEAK",avgDays:"26.1"},{type:"DOOR/WINDOW",avgDays:"24.8"},{type:"UNSANITARY CONDITION",avgDays:"22.7"},{type:"ELECTRIC",avgDays:"21.1"},{type:"PLUMBING",avgDays:"19.8"},{type:"PAINT/PLASTER",avgDays:"17.2"},{type:"HEAT/HOT WATER",avgDays:"8.3"}],
  avgByPriority:[{priority:"NON EMERGENCY",avgDays:"24.9",total:878879},{priority:"EMERGENCY",avgDays:"10.5",total:1618335},{priority:"IMMEDIATE EMERGENCY",avgDays:"3.6",total:99426}],
  avgByBoro:[{borough:"MANHATTAN",avgDays:"20.3"},{borough:"STATEN ISLAND",avgDays:"17.9"},{borough:"BROOKLYN",avgDays:"14.8"},{borough:"BRONX",avgDays:"13.5"},{borough:"QUEENS",avgDays:"13.1"}],
  openByType:[{type:"UNSANITARY CONDITION",total:14480},{type:"HEAT/HOT WATER",total:14154},{type:"PLUMBING",total:9650},{type:"DOOR/WINDOW",total:7024},{type:"WATER LEAK",total:6269}],
  oldest:[{received:"2020-01-03",type:"HEAT/HOT WATER",priority:"EMERGENCY",borough:"MANHATTAN",address:"123 W 45TH ST",daysOpen:1884}],
  hpdManaged:{avgDays:"53.9",totalClosed:3239,totalOpen:9,buildingCount:943},
  shelterTrend:Array.from({length:30},(_,i)=>({date:`2025-${String(i+1).padStart(2,'0')}-01`,total:80000+Math.random()*5000,children:28000+Math.random()*2000})),
  peakVsNow:{peak:{date:"2023-12-10",total:89558},low:{date:"2021-08-01",total:44586}},
  nycha:{byDevelopment:[{name:"RED HOOK WEST",total:163},{name:"WAGNER",total:158},{name:"RED HOOK EAST",total:114}],byHazardClass:[{cls:"B",total:1416},{cls:"A",total:464},{cls:"C",total:393}],totalViolations:2273}};
}

async function main(){
  const s=document.getElementById("status");
  try{
    const d=USE_MOCK?getMockData():await loadAllData();
    s.textContent=USE_MOCK?"Mock data":`Live data loaded ${new Date().toLocaleTimeString()}`;
    renderHero(d.hero);renderAvgByType(d.avgByType);renderAvgByBoro(d.avgByBoro);
    renderAvgByPriority(d.avgByPriority);renderOpenByType(d.openByType);renderOldest(d.oldest);
    renderHPDManaged(d.hpdManaged);renderShelterTrend(d.shelterTrend);
    renderPeakVsNow(d.peakVsNow,d.hero.shelterTotal);renderNYCHA(d.nycha);
  }catch(e){s.textContent=`Error: ${e.message}`;s.classList.add("error");console.error(e)}
}
document.addEventListener("DOMContentLoaded",main);
