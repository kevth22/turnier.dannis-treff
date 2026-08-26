import { getLogin } from './auth-utils.js';

const user = getLogin();
const role = String(user?.rolle || '').toLowerCase();
const allowed = ['admin','captain'].includes(role);
const app = document.getElementById('cameraApp');
const denied = document.getElementById('cameraAccessDenied');
if (!allowed) { denied.hidden = false; } else { app.hidden = false; init(); }

function init(){
  const state = { board:'left', bridgeUrl:localStorage.getItem('dart11enCameraBridgeUrl')||'', pin:localStorage.getItem('dart11enCameraBridgePin')||'' };
  buildDartboard();
  bindUi(state);
  if(state.bridgeUrl) testConnection(state);
}

function buildDartboard(){
  const host=document.getElementById('dartboardControl');
  const order=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const cx=250,cy=250;
  const ringDefs=[
    {name:'singleOuter',r1:150,r2:205,fill:['#151515','#e9e9df']},
    {name:'triple',r1:128,r2:150,fill:['#d51e2b','#16865f']},
    {name:'singleInner',r1:55,r2:128,fill:['#151515','#e9e9df']},
    {name:'double',r1:205,r2:228,fill:['#d51e2b','#16865f']}
  ];
  let svg=`<svg viewBox="0 0 500 500" aria-label="Dartboard"><circle cx="250" cy="250" r="244" fill="#080808" stroke="#333" stroke-width="5"/>`;
  const polar=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)];
  const wedge=(r1,r2,a1,a2)=>{const p1=polar(r1,a1),p2=polar(r2,a1),p3=polar(r2,a2),p4=polar(r1,a2);return `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]} A${r2},${r2} 0 0 1 ${p3[0]},${p3[1]} L${p4[0]},${p4[1]} A${r1},${r1} 0 0 0 ${p1[0]},${p1[1]} Z`;};
  order.forEach((num,i)=>{const center=-Math.PI/2+i*2*Math.PI/20,a1=center-Math.PI/20,a2=center+Math.PI/20; ringDefs.forEach(r=>{const alt=i%2; const field=r.name==='triple'?`T${num}`:r.name==='double'?`D${num}`:`S${num}`;svg+=`<path data-hit="${field}" d="${wedge(r.r1,r.r2,a1,a2)}" fill="${r.fill[alt]}" stroke="#777" stroke-width=".6"/>`;}); const lp=polar(237,center); svg+=`<text x="${lp[0]}" y="${lp[1]+7}" fill="#fff" text-anchor="middle" font-size="19" font-weight="800">${num}</text>`;});
  svg+=`<circle data-hit="SB" cx="250" cy="250" r="32" fill="#16865f" stroke="#ddd"/><circle data-hit="DB" cx="250" cy="250" r="14" fill="#d51e2b" stroke="#ddd"/><circle cx="250" cy="250" r="228" fill="none" stroke="#ddd" stroke-width="2"/></svg>`;
  host.innerHTML=svg;
}

function bindUi(state){
  document.querySelectorAll('.camera-board-switch button').forEach(btn=>btn.addEventListener('click',()=>{state.board=btn.dataset.board;document.querySelectorAll('.camera-board-switch button').forEach(b=>b.classList.toggle('active',b===btn));document.getElementById('currentBoardLabel').textContent=state.board==='left'?'Board links':'Board rechts';}));
  document.getElementById('dartboardControl').addEventListener('click',e=>{const hit=e.target.closest('[data-hit]');if(hit) sendFocus(state,hit.dataset.hit);});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>sendFocus(state,b.dataset.preset)));
  document.querySelectorAll('[data-nudge]').forEach(b=>b.addEventListener('click',()=>sendCommand(state,'nudge',{direction:b.dataset.nudge})));
  document.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>sendCommand(state,'zoom',{direction:b.dataset.zoom})));
  const modal=document.getElementById('bridgeModal');
  document.getElementById('bridgeSettingsButton').addEventListener('click',()=>{document.getElementById('bridgeUrl').value=state.bridgeUrl;document.getElementById('bridgePin').value=state.pin;modal.hidden=false;});
  document.getElementById('bridgeModalClose').addEventListener('click',()=>modal.hidden=true);
  document.getElementById('bridgeSave').addEventListener('click',async()=>{state.bridgeUrl=document.getElementById('bridgeUrl').value.trim().replace(/\/$/,'');state.pin=document.getElementById('bridgePin').value.trim();localStorage.setItem('dart11enCameraBridgeUrl',state.bridgeUrl);localStorage.setItem('dart11enCameraBridgePin',state.pin);await testConnection(state);if(document.getElementById('bridgeStatus').textContent.includes('Verbunden')) modal.hidden=true;});
}

async function testConnection(state){
  const status=document.getElementById('bridgeStatus');
  if(!state.bridgeUrl){status.textContent='Bridge-Adresse fehlt';return;}
  status.textContent='Verbindung wird geprüft …';
  try{const r=await fetch(`${state.bridgeUrl}/api/status`,{headers:{'X-Camera-Pin':state.pin}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json();status.textContent=j.streamlabsConnected?'🟢 Verbunden mit Streamlabs':'🟡 Bridge online · Streamlabs getrennt';}
  catch(e){status.textContent='🔴 Nicht erreichbar';}
}

async function sendFocus(state,target){
  const label=target==='full'?'Gesamtansicht':target==='bull'?'Bull':target==='SB'?'Single Bull':target==='DB'?'Bullseye':target;
  document.getElementById('currentTarget').textContent=label;
  await sendCommand(state,'focus',{target});
}

async function sendCommand(state,action,extra={}){
  const msg=document.getElementById('cameraMessage');
  if(!state.bridgeUrl){msg.textContent='⚙️ Bitte zuerst die Streaming-PC-Verbindung einrichten.';msg.className='camera-message error';return;}
  msg.textContent='Wird gesendet …';msg.className='camera-message';
  try{const r=await fetch(`${state.bridgeUrl}/api/camera/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-Camera-Pin':state.pin},body:JSON.stringify({board:state.board,...extra})});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.error||`HTTP ${r.status}`);msg.textContent=`✓ ${state.board==='left'?'Links':'Rechts'}: ${j.label||extra.target||action}`;}
  catch(e){msg.textContent=`Fehler: ${e.message}`;msg.className='camera-message error';}
}
