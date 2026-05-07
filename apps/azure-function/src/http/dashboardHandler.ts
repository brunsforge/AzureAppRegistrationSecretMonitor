import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit } from '@azure/functions';

app.http('dashboard', {
  methods: ['GET'],
  route: 'dashboard',
  authLevel: 'anonymous',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const selectedTenant = req.query.get('tenant') ?? '';
    const selectedEnv = req.query.get('env') ?? '';
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: buildDashboardHtml(selectedTenant, selectedEnv),
    };
  },
});

function buildDashboardHtml(initialTenant: string, initialEnv: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AARM Dashboard</title>
<style>
  :root { --bg:#0f172a;--surface:#1e293b;--border:#334155;--text:#e2e8f0;--sub:#94a3b8;
          --critical:#ef4444;--warning:#f59e0b;--ok:#22c55e;--accent:#3b82f6; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;padding:1.5rem}
  h1{font-size:1.4rem;margin-bottom:1rem;color:var(--accent)}
  .controls{display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem;align-items:center}
  select,button{background:var(--surface);color:var(--text);border:1px solid var(--border);
    padding:.5rem .9rem;border-radius:.375rem;font-size:.875rem;cursor:pointer}
  button:hover{background:var(--accent)}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:.5rem;
    padding:1rem;text-align:center}
  .card .n{font-size:2rem;font-weight:700}
  .card .l{font-size:.75rem;color:var(--sub);margin-top:.25rem}
  .critical .n{color:var(--critical)} .warning .n{color:var(--warning)} .ok .n{color:var(--ok)}
  table{width:100%;border-collapse:collapse;font-size:.8rem}
  th{text-align:left;padding:.5rem .75rem;color:var(--sub);border-bottom:1px solid var(--border)}
  td{padding:.5rem .75rem;border-bottom:1px solid var(--border)}
  tr:hover td{background:var(--surface)}
  .badge{display:inline-block;padding:.1rem .4rem;border-radius:.25rem;font-size:.7rem;font-weight:600}
  .Critical{background:#7f1d1d;color:#fca5a5} .High{background:#78350f;color:#fcd34d}
  .Medium{background:#713f12;color:#fde68a} .Low{background:#14532d;color:#86efac}
  .None{background:#1e3a5f;color:#93c5fd}
  #status{font-size:.75rem;color:var(--sub);margin-bottom:.75rem}
</style>
</head>
<body>
<h1>Azure App Registration Monitor</h1>
<div class="controls">
  <select id="tenantSel"></select>
  <select id="envSel"></select>
  <button onclick="load()">Refresh</button>
</div>
<div id="status">Loading…</div>
<div class="cards" id="cards"></div>
<table><thead><tr>
  <th>Risk</th><th>App</th><th>Secret</th><th>Expires</th><th>Days</th><th>Status</th>
</tr></thead><tbody id="tbody"></tbody></table>

<script>
const BASE = '';
let tenants = [];

async function init() {
  const r = await fetch(BASE+'/api/tenants', {headers:{'x-functions-key':getKey()}}).catch(()=>null);
  if(!r||!r.ok){setStatus('Could not load tenants — check function key');return;}
  tenants = await r.json();
  const sel = document.getElementById('tenantSel');
  sel.innerHTML = tenants.map(t=>'<option value="'+t.tenantId+'">'+t.tenantId+'</option>').join('');
  const params = new URLSearchParams(location.search);
  if(params.get('tenant')) sel.value = params.get('tenant');
  sel.onchange = () => { fillEnvs(); load(); };
  fillEnvs();
  if(params.get('env')) document.getElementById('envSel').value = params.get('env');
  load();
}

function fillEnvs() {
  const tid = document.getElementById('tenantSel').value;
  const t = tenants.find(x=>x.tenantId===tid);
  const envSel = document.getElementById('envSel');
  envSel.innerHTML = (t?.environments||[]).map(e=>'<option>'+e+'</option>').join('');
  envSel.onchange = load;
}

async function load() {
  const tid = document.getElementById('tenantSel').value;
  const env = document.getElementById('envSel').value;
  if(!tid||!env){setStatus('Select a tenant and environment');return;}
  setStatus('Loading…');
  const r = await fetch(BASE+'/api/tenants/'+tid+'/environments/'+env+'/secrets',
    {headers:{'x-functions-key':getKey()}}).catch(()=>null);
  if(!r||!r.ok){setStatus('No data — run a scan first');render([]);return;}
  const {data,metadata} = await r.json();
  setStatus('Last scan: '+(metadata?.generatedAt||'unknown'));
  render(data||[]);
}

function render(apps) {
  let secrets=[],total=0,exp=0,crit=0;
  for(const a of apps) for(const s of (a.secrets||[])){
    secrets.push(s); total++;
    if(s.status==='Expired'||s.riskLevel==='Critical') crit++;
    else if(s.riskLevel==='High'||s.status==='ExpiringSoon') exp++;
  }
  document.getElementById('cards').innerHTML =
    card(total,'Total Secrets','')+card(crit,'Critical','critical')+
    card(exp,'Expiring','warning')+card(total-crit-exp,'Healthy','ok');
  document.getElementById('tbody').innerHTML = secrets
    .sort((a,b)=>(a.daysUntilExpiry??999)-(b.daysUntilExpiry??999))
    .map(s=>'<tr><td><span class="badge '+s.riskLevel+'">'+s.riskLevel+'</span></td>'+
      '<td>'+esc(s.appDisplayName)+'</td><td>'+esc(s.displayName||s.keyId)+'</td>'+
      '<td>'+(s.endDateTime||'—').slice(0,10)+'</td>'+
      '<td>'+(s.daysUntilExpiry??'—')+'</td><td>'+s.status+'</td></tr>').join('');
}

function card(n,label,cls){return'<div class="card '+cls+'"><div class="n">'+n+'</div><div class="l">'+label+'</div></div>';}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function setStatus(t){document.getElementById('status').textContent=t;}
function getKey(){return localStorage.getItem('aarm_fn_key')||prompt('Function key:')||'';}

init();
</script>
</body>
</html>`;
}
