import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  db,
  getLogin,
  saveLogin,
  setNewPassword,
  verifyPassword
} from "./auth-utils.js";

const $ = id => document.getElementById(id);
const MEMBER_ROLES = ["mitglied", "captain", "admin", "kassenwart"];
const BESTLEISTUNGEN_EDIT_ROLES = ["admin", "captain"];
const DEFAULT_IMAGE = "dart11enlogo.png";
const SYNC_3K_URL = "https://dart11en-push.kevteha.workers.dev/3k-sync";
let members = [];
let selectedMember = null;
let login = getLogin();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function roleLabel(role) {
  return ({ admin: "Admin", captain: "Captain", kassenwart: "Kassenwart", mitglied: "Mitglied" })[role] || "Mitglied";
}
function displayName(member) { return [member.vorname, member.nachname].filter(Boolean).join(" ").trim(); }
function nickname(member) { return String(member.nickname || member.benutzername || "Mitglied").trim(); }
function profileImage(member) { return member.profilBild || member.profilbild || member.foto || legacyImage(member) || DEFAULT_IMAGE; }
function legacyImage(member) {
  const key = nickname(member).toLowerCase();
  const known = {
    "red dart": "images/red dart.jpeg", lena: "images/lena.jpeg", axel: "images/axel.jpeg",
    bandit: "images/bandit.jpeg", pinki: "images/pinki.jpeg", buddha: "images/buddha.jpeg",
    "de mötz": "images/de mötz.jpeg", kraudi: "images/kraudi.jpeg", matthes: "images/matthes.jpeg",
    czek: "images/czek.jpeg", "päule": "images/päule.jpeg", siggi: "images/siggi.jpeg",
    sasi: "images/sasi.jpeg", shadow: "images/shadow.jpeg", rolifant: "images/rolifant.jpeg",
    eisprinzessin: "images/eisprinzessin.jpeg", danni: "images/danni.jpeg"
  };
  return known[key] || "";
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === "number") return { value: item, count: 1 };
    return { value: Number(item?.value), count: Math.max(1, Number(item?.count) || 1) };
  }).filter(item => Number.isFinite(item.value) && item.value > 0)
    .sort((a,b) => b.value - a.value);
}

function getBestleistungen(member) {
  const best = member.bestleistungen3k || member.bestleistungen || {};
  const legacyHighscore = Number(best.highscore ?? member.highscore);
  const legacyShort = Number(best.shortleg ?? best.shortLeg ?? member.shortleg);
  const hs = normalizeList(best.highscores || (Number.isFinite(legacyHighscore) && legacyHighscore > 0 ? [{value:legacyHighscore,count:1}] : []));
  const hf = normalizeList(best.highfinishes || []);
  const sg = normalizeList(best.shortgames || (Number.isFinite(legacyShort) && legacyShort > 0 ? [{value:legacyShort,count:1}] : []))
    .sort((a,b) => a.value - b.value);
  const count180 = Number(best.count180 ?? best["180"] ?? member.count180 ?? 0) || 0;
  return { count180, highscores: hs, highfinishes: hf, shortgames: sg };
}

function listTotal(list) { return list.reduce((sum, item) => sum + (Number(item.count) || 0), 0); }
function renderDetailList(label, list, suffix="") {
  if (!list.length) return `<div class="best-detail-empty">Noch keine ${escapeHtml(label)}-Einträge.</div>`;
  return `<div class="best-detail-list">${list.map(item => `<div class="best-detail-row"><strong>${escapeHtml(item.count)}×</strong><span>${escapeHtml(item.value)}${suffix}</span></div>`).join("")}</div>`;
}

function renderBestleistungen(member) {
  const best = getBestleistungen(member);
  const bestHighscore = best.highscores.length ? best.highscores[0].value : null;
  const bestHighfinish = best.highfinishes.length ? best.highfinishes[0].value : null;
  const bestShortgame = best.shortgames.length ? best.shortgames[0].value : null;

  const cards = [
    {
      key:"180",
      icon:"🎯",
      label:"180",
      value: String(best.count180 || 0),
      meta: best.count180 === 1 ? "geworfen" : "geworfen",
      detail: `<div class="best-detail-single"><strong>${best.count180 || 0}</strong><span>geworfene 180er</span></div>`
    },
    {
      key:"highscore",
      icon:"🔥",
      label:"Highscore",
      value: bestHighscore ?? "–",
      meta: best.highscores.length ? `${listTotal(best.highscores)} Einträge` : "noch keiner",
      detail: renderDetailList("Highscore", best.highscores)
    },
    {
      key:"highfinish",
      icon:"✅",
      label:"Highfinish",
      value: bestHighfinish ?? "–",
      meta: best.highfinishes.length ? `${listTotal(best.highfinishes)} Einträge` : "noch keins",
      detail: renderDetailList("Highfinish", best.highfinishes)
    },
    {
      key:"shortgame",
      icon:"⚡",
      label:"Short Game",
      value: bestShortgame ?? "–",
      meta: bestShortgame ? "Darts" : "noch keins",
      detail: renderDetailList("Short Game", best.shortgames, " Darts")
    }
  ];

  $("bestleistungenGrid").innerHTML = `
    <div class="best-summary-grid">
      ${cards.map(card => `
        <button class="best-card best-card-clickable" type="button" data-best-key="${card.key}" aria-expanded="false">
          <span class="best-card-top"><span class="best-icon">${card.icon}</span><span class="best-chevron">›</span></span>
          <span class="best-value">${escapeHtml(card.value)}</span>
          <span class="best-label">${escapeHtml(card.label)}</span>
          <span class="best-meta">${escapeHtml(card.meta)}</span>
        </button>
      `).join("")}
    </div>
    <div id="bestDetailPanel" class="best-detail-panel" hidden></div>
  `;

  $("bestleistungenGrid").hidden = false;
  $("keineBestleistungen").hidden = true;

  const detailPanel = $("bestDetailPanel");
  document.querySelectorAll("[data-best-key]").forEach(btn => btn.addEventListener("click", () => {
    const card = cards.find(item => item.key === btn.dataset.bestKey);
    if (!card) return;
    const alreadyOpen = detailPanel.dataset.openKey === card.key && !detailPanel.hidden;

    document.querySelectorAll("[data-best-key]").forEach(item => {
      item.classList.remove("active");
      item.setAttribute("aria-expanded", "false");
    });

    if (alreadyOpen) {
      detailPanel.hidden = true;
      detailPanel.dataset.openKey = "";
      return;
    }

    btn.classList.add("active");
    btn.setAttribute("aria-expanded", "true");
    detailPanel.dataset.openKey = card.key;
    detailPanel.innerHTML = `
      <div class="best-detail-head">
        <div><span class="best-detail-icon">${card.icon}</span><strong>${escapeHtml(card.label)}</strong></div>
        <button type="button" id="closeBestDetail" aria-label="Details schließen">✕</button>
      </div>
      ${card.detail}
    `;
    detailPanel.hidden = false;
    $("closeBestDetail")?.addEventListener("click", () => {
      detailPanel.hidden = true;
      detailPanel.dataset.openKey = "";
      btn.classList.remove("active");
      btn.setAttribute("aria-expanded", "false");
    });
  }));
}

function listToText(list) { return list.map(item => `${item.value} = ${item.count}`).join("\n"); }
function parseListText(text, min, max) {
  const result=[];
  for (const raw of String(text||"").split(/\n+/)) {
    const line=raw.trim(); if(!line) continue;
    const match=line.match(/^(\d+)\s*(?:=|x|×|:|-)\s*(\d+)$/i);
    if(!match) return null;
    const value=Number(match[1]), count=Number(match[2]);
    if(!Number.isInteger(value)||!Number.isInteger(count)||value<min||value>max||count<1) return null;
    result.push({value,count});
  }
  return result.sort((a,b)=>b.value-a.value);
}
function fillBestleistungenForm(member) {
  const best=getBestleistungen(member);
  $("best180").value=best.count180 || "";
  $("bestHighscore").value=listToText(best.highscores);
  $("bestHighfinish").value=listToText(best.highfinishes);
  $("bestShortgame").value=listToText(best.shortgames);
}
async function saveBestleistungen() {
  if (!selectedMember || !BESTLEISTUNGEN_EDIT_ROLES.includes(String(login?.rolle||"").toLowerCase())) return;
  const count180=Number($("best180").value||0);
  const highscores=parseListText($("bestHighscore").value,150,180);
  const highfinishes=parseListText($("bestHighfinish").value,100,180);
  const shortgames=parseListText($("bestShortgame").value,1,60);
  const msg=$("bestleistungenMeldung"); msg.hidden=true;
  if(!Number.isInteger(count180)||count180<0||!highscores||!highfinishes||!shortgames){
    msg.textContent="Bitte prüfe die Werte. Listen bitte z. B. als 160 = 2 eintragen."; msg.className="profil-message error"; msg.hidden=false; return;
  }
  const button=$("bestleistungenSpeichern"); button.disabled=true;
  try{
    const bestleistungen3k={count180,highscores,highfinishes,shortgames,quelle:"manuell"};
    await updateDoc(doc(db,"mitglieder",selectedMember.id),{bestleistungen3k,bestleistungenGeaendertAm:serverTimestamp(),bestleistungenGeaendertVon:String(login?.benutzername||"")});
    selectedMember.bestleistungen3k=bestleistungen3k;
    const local=members.find(x=>x.id===selectedMember.id); if(local) local.bestleistungen3k=bestleistungen3k;
    renderBestleistungen(selectedMember);
    msg.textContent="Manuelle Bestleistungen wurden gespeichert."; msg.className="profil-message success"; msg.hidden=false;
  }catch(error){ console.error(error); msg.textContent="Die Bestleistungen konnten nicht gespeichert werden."; msg.className="profil-message error"; msg.hidden=false; }
  finally{ button.disabled=false; }
}

async function sync3k() {
  const canEdit=BESTLEISTUNGEN_EDIT_ROLES.includes(String(login?.rolle||"").toLowerCase());
  if(!canEdit) return;
  const button=$("sync3kButton"), msg=$("sync3kMeldung");
  button.disabled=true; button.textContent="⏳ 3K wird geladen …"; msg.hidden=true;
  try{
    const response=await fetch(SYNC_3K_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({events:[7019,8683]})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok) throw new Error(data.error||`HTTP_${response.status}`);
    await loadMembers(false);
    const refreshed=members.find(x=>x.id===selectedMember?.id);
    if(refreshed){ selectedMember=refreshed; renderBestleistungen(selectedMember); fillBestleistungenForm(selectedMember); }
    const unmatched=Array.isArray(data.nichtZugeordnet)?data.nichtZugeordnet.length:0;
    msg.textContent=`3K aktualisiert: ${data.aktualisiert||0} Spieler${unmatched?`, ${unmatched} Namen nicht zugeordnet`:""}.`;
    msg.className="profil-message success"; msg.hidden=false;
  }catch(error){
    console.error(error);
    msg.textContent="3K-Synchronisierung noch nicht möglich. Bitte den mitgelieferten Cloudflare-Worker aktualisieren/deployen.";
    msg.className="profil-message error"; msg.hidden=false;
  }finally{ button.disabled=false; button.textContent="🔄 3K synchronisieren"; }
}

function showMessage(text, success=false){ const box=$("profilMeldung"); box.textContent=text; box.className=`profil-message ${success?"success":"error"}`; box.hidden=false; }
function clearMessage(){ $("profilMeldung").hidden=true; }

async function loadMembers(render=true){
  try{
    const snap=await getDocs(collection(db,"mitglieder"));
    members=snap.docs.map(item=>({id:item.id,...item.data()}))
      .filter(member=>member.aktiv!==false && MEMBER_ROLES.includes(String(member.rolle||"").toLowerCase()))
      .sort((a,b)=>nickname(a).localeCompare(nickname(b),"de",{sensitivity:"base"}));
    if(render) renderMembers();
  }catch(error){ console.error(error); const box=$("kaderMeldung"); box.textContent="Der Kader konnte gerade nicht geladen werden."; box.className="kader-message error"; box.hidden=false; }
}
function renderMembers(){
  $("mitgliedAnzahl").textContent=`${members.length} ${members.length===1?"Mitglied":"Mitglieder"}`;
  $("kaderGrid").innerHTML=members.map(member=>`<button class="member-card" type="button" data-member-id="${escapeHtml(member.id)}"><img class="member-avatar" src="${escapeHtml(profileImage(member))}" alt="Profilbild von ${escapeHtml(nickname(member))}" onerror="this.src='${DEFAULT_IMAGE}'"><span class="member-nickname">${escapeHtml(nickname(member))}</span>${displayName(member)?`<span class="member-name">${escapeHtml(displayName(member))}</span>`:""}<span class="member-role">${escapeHtml(roleLabel(String(member.rolle).toLowerCase()))}</span></button>`).join("");
  document.querySelectorAll("[data-member-id]").forEach(button=>button.addEventListener("click",()=>openProfile(button.dataset.memberId)));
}
function openProfile(memberId){
  selectedMember=members.find(member=>member.id===memberId); if(!selectedMember)return; clearMessage();
  $("profilBild").src=profileImage(selectedMember); $("profilBild").onerror=()=>{$("profilBild").src=DEFAULT_IMAGE;};
  $("profilNickname").textContent=nickname(selectedMember); $("profilName").textContent=displayName(selectedMember); $("profilRolle").textContent=roleLabel(String(selectedMember.rolle).toLowerCase());
  renderBestleistungen(selectedMember);
  const isOwn=Boolean(login?.benutzername)&&String(login.benutzername).toLowerCase()===String(selectedMember.benutzername||selectedMember.id).toLowerCase();
  $("eigenesProfilTools").hidden=!isOwn; if(isOwn) $("nicknameInput").value=nickname(selectedMember);
  const canEdit=BESTLEISTUNGEN_EDIT_ROLES.includes(String(login?.rolle||"").toLowerCase());
  $("bestleistungenAdmin").hidden=!canEdit; $("sync3kButton").hidden=!canEdit; $("bestleistungenMeldung").hidden=true; $("sync3kMeldung").hidden=true; if(canEdit) fillBestleistungenForm(selectedMember);
  $("kaderListeBereich").hidden=true; $("profilBereich").hidden=false; window.scrollTo({top:0,behavior:"smooth"});
}
function backToRoster(){ selectedMember=null; $("profilBereich").hidden=true; $("kaderListeBereich").hidden=false; window.scrollTo({top:0,behavior:"smooth"}); }

async function saveNickname(){
  if(!selectedMember||!login?.benutzername)return; clearMessage(); const value=$("nicknameInput").value.trim();
  if(value.length<2||value.length>30){showMessage("Der Spitzname muss zwischen 2 und 30 Zeichen lang sein.");return;}
  const button=$("nicknameButton"); button.disabled=true;
  try{
    const duplicate=await getDocs(query(collection(db,"mitglieder"),where("nickname","==",value))); if(duplicate.docs.some(item=>item.id!==selectedMember.id)){showMessage("Dieser Spitzname wird bereits verwendet.");return;}
    await updateDoc(doc(db,"mitglieder",selectedMember.id),{nickname:value,nicknameGeaendertAm:serverTimestamp()});
    selectedMember.nickname=value; const local=members.find(item=>item.id===selectedMember.id); if(local)local.nickname=value; login.nickname=value; saveLogin(login,localStorage.getItem("dart11enAngemeldetBleiben")==="true"); $("profilNickname").textContent=value; renderMembers(); showMessage("Dein Spitzname wurde geändert.",true);
  }catch(error){console.error(error);showMessage("Der Spitzname konnte nicht gespeichert werden.");} finally{button.disabled=false;}
}
function compressImage(file){return new Promise((resolve,reject)=>{if(!file.type.startsWith("image/"))return reject(new Error("INVALID_TYPE"));if(file.size>8*1024*1024)return reject(new Error("TOO_LARGE"));const reader=new FileReader();reader.onerror=()=>reject(new Error("READ_ERROR"));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error("IMAGE_ERROR"));image.onload=()=>{const size=Math.min(600,Math.max(image.width,image.height));const scale=Math.min(1,size/Math.max(image.width,image.height));const canvas=document.createElement("canvas");canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.78));};image.src=reader.result;};reader.readAsDataURL(file);});}
async function savePhoto(file){if(!selectedMember||!file)return;clearMessage();const button=$("fotoButton");button.disabled=true;try{const dataUrl=await compressImage(file);if(dataUrl.length>450000)throw new Error("TOO_LARGE_AFTER_COMPRESS");await updateDoc(doc(db,"mitglieder",selectedMember.id),{profilBild:dataUrl,profilBildGeaendertAm:serverTimestamp()});selectedMember.profilBild=dataUrl;const local=members.find(item=>item.id===selectedMember.id);if(local)local.profilBild=dataUrl;$("profilBild").src=dataUrl;renderMembers();showMessage("Dein Profilfoto wurde geändert.",true);}catch(error){console.error(error);showMessage(error.message?.includes("TOO_LARGE")?"Das Bild ist zu groß. Bitte wähle ein anderes Foto.":"Das Profilfoto konnte nicht gespeichert werden.");}finally{button.disabled=false;$("fotoInput").value="";}}
async function changePassword(){if(!selectedMember||!login?.benutzername)return;clearMessage();const oldPassword=$("aktuellesPasswort").value,newPassword=$("neuesPasswort").value,repeated=$("neuesPasswort2").value;if(!oldPassword)return showMessage("Bitte gib zuerst dein aktuelles Passwort ein.");if(newPassword.length<8)return showMessage("Das neue Passwort muss mindestens 8 Zeichen haben.");if(newPassword!==repeated)return showMessage("Die neuen Passwörter stimmen nicht überein.");if(oldPassword===newPassword)return showMessage("Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.");const button=$("passwortButton");button.disabled=true;try{const username=String(login.benutzername).toLowerCase();const userSnap=await getDoc(doc(db,"mitglieder",username));if(!userSnap.exists())throw new Error("USER_NOT_FOUND");const valid=await verifyPassword(oldPassword,userSnap.data());if(!valid){showMessage("Das aktuelle Passwort ist falsch.");return;}await setNewPassword(username,newPassword,false);$("aktuellesPasswort").value="";$("neuesPasswort").value="";$("neuesPasswort2").value="";showMessage("Dein Passwort wurde geändert.",true);}catch(error){console.error(error);showMessage("Das Passwort konnte nicht geändert werden.");}finally{button.disabled=false;}}

$("zurueckButton").addEventListener("click",backToRoster);
$("fotoButton").addEventListener("click",()=>$("fotoInput").click());
$("fotoInput").addEventListener("change",event=>savePhoto(event.target.files?.[0]));
$("nicknameButton").addEventListener("click",saveNickname);
$("passwortButton").addEventListener("click",changePassword);
$("bestleistungenSpeichern").addEventListener("click",saveBestleistungen);
$("sync3kButton").addEventListener("click",sync3k);
loadMembers();
