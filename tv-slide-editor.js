import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

const user = (() => { try { return JSON.parse(localStorage.getItem('dart11enLogin') || 'null'); } catch { return null; } })();
const isAdmin = String(user?.rolle || '').toLowerCase() === 'admin';
const editor = document.getElementById('tvSlideEditor');
const canvas = document.getElementById('tvSlideCanvas');
const list = document.getElementById('tvSlideList');
const message = document.getElementById('tvSlideMessage');
let slides = [];
let current = null;
let selectedId = null;
let operation = null;

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const clamp = (v,min,max) => Math.max(min, Math.min(max,v));
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultSlide = () => ({ title:'Neue Folie', active:true, duration:10, background:'#08090d', order: slides.length, elements:[] });

function normalize(slide){
  return { ...defaultSlide(), ...slide, elements:Array.isArray(slide.elements)?slide.elements:[] };
}
function setMessage(text, error=false){ if(message){ message.textContent=text; message.classList.toggle('error',error); } }

function renderList(){
  if(!list) return;
  list.innerHTML = slides.length ? slides.map((s,i)=>`<button type="button" class="tv-slide-list-item ${current?.id===s.id?'active':''}" data-id="${s.id}"><span>${i+1}. ${safe(s.title || 'Ohne Titel')}</span><small>${s.active===false?'deaktiviert':`${Number(s.duration)||10} Sek.`}</small></button>`).join('') : '<p class="section-text">Noch keine eigenen Folien vorhanden.</p>';
  list.querySelectorAll('[data-id]').forEach(btn=>btn.addEventListener('click',()=>selectSlide(btn.dataset.id)));
}

function selectSlide(id){
  const found=slides.find(s=>s.id===id); if(!found) return;
  current=structuredClone(found); selectedId=null;
  document.getElementById('tvSlideTitle').value=current.title||'';
  document.getElementById('tvSlideDuration').value=current.duration||10;
  document.getElementById('tvSlideActive').checked=current.active!==false;
  document.getElementById('tvSlideBackground').value=current.background||'#08090d';
  renderList(); renderCanvas();
}

function renderCanvas(){
  if(!canvas || !current) return;
  canvas.style.background=current.background||'#08090d';
  canvas.innerHTML=current.elements.map(el=>{
    const common=`left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;z-index:${el.z||1};`;
    const cls=`tv-editor-element ${selectedId===el.id?'selected':''}`;
    if(el.type==='image') return `<div class="${cls}" data-eid="${el.id}" style="${common}"><img src="${el.src}" alt=""><span class="resize-handle" aria-hidden="true"></span></div>`;
    return `<div class="${cls} tv-editor-text" data-eid="${el.id}" style="${common}color:${el.color||'#fff'};font-size:${el.fontSize||42}px;text-align:${el.align||'center'};font-weight:${el.bold===false?400:800};"><div>${safe(el.text||'Text')}</div><span class="resize-handle" aria-hidden="true"></span></div>`;
  }).join('');
  canvas.querySelectorAll('.tv-editor-element').forEach(el=>{
    el.addEventListener('pointerdown',startPointer);
    el.addEventListener('click',()=>{ selectedId=el.dataset.eid; renderCanvas(); renderProperties(); });
  });
  renderProperties();
}

function renderProperties(){
  const box=document.getElementById('tvElementProperties'); if(!box) return;
  const el=current?.elements.find(e=>e.id===selectedId);
  if(!el){ box.innerHTML='<p class="section-text">Wähle ein Element auf der Folie aus.</p>'; return; }
  box.innerHTML=`
    ${el.type==='text'?`<label>Text<textarea id="propText" rows="3">${safe(el.text)}</textarea></label><div class="tv-prop-grid"><label>Schriftgröße<input id="propFont" type="range" min="16" max="120" value="${el.fontSize||42}"></label><label>Farbe<input id="propColor" type="color" value="${el.color||'#ffffff'}"></label><label>Ausrichtung<select id="propAlign"><option value="left">Links</option><option value="center">Mittig</option><option value="right">Rechts</option></select></label><label class="settings-row"><span>Fett</span><input id="propBold" type="checkbox" ${el.bold===false?'':'checked'}></label></div>`:''}
    <div class="tv-prop-grid"><label>Ebene<input id="propZ" type="number" min="1" max="99" value="${el.z||1}"></label><button id="propDelete" type="button" class="main-button danger-button">Element löschen</button></div>`;
  if(el.type==='text'){
    box.querySelector('#propAlign').value=el.align||'center';
    [['propText','input','text'],['propFont','input','fontSize'],['propColor','input','color'],['propAlign','change','align']].forEach(([id,event,key])=>box.querySelector('#'+id)?.addEventListener(event,e=>{ el[key]=key==='fontSize'?Number(e.target.value):e.target.value; renderCanvas(); }));
    box.querySelector('#propBold')?.addEventListener('change',e=>{el.bold=e.target.checked;renderCanvas();});
  }
  box.querySelector('#propZ')?.addEventListener('input',e=>{el.z=Number(e.target.value);renderCanvas();});
  box.querySelector('#propDelete')?.addEventListener('click',()=>{current.elements=current.elements.filter(e=>e.id!==selectedId);selectedId=null;renderCanvas();});
}

function startPointer(e){
  if(!current) return; e.preventDefault();
  selectedId=e.currentTarget.dataset.eid;
  const el=current.elements.find(x=>x.id===selectedId); if(!el) return;
  const rect=canvas.getBoundingClientRect();
  operation={ el, resize:e.target.classList.contains('resize-handle'), sx:e.clientX, sy:e.clientY, x:el.x,y:el.y,w:el.w,h:el.h, rect };
  e.currentTarget.setPointerCapture(e.pointerId);
  e.currentTarget.addEventListener('pointermove',movePointer);
  e.currentTarget.addEventListener('pointerup',endPointer,{once:true});
  renderCanvas();
}
function movePointer(e){
  if(!operation) return;
  const dx=(e.clientX-operation.sx)/operation.rect.width*100;
  const dy=(e.clientY-operation.sy)/operation.rect.height*100;
  if(operation.resize){ operation.el.w=clamp(operation.w+dx,5,100-operation.el.x); operation.el.h=clamp(operation.h+dy,5,100-operation.el.y); }
  else { operation.el.x=clamp(operation.x+dx,0,100-operation.el.w); operation.el.y=clamp(operation.y+dy,0,100-operation.el.h); }
  const dom=canvas.querySelector(`[data-eid="${operation.el.id}"]`); if(dom){dom.style.left=operation.el.x+'%';dom.style.top=operation.el.y+'%';dom.style.width=operation.el.w+'%';dom.style.height=operation.el.h+'%';}
}
function endPointer(e){ e.currentTarget.removeEventListener('pointermove',movePointer); operation=null; renderCanvas(); }

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
  document.getElementById('tvSlideNew')?.addEventListener('click',()=>{ current=defaultSlide(); selectedId=null; renderList();renderCanvas(); document.getElementById('tvSlideTitle').value=current.title; });
  document.getElementById('tvAddText')?.addEventListener('click',()=>{ if(!current) current=defaultSlide(); const el={id:uid(),type:'text',text:'Neuer Text',x:15,y:20,w:70,h:18,z:2,color:'#ffffff',fontSize:48,align:'center',bold:true};current.elements.push(el);selectedId=el.id;renderCanvas();});
  document.getElementById('tvAddImage')?.addEventListener('change',async e=>{ const file=e.target.files?.[0];if(!file)return;try{setMessage('Bild wird vorbereitet …');const src=await imageToDataUrl(file);if(!current)current=defaultSlide();const el={id:uid(),type:'image',src,x:20,y:15,w:60,h:65,z:1};current.elements.push(el);selectedId=el.id;renderCanvas();setMessage('Bild hinzugefügt. Position und Größe können direkt verändert werden.');}catch(err){setMessage(err.message,true);}e.target.value='';});
  document.getElementById('tvSlideSave')?.addEventListener('click',saveCurrent);
  document.getElementById('tvSlideDelete')?.addEventListener('click',async()=>{if(!current?.id||!confirm('Diese TV-Folie endgültig löschen?'))return;await deleteDoc(doc(db,'tvSlides',current.id));current=null;canvas.innerHTML='';});
  document.getElementById('tvSlideBackground')?.addEventListener('input',e=>{if(current){current.background=e.target.value;renderCanvas();}});
}

onSnapshot(query(collection(db,'tvSlides'),orderBy('order','asc')),(snapshot)=>{
  slides=snapshot.docs.map(d=>normalize({id:d.id,...d.data()}));
  if(editor&&isAdmin){ if(current?.id){const fresh=slides.find(s=>s.id===current.id);if(fresh)current=structuredClone(fresh);} else if(!current&&slides[0])current=structuredClone(slides[0]); renderList();if(current){document.getElementById('tvSlideTitle').value=current.title||'';document.getElementById('tvSlideDuration').value=current.duration||10;document.getElementById('tvSlideActive').checked=current.active!==false;document.getElementById('tvSlideBackground').value=current.background||'#08090d';renderCanvas();} }
  renderTvSlides();
},err=>{console.error('TV-Slides konnten nicht geladen werden',err);setMessage('TV-Slides konnten nicht geladen werden.',true);});

function renderTvSlides(){
  const tv=document.getElementById('tvAnsicht'); if(!tv) return;
  tv.querySelectorAll('.tv-custom-slide').forEach(n=>n.remove());
  slides.filter(s=>s.active!==false).forEach(s=>{
    const node=document.createElement('div');node.className='tv-slide tv-custom-slide';node.dataset.duration=String(clamp(Number(s.duration)||10,3,120));node.style.background=s.background||'#08090d';
    node.innerHTML=`<div class="tv-custom-stage">${s.elements.map(el=>el.type==='image'?`<img class="tv-custom-element" src="${el.src}" alt="" style="left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;z-index:${el.z||1};">`:`<div class="tv-custom-element tv-custom-text" style="left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;z-index:${el.z||1};color:${el.color||'#fff'};font-size:${el.fontSize||42}px;text-align:${el.align||'center'};font-weight:${el.bold===false?400:800};">${safe(el.text)}</div>`).join('')}</div>`;
    tv.appendChild(node);
  });
  window.dispatchEvent(new CustomEvent('dart11en-tv-slides-updated'));
}
