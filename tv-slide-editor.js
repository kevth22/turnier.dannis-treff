import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc, onSnapshot, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4',
  authDomain: 'dannistreffturnier.firebaseapp.com',
  projectId: 'dannistreffturnier',
  storageBucket: 'dannistreffturnier.firebasestorage.app',
  messagingSenderId: '829873084116',
  appId: '1:829873084116:web:683bbf1ea3e58f1a4ecd41'
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const user = (() => { try { return JSON.parse(sessionStorage.getItem('dart11enLogin') || localStorage.getItem('dart11enLogin') || 'null'); } catch { return null; } })();
const isAdmin = String(user?.rolle || '').toLowerCase() === 'admin';
const editor = document.getElementById('tvSlideEditor');
const canvas = document.getElementById('tvSlideCanvas');
const list = document.getElementById('tvSlideList');
const message = document.getElementById('tvSlideMessage');
const builtInBox = document.getElementById('tvBuiltInSlideSettings');
let slides = [];
let current = null;
let selectedId = null;
let operation = null;

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const clamp = (v,min,max) => Math.max(min, Math.min(max,v));
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultSlide = () => ({ title:'Neue Folie', active:true, duration:10, background:'#08090d', order: 100 + slides.length, elements:[] });
const builtIns=[['slideAktuelleSpiele','Aktuelle Spiele',1],['slideNaechsteSpiele','Nächste Spiele',2],['slideTurnierbaum','Turnierbaum',3],['slideGewinnerbaum','Gewinnerbaum',4],['slideVerliererbaum','Verliererbaum',5],['slideFinale','Grand Final',6],['slideGruppen','Gruppenphase',7],['slideGruppenKo','K.-o.-Phasen',8]];
let rotationSettings={};

function normalize(slide){
  return { ...defaultSlide(), ...slide, elements:Array.isArray(slide.elements)?slide.elements:[] };
}
function setMessage(text, error=false){ if(message){ message.textContent=text; message.classList.toggle('error',error); } }
function fillMeta(){ if(!current)return; document.getElementById('tvSlideTitle').value=current.title||'';document.getElementById('tvSlideDuration').value=current.duration||10;document.getElementById('tvSlideOrder').value=Number(current.order)||100;document.getElementById('tvSlideActive').checked=current.active!==false;document.getElementById('tvSlideBackground').value=current.background||'#08090d'; }

function applyElementStyle(dom, el){
  if(!dom || !el) return;
  dom.style.left = `${Number(el.x)||0}%`;
  dom.style.top = `${Number(el.y)||0}%`;
  dom.style.width = `${Number(el.w)||10}%`;
  dom.style.height = `${Number(el.h)||10}%`;
  dom.style.zIndex = String(Number(el.z)||1);
  if(el.type === 'text'){
    dom.style.color = el.color || '#ffffff';
    dom.style.fontSize = `${Number(el.fontSize)||42}px`;
    dom.style.textAlign = el.align || 'center';
    dom.style.fontWeight = el.bold === false ? '400' : '800';
    const textNode = dom.querySelector('[data-editor-text]');
    if(textNode) textNode.textContent = el.text || 'Text';
  }
}
function updateElementPreview(el){
  if(!el || !canvas) return;
  applyElementStyle(canvas.querySelector(`[data-eid="${el.id}"]`), el);
  updatePropertyReadouts(el);
}
function updatePropertyReadouts(el){
  const values={propX:el.x,propY:el.y,propW:el.w,propH:el.h,propFont:el.fontSize};
  Object.entries(values).forEach(([id,value])=>{
    const out=document.querySelector(`[data-value-for="${id}"]`);
    if(out) out.textContent = `${Number(value)||0}${id==='propFont'?' px':' %'}`;
  });
}

function renderList(){
  if(!list) return;
  list.innerHTML = slides.length ? slides.map((s,i)=>`<button type="button" class="tv-slide-list-item ${current?.id===s.id?'active':''}" data-id="${s.id}"><span>${i+1}. ${safe(s.title || 'Ohne Titel')}</span><small>${s.active===false?'deaktiviert':`${Number(s.duration)||10} Sek.`}</small></button>`).join('') : '<p class="section-text">Noch keine eigenen Folien vorhanden.</p>';
  list.querySelectorAll('[data-id]').forEach(btn=>btn.addEventListener('click',()=>selectSlide(btn.dataset.id)));
}

function selectSlide(id){
  const found=slides.find(s=>s.id===id); if(!found) return;
  current=structuredClone(found); selectedId=null;
  fillMeta();
  renderList(); renderCanvas();
}

function renderCanvas(){
  if(!canvas || !current) return;
  canvas.style.background=current.background||'#08090d';
  canvas.innerHTML=current.elements.map(el=>{
    const common=`left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;z-index:${el.z||1};`;
    const cls=`tv-editor-element ${selectedId===el.id?'selected':''}`;
    if(el.type==='image') return `<div class="${cls}" data-eid="${el.id}" style="${common}"><img src="${el.src}" alt=""><span class="resize-handle" aria-hidden="true"></span></div>`;
    return `<div class="${cls} tv-editor-text" data-eid="${el.id}" style="${common}color:${el.color||'#fff'};font-size:${el.fontSize||42}px;text-align:${el.align||'center'};font-weight:${el.bold===false?400:800};"><div data-editor-text>${safe(el.text||'Text')}</div><span class="resize-handle" aria-hidden="true"></span></div>`;
  }).join('');
  canvas.querySelectorAll('.tv-editor-element').forEach(el=>{
    el.addEventListener('pointerdown',startPointer,{passive:false});
    el.addEventListener('click',()=>{ selectedId=el.dataset.eid; el.classList.add('selected'); renderProperties(); });
  });
  renderProperties();
}

function renderProperties(){
  const box=document.getElementById('tvElementProperties'); if(!box) return;
  const el=current?.elements.find(e=>e.id===selectedId);
  if(!el){ box.innerHTML='<p class="section-text">Tippe in der Vorschau auf ein Bild oder einen Text.</p>'; return; }
  const slider=(id,label,min,max,value,step='0.5',unit='%')=>`<label class="tv-live-control"><span>${label}<output data-value-for="${id}">${Number(value)||0} ${unit}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  box.innerHTML=`
    <div class="tv-selected-head"><strong>${el.type==='image'?'🖼️ Bild':'T Text'} ausgewählt</strong><span>Änderungen erscheinen sofort oben.</span></div>
    ${el.type==='text'?`<label>Text<textarea id="propText" rows="3">${safe(el.text)}</textarea></label><div class="tv-prop-grid">${slider('propFont','Schriftgröße',16,120,el.fontSize||42,1,'px')}<label>Farbe<input id="propColor" type="color" value="${el.color||'#ffffff'}"></label><label>Ausrichtung<select id="propAlign"><option value="left">Links</option><option value="center">Mittig</option><option value="right">Rechts</option></select></label><label class="settings-row"><span>Fett</span><input id="propBold" type="checkbox" ${el.bold===false?'':'checked'}></label></div>`:''}
    <div class="tv-position-controls">
      ${slider('propX','Links / rechts',0,Math.max(0,100-el.w),el.x)}
      ${slider('propY','Oben / unten',0,Math.max(0,100-el.h),el.y)}
      ${slider('propW','Breite',5,Math.max(5,100-el.x),el.w)}
      ${slider('propH','Höhe',5,Math.max(5,100-el.y),el.h)}
    </div>
    <div class="tv-nudge-controls"><button type="button" data-nudge="left">←</button><button type="button" data-nudge="up">↑</button><button type="button" data-nudge="down">↓</button><button type="button" data-nudge="right">→</button></div>
    <div class="tv-prop-grid"><label>Ebene<input id="propZ" type="number" min="1" max="99" value="${el.z||1}"></label><button id="propDelete" type="button" class="main-button danger-button">Element löschen</button></div>`;
  if(el.type==='text'){
    box.querySelector('#propAlign').value=el.align||'center';
    [['propText','input','text'],['propFont','input','fontSize'],['propColor','input','color'],['propAlign','change','align']].forEach(([id,event,key])=>box.querySelector('#'+id)?.addEventListener(event,e=>{ el[key]=key==='fontSize'?Number(e.target.value):e.target.value; updateElementPreview(el); }));
    box.querySelector('#propBold')?.addEventListener('change',e=>{el.bold=e.target.checked;updateElementPreview(el);});
  }
  [['propX','x'],['propY','y'],['propW','w'],['propH','h']].forEach(([id,key])=>box.querySelector('#'+id)?.addEventListener('input',e=>{
    el[key]=Number(e.target.value);
    if(key==='x') box.querySelector('#propW')?.setAttribute('max',String(Math.max(5,100-el.x)));
    if(key==='y') box.querySelector('#propH')?.setAttribute('max',String(Math.max(5,100-el.y)));
    updateElementPreview(el);
  }));
  box.querySelectorAll('[data-nudge]').forEach(btn=>btn.addEventListener('click',()=>{const d=btn.dataset.nudge;if(d==='left')el.x=clamp(el.x-1,0,100-el.w);if(d==='right')el.x=clamp(el.x+1,0,100-el.w);if(d==='up')el.y=clamp(el.y-1,0,100-el.h);if(d==='down')el.y=clamp(el.y+1,0,100-el.h);updateElementPreview(el);renderProperties();}));
  box.querySelector('#propZ')?.addEventListener('input',e=>{el.z=Number(e.target.value);updateElementPreview(el);});
  box.querySelector('#propDelete')?.addEventListener('click',()=>{current.elements=current.elements.filter(e=>e.id!==selectedId);selectedId=null;renderCanvas();});
  updatePropertyReadouts(el);
}

function pointOf(e){const t=e.touches?.[0]||e.changedTouches?.[0]||e;return {x:t.clientX,y:t.clientY};}
function startPointer(e){
  if(!current) return;
  if(e.cancelable)e.preventDefault(); e.stopPropagation();
  const target=e.currentTarget;
  selectedId=target.dataset.eid;
  const el=current.elements.find(x=>x.id===selectedId); if(!el) return;
  canvas.querySelectorAll('.tv-editor-element').forEach(n=>n.classList.toggle('selected',n===target));
  renderProperties();
  const pt=pointOf(e), rect=canvas.getBoundingClientRect();
  operation={el,resize:e.target.classList.contains('resize-handle'),sx:pt.x,sy:pt.y,x:el.x,y:el.y,w:el.w,h:el.h,rect,target};
  canvas.classList.add('dragging');
  if(e.pointerId!=null){try{target.setPointerCapture(e.pointerId)}catch{}}
}
function movePointer(e){
  if(!operation)return;if(e.cancelable)e.preventDefault();
  const pt=pointOf(e);const dx=(pt.x-operation.sx)/operation.rect.width*100;const dy=(pt.y-operation.sy)/operation.rect.height*100;
  if(operation.resize){operation.el.w=clamp(operation.w+dx,5,100-operation.el.x);operation.el.h=clamp(operation.h+dy,5,100-operation.el.y)}else{operation.el.x=clamp(operation.x+dx,0,100-operation.el.w);operation.el.y=clamp(operation.y+dy,0,100-operation.el.h)}
  updateElementPreview(operation.el);
}
function endPointer(e){if(!operation)return;if(e?.cancelable)e.preventDefault();operation=null;canvas.classList.remove('dragging');renderProperties();}
window.addEventListener('pointermove',movePointer,{passive:false,capture:true});window.addEventListener('pointerup',endPointer,{passive:false,capture:true});window.addEventListener('pointercancel',endPointer,{passive:false,capture:true});

async function imageToDataUrl(file){
  if(!file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.');
  const bitmap=await createImageBitmap(file); const maxW=1600,maxH=900; const scale=Math.min(1,maxW/bitmap.width,maxH/bitmap.height);
  const c=document.createElement('canvas'); c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);
  c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.78);
}

async function saveCurrent(){
  if(!isAdmin||!current) return;
  current.title=document.getElementById('tvSlideTitle').value.trim()||'Ohne Titel';
  current.duration=clamp(Number(document.getElementById('tvSlideDuration').value)||10,3,120);
  current.active=document.getElementById('tvSlideActive').checked;
  current.background=document.getElementById('tvSlideBackground').value;
  current.order=Math.max(1,Number(document.getElementById('tvSlideOrder').value)||100);
  const payload={title:current.title,duration:current.duration,active:current.active,background:current.background,order:Number(current.order)||0,elements:current.elements,updatedAt:serverTimestamp(),updatedBy:user?.benutzername||user?.nickname||'admin'};
  try{
    setMessage('Folie wird gespeichert …');
    if(current.id) await updateDoc(doc(db,'tvSlides',current.id),payload);
    else { const ref=await addDoc(collection(db,'tvSlides'),{...payload,createdAt:serverTimestamp()}); current.id=ref.id; }
    setMessage('Folie gespeichert. Sie erscheint automatisch in der TV-Rotation.');
  }catch(err){ console.error(err); setMessage('Speichern fehlgeschlagen. Prüfe Firestore-Regeln und Bildgröße.',true); }
}

if(editor && isAdmin){
  editor.hidden=false;
  document.querySelectorAll('.tv-editor-menu-button[data-tv-panel]').forEach(btn=>btn.addEventListener('click',()=>{const name=btn.dataset.tvPanel;document.querySelectorAll('.tv-editor-menu-button[data-tv-panel]').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('[data-tv-panel-content]').forEach(panel=>panel.hidden=panel.dataset.tvPanelContent!==name);}));
  const newSlide=()=>{ current=defaultSlide(); selectedId=null; fillMeta(); renderList();renderCanvas();setMessage('Neue Folie angelegt. Füge Text oder Bilder hinzu und speichere sie.'); };
  document.getElementById('tvSlideNew')?.addEventListener('click',newSlide);
  document.getElementById('tvAddText')?.addEventListener('click',()=>{ if(!current) current=defaultSlide(); const el={id:uid(),type:'text',text:'Neuer Text',x:15,y:20,w:70,h:18,z:2,color:'#ffffff',fontSize:48,align:'center',bold:true};current.elements.push(el);selectedId=el.id;renderCanvas();});
  document.getElementById('tvAddImage')?.addEventListener('change',async e=>{ const file=e.target.files?.[0];if(!file)return;try{setMessage('Bild wird vorbereitet …');const src=await imageToDataUrl(file);if(!current)current=defaultSlide();const el={id:uid(),type:'image',src,x:20,y:15,w:60,h:65,z:1};current.elements.push(el);selectedId=el.id;renderCanvas();setMessage('Bild hinzugefügt. Position und Größe können direkt verändert werden.');}catch(err){setMessage(err.message,true);}e.target.value='';});
  document.getElementById('tvSlideDuplicate')?.addEventListener('click',()=>{if(!current)return newSlide();current={...structuredClone(current),id:undefined,title:(current.title||'Folie')+' – Kopie',order:(Number(current.order)||100)+1};current.elements=current.elements.map(e=>({...e,id:uid()}));selectedId=null;fillMeta();renderList();renderCanvas();setMessage('Kopie erstellt. Speichere sie als zusätzliche Folie.');});
  document.getElementById('tvSlideSave')?.addEventListener('click',saveCurrent);
  document.getElementById('tvSlideSaveNew')?.addEventListener('click',async()=>{await saveCurrent();newSlide();});
  document.getElementById('tvSlideDelete')?.addEventListener('click',async()=>{if(!current?.id||!confirm('Diese TV-Folie endgültig löschen?'))return;await deleteDoc(doc(db,'tvSlides',current.id));current=null;canvas.innerHTML='';});
  document.getElementById('tvSlideBackground')?.addEventListener('input',e=>{if(current){current.background=e.target.value;canvas.style.background=current.background;}});
}


function defaultRotation(){return Object.fromEntries(builtIns.map(([id,,order])=>[id,{order,duration:10,active:true}]));}
function renderBuiltInSettings(){
 if(!builtInBox||!isAdmin)return;const cfg={...defaultRotation(),...rotationSettings};
 builtInBox.innerHTML=builtIns.map(([id,label,order])=>{const v=cfg[id]||{order,duration:10,active:true};return `<div class="tv-built-in-row" data-slide-id="${id}"><strong>${safe(label)}</strong><label>Reihenfolge<input class="builtin-order" type="number" min="1" max="999" value="${Number(v.order)||order}"></label><label>Dauer (Sek.)<input class="builtin-duration" type="number" min="3" max="120" value="${Number(v.duration)||10}"></label><label class="settings-row"><span>Aktiv</span><input class="builtin-active" type="checkbox" ${v.active===false?'':'checked'}></label></div>`}).join('');
 builtInBox.querySelectorAll('.tv-built-in-row').forEach(row=>row.querySelectorAll('input').forEach(input=>input.addEventListener('change',async()=>{const id=row.dataset.slideId;const value={order:Math.max(1,Number(row.querySelector('.builtin-order').value)||1),duration:clamp(Number(row.querySelector('.builtin-duration').value)||10,3,120),active:row.querySelector('.builtin-active').checked};rotationSettings={...rotationSettings,[id]:value};await setDoc(doc(db,'tvSettings','rotation'),{slides:rotationSettings,updatedAt:serverTimestamp()},{merge:true});applyRotationSettings();setMessage('TV-Reihenfolge gespeichert.');})));
}
function applyRotationSettings(){
 const tv=document.getElementById('tvAnsicht');if(!tv)return;const cfg={...defaultRotation(),...rotationSettings};
 builtIns.forEach(([id,,fallback])=>{const node=document.getElementById(id);if(!node)return;const v=cfg[id]||{};node.dataset.order=String(Number(v.order)||fallback);node.dataset.duration=String(clamp(Number(v.duration)||10,3,120));node.dataset.rotationActive=v.active===false?'false':'true';node.style.display=v.active===false?'none':'';});
 [...tv.querySelectorAll('.tv-slide')].sort((a,b)=>(Number(a.dataset.order)||500)-(Number(b.dataset.order)||500)).forEach(n=>tv.appendChild(n));window.dispatchEvent(new CustomEvent('dart11en-tv-slides-updated'));
}
onSnapshot(doc(db,'tvSettings','rotation'),snap=>{rotationSettings=snap.exists()?(snap.data().slides||{}):{};renderBuiltInSettings();applyRotationSettings();},err=>console.error('TV-Reihenfolge konnte nicht geladen werden',err));

onSnapshot(query(collection(db,'tvSlides'),orderBy('order','asc')),(snapshot)=>{
  slides=snapshot.docs.map(d=>normalize({id:d.id,...d.data()}));
  if(editor&&isAdmin){ if(current?.id){const fresh=slides.find(s=>s.id===current.id);if(fresh)current=structuredClone(fresh);} else if(!current&&slides[0])current=structuredClone(slides[0]); renderList();if(current){fillMeta();renderCanvas();} }
  renderTvSlides();
},err=>{console.error('TV-Slides konnten nicht geladen werden',err);setMessage('TV-Slides konnten nicht geladen werden.',true);});

function renderTvSlides(){
  const tv=document.getElementById('tvAnsicht'); if(!tv) return;
  tv.querySelectorAll('.tv-custom-slide').forEach(n=>n.remove());
  slides.filter(s=>s.active!==false).forEach(s=>{
    const node=document.createElement('div');node.className='tv-slide tv-custom-slide';node.dataset.duration=String(clamp(Number(s.duration)||10,3,120));node.dataset.order=String(Number(s.order)||100);node.style.background=s.background||'#08090d';
    node.innerHTML=`<div class="tv-custom-stage">${s.elements.map(el=>el.type==='image'?`<img class="tv-custom-element" src="${el.src}" alt="" style="left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;z-index:${el.z||1};">`:`<div class="tv-custom-element tv-custom-text" style="left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;z-index:${el.z||1};color:${el.color||'#fff'};font-size:${el.fontSize||42}px;text-align:${el.align||'center'};font-weight:${el.bold===false?400:800};">${safe(el.text)}</div>`).join('')}</div>`;
    tv.appendChild(node);
  });
  applyRotationSettings();
}
