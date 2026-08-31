import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
  arrayUnion,
  deleteField
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

function getSpielstatistik(member) {
  const raw = member.spielstatistik3k || member.statistik3k || {};
  const wonGames = Number(raw.spieleGewonnen ?? raw.wonGames ?? 0) || 0;
  const lostGames = Number(raw.spieleVerloren ?? raw.lostGames ?? 0) || 0;
  const wonLegs = Number(raw.legsGewonnen ?? raw.wonLegs ?? 0) || 0;
  const lostLegs = Number(raw.legsVerloren ?? raw.lostLegs ?? 0) || 0;
  return { wonGames, lostGames, wonLegs, lostLegs };
}

function renderSpielstatistik(member) {
  const stats = getSpielstatistik(member);
  const items = [
    { icon: "🏆", value: stats.wonGames, label: "Spiele gewonnen" },
    { icon: "✕", value: stats.lostGames, label: "Spiele verloren" },
    { icon: "✅", value: stats.wonLegs, label: "Legs gewonnen" },
    { icon: "➖", value: stats.lostLegs, label: "Legs verloren" }
  ];
  $("spielstatistikGrid").innerHTML = items.map(item => `
    <div class="player-stat-card">
      <span class="player-stat-icon">${item.icon}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <span>${escapeHtml(item.label)}</span>
    </div>
  `).join("");
}

async function renderDartTvStats(member) {
  const grid = $("dartTvStatsGrid");
  const recent = $("dartTvRecentGames");
  if (!grid || !recent) return;
  grid.innerHTML = `<div class="dart-tv-empty">TV-Spiele werden geladen …</div>`;
  recent.innerHTML = "";
  const username = String(member?.benutzername || member?.id || "").toLowerCase();
  if (!username) { grid.innerHTML = `<div class="dart-tv-empty">Noch keine Spiele zugeordnet.</div>`; return; }
  try {
    const snap = await getDocs(query(collection(db, "dartTvSpiele"), where("benutzername", "==", username)));
    const games = snap.docs.map(item => ({ id:item.id, ...item.data() })).sort((a,b)=>(Number(b.endedAt)||0)-(Number(a.endedAt)||0));
    const group = mode => games.filter(g => g.mode === mode);
    const summarize = list => {
      const points=list.reduce((sum,g)=>sum+(Number(g.points)||0),0);
      const darts=list.reduce((sum,g)=>sum+(Number(g.darts)||0),0);
      const avg=darts>0?(points/darts*3):0;
      const best=list.reduce((max,g)=>Math.max(max,Number(g.average)||0),0);
      const count180=list.reduce((sum,g)=>sum+(Number(g.count180)||0),0);
      return { games:list.length, points, darts, avg, best, count180 };
    };
    const cards = [{key:"single",label:"Einzel"},{key:"double",label:"Doppel"}].map(item=>({ ...item, ...summarize(group(item.key)) }));
    grid.innerHTML = cards.map(card => `
      <div class="dart-tv-mode-card ${card.avg>=60?"hot":""}">
        <span>${card.label}-Average</span>
        <strong>${card.games ? card.avg.toFixed(2) : "–"}</strong>
        <div class="dart-tv-mode-meta">
          <span>${card.games} Spiele</span>
          <span>Best ${card.games ? card.best.toFixed(2) : "–"}</span>
          <span>${card.darts} Darts</span>
          <span>${card.count180}× 180</span>
        </div>
      </div>
    `).join("");
    if (!games.length) { recent.innerHTML = `<div class="dart-tv-empty">Ordne nach einem Spieltag im Spielarchiv deine Spielerpositionen zu.</div>`; return; }
    recent.innerHTML = `<div class="dart-tv-game-row"><strong>Letzte Spiele</strong><span></span><span>Average</span><span>Darts</span></div>` + games.slice(0,6).map(g => {
      const date=String(g.date||"").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3.$2.$1");
      return `<div class="dart-tv-game-row"><span>${g.mode==="double"?"Doppel":"Einzel"}</span><span>${escapeHtml(date)} · Board ${escapeHtml(g.board??"–")}</span><strong>${Number(g.average||0).toFixed(2)}</strong><span>${Number(g.darts)||0}</span></div>`;
    }).join("");
  } catch (error) {
    console.error(error);
    grid.innerHTML = `<div class="dart-tv-empty">TV-Statistiken konnten nicht geladen werden.</div>`;
  }
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


let import3kPreviewData = null;

function normalizeImportName(value) {
  return String(value || "")
    .toLocaleLowerCase("de")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ").trim();
}

function extractNicknameFrom3k(value) {
  return String(value || "").match(/\(([^)]+)\)/)?.[1]?.trim() || "";
}

function matchImportedPlayer(playerName) {
  const cleanSource = normalizeImportName(playerName);
  const nickSource = normalizeImportName(extractNicknameFrom3k(playerName));
  if (!cleanSource && !nickSource) return null;

  // 1. Vorname + Nachname exakt. Das ist absichtlich der Hauptschlüssel.
  const fullMatches = members.filter(member => normalizeImportName(displayName(member)) === cleanSource);
  if (fullMatches.length === 1) return fullMatches[0];

  // Falls 3K "Vorname Nachname (Spitzname)" liefert, ist cleanSource bereits der volle Name.
  // 2. Gespeicherte Aliasse, falls später nötig.
  const aliasMatches = members.filter(member => {
    const aliases = Array.isArray(member.threeKAliases) ? member.threeKAliases : [];
    return aliases.some(alias => normalizeImportName(alias) === cleanSource || normalizeImportName(alias) === nickSource);
  });
  if (aliasMatches.length === 1) return aliasMatches[0];

  // 3. Spitzname nur als Fallback.
  const nickMatches = members.filter(member => {
    const target = normalizeImportName(nickname(member));
    return target && (target === cleanSource || target === nickSource);
  });
  return nickMatches.length === 1 ? nickMatches[0] : null;
}

function splitImportLines(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);
}

function parseBestleistungenImport(text) {
  const lines = splitImportLines(text);
  const result = [];
  let category = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes("HIGHSCORE")) { category = "highscore"; continue; }
    if (upper.includes("HIGHFINISH")) { category = "highfinish"; continue; }
    if (upper.includes("SHORTGAME") || upper.includes("SHORT GAME") || upper.includes("SHORTLEG")) { category = "shortgame"; continue; }
    if (/^(NAME|ANZAHL|WERT|NACH BESTLEISTUNGSART|NACH SPIELER|BESTLEISTUNGS)/i.test(line)) continue;
    if (!category) continue;

    // Kopierte 3K-Zeilen kommen meist als: Name <Tab/Spaces> Anzahl <Tab/Spaces> Wert
    const match = line.match(/^(.+?)\s+(\d+)\s+(\d+)$/);
    if (!match) continue;
    const player = match[1].trim();
    const count = Number(match[2]);
    const value = Number(match[3]);
    if (!player || !Number.isInteger(count) || count < 1 || !Number.isFinite(value)) continue;
    if (category === "highscore" && (value < 150 || value > 180)) continue;
    if (category === "highfinish" && (value < 100 || value > 180)) continue;
    if (category === "shortgame" && (value < 1 || value > 60)) continue;
    result.push({ player, category, count, value });
  }
  // iOS/Safari kann Tabellenzellen beim Kopieren auch einzeln pro Zeile liefern.
  if (!result.length) {
    let fallbackCategory = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], upper = line.toUpperCase();
      if (upper.includes("HIGHSCORE")) { fallbackCategory="highscore"; continue; }
      if (upper.includes("HIGHFINISH")) { fallbackCategory="highfinish"; continue; }
      if (upper.includes("SHORTGAME") || upper.includes("SHORT GAME") || upper.includes("SHORTLEG")) { fallbackCategory="shortgame"; continue; }
      if (!fallbackCategory || /^(NAME|ANZAHL|WERT)/i.test(line) || /^\d+$/.test(line)) continue;
      const count = Number(lines[i+1]), value = Number(lines[i+2]);
      if (!Number.isInteger(count) || count < 1 || !Number.isFinite(value)) continue;
      const plausible = fallbackCategory === "highscore" ? value >= 150 && value <= 180 : fallbackCategory === "highfinish" ? value >= 100 && value <= 180 : value >= 1 && value <= 60;
      if (plausible) { result.push({player:line, category:fallbackCategory, count, value}); i += 2; }
    }
  }
  return result;
}

function normalizeHeader(value) {
  return normalizeImportName(value).replace(/\s/g, "");
}

function findHeaderIndex(headers, patterns) {
  return headers.findIndex(header => patterns.some(pattern => pattern.test(header)));
}

function parseSpielstatistikImport(text) {
  const raw = String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ");
  const records = [];

  // 3K liefert beim Kopieren je nach Gerät Tabs und Zeilenumbrüche an
  // unterschiedlichen Stellen. Darum suchen wir zuerst direkt im gesamten
  // Rohtext nach Spielerankern: "Vorname Nachname (Spitzname)  Dart11en".
  // Alles bis zum nächsten Spieler gehört zu diesem Spielerblock.
  const playerRegex = /(?:^|\n|\t|\s)(?:\d+\.\s*)?([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .'-]*?\([^()\n\t]+\))\s*[\t ]+Dart11en\b/gi;
  const players = [];
  let match;
  while ((match = playerRegex.exec(raw)) !== null) {
    players.push({
      player: match[1].replace(/\s+/g, " ").trim(),
      start: match.index,
      dataStart: playerRegex.lastIndex
    });
  }

  for (let i = 0; i < players.length; i++) {
    const current = players[i];
    const end = i + 1 < players.length ? players[i + 1].start : raw.length;
    const block = raw.slice(current.dataStart, end);

    // Differenzen (+8, -3, 0) interessieren uns nicht. Gesucht werden nur
    // echte Ergebnispaare wie "24 - 14". Der 3K-Aufbau enthält sechs Paare:
    // Spiele Einzel, Legs Einzel, Spiele Doppel, Legs Doppel,
    // Spiele Gesamt, Legs Gesamt. Deshalb nehmen wir die letzten zwei Paare.
    const pairs = [...block.matchAll(/(\d+)\s*-\s*(\d+)/g)]
      .map(result => [Number(result[1]), Number(result[2])]);

    if (pairs.length >= 6) {
      const games = pairs[pairs.length - 2];
      const legs = pairs[pairs.length - 1];
      records.push({
        player: current.player,
        wonGames: games[0],
        lostGames: games[1],
        wonLegs: legs[0],
        lostLegs: legs[1]
      });
    }
  }

  // Fallback: Falls ein Browser "Dart11en" auf eine eigene Zeile legt,
  // erkennen wir den Spieler über die Zeile mit Name + (Spitzname) und
  // sammeln bis zum nächsten solchen Namen alle Ergebnispaare ein.
  if (!records.length) {
    const lines = splitImportLines(raw);
    const starts = [];
    for (let i = 0; i < lines.length; i++) {
      const nameMatch = lines[i].match(/^(?:\d+\.\s*)?([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .'-]*?\([^()]+\))(?:\s+Dart11en)?$/i)
        || lines[i].match(/^(?:\d+\.\s*)?(.+?\([^()]+\))\s+Dart11en\b/i);
      if (nameMatch) starts.push({ index: i, player: nameMatch[1].replace(/\s+/g, " ").trim() });
    }
    for (let i = 0; i < starts.length; i++) {
      const current = starts[i];
      const end = i + 1 < starts.length ? starts[i + 1].index : lines.length;
      const block = lines.slice(current.index + 1, end).join("\n");
      const pairs = [...block.matchAll(/(\d+)\s*-\s*(\d+)/g)].map(result => [Number(result[1]), Number(result[2])]);
      if (pairs.length >= 6) {
        const games = pairs[pairs.length - 2];
        const legs = pairs[pairs.length - 1];
        records.push({ player: current.player, wonGames: games[0], lostGames: games[1], wonLegs: legs[0], lostLegs: legs[1] });
      }
    }
  }

  return records;
}

function aggregateImportPreview(type, records) {
  const grouped = new Map();
  const unmatched = new Map();

  for (const record of records) {
    const member = matchImportedPlayer(record.player);
    if (!member) {
      unmatched.set(record.player, record);
      continue;
    }
    if (!grouped.has(member.id)) grouped.set(member.id, { member, sourceNames: new Set(), records: [] });
    const entry = grouped.get(member.id);
    entry.sourceNames.add(record.player);
    entry.records.push(record);
  }

  const matched = [...grouped.values()].map(entry => {
    if (type === "bestleistungen") {
      const stats = { count180: 0, highscores: [], highfinishes: [], shortgames: [] };
      const maps = { highscore: new Map(), highfinish: new Map(), shortgame: new Map() };
      for (const record of entry.records) {
        if (record.category === "highscore" && record.value === 180) stats.count180 += record.count;
        const map = maps[record.category];
        if (map) map.set(record.value, (map.get(record.value) || 0) + record.count);
      }
      stats.highscores = [...maps.highscore].map(([value,count]) => ({value,count})).sort((a,b)=>b.value-a.value);
      stats.highfinishes = [...maps.highfinish].map(([value,count]) => ({value,count})).sort((a,b)=>b.value-a.value);
      stats.shortgames = [...maps.shortgame].map(([value,count]) => ({value,count})).sort((a,b)=>a.value-b.value);
      return { ...entry, data: stats };
    }
    const data = entry.records.reduce((sum, record) => ({
      wonGames: sum.wonGames + (Number(record.wonGames) || 0),
      lostGames: sum.lostGames + (Number(record.lostGames) || 0),
      wonLegs: sum.wonLegs + (Number(record.wonLegs) || 0),
      lostLegs: sum.lostLegs + (Number(record.lostLegs) || 0)
    }), { wonGames:0, lostGames:0, wonLegs:0, lostLegs:0 });
    return { ...entry, data };
  });
  return { matched, unmatched: [...unmatched.entries()].map(([name, record]) => ({ name, record })) };
}

function mergeBestSources(sources) {
  const total = { count180:0, highscores:[], highfinishes:[], shortgames:[], quelle:"3k-import" };
  const maps = { highscores:new Map(), highfinishes:new Map(), shortgames:new Map() };
  for (const source of Object.values(sources || {})) {
    total.count180 += Number(source?.count180 || 0);
    for (const key of ["highscores","highfinishes","shortgames"]) {
      for (const item of normalizeList(source?.[key] || [])) maps[key].set(item.value, (maps[key].get(item.value)||0) + item.count);
    }
  }
  total.highscores=[...maps.highscores].map(([value,count])=>({value,count})).sort((a,b)=>b.value-a.value);
  total.highfinishes=[...maps.highfinishes].map(([value,count])=>({value,count})).sort((a,b)=>b.value-a.value);
  total.shortgames=[...maps.shortgames].map(([value,count])=>({value,count})).sort((a,b)=>a.value-b.value);
  return total;
}

function mergeStatsSources(sources) {
  return Object.values(sources || {}).reduce((sum, source) => ({
    spieleGewonnen: sum.spieleGewonnen + (Number(source?.wonGames ?? source?.spieleGewonnen ?? 0) || 0),
    spieleVerloren: sum.spieleVerloren + (Number(source?.lostGames ?? source?.spieleVerloren ?? 0) || 0),
    legsGewonnen: sum.legsGewonnen + (Number(source?.wonLegs ?? source?.legsGewonnen ?? 0) || 0),
    legsVerloren: sum.legsVerloren + (Number(source?.lostLegs ?? source?.legsVerloren ?? 0) || 0),
    quelle: "3k-import"
  }), { spieleGewonnen:0, spieleVerloren:0, legsGewonnen:0, legsVerloren:0, quelle:"3k-import" });
}

function renderImportPreview(preview, type) {
  const box = $("import3kPreview");
  const rows = [];
  for (const entry of preview.matched) {
    const summary = type === "bestleistungen"
      ? `180: ${entry.data.count180} · HS: ${listTotal(entry.data.highscores)} · HF: ${listTotal(entry.data.highfinishes)} · SG: ${listTotal(entry.data.shortgames)}`
      : `${entry.data.wonGames}:${entry.data.lostGames} Spiele · ${entry.data.wonLegs}:${entry.data.lostLegs} Legs`;
    rows.push(`<div class="import-preview-row"><div><strong>${escapeHtml(nickname(entry.member))}</strong><small>${escapeHtml(displayName(entry.member))}</small></div><span>${escapeHtml(summary)}</span></div>`);
  }
  for (const item of preview.unmatched) {
    const options = members.map(member => `<option value="${escapeHtml(member.id)}">${escapeHtml(nickname(member))} – ${escapeHtml(displayName(member) || "ohne Namen")}</option>`).join("");
    rows.push(`<div class="import-preview-row unmatched import-alias-row" data-import-name="${escapeHtml(item.name)}">
      <div class="import-unmatched-info"><strong>Nicht zugeordnet</strong><small>${escapeHtml(item.name)}</small></div>
      <div class="import-alias-controls">
        <select class="import-alias-select" aria-label="Dart11en-Spieler für ${escapeHtml(item.name)} auswählen">
          <option value="">Spieler auswählen …</option>${options}
        </select>
        <button class="import-alias-button" type="button">Zuordnen & merken</button>
      </div>
    </div>`);
  }

  box.innerHTML = `
    <div class="import-preview-summary">
      <span class="import-preview-pill good">${preview.matched.length} zugeordnet</span>
      <span class="import-preview-pill bad">${preview.unmatched.length} nicht zugeordnet</span>
    </div>
    ${rows.join("")}
  `;
  box.hidden = false;
  box.querySelectorAll(".import-alias-button").forEach(button => {
    button.addEventListener("click", async () => {
      const row = button.closest(".import-alias-row");
      const sourceName = row?.dataset.importName || "";
      const memberId = row?.querySelector(".import-alias-select")?.value || "";
      if (!sourceName || !memberId) {
        const msg = $("import3kMeldung");
        msg.textContent = "Bitte zuerst den richtigen Dart11en-Spieler auswählen.";
        msg.className = "profil-message error"; msg.hidden = false;
        return;
      }
      await save3kAlias(sourceName, memberId, button);
    });
  });
}

async function save3kAlias(sourceName, memberId, button) {
  const member = members.find(item => item.id === memberId);
  const state = import3kPreviewData;
  const msg = $("import3kMeldung");
  if (!member || !state) return;
  button.disabled = true;
  try {
    await updateDoc(doc(db, "mitglieder", member.id), {
      threeKAliases: arrayUnion(sourceName),
      threeKAliasesGeaendertAm: serverTimestamp(),
      threeKAliasesGeaendertVon: String(login?.benutzername || "3k-import")
    });
    if (!Array.isArray(member.threeKAliases)) member.threeKAliases = [];
    if (!member.threeKAliases.some(alias => normalizeImportName(alias) === normalizeImportName(sourceName))) member.threeKAliases.push(sourceName);

    // Vorschau mit derselben bereits erkannten 3K-Tabelle neu aufbauen.
    const preview = aggregateImportPreview(state.type, state.records);
    import3kPreviewData = { ...state, preview };
    renderImportPreview(preview, state.type);
    $("save3kImportButton").disabled = preview.matched.length === 0;
    msg.textContent = `${sourceName} wurde dauerhaft ${nickname(member)} zugeordnet.`;
    msg.className = "profil-message success"; msg.hidden = false;
  } catch (error) {
    console.error(error);
    msg.textContent = "Die 3K-Zuordnung konnte nicht gespeichert werden.";
    msg.className = "profil-message error"; msg.hidden = false;
    button.disabled = false;
  }
}

function preview3kImport() {
  let type = $("import3kArt").value;
  const text = $("import3kText").value;
  const msg = $("import3kMeldung");
  msg.hidden = true;

  let records = type === "bestleistungen"
    ? parseBestleistungenImport(text)
    : parseSpielstatistikImport(text);

  // Automatische Erkennung: 3K-Spielstatistiken enthalten pro Spieler sechs
  // Ergebnispaare und typischerweise den Mannschaftsnamen Dart11en. Wenn im
  // Dropdown versehentlich Bestleistungen gewählt ist, erkennen wir das Format
  // trotzdem und wechseln selbstständig auf Spielstatistik.
  if (!records.length && type === "bestleistungen") {
    const statsRecords = parseSpielstatistikImport(text);
    if (statsRecords.length) {
      type = "spielstatistik";
      $("import3kArt").value = "spielstatistik";
      records = statsRecords;
    }
  }

  // Umgekehrt ebenfalls tolerant sein.
  if (!records.length && type === "spielstatistik") {
    const bestRecords = parseBestleistungenImport(text);
    if (bestRecords.length) {
      type = "bestleistungen";
      $("import3kArt").value = "bestleistungen";
      records = bestRecords;
    }
  }

  if (!records.length) {
    import3kPreviewData = null;
    $("save3kImportButton").disabled = true;
    $("import3kPreview").hidden = true;
    msg.textContent = "Keine 3K-Daten erkannt. Kopiere den Bereich ab dem ersten Spielernamen bis zum letzten Spieler vollständig.";
    msg.className = "profil-message error"; msg.hidden = false;
    return;
  }

  const preview = aggregateImportPreview(type, records);
  import3kPreviewData = { type, league: $("import3kLiga").value, records, preview };
  renderImportPreview(preview, type);
  $("save3kImportButton").disabled = preview.matched.length === 0;
  const artName = type === "spielstatistik" ? "Spielstatistik" : "Bestleistungen";
  msg.textContent = `${records.length} Spieler/Einträge als ${artName} erkannt. Bitte Vorschau prüfen und erst dann speichern.`;
  msg.className = "profil-message success"; msg.hidden = false;
}

async function save3kImport() {
  const state = import3kPreviewData;
  if (!state || !state.preview.matched.length) return;
  const button = $("save3kImportButton"), msg = $("import3kMeldung");
  button.disabled = true;
  try {
    for (const entry of state.preview.matched) {
      const member = members.find(item => item.id === entry.member.id) || entry.member;
      const currentImport = member.dreiKImport && typeof member.dreiKImport === "object" ? structuredClone(member.dreiKImport) : {};
      if (state.type === "bestleistungen") {
        currentImport.bestleistungen = currentImport.bestleistungen || {};
        currentImport.bestleistungen[state.league] = { ...entry.data, importiertAm: new Date().toISOString() };
        const bestleistungen3k = mergeBestSources(currentImport.bestleistungen);
        await updateDoc(doc(db,"mitglieder",member.id), {
          dreiKImport: currentImport,
          bestleistungen3k,
          bestleistungenGeaendertAm: serverTimestamp(),
          bestleistungenGeaendertVon: String(login?.benutzername || "3k-import")
        });
        member.dreiKImport = currentImport; member.bestleistungen3k = bestleistungen3k;
      } else {
        currentImport.spielstatistik = currentImport.spielstatistik || {};
        currentImport.spielstatistik[state.league] = { ...entry.data, importiertAm: new Date().toISOString() };
        const spielstatistik3k = mergeStatsSources(currentImport.spielstatistik);
        await updateDoc(doc(db,"mitglieder",member.id), {
          dreiKImport: currentImport,
          spielstatistik3k,
          spielstatistikGeaendertAm: serverTimestamp(),
          spielstatistikGeaendertVon: String(login?.benutzername || "3k-import")
        });
        member.dreiKImport = currentImport; member.spielstatistik3k = spielstatistik3k;
      }
    }
    const refreshed = members.find(x => x.id === selectedMember?.id);
    if (refreshed) { selectedMember = refreshed; renderBestleistungen(refreshed); renderSpielstatistik(refreshed); renderDartTvStats(refreshed); fillBestleistungenForm(refreshed); }
    msg.textContent = `${state.preview.matched.length} Spieler wurden aus ${state.league === "ruhrpott" ? "Ruhrpott" : "Herne"} aktualisiert.${state.preview.unmatched.length ? ` ${state.preview.unmatched.length} Namen konnten nicht zugeordnet werden.` : ""}`;
    msg.className = "profil-message success"; msg.hidden = false;
    $("import3kText").value = "";
    import3kPreviewData = null;
    $("save3kImportButton").disabled = true;
  } catch (error) {
    console.error(error);
    msg.textContent = "Der 3K-Import konnte nicht vollständig gespeichert werden.";
    msg.className = "profil-message error"; msg.hidden = false;
  } finally { button.disabled = !import3kPreviewData; }
}

function open3kImport() {
  $("import3kPanel").hidden = false;
  $("import3kMeldung").hidden = true;
  $("import3kPreview").hidden = true;
  $("save3kImportButton").disabled = true;
  import3kPreviewData = null;
  $("import3kPanel").scrollIntoView({behavior:"smooth", block:"nearest"});
}
function close3kImport() { $("import3kPanel").hidden = true; import3kPreviewData = null; }

async function reset3kData() {
  const canEdit = BESTLEISTUNGEN_EDIT_ROLES.includes(String(login?.rolle || "").toLowerCase());
  if (!canEdit) return;
  const confirmed = window.confirm(
    "Wirklich alle importierten 3K-Daten zurücksetzen?\n\n" +
    "Gelöscht werden Bestleistungen und Spielstatistiken aus Ruhrpott + Herne. " +
    "Spielerprofile und gespeicherte 3K-Zuordnungen bleiben erhalten."
  );
  if (!confirmed) return;

  const button = $("reset3kButton");
  const msg = $("sync3kMeldung");
  button.disabled = true;
  msg.hidden = false;
  msg.className = "profil-message";
  msg.textContent = "3K-Daten werden zurückgesetzt …";

  try {
    for (const member of members) {
      await updateDoc(doc(db, "mitglieder", member.id), {
        dreiKImport: deleteField(),
        bestleistungen3k: deleteField(),
        spielstatistik3k: deleteField(),
        statistik3k: deleteField(),
        bestleistungenGeaendertAm: serverTimestamp(),
        bestleistungenGeaendertVon: String(login?.benutzername || "3k-reset"),
        spielstatistikGeaendertAm: serverTimestamp(),
        spielstatistikGeaendertVon: String(login?.benutzername || "3k-reset")
      });
      delete member.dreiKImport;
      delete member.bestleistungen3k;
      delete member.spielstatistik3k;
      delete member.statistik3k;
    }

    const refreshed = members.find(item => item.id === selectedMember?.id);
    if (refreshed) {
      selectedMember = refreshed;
      renderBestleistungen(refreshed);
      renderSpielstatistik(refreshed); renderDartTvStats(refreshed);
      fillBestleistungenForm(refreshed);
    }
    $("import3kText").value = "";
    $("import3kPreview").hidden = true;
    $("save3kImportButton").disabled = true;
    import3kPreviewData = null;
    msg.className = "profil-message success";
    msg.textContent = "3K-Daten wurden zurückgesetzt. Du kannst Ruhrpott und Herne jetzt neu importieren.";
  } catch (error) {
    console.error(error);
    msg.className = "profil-message error";
    msg.textContent = "Die 3K-Daten konnten nicht vollständig zurückgesetzt werden.";
  } finally {
    button.disabled = false;
  }
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
  renderSpielstatistik(selectedMember);
  renderDartTvStats(selectedMember);
  const isOwn=Boolean(login?.benutzername)&&String(login.benutzername).toLowerCase()===String(selectedMember.benutzername||selectedMember.id).toLowerCase();
  $("eigenesProfilTools").hidden=!isOwn; if(isOwn) $("nicknameInput").value=nickname(selectedMember);
  const canEdit=BESTLEISTUNGEN_EDIT_ROLES.includes(String(login?.rolle||"").toLowerCase());
  $("bestleistungenAdmin").hidden=!canEdit; $("threeKAdminActions").hidden=!canEdit; $("bestleistungenMeldung").hidden=true; $("sync3kMeldung").hidden=true; $("import3kPanel").hidden=true; if(canEdit) fillBestleistungenForm(selectedMember);
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
$("open3kImportButton").addEventListener("click",open3kImport);
$("reset3kButton").addEventListener("click",reset3kData);
$("close3kImportButton").addEventListener("click",close3kImport);
$("preview3kImportButton").addEventListener("click",preview3kImport);
$("save3kImportButton").addEventListener("click",save3kImport);
$("import3kText").addEventListener("input",()=>{ import3kPreviewData=null; $("save3kImportButton").disabled=true; });
$("import3kLiga").addEventListener("change",()=>{ import3kPreviewData=null; $("save3kImportButton").disabled=true; });
$("import3kArt").addEventListener("change",()=>{ import3kPreviewData=null; $("save3kImportButton").disabled=true; $("import3kPreview").hidden=true; });
loadMembers();
