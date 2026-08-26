import { getLogin } from './auth-utils.js';
const user=getLogin(); const role=String(user?.rolle||'').toLowerCase(); const allowed=['admin','captain'].includes(role);
const app=document.getElementById('cameraApp'), denied=document.getElementById('cameraAccessDenied');
if(!allowed){denied.hidden=false;}else{app.hidden=false;init();}
function init(){
 const input=document.getElementById('bridgeUrl'); const msg=document.getElementById('cameraMessage');
 input.value=localStorage.getItem('dart11enCameraBridgeUrl')||'http://192.168.2.79:8787';
 document.getElementById('saveBridge').onclick=()=>{const u=input.value.trim().replace(/\/$/,'');localStorage.setItem('dart11enCameraBridgeUrl',u);msg.textContent='✓ Bridge-Adresse gespeichert';};
 document.getElementById('openCamera').onclick=()=>{const u=(input.value.trim()||'http://192.168.2.79:8787').replace(/\/$/,'');localStorage.setItem('dart11enCameraBridgeUrl',u);const back=encodeURIComponent(location.href);location.href=u+'/control?back='+back;};
}
