import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, getLogin } from './auth-utils.js';
const user=getLogin(); const role=String(user?.rolle||'').toLowerCase(); const allowed=['admin','captain'].includes(role);
const app=document.getElementById('cameraApp'), denied=document.getElementById('cameraAccessDenied');
if(!allowed){denied.hidden=false;}else{app.hidden=false;init();}
function normalize(value){return String(value||'').trim().replace(/\/$/,'');}
function init(){
 const input=document.getElementById('bridgeUrl'); const msg=document.getElementById('cameraMessage');
 input.value=localStorage.getItem('dart11enCameraBridgeUrl')||'http://192.168.2.79:8787';
 document.getElementById('saveBridge').onclick=async()=>{
   const u=normalize(input.value);localStorage.setItem('dart11enCameraBridgeUrl',u);msg.textContent='Speichere …';
   try{await setDoc(doc(db,'einstellungen','kameraBridge'),{url:u,geaendertAm:serverTimestamp(),geaendertVon:String(user?.benutzername||'')},{merge:true});msg.textContent='✓ Bridge-Adresse gespeichert – auch fürs Spielarchiv';}
   catch(error){console.error(error);msg.textContent='✓ Lokal gespeichert. Globale Adresse konnte nicht gespeichert werden.';}
 };
 document.getElementById('openCamera').onclick=()=>{const u=normalize(input.value||'http://192.168.2.79:8787');localStorage.setItem('dart11enCameraBridgeUrl',u);const back=encodeURIComponent(location.href);location.href=u+'/control?back='+back;};
 document.getElementById('openTv').onclick=()=>{const u=normalize(input.value||'http://192.168.2.79:8787');localStorage.setItem('dart11enCameraBridgeUrl',u);location.href=u+'/tv';};
}
