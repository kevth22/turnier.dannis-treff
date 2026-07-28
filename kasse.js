import { getLogin } from "./auth-utils.js";
import { db } from "./auth-utils.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const VIEW_ROLES = ["admin", "captain", "kassenwart"];
const EDIT_ROLES = ["admin", "kassenwart"];
const CONTRIBUTION_ROLES = ["admin", "captain", "kassenwart", "mitglied"];
const DEFAULT_AMOUNT = 20;
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

const state = {
  user: null,
  role: "",
  canEdit: false,
  members: [],
  profiles: new Map(),
  contributions: new Map(),
  bookings: []
};

const $ = id => document.getElementById(id);

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function displayName(member) {
  return member.nickname || [member.vorname, member.nachname].filter(Boolean).join(" ") || member.benutzername;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(text, isError = false) {
  const host = $("kasseMessage");
  host.textContent = text;
  host.style.color = isError ? "#ff6570" : "#58d991";
}

function roleLabel(role) {
  return ({ admin: "Admin", captain: "Captain", kassenwart: "Kassenwart" })[role] || role;
}

function initAccess() {
  state.user = getLogin();
  state.role = String(state.user?.rolle || "").toLowerCase().trim();
  state.canEdit = EDIT_ROLES.includes(state.role);

  if (!state.user || !VIEW_ROLES.includes(state.role)) {
    $("accessDenied").hidden = false;
    return false;
  }

  $("kasseApp").hidden = false;
  $("roleBadge").textContent = roleLabel(state.role);
  $("welcomeText").textContent = `Hallo ${displayName(state.user)}`;
  $("monthPicker").value = currentMonthKey();

  if (!state.canEdit) {
    $("tableHint").textContent = "Lesemodus: Beiträge können nur von Admin und Kassenwart geändert werden.";
  }
  return true;
}

async function loadMembers() {
  const snap = await getDocs(collection(db, "mitglieder"));
  state.members = snap.docs
    .map(item => ({ benutzername: item.id, ...item.data() }))
    .filter(member => member.aktiv !== false)
    .filter(member => CONTRIBUTION_ROLES.includes(String(member.rolle || "gast").toLowerCase()))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "de"));
}

async function loadProfiles() {
  const snap = await getDocs(collection(db, "kassenProfile"));
  state.profiles = new Map(snap.docs.map(item => [item.id, item.data()]));
}

async function loadContributions(monthKey) {
  const snap = await getDocs(collection(db, "kassenBeitraege"));
  state.contributions = new Map();
  snap.forEach(item => {
    const data = item.data();
    if (data.monat === monthKey) state.contributions.set(data.benutzername, { id: item.id, ...data });
  });
}

async function loadBookings() {
  try {
    const snap = await getDocs(query(collection(db, "kassenBuchungen"), orderBy("erstelltAm", "desc"), limit(100)));
    state.bookings = snap.docs.map(item => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn("Buchungen konnten nicht sortiert geladen werden:", error);
    const snap = await getDocs(collection(db, "kassenBuchungen"));
    state.bookings = snap.docs.map(item => ({ id: item.id, ...item.data() }));
  }
}

function profileFor(username) {
  return state.profiles.get(username) || { beitrag: DEFAULT_AMOUNT, befreit: false, notizen: "", gueltigAb: currentMonthKey() };
}

function amountFor(username, monthKey) {
  const profile = profileFor(username);
  if (profile.gueltigAb && profile.gueltigAb > monthKey) return DEFAULT_AMOUNT;
  const amount = Number(profile.beitrag);
  return Number.isFinite(amount) ? amount : DEFAULT_AMOUNT;
}

function statusFor(username, monthKey) {
  const contribution = state.contributions.get(username);
  if (contribution?.status === "bezahlt") return "bezahlt";
  if (contribution?.status === "befreit") return "befreit";
  const profile = profileFor(username);
  if (profile.befreit === true && (!profile.gueltigAb || profile.gueltigAb <= monthKey)) return "befreit";
  return "offen";
}

function statusButton(member, monthKey) {
  const status = statusFor(member.benutzername, monthKey);
  const className = status === "bezahlt" ? "status-paid" : status === "befreit" ? "status-exempt" : "status-open";
  const symbol = status === "bezahlt" ? "✓" : status === "befreit" ? "−" : "";
  const title = status === "bezahlt" ? "Bezahlt" : status === "befreit" ? "Befreit" : "Offen";
  return `<button class="status-button ${className}" data-action="toggle-paid" data-user="${escapeHtml(member.benutzername)}" title="${title}" ${state.canEdit && status !== "befreit" ? "" : "disabled"}>${symbol}</button>`;
}

function renderMembers() {
  const monthKey = $("monthPicker").value || currentMonthKey();
  const host = $("memberRows");
  if (!state.members.length) {
    host.innerHTML = '<tr><td colspan="4" class="empty-cell">Keine beitragspflichtigen Personen gefunden.</td></tr>';
    return;
  }

  host.innerHTML = state.members.map(member => {
    const profile = profileFor(member.benutzername);
    return `
      <tr>
        <td><span class="member-name">${escapeHtml(displayName(member))}</span><span class="member-sub">${escapeHtml(roleLabel(String(member.rolle || "mitglied").toLowerCase()))}</span></td>
        <td>${euro.format(amountFor(member.benutzername, monthKey))}</td>
        <td>${statusButton(member, monthKey)}</td>
        <td class="edit-column">${state.canEdit ? `<button class="edit-member" data-action="edit-member" data-user="${escapeHtml(member.benutzername)}" title="Beitrag und Notiz bearbeiten">📝</button>` : (profile.notizen ? "📝" : "–")}</td>
      </tr>`;
  }).join("");

  updateContributionStats();
}

function updateContributionStats() {
  const monthKey = $("monthPicker").value || currentMonthKey();
  let paid = 0, open = 0, exempt = 0, openAmount = 0;
  state.members.forEach(member => {
    const status = statusFor(member.benutzername, monthKey);
    if (status === "bezahlt") paid++;
    else if (status === "befreit") exempt++;
    else { open++; openAmount += amountFor(member.benutzername, monthKey); }
  });
  $("paidCount").textContent = paid;
  $("openCount").textContent = open;
  $("exemptCount").textContent = exempt;
  $("openValue").textContent = `${open} · ${euro.format(openAmount)}`;
}

function bookingValue(item) {
  const amount = Number(item.betrag) || 0;
  return item.typ === "ausgabe" ? -amount : amount;
}

function renderDashboard() {
  const active = state.bookings.filter(item => item.storniert !== true);
  const income = active.filter(item => item.typ !== "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  const expense = active.filter(item => item.typ === "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  $("incomeValue").textContent = euro.format(income);
  $("expenseValue").textContent = euro.format(expense);
  $("balanceValue").textContent = euro.format(income - expense);
}

function iconFor(category) {
  return ({ mitgliedsbeitrag: "👥", preisgeld: "🏆", strafe: "⚠️", divers: "📦", muenzgeld: "🪙", automatenabgabe: "🎯", liga_anmeldung: "🏅" })[category] || "💶";
}

function renderJournal() {
  const host = $("journalList");
  if (!state.bookings.length) {
    host.innerHTML = '<p class="empty-cell">Noch keine Buchungen vorhanden.</p>';
    return;
  }
  host.innerHTML = state.bookings.slice(0, 12).map(item => {
    const expense = item.typ === "ausgabe";
    const amount = Math.abs(Number(item.betrag) || 0);
    const date = item.datum || item.monat || "";
    return `<article class="journal-item">
      <div class="journal-icon">${iconFor(item.kategorie)}</div>
      <div class="journal-main"><strong>${escapeHtml(item.titel || item.beschreibung || "Buchung")}${item.storniert ? " (storniert)" : ""}</strong><small>${escapeHtml(date)}${item.personName ? ` · ${escapeHtml(item.personName)}` : ""}</small></div>
      <div class="journal-amount ${expense ? "expense" : "income"}">${expense ? "−" : "+"}${euro.format(amount)}</div>
    </article>`;
  }).join("");
}

async function togglePaid(username) {
  if (!state.canEdit) return;
  const monthKey = $("monthPicker").value || currentMonthKey();
  const member = state.members.find(item => item.benutzername === username);
  if (!member || statusFor(username, monthKey) === "befreit") return;
  const existing = state.contributions.get(username);
  const amount = amountFor(username, monthKey);
  const nowPaid = existing?.status !== "bezahlt";
  const contributionId = `${monthKey}_${username}`;
  const bookingId = `mitgliedsbeitrag_${monthKey}_${username}`;
  const batch = writeBatch(db);

  batch.set(doc(db, "kassenBeitraege", contributionId), {
    benutzername: username,
    personName: displayName(member),
    monat: monthKey,
    betrag: amount,
    status: nowPaid ? "bezahlt" : "offen",
    geaendertVon: state.user.benutzername,
    geaendertAm: serverTimestamp()
  }, { merge: true });

  batch.set(doc(db, "kassenBuchungen", bookingId), {
    typ: "einnahme",
    kategorie: "mitgliedsbeitrag",
    titel: `Mitgliedsbeitrag ${monthKey}`,
    personName: displayName(member),
    benutzername: username,
    monat: monthKey,
    datum: monthKey,
    betrag: amount,
    storniert: !nowPaid,
    erstelltVon: state.user.benutzername,
    erstelltAm: serverTimestamp()
  }, { merge: true });

  await batch.commit();
  showMessage(nowPaid ? "Beitrag als bezahlt gespeichert." : "Beitrag wieder auf offen gesetzt.");
  await refreshData();
}

function openMemberModal(username) {
  if (!state.canEdit) return;
  const member = state.members.find(item => item.benutzername === username);
  if (!member) return;
  const profile = profileFor(username);
  $("memberUsername").value = username;
  $("memberModalTitle").textContent = displayName(member);
  $("memberAmount").value = Number(profile.beitrag ?? DEFAULT_AMOUNT).toFixed(2);
  $("memberValidFrom").value = profile.gueltigAb || $("monthPicker").value || currentMonthKey();
  $("memberExempt").checked = profile.befreit === true;
  $("memberNotes").value = profile.notizen || "";
  $("memberModal").hidden = false;
}

async function saveMemberProfile(event) {
  event.preventDefault();
  if (!state.canEdit) return;
  const username = $("memberUsername").value;
  const member = state.members.find(item => item.benutzername === username);
  const amount = Number($("memberAmount").value);
  if (!member || !Number.isFinite(amount) || amount < 0) return showMessage("Bitte einen gültigen Beitrag eingeben.", true);

  await setDoc(doc(db, "kassenProfile", username), {
    benutzername: username,
    personName: displayName(member),
    beitrag: amount,
    gueltigAb: $("memberValidFrom").value,
    befreit: $("memberExempt").checked,
    notizen: $("memberNotes").value.trim(),
    geaendertVon: state.user.benutzername,
    geaendertAm: serverTimestamp()
  }, { merge: true });

  $("memberModal").hidden = true;
  showMessage("Mitgliedsdaten gespeichert.");
  await refreshData();
}

async function refreshData() {
  const monthKey = $("monthPicker").value || currentMonthKey();
  await Promise.all([loadMembers(), loadProfiles(), loadContributions(monthKey), loadBookings()]);
  renderMembers();
  renderDashboard();
  renderJournal();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!initAccess()) return;

  $("monthPicker").addEventListener("change", async () => {
    await loadContributions($("monthPicker").value);
    renderMembers();
  });
  $("memberRows").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "toggle-paid") togglePaid(button.dataset.user).catch(error => showMessage(error.message, true));
    if (button.dataset.action === "edit-member") openMemberModal(button.dataset.user);
  });
  $("memberForm").addEventListener("submit", event => saveMemberProfile(event).catch(error => showMessage(error.message, true)));
  $("closeMemberModal").addEventListener("click", () => $("memberModal").hidden = true);
  $("memberModal").addEventListener("click", event => { if (event.target === $("memberModal")) $("memberModal").hidden = true; });

  try { await refreshData(); }
  catch (error) { console.error(error); showMessage("Die Kassendaten konnten nicht geladen werden.", true); }
});
