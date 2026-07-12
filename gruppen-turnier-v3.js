import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyDtQ3pECcZETIoI4QTV5G-7_QcoRvVGHL4",authDomain:"dannistreffturnier.firebaseapp.com",projectId:"dannistreffturnier",storageBucket:"dannistreffturnier.firebasestorage.app",messagingSenderId:"829873084116",appId:"1:829873084116:web:683bbf1ea3e58f1a4ecd41"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const db=getFirestore(app);
const $=id=>document.getElementById(id);
const clone=v=>JSON.parse(JSON.stringify(v));
const istTv=new URLSearchParams(location.search).get("tv")==="true";
let istAdmin=false;
try{istAdmin=(JSON.parse(localStorage.getItem("dart11enLogin")||"null")?.rolle||"").toLowerCase()==="admin"}catch{}
let teilnehmer=[];
let daten=null;
let speicherTimer=null;
const REGEL_ENTWURF_KEY="dart11enV3GruppenRegelnEntwurf";
let entwurfRegeln={ko1:[1,2],ko2:[1,2]};
try{const gespeichert=JSON.parse(localStorage.getItem(REGEL_ENTWURF_KEY)||"null");if(gespeichert?.ko1&&gespeichert?.ko2)entwurfRegeln=gespeichert}catch{}

function spielName(p){return p.nickname||[p.vorname,p.nachname].filter(Boolean).join(" ")}
function mischen(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function paarungen(spieler,prefix){const out=[];let n=1;for(let i=0;i<spieler.length;i++)for(let j=i+1;j<spieler.length;j++)out.push({id:`${prefix}-${n++}`,a:spieler[i],b:spieler[j],scoreA:null,scoreB:null});return out}
function gruppenErstellen(namen,anzahl,aufteilung){
  const gs=Array.from({length:anzahl},(_,i)=>({id:String.fromCharCode(65+i),turnierId:1,spieler:[],spiele:[]}));
  mischen(namen).forEach((n,i)=>gs[i%anzahl].spieler.push(n));
  if(aufteilung==="getrennt"){
    const grenze=Math.ceil(anzahl/2);
    gs.forEach((g,i)=>g.turnierId=i<grenze?1:2);
  }
  gs.forEach(g=>g.spiele=paarungen(g.spieler,`G${g.id}`));
  return gs;
}
function siegLegs(){return Math.ceil((daten?.bestOf||3)/2)}
function matchErgebnis(m){const z=siegLegs();if(m.scoreA===z&&m.scoreB<z)return{gewinner:m.a,verlierer:m.b};if(m.scoreB===z&&m.scoreA<z)return{gewinner:m.b,verlierer:m.a};return null}
function tabelle(g){
  const rows=new Map(g.spieler.map(n=>[n,{name:n,sp:0,s:0,n:0,lf:0,lg:0,diff:0,p:0}]));
  g.spiele.forEach(m=>{const e=matchErgebnis(m);if(!e)return;const a=rows.get(m.a),b=rows.get(m.b);a.sp++;b.sp++;a.lf+=m.scoreA;a.lg+=m.scoreB;b.lf+=m.scoreB;b.lg+=m.scoreA;a.diff=a.lf-a.lg;b.diff=b.lf-b.lg;if(e.gewinner===m.a){a.s++;b.n++;a.p+=2}else{b.s++;a.n++;b.p+=2}});
  return [...rows.values()].sort((a,b)=>b.p-a.p||b.diff-a.diff||b.lf-a.lf||a.name.localeCompare(b.name,"de"));
}
function alleGruppenFertig(){return daten?.gruppen?.every(g=>g.spiele.every(m=>matchErgebnis(m)))||false}
function naechsteZweierzahl(n){let z=2;while(z<n)z*=2;return z}
function koErstellen(spieler,id,turnierId=null){
  const feld=naechsteZweierzahl(Math.max(2,spieler.length));
  const slots=[...spieler,...Array(feld-spieler.length).fill("Freilos")];
  const runden=[];
  for(let r=0,anz=feld/2;anz>=1;r++,anz/=2)runden.push(Array.from({length:anz},(_,i)=>({id:`K${id}-${r+1}-${i+1}`,a:null,b:null,scoreA:null,scoreB:null})));
  runden[0].forEach((m,i)=>{m.a=slots[i*2]||"Freilos";m.b=slots[i*2+1]||"Freilos"});
  return{id,turnierId,runden};
}
function koErgebnis(m){if(m.a==="Freilos"&&m.b==="Freilos")return{gewinner:"Freilos"};if(m.a==="Freilos"&&m.b)return{gewinner:m.b};if(m.b==="Freilos"&&m.a)return{gewinner:m.a};return matchErgebnis(m)}
function koWege(ko){
  const alt=new Map(ko.runden.flat().map(m=>[m.id,clone(m)]));
  ko.runden.slice(1).flat().forEach(m=>{m.a=null;m.b=null;m.scoreA=null;m.scoreB=null});
  ko.runden.forEach((runde,r)=>runde.forEach((m,i)=>{const old=alt.get(m.id);if(old&&old.a===m.a&&old.b===m.b){m.scoreA=old.scoreA;m.scoreB=old.scoreB}const e=koErgebnis(m);if(e&&r<ko.runden.length-1){const z=ko.runden[r+1][Math.floor(i/2)],feld=i%2?"b":"a";z[feld]=e.gewinner;const zo=alt.get(z.id);if(zo&&zo.a===z.a&&zo.b===z.b){z.scoreA=zo.scoreA;z.scoreB=zo.scoreB}}}))
}
function qualifizierte(pos,turnierId=null){
  const out=[];
  daten.gruppen.filter(g=>turnierId==null||g.turnierId===turnierId).forEach(g=>{const tab=tabelle(g);pos.forEach(p=>{if(tab[p-1])out.push({name:tab[p-1].name,gruppe:g.id,platz:p})})});
  return out;
}
function koPhasenErstellen(){
  if(!alleGruppenFertig()){alert("Bitte zuerst alle Gruppenspiele abschließen.");return}
  normalisiereRegeln();
  const getrennt=daten.aufteilung==="getrennt";
  const sets=getrennt?
    [{key:"ko1",turnierId:1,label:"Turnier 1"},{key:"ko2",turnierId:2,label:"Turnier 2"}]:
    [{key:"ko1",turnierId:null,label:"K.-o.-Baum 1"},...(daten.anzahlKo>1?[{key:"ko2",turnierId:null,label:"K.-o.-Baum 2"}]:[])];
  const neuePhasen=[];
  const fehler=[];
  sets.forEach((set,i)=>{
    const pos=clone(daten.regeln?.[set.key]||[]);
    if(!pos.length){fehler.push(`${set.label}: Keine Platzierung ausgewählt.`);return}
    const q=qualifizierte(pos,set.turnierId),sortiert=[];
    [...pos].sort((a,b)=>a-b).forEach(p=>sortiert.push(...mischen(q.filter(x=>x.platz===p)).map(x=>x.name)));
    const eindeutig=[...new Set(sortiert.filter(n=>n&&n!=="Freilos"))];
    if(eindeutig.length<2){fehler.push(`${set.label}: Es wurden nur ${eindeutig.length} qualifizierte Spieler gefunden.`);return}
    neuePhasen.push(koErstellen(eindeutig,i+1,set.turnierId));
  });
  if(fehler.length){alert(`K.-o.-Phase konnte nicht erstellt werden:\n\n${fehler.join("\n")}\n\nPrüfe die ausgewählten Plätze und die Gruppentabellen.`);return}
  daten.koPhasen=neuePhasen;speichern();renderAlles();
}
function speichern(){localStorage.setItem("dart11enV3GruppenKo",JSON.stringify(daten));clearTimeout(speicherTimer);speicherTimer=setTimeout(()=>setDoc(doc(db,"turnierLive","gruppenTurnierV3"),{datenJson:JSON.stringify(daten),aktualisiert:Date.now()}).catch(console.error),250)}
function scoreSelect(wert,onchange){const s=document.createElement("select");s.innerHTML='<option value="">–</option>'+Array.from({length:siegLegs()+1},(_,i)=>`<option value="${i}">${i}</option>`).join("");s.value=wert??"";s.onchange=()=>onchange(s.value===""?null:Number(s.value));return s}
function maxGruppenPlaetze(){if(daten?.gruppen?.length)return Math.max(1,...daten.gruppen.map(g=>g.spieler.length));const gruppen=Math.max(1,Number($("gruppenAnzahl")?.value||1));const anwesend=teilnehmer.filter(p=>p.anwesend===true).length;return Math.max(1,Math.min(8,Math.ceil(Math.max(anwesend,2)/gruppen)))}
function regelQuelle(){return daten?.regeln||entwurfRegeln}
function regelEntwurfSpeichern(regeln=regelQuelle()){entwurfRegeln=clone(regeln);localStorage.setItem(REGEL_ENTWURF_KEY,JSON.stringify(entwurfRegeln))}
function aktuelleAufteilung(){return $("turnierAufteilung")?.value||daten?.aufteilung||"gemeinsam"}
function normalisiereRegeln(){
  const ziel=regelQuelle(),max=maxGruppenPlaetze();
  ziel.ko1=[...new Set((ziel.ko1||[]).filter(p=>p>=1&&p<=max))].sort((a,b)=>a-b);
  ziel.ko2=[...new Set((ziel.ko2||[]).filter(p=>p>=1&&p<=max))].sort((a,b)=>a-b);
  if(aktuelleAufteilung()!=="getrennt")ziel.ko2=ziel.ko2.filter(p=>!ziel.ko1.includes(p));
}
function regelSetzen(key,werte){
  const ziel=regelQuelle(),anderer=key==="ko1"?"ko2":"ko1",max=maxGruppenPlaetze();
  ziel[key]=[...new Set(werte.filter(p=>p>=1&&p<=max))].sort((a,b)=>a-b);
  if(aktuelleAufteilung()!=="getrennt")ziel[anderer]=(ziel[anderer]||[]).filter(p=>!ziel[key].includes(p));

  // Die sichtbare Auswahl ist zugleich der Entwurf für die nächste Auslosung.
  // Vorher wurden Änderungen nur in einem bereits vorhandenen Turnier gespeichert;
  // beim erneuten Auslosen griff der Code wieder auf [1, 2] zurück.
  regelEntwurfSpeichern(ziel);

  if(daten){
    daten.regeln=clone(ziel);
    daten.koPhasen=[];
    speichern();
  }
  renderConfig();
  if(daten)renderAlles();
}
function regelOptionen(box,key){
  if(!box)return;box.replaceChildren();normalisiereRegeln();const quelle=regelQuelle(),max=maxGruppenPlaetze();
  for(let p=1;p<=max;p++){const l=document.createElement("label"),c=document.createElement("input"),t=document.createElement("span");c.type="checkbox";c.checked=quelle[key]?.includes(p)||false;t.textContent=`Platz ${p}`;l.classList.toggle("is-selected",c.checked);c.onchange=()=>{const arr=new Set(regelQuelle()[key]||[]);c.checked?arr.add(p):arr.delete(p);regelSetzen(key,[...arr])};l.append(c,t);box.append(l)}
}
function renderConfig(){
  const mode=$("turnierModus");
  const panel=$("gruppenKonfiguration");panel?.classList.toggle("modus-versteckt",mode?.value!=="gruppenko");
  $("doppelKoKonfiguration")?.classList.toggle("modus-versteckt",mode?.value==="gruppenko");
  if(daten){$("gruppenAnzahl").value=daten.anzahlGruppen;$("koAnzahl").value=daten.anzahlKo;$("gruppenBestOf").value=daten.bestOf;const aufteilungFeld=$("turnierAufteilung");if(aufteilungFeld&&!aufteilungFeld.dataset.userChanged)aufteilungFeld.value=daten.aufteilung||"gemeinsam"}
  const getrennt=aktuelleAufteilung()==="getrennt";
  const koAnzahl=getrennt?2:(daten?.anzahlKo||Number($("koAnzahl")?.value||2));
  $("koAnzahlZeile")?.classList.toggle("modus-versteckt",getrennt);
  $("ko2RegelBox")?.classList.toggle("modus-versteckt",!getrennt&&koAnzahl<2);
  const h1=$("ko1Titel"),h2=$("ko2Titel"),hint=$("gruppenRegelHinweis");
  if(h1)h1.textContent=getrennt?"Turnier 1: Weiterkommende Plätze":"K.-o.-Baum 1";
  if(h2)h2.textContent=getrennt?"Turnier 2: Weiterkommende Plätze":"K.-o.-Baum 2";
  if(hint)hint.textContent=getrennt?"Turnier 1 und Turnier 2 laufen vollständig getrennt. Dieselbe Platzierung darf in beiden Turnieren ausgewählt werden.":"Eine Platzierung kann nur einem K.-o.-Baum zugeordnet werden.";
  normalisiereRegeln();regelOptionen($("ko1Plaetze"),"ko1");regelOptionen($("ko2Plaetze"),"ko2");
}
function turnierLabel(g){return daten?.aufteilung==="getrennt"?` · Turnier ${g.turnierId}`:""}
function renderGruppe(g,admin=false){
  const card=document.createElement("article");card.className=`gruppe-card turnier-${g.turnierId||1}`;card.innerHTML=`<h3>Gruppe ${g.id}${turnierLabel(g)}</h3>`;
  if(admin){const players=document.createElement("div");players.className="gruppe-spieler";g.spieler.forEach(name=>{const z=document.createElement("div");z.className="gruppe-spieler-zeile";const b=document.createElement("strong");b.textContent=name;const s=document.createElement("select");daten.gruppen.forEach(x=>s.add(new Option(`Gruppe ${x.id}${daten.aufteilung==="getrennt"?` (Turnier ${x.turnierId})`:""}`,x.id)));s.value=g.id;s.onchange=()=>{const ziel=daten.gruppen.find(x=>x.id===s.value);g.spieler=g.spieler.filter(n=>n!==name);ziel.spieler.push(name);daten.gruppen.forEach(x=>x.spiele=paarungen(x.spieler,`G${x.id}`));daten.koPhasen=[];speichern();renderAlles()};z.append(b,s);players.append(z)});card.append(players)}
  const table=document.createElement("table");table.className="gruppen-tabelle";table.innerHTML='<thead><tr><th>#</th><th>Spieler</th><th>Sp</th><th>S</th><th>N</th><th>Legs</th><th>Diff</th><th>P</th></tr></thead>';
  const body=document.createElement("tbody"),regelKey=daten.aufteilung==="getrennt"?(g.turnierId===1?"ko1":"ko2"):null,q=new Set(regelKey?(daten.regeln[regelKey]||[]):[...(daten.regeln.ko1||[]),...(daten.anzahlKo>1?daten.regeln.ko2:[])]);
  tabelle(g).forEach((r,i)=>{const tr=document.createElement("tr");if(q.has(i+1))tr.className="qualifiziert";tr.innerHTML=`<td>${i+1}</td><td>${r.name}</td><td>${r.sp}</td><td>${r.s}</td><td>${r.n}</td><td>${r.lf}:${r.lg}</td><td>${r.diff}</td><td>${r.p}</td>`;body.append(tr)});table.append(body);card.append(table);
  if(admin){const games=document.createElement("div");games.className="gruppen-spiele";g.spiele.forEach(m=>{const a=document.createElement("article");a.className="gruppen-match";a.innerHTML=`<div class="gruppen-match-kopf"><span>${m.id}</span><span>Best of ${daten.bestOf}</span></div>`;const row=document.createElement("div");row.className="gruppen-score";const na=document.createElement("span");na.textContent=m.a;const nb=document.createElement("span");nb.textContent=m.b;const sep=document.createElement("b");sep.textContent=":";const sa=scoreSelect(m.scoreA,v=>{m.scoreA=v;if(v===siegLegs()&&m.scoreB>=siegLegs())m.scoreB=null;daten.koPhasen=[];speichern();renderAlles()});const sb=scoreSelect(m.scoreB,v=>{m.scoreB=v;if(v===siegLegs()&&m.scoreA>=siegLegs())m.scoreA=null;daten.koPhasen=[];speichern();renderAlles()});row.append(na,sa,sep,sb,nb);a.append(row);games.append(a)});card.append(games)}
  return card;
}
function renderKo(ko,admin=false){
  koWege(ko);const card=document.createElement("article");card.className=`ko-phase-card turnier-${ko.turnierId||ko.id}`;const titel=daten?.aufteilung==="getrennt"?`Turnier ${ko.turnierId}`:`K.-o.-Baum ${ko.id}`;card.innerHTML=`<h3>${titel}</h3>`;
  const wrap=document.createElement("div");wrap.className="gruppen-bracket";const grid=document.createElement("div");grid.className="gruppen-bracket-grid";
  ko.runden.forEach((runde,ri)=>{const col=document.createElement("section");col.className="gruppen-bracket-round";col.innerHTML=`<h4>Runde ${ri+1}</h4>`;runde.forEach(m=>{const e=koErgebnis(m),box=document.createElement("article");box.className="gruppen-bracket-match";box.innerHTML=`<small>${m.id}</small>`;[[m.a,m.scoreA],[m.b,m.scoreB]].forEach(([n,s])=>{const p=document.createElement("div");p.className="gruppen-bracket-player"+(e?.gewinner===n&&n!=="Freilos"?" winner":"");p.innerHTML=`<span>${n||"Noch offen"}</span><b>${s??"–"}</b>`;box.append(p)});if(admin&&m.a&&m.b&&m.a!=="Freilos"&&m.b!=="Freilos"){const row=document.createElement("div");row.className="gruppen-bracket-score";const na=document.createElement("span");na.textContent=m.a;const nb=document.createElement("span");nb.textContent=m.b;const sep=document.createElement("b");sep.textContent=":";const sa=scoreSelect(m.scoreA,v=>{m.scoreA=v;if(v===siegLegs()&&m.scoreB>=siegLegs())m.scoreB=null;koWege(ko);speichern();renderAlles()});const sb=scoreSelect(m.scoreB,v=>{m.scoreB=v;if(v===siegLegs()&&m.scoreA>=siegLegs())m.scoreA=null;koWege(ko);speichern();renderAlles()});row.append(na,sa,sep,sb,nb);box.append(row)}col.append(box)});grid.append(col)});wrap.append(grid);card.append(wrap);return card;
}
function renderAlles(){
  if(!daten||daten.modus!=="gruppenko")return;renderConfig();$("gruppenBereich")?.classList.remove("modus-versteckt");
  const pub=$("gruppenAnzeige");if(pub){pub.replaceChildren();daten.gruppen.forEach(g=>pub.append(renderGruppe(g,false)))}
  const adm=$("gruppenAdminAnzeige");if(adm){adm.replaceChildren();if(istAdmin)daten.gruppen.forEach(g=>adm.append(renderGruppe(g,true)))}
  // Eigene Ergebnisliste für die Gruppenphase. Die allgemeine #spieleListe
  // gehört ausschließlich zum Doppel-K.-o.-Modus.
  const gruppenErgebnisse=$("gruppenErgebnisAnzeige");
  if(gruppenErgebnisse){
    gruppenErgebnisse.replaceChildren();
    if(istAdmin)daten.gruppen.forEach(g=>gruppenErgebnisse.append(renderGruppe(g,true)));
  }
  const ko=$("gruppenKoAnzeige");if(ko){ko.replaceChildren();daten.koPhasen?.forEach(k=>ko.append(renderKo(k,istAdmin)));if(!daten.koPhasen?.length)ko.innerHTML='<p class="section-text">Die K.-o.-Phasen werden nach Abschluss der Gruppenphase erstellt.</p>'}
  const btn=$("koErstellenBtn");if(btn){btn.disabled=!alleGruppenFertig();btn.textContent=alleGruppenFertig()?(daten.aufteilung==="getrennt"?"Beide K.-o.-Phasen erstellen":"K.-o.-Phase erstellen"):"Erst alle Gruppenspiele abschließen"}renderTv();
}
function renderTv(){
  const gbox=$("tvGruppen");
  if(gbox){
    gbox.replaceChildren();
    daten?.gruppen?.forEach(g=>{
      const card=renderGruppe(g,false),d=document.createElement("div");
      d.className=`tv-gruppe turnier-${g.turnierId||1}`;
      d.append(card.querySelector("h3"),card.querySelector("table"));
      gbox.append(d);
    });
    if(!daten?.gruppen?.length)gbox.innerHTML='<div class="tv-leer">Die Gruppen erscheinen nach der Auslosung.</div>';
  }
  const kbox=$("tvGruppenKo");
  if(kbox){
    kbox.replaceChildren();
    daten?.koPhasen?.forEach(k=>kbox.append(renderKo(k,false)));
    if(!daten?.koPhasen?.length)kbox.innerHTML='<div class="tv-leer">Die K.-o.-Bäume erscheinen nach Abschluss der Gruppenphase.</div>';
  }
  if(istTv&&daten)window.dispatchEvent(new CustomEvent("dart11en:gruppen-tv-ready"));
}
function neuesGruppenTurnier(){
  const namen=teilnehmer.filter(p=>p.anwesend===true).map(spielName).filter(Boolean),anzahl=Number($("gruppenAnzahl").value),aufteilung=$("turnierAufteilung")?.value||"gemeinsam";
  if(namen.length<2){alert("Mindestens zwei anwesende Spieler werden benötigt.");return}
  if(anzahl>namen.length){alert("Es können nicht mehr Gruppen als Spieler erstellt werden.");return}
  if(aufteilung==="getrennt"&&anzahl<2){alert("Für zwei getrennte Turniere werden mindestens zwei Gruppen benötigt.");return}

  // Die Auswahl direkt aus den sichtbaren Checkboxen lesen. Dadurch kann ein
  // alter Speicherstand die gerade gewählten Platzierungen nicht überschreiben.
  const checkboxWerte=id=>[...document.querySelectorAll(`#${id} input[type="checkbox"]:checked`)]
    .map(input=>Number(input.closest("label")?.textContent?.match(/\d+/)?.[0]))
    .filter(Number.isFinite);
  const aktuelleRegeln={ko1:checkboxWerte("ko1Plaetze"),ko2:checkboxWerte("ko2Plaetze")};
  if(!aktuelleRegeln.ko1.length){alert("Bitte für Turnier 1 mindestens eine Platzierung auswählen.");return}
  if(aufteilung==="getrennt"&&!aktuelleRegeln.ko2.length){alert("Bitte für Turnier 2 mindestens eine Platzierung auswählen.");return}
  regelEntwurfSpeichern(aktuelleRegeln);

  const neueGruppen=gruppenErstellen(namen,anzahl,aufteilung);
  const maxPlatz=Math.max(...neueGruppen.map(g=>g.spieler.length));
  const ungueltig=[...aktuelleRegeln.ko1,...aktuelleRegeln.ko2].filter(p=>p>maxPlatz);
  if(ungueltig.length){
    alert(`Die Gruppen haben höchstens ${maxPlatz} Spieler. Deshalb sind nur Platz 1 bis ${maxPlatz} möglich. Die Auswahl wurde nicht verändert.`);
    return;
  }

  daten={
    modus:"gruppenko",
    version:"3.0.6",
    erstellt:Date.now(),
    bestOf:Number($("gruppenBestOf").value),
    anzahlGruppen:anzahl,
    aufteilung,
    anzahlKo:aufteilung==="getrennt"?2:Number($("koAnzahl").value),
    koModi:{ko1:"einfach",ko2:"einfach"},
    regeln:clone(aktuelleRegeln),
    gruppen:neueGruppen,
    koPhasen:[]
  };
  speichern();
  renderAlles();
}

let gruppenResetLaeuft=false;

async function gruppenTurnierZuruecksetzen({wechselZuDoppelKo=false, bestaetigen=true}={}){
  if(bestaetigen&&!confirm(wechselZuDoppelKo
    ? "Gruppenphase samt Ergebnissen und K.-o.-Bäumen löschen und zu Doppel-K.-o. wechseln? Die Teilnehmer bleiben erhalten."
    : "Gruppenphase samt Ergebnissen und K.-o.-Bäumen wirklich zurücksetzen? Die Teilnehmer bleiben erhalten.")) return false;
  gruppenResetLaeuft=true;
  daten=null;
  localStorage.removeItem("dart11enV3GruppenKo");
  entwurfRegeln={ko1:[1,2],ko2:[1,2]};
  $("gruppenAnzeige")?.replaceChildren();
  $("gruppenAdminAnzeige")?.replaceChildren();
  $("gruppenKoAnzeige")?.replaceChildren();
  try{await deleteDoc(doc(db,"turnierLive","gruppenTurnierV3"))}catch(e){console.error("Gruppenturnier konnte online nicht gelöscht werden:",e)}
  renderConfig();
  if(wechselZuDoppelKo){
    localStorage.setItem("dart11enV3TurnierModus","doppelko");
    const mode=$("turnierModus");
    if(mode){mode.value="doppelko";mode.dispatchEvent(new Event("change",{bubbles:true}))}
  }
  setTimeout(()=>{gruppenResetLaeuft=false},500);
  return true;
}

window.dart11enGruppenReset=gruppenTurnierZuruecksetzen;

function gruppenphaseSimulieren(){
  if(!istAdmin){alert("Nur Admins können die Simulation starten.");return}
  if(!daten?.gruppen?.length){alert("Bitte zuerst die Gruppen auslosen.");return}
  const ziel=siegLegs();
  let geaendert=0;
  daten.gruppen.forEach(g=>g.spiele.forEach(m=>{
    if(matchErgebnis(m))return;
    const gewinnerA=Math.random()<0.5;
    const verliererScore=ziel>1?Math.floor(Math.random()*ziel):0;
    m.scoreA=gewinnerA?ziel:verliererScore;
    m.scoreB=gewinnerA?verliererScore:ziel;
    geaendert++;
  }));
  daten.koPhasen=[];
  speichern();
  renderAlles();
  alert(`${geaendert} offene Gruppenspiele wurden simuliert. Du kannst jetzt die K.-o.-Phase erstellen.`);
}

document.addEventListener("DOMContentLoaded",()=>{
  const mode=$("turnierModus"),originalBtn=$("turnierAuslosenBtn");
  originalBtn?.addEventListener("click",e=>{if(mode?.value!=="gruppenko")return;e.stopImmediatePropagation();e.preventDefault();neuesGruppenTurnier()},true);
  $("koErstellenBtn")?.addEventListener("click",koPhasenErstellen);
  $("gruppenSimulationBtn")?.addEventListener("click",gruppenphaseSimulieren);
  $("gruppenZuruecksetzenBtn")?.addEventListener("click",()=>gruppenTurnierZuruecksetzen());
  $("gruppenZuDoppelKoBtn")?.addEventListener("click",()=>gruppenTurnierZuruecksetzen({wechselZuDoppelKo:true}));
  $("gruppenAnzahl")?.addEventListener("change",()=>{if(daten)return;normalisiereRegeln();renderConfig()});
  $("turnierAufteilung")?.addEventListener("change",()=>{const feld=$("turnierAufteilung");feld.dataset.userChanged="1";regelEntwurfSpeichern(feld.value==="getrennt"?{ko1:[1,2],ko2:[1,2]}:{ko1:[1,2],ko2:[3,4]});renderConfig()});
  document.querySelectorAll(".qualifier-presets").forEach(leiste=>leiste.addEventListener("click",e=>{const btn=e.target.closest("button");if(!btn)return;const key=leiste.dataset.target==="ko1Plaetze"?"ko1":"ko2",max=maxGruppenPlaetze();let werte=[];if(btn.dataset.clear)werte=[];else if(btn.dataset.top)werte=Array.from({length:Math.min(max,Number(btn.dataset.top))},(_,i)=>i+1);else if(btn.dataset.from)werte=Array.from({length:Math.max(0,max-Number(btn.dataset.from)+1)},(_,i)=>Number(btn.dataset.from)+i);regelSetzen(key,werte)}));
  $("koAnzahl")?.addEventListener("change",()=>{if(!daten)return;daten.anzahlKo=Number($("koAnzahl").value);daten.koPhasen=[];speichern();renderAlles()});
  $("gruppenBestOf")?.addEventListener("change",()=>{if(!daten)return;daten.bestOf=Number($("gruppenBestOf").value);daten.gruppen.forEach(g=>g.spiele.forEach(m=>{m.scoreA=null;m.scoreB=null}));daten.koPhasen=[];speichern();renderAlles()});
  try{daten=JSON.parse(localStorage.getItem("dart11enV3GruppenKo")||"null")}catch{}
  if(daten){if(!daten.aufteilung)daten.aufteilung="gemeinsam";daten.gruppen?.forEach(g=>{if(!g.turnierId)g.turnierId=1});regelEntwurfSpeichern(daten.regeln);renderAlles()}
  window.addEventListener("dart11en:v3-reset",event=>{const scope=event.detail?.scope||"active",activeMode=localStorage.getItem("dart11enV3TurnierModus")||"doppelko";if(scope==="active"&&activeMode!=="gruppenko")return;gruppenTurnierZuruecksetzen({bestaetigen:false});});
  renderConfig();if(mode){$("doppelKoKonfiguration")?.classList.toggle("modus-versteckt",mode.value==="gruppenko")}if(originalBtn&&mode)originalBtn.textContent=mode.value==="gruppenko"?"🎲 Gruppen auslosen":"🎲 Live-Auslosung starten";
});
onSnapshot(collection(db,"warteschlange"),snap=>{teilnehmer=[];snap.forEach(d=>teilnehmer.push({id:d.id,...d.data()}));if(!daten)renderConfig()});
onSnapshot(doc(db,"turnierLive","gruppenTurnierV3"),snap=>{if(istAdmin&&!istTv)return;if(gruppenResetLaeuft)return;if(!snap.exists()){daten=null;localStorage.removeItem("dart11enV3GruppenKo");return}try{daten=JSON.parse(snap.data().datenJson||"null");if(daten){if(!daten.aufteilung)daten.aufteilung="gemeinsam";localStorage.setItem("dart11enV3GruppenKo",JSON.stringify(daten));renderAlles()}}catch(e){console.error(e)}});
