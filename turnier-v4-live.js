import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4",authDomain:"dannistreffturnier.firebaseapp.com",projectId:"dannistreffturnier",storageBucket:"dannistreffturnier.firebasestorage.app",messagingSenderId:"829873084116",appId:"1:829873084116:web:683bbf1ea3e58f1a4ecd41"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const db=getFirestore(app);
const STATUS={
  vorbereitung:{anzeige:"🟢 Vorbereitung",tv:"VORBEREITUNG"},
  anmeldung:{anzeige:"🟡 Anmeldung",tv:"ANMELDUNG"},
  live:{anzeige:"🔴 Live",tv:"LIVE TURNIER"}
};
let istAdmin=false;
try{istAdmin=(JSON.parse(localStorage.getItem("dart11enLogin")||"null")?.rolle||"").toLowerCase()==="admin"}catch{}
function anwenden(wert){
  const key=STATUS[wert]?wert:"vorbereitung",cfg=STATUS[key];
  const status=document.getElementById("status");
  if(status){status.textContent=cfg.anzeige;const box=status.closest(".turnier-status");box?.classList.remove("status-vorbereitung","status-anmeldung","status-live");box?.classList.add(`status-${key}`)}
  const auswahl=document.getElementById("turnierLiveStatus");if(auswahl)auswahl.value=key;
  const tv=document.getElementById("tvLiveStatus");
  if(tv){tv.innerHTML=`<i></i> ${cfg.tv}`;const box=tv.closest(".tv-live-kopf");box?.classList.remove("status-vorbereitung","status-anmeldung","status-live");box?.classList.add(`status-${key}`)}
  const vorstart=document.querySelector("#tvVorstart p");if(vorstart)vorstart.textContent=cfg.tv;
  localStorage.setItem("dart11enV4LiveStatus",key);
}

function gruppenModusFuerSpielerAktivieren(snap){
  if(!snap.exists())return;
  let gruppenDaten=null;
  try{gruppenDaten=JSON.parse(snap.data()?.datenJson||"null")}catch(e){return}
  if(gruppenDaten?.modus!=="gruppenko")return;
  localStorage.setItem("dart11enV3TurnierModus","gruppenko");
  const feld=document.getElementById("turnierModus");
  if(feld)feld.value="gruppenko";
  window.dispatchEvent(new CustomEvent("dart11en:v3-mode",{detail:{mode:"gruppenko"}}));
}

document.addEventListener("DOMContentLoaded",()=>{
  anwenden(localStorage.getItem("dart11enV4LiveStatus")||"vorbereitung");
  const select=document.getElementById("turnierLiveStatus");
  select?.addEventListener("change",()=>{
    if(!istAdmin)return;
    anwenden(select.value);
    setDoc(doc(db,"turnierLive","steuerungV4"),{status:select.value,aktualisiert:Date.now()},{merge:true}).catch(console.error);
  });
  onSnapshot(doc(db,"turnierLive","steuerungV4"),snap=>{if(snap.exists())anwenden(snap.data().status)});
  onSnapshot(doc(db,"turnierLive","gruppenTurnierV3"),gruppenModusFuerSpielerAktivieren);
});
