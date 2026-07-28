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
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const VIEW_ROLES = ["admin", "captain", "kassenwart"];
const EDIT_ROLES = ["admin", "kassenwart"];
const CONTRIBUTION_ROLES = ["admin", "captain", "kassenwart", "mitglied"];
const DEFAULT_AMOUNT = 20;
const BOOKING_CATEGORIES = {
  einnahme: [
    ["preisgeld", "🏆 Preisgeld"],
    ["strafe", "⚠️ Strafen"],
    ["divers", "📦 Divers"]
  ],
  ausgabe: [
    ["muenzgeld", "🪙 Münzgeld"],
    ["automatenabgabe", "🎯 Automatenabgabe"],
    ["liga_anmeldung", "🏅 Liga-Anmeldung"],
    ["divers", "📦 Divers"]
  ]
};
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

const state = {
  user: null,
  role: "",
  canEdit: false,
  members: [],
  profiles: new Map(),
  contributions: new Map(),
  bookings: [],
  savingContribution: new Set()
};

const $ = id => document.getElementById(id);

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function memberId(member) {
  return String(member?.mitgliedId || member?._docId || member?.benutzername || "").trim();
}

function displayName(member) {
  return member.nickname || [member.vorname, member.nachname].filter(Boolean).join(" ") || member.benutzername || memberId(member);
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
  $("journalMonthPicker").value = currentMonthKey();
  $("bookingDate").value = new Date().toISOString().slice(0, 10);
  updateCategoryOptions();

  if (!state.canEdit) {
    $("bookingForm").hidden = true;
    $("bookingReadOnly").hidden = false;
    $("tableHint").textContent = "Lesemodus: Beiträge können nur von Admin und Kassenwart geändert werden.";
    $("downloadClosingPdf").hidden = true;
    $("closingReadOnly").hidden = false;
  }
  return true;
}

async function loadMembers() {
  const snap = await getDocs(collection(db, "mitglieder"));
  state.members = snap.docs
    .map(item => ({ ...item.data(), _docId: item.id, mitgliedId: item.id, benutzername: item.data().benutzername || item.id }))
    .filter(member => member.aktiv !== false)
    .filter(member => CONTRIBUTION_ROLES.includes(String(member.rolle || "gast").toLowerCase()))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "de"));
}

async function loadProfiles() {
  const snap = await getDocs(collection(db, "kassenProfile"));
  state.profiles = new Map();
  snap.docs.forEach(item => {
    const data = item.data();
    state.profiles.set(item.id, data);
    if (data.mitgliedId) state.profiles.set(String(data.mitgliedId), data);
    if (data.benutzername) state.profiles.set(String(data.benutzername), data);
  });
}

async function loadContributions(monthKey) {
  const snap = await getDocs(collection(db, "kassenBeitraege"));
  state.contributions = new Map();
  snap.forEach(item => {
    const data = item.data();
    if (data.monat === monthKey) {
      const entry = { id: item.id, ...data };
      const key = String(data.mitgliedId || data.benutzername || "").trim();
      if (key) state.contributions.set(key, entry);
      if (data.benutzername) state.contributions.set(String(data.benutzername), entry);
    }
  });
}

async function loadBookings() {
  const snap = await getDocs(collection(db, "kassenBuchungen"));
  state.bookings = snap.docs.map(item => ({ id: item.id, ...item.data() }));
  state.bookings.sort((a, b) => {
    const aDate = String(a.datum || a.monat || "");
    const bDate = String(b.datum || b.monat || "");
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    const aTime = a.erstelltAm?.seconds || 0;
    const bTime = b.erstelltAm?.seconds || 0;
    return bTime - aTime;
  });
}

function profileFor(idOrUsername) {
  const key = String(idOrUsername || "");
  const member = state.members.find(item => memberId(item) === key || item.benutzername === key);
  return state.profiles.get(key)
    || (member?.benutzername ? state.profiles.get(String(member.benutzername)) : null)
    || { beitrag: DEFAULT_AMOUNT, befreit: false, notizen: "", gueltigAb: currentMonthKey() };
}

function amountFor(username, monthKey) {
  const profile = profileFor(key);
  if (profile.gueltigAb && profile.gueltigAb > monthKey) return DEFAULT_AMOUNT;
  const amount = Number(profile.beitrag);
  return Number.isFinite(amount) ? amount : DEFAULT_AMOUNT;
}

function statusFor(idOrUsername, monthKey) {
  const key = String(idOrUsername || "");
  const member = state.members.find(item => memberId(item) === key || item.benutzername === key);
  const contribution = state.contributions.get(key)
    || (member?.benutzername ? state.contributions.get(String(member.benutzername)) : null);
  if (contribution?.status === "bezahlt") return "bezahlt";
  if (contribution?.status === "befreit") return "befreit";
  const profile = profileFor(username);
  if (profile.befreit === true && (!profile.gueltigAb || profile.gueltigAb <= monthKey)) return "befreit";
  return "offen";
}

function statusButton(member, monthKey) {
  const id = memberId(member);
  const status = statusFor(id, monthKey);
  const className = status === "bezahlt" ? "status-paid" : status === "befreit" ? "status-exempt" : "status-open";
  const symbol = status === "bezahlt" ? "✓" : status === "befreit" ? "−" : "";
  const title = status === "bezahlt" ? "Bezahlt" : status === "befreit" ? "Befreit" : "Offen";
  return `<button class="status-button ${className}" data-action="toggle-paid" data-member-id="${escapeHtml(id)}" title="${title}" ${state.canEdit && status !== "befreit" ? "" : "disabled"}>${symbol}</button>`;
}

function renderMembers() {
  const monthKey = $("monthPicker").value || currentMonthKey();
  const host = $("memberRows");
  if (!state.members.length) {
    host.innerHTML = '<tr><td colspan="4" class="empty-cell">Keine beitragspflichtigen Personen gefunden.</td></tr>';
    return;
  }

  host.innerHTML = state.members.map(member => {
    const id = memberId(member);
    const profile = profileFor(id);
    return `
      <tr>
        <td><span class="member-name">${escapeHtml(displayName(member))}</span><span class="member-sub">${escapeHtml(roleLabel(String(member.rolle || "mitglied").toLowerCase()))}</span></td>
        <td>${euro.format(amountFor(id, monthKey))}</td>
        <td>${statusButton(member, monthKey)}</td>
        <td class="edit-column">${state.canEdit ? `<button class="edit-member" data-action="edit-member" data-member-id="${escapeHtml(id)}" title="Beitrag und Notiz bearbeiten">📝</button>` : (profile.notizen ? "📝" : "–")}</td>
      </tr>`;
  }).join("");

  updateContributionStats();
}

function updateContributionStats() {
  const monthKey = $("monthPicker").value || currentMonthKey();
  let paid = 0, open = 0, exempt = 0, openAmount = 0;
  state.members.forEach(member => {
    const id = memberId(member);
    const status = statusFor(id, monthKey);
    if (status === "bezahlt") paid++;
    else if (status === "befreit") exempt++;
    else { open++; openAmount += amountFor(id, monthKey); }
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

function isActual(item) {
  return item.zahlungsstand !== "soll";
}

function bookingMonth(item) {
  return String(item.datum || item.monat || "").slice(0, 7);
}

function renderDashboard() {
  const active = state.bookings.filter(item => item.storniert !== true && isActual(item));
  const income = active.filter(item => item.typ !== "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  const expense = active.filter(item => item.typ === "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  $("incomeValue").textContent = euro.format(income);
  $("expenseValue").textContent = euro.format(expense);
  $("balanceValue").textContent = euro.format(income - expense);
}

function iconFor(category) {
  return ({ mitgliedsbeitrag: "👥", preisgeld: "🏆", strafe: "⚠️", divers: "📦", muenzgeld: "🪙", automatenabgabe: "🎯", liga_anmeldung: "🏅" })[category] || "💶";
}

function bookingCard(item) {
  const expense = item.typ === "ausgabe";
  const amount = Math.abs(Number(item.betrag) || 0);
  const date = item.datum || item.monat || "";
  const status = isActual(item) ? "ist" : "soll";
  const statusLabel = status === "ist" ? "Ist · bezahlt" : "Soll · offen";
  return `<article class="journal-item ${status === "soll" ? "is-planned" : ""}">
    <div class="journal-icon">${iconFor(item.kategorie)}</div>
    <div class="journal-main">
      <strong>${escapeHtml(item.titel || item.beschreibung || "Buchung")}${item.storniert ? " (storniert)" : ""}</strong>
      <small>${escapeHtml(date)}${item.personName ? ` · ${escapeHtml(item.personName)}` : ""}</small>
      <div class="booking-badges"><span class="booking-badge ${status}">${statusLabel}</span><span class="booking-badge">${expense ? "Ausgabe" : "Einnahme"}</span></div>
    </div>
    <div class="journal-amount ${expense ? "expense" : "income"}">${expense ? "−" : "+"}${euro.format(amount)}</div>
  </article>`;
}

function renderJournal() {
  const host = $("journalList");
  if (!state.bookings.length) {
    host.innerHTML = '<p class="empty-cell">Noch keine Buchungen vorhanden.</p>';
    return;
  }
  host.innerHTML = state.bookings.slice(0, 12).map(bookingCard).join("");
}

function renderMonthlyBookings() {
  const monthKey = $("journalMonthPicker").value || currentMonthKey();
  const items = state.bookings.filter(item => bookingMonth(item) === monthKey && item.storniert !== true);
  const actual = items.filter(isActual);
  const income = actual.filter(item => item.typ !== "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  const expense = actual.filter(item => item.typ === "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  const planned = items.filter(item => !isActual(item)).reduce((sum, item) => sum + Math.abs(Number(item.betrag) || 0), 0);

  $("monthIncomeValue").textContent = euro.format(income);
  $("monthExpenseValue").textContent = euro.format(expense);
  $("monthBalanceValue").textContent = euro.format(income - expense);
  $("monthPlannedValue").textContent = euro.format(planned);

  const host = $("monthlyBookingList");
  host.innerHTML = items.length ? items.map(bookingCard).join("") : '<p class="empty-cell">Noch keine Zahlungen in diesem Monat.</p>';
}


function unexportedBookings() {
  return state.bookings
    .filter(item => !item.abschlussId)
    .sort((a, b) => {
      const aDate = String(a.datum || a.monat || "");
      const bDate = String(b.datum || b.monat || "");
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return (a.erstelltAm?.seconds || 0) - (b.erstelltAm?.seconds || 0);
    });
}

function updateClosingInfo() {
  const count = unexportedBookings().length;
  $("unexportedCount").textContent = `${count} ${count === 1 ? "Buchung" : "Buchungen"}`;
  $("downloadClosingPdf").disabled = !state.canEdit || count === 0;
}

function formatDateGerman(value) {
  const text = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}.${month}.${year}`;
  }
  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");
    return `${month}.${year}`;
  }
  return text || "–";
}

function categoryLabel(category) {
  return ({
    mitgliedsbeitrag: "Mitgliedsbeitrag",
    preisgeld: "Preisgeld",
    strafe: "Strafe",
    divers: "Divers",
    muenzgeld: "Münzgeld",
    automatenabgabe: "Automatenabgabe",
    liga_anmeldung: "Liga-Anmeldung"
  })[category] || category || "Divers";
}

function makeClosingPdf(items, closingId, createdAt) {
  if (!window.jspdf?.jsPDF) throw new Error("PDF-Modul konnte nicht geladen werden. Bitte Internetverbindung prüfen.");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const activeActual = items.filter(item => item.storniert !== true && isActual(item));
  const income = activeActual.filter(item => item.typ !== "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  const expense = activeActual.filter(item => item.typ === "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  const plannedIncome = items.filter(item => item.storniert !== true && !isActual(item) && item.typ !== "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  const plannedExpense = items.filter(item => item.storniert !== true && !isActual(item) && item.typ === "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
  const dates = items.map(item => String(item.datum || item.monat || "")).filter(Boolean).sort();
  const from = dates[0] || "–";
  const to = dates.at(-1) || "–";

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Dart11en – Kassenabschluss", 14, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Abschluss: ${closingId}`, 14, 25);
  pdf.text(`Erstellt am: ${createdAt.toLocaleString("de-DE")}`, 14, 30);
  pdf.text(`Zeitraum der Buchungen: ${formatDateGerman(from)} bis ${formatDateGerman(to)}`, 14, 35);
  pdf.text(`Erstellt von: ${displayName(state.user)}`, 14, 40);

  pdf.setFont("helvetica", "bold");
  pdf.text(`Ist-Einnahmen: ${euro.format(income)}`, 14, 49);
  pdf.text(`Ist-Ausgaben: ${euro.format(expense)}`, 75, 49);
  pdf.text(`Ergebnis: ${euro.format(income - expense)}`, 136, 49);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Soll-Einnahmen: ${euro.format(plannedIncome)} · Soll-Ausgaben: ${euro.format(plannedExpense)}`, 14, 55);

  const rows = items.map((item, index) => [
    String(index + 1),
    formatDateGerman(item.datum || item.monat),
    item.typ === "ausgabe" ? "Ausgabe" : "Einnahme",
    categoryLabel(item.kategorie),
    item.zahlungsstand === "soll" ? "Soll" : "Ist",
    item.storniert === true ? "Storniert" : (item.titel || item.beschreibung || "–"),
    item.personName || "–",
    `${item.typ === "ausgabe" ? "−" : "+"}${euro.format(Math.abs(Number(item.betrag) || 0))}`
  ]);

  pdf.autoTable({
    startY: 62,
    head: [["Nr.", "Datum", "Art", "Kategorie", "Stand", "Notiz", "Person", "Betrag"]],
    body: rows,
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.8, overflow: "linebreak" },
    headStyles: { fillColor: [35, 35, 40] },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 18 }, 2: { cellWidth: 17 }, 3: { cellWidth: 23 },
      4: { cellWidth: 12 }, 5: { cellWidth: 48 }, 6: { cellWidth: 28 }, 7: { cellWidth: 25, halign: "right" }
    },
    didDrawPage: data => {
      const pageCount = pdf.internal.getNumberOfPages();
      pdf.setFontSize(8);
      pdf.setTextColor(110);
      pdf.text(`Seite ${pageCount}`, 196, 290, { align: "right" });
      pdf.setTextColor(0);
    }
  });

  return pdf.output("blob");
}

async function markBookingsClosed(items, closingId, createdAt) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 450) chunks.push(items.slice(i, i + 450));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(item => batch.set(doc(db, "kassenBuchungen", item.id), {
      abschlussId: closingId,
      abgeschlossenAm: createdAt,
      abgeschlossenVon: state.user.benutzername
    }, { merge: true }));
    await batch.commit();
  }
}

async function downloadClosingPdf() {
  if (!state.canEdit) return;
  const items = unexportedBookings();
  if (!items.length) return showMessage("Seit dem letzten Abschluss gibt es keine neuen Buchungen.", true);

  const button = $("downloadClosingPdf");
  button.disabled = true;
  button.textContent = "PDF wird erstellt …";
  try {
    const now = new Date();
    const closingId = `KA-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const blob = makeClosingPdf(items, closingId, now);

    const activeActual = items.filter(item => item.storniert !== true && isActual(item));
    const income = activeActual.filter(item => item.typ !== "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
    const expense = activeActual.filter(item => item.typ === "ausgabe").reduce((sum, item) => sum + (Number(item.betrag) || 0), 0);
    const closingRef = doc(db, "kassenAbschluesse", closingId);
    await setDoc(closingRef, {
      abschlussId: closingId,
      anzahlBuchungen: items.length,
      einnahmen: income,
      ausgaben: expense,
      ergebnis: income - expense,
      erstelltVon: state.user.benutzername,
      erstelltAm: serverTimestamp()
    });
    await markBookingsClosed(items, closingId, serverTimestamp());

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Dart11en-Kassenabschluss-${closingId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    showMessage(`${items.length} Buchungen wurden abgeschlossen und als PDF heruntergeladen.`);
    await refreshData();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Der PDF-Abschluss konnte nicht erstellt werden.", true);
  } finally {
    button.textContent = "📄 PDF-Abschluss erstellen";
    updateClosingInfo();
  }
}

function updateCategoryOptions() {
  const type = $("bookingType")?.value || "einnahme";
  const select = $("bookingCategory");
  if (!select) return;
  select.innerHTML = BOOKING_CATEGORIES[type].map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
}

async function saveBooking(event) {
  event.preventDefault();
  if (!state.canEdit) return;
  const type = $("bookingType").value;
  const amount = Number($("bookingAmount").value);
  const note = $("bookingNote").value.trim();
  const date = $("bookingDate").value;
  if (!["einnahme", "ausgabe"].includes(type) || !Number.isFinite(amount) || amount <= 0 || !note || !date) {
    return showMessage("Bitte Art, Betrag, Datum und Notiz vollständig eintragen.", true);
  }

  await addDoc(collection(db, "kassenBuchungen"), {
    typ: type,
    kategorie: $("bookingCategory").value,
    zahlungsstand: $("bookingStatus").value,
    titel: note,
    beschreibung: note,
    betrag: amount,
    datum: date,
    monat: date.slice(0, 7),
    storniert: false,
    erstelltVon: state.user.benutzername,
    erstelltAm: serverTimestamp()
  });

  $("bookingAmount").value = "";
  $("bookingNote").value = "";
  showMessage("Buchung wurde gespeichert.");
  await refreshData();
}

async function togglePaid(id) {
  if (!state.canEdit || !id || state.savingContribution.has(id)) return;
  const monthKey = $("monthPicker").value || currentMonthKey();
  const member = state.members.find(item => memberId(item) === id);
  if (!member || statusFor(id, monthKey) === "befreit") return;

  state.savingContribution.add(id);
  const button = document.querySelector(`button[data-action="toggle-paid"][data-member-id="${CSS.escape(id)}"]`);
  if (button) button.disabled = true;

  try {
    const existing = state.contributions.get(id);
    const amount = amountFor(id, monthKey);
    const nowPaid = existing?.status !== "bezahlt";
    const safeId = encodeURIComponent(id);
    const contributionId = `${monthKey}_${safeId}`;
    const bookingId = `mitgliedsbeitrag_${monthKey}_${safeId}`;
    const batch = writeBatch(db);

    batch.set(doc(db, "kassenBeitraege", contributionId), {
      mitgliedId: id,
      benutzername: member.benutzername || id,
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
      mitgliedId: id,
      benutzername: member.benutzername || id,
      monat: monthKey,
      datum: monthKey,
      betrag: amount,
      storniert: !nowPaid,
      erstelltVon: state.user.benutzername,
      erstelltAm: serverTimestamp()
    }, { merge: true });

    await batch.commit();
    showMessage(nowPaid ? "Beitrag als bezahlt gespeichert." : "Beitrag wieder auf offen gesetzt.");
    await loadContributions(monthKey);
    await loadBookings();
    renderMembers();
    renderDashboard();
    renderJournal();
    renderMonthlyBookings();
    updateClosingInfo();
  } finally {
    state.savingContribution.delete(id);
  }
}

function openMemberModal(id) {
  if (!state.canEdit) return;
  const member = state.members.find(item => memberId(item) === id);
  if (!member) return;
  const profile = profileFor(id);
  $("memberUsername").value = id;
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
  const id = $("memberUsername").value;
  const member = state.members.find(item => memberId(item) === id);
  const amount = Number($("memberAmount").value);
  if (!member || !Number.isFinite(amount) || amount < 0) return showMessage("Bitte einen gültigen Beitrag eingeben.", true);

  await setDoc(doc(db, "kassenProfile", encodeURIComponent(id)), {
    mitgliedId: id,
    benutzername: member.benutzername || id,
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
  renderMonthlyBookings();
  updateClosingInfo();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!initAccess()) return;

  $("monthPicker").addEventListener("change", async () => {
    await loadContributions($("monthPicker").value);
    renderMembers();
  });
  $("journalMonthPicker").addEventListener("change", renderMonthlyBookings);
  $("bookingType").addEventListener("change", updateCategoryOptions);
  $("downloadClosingPdf").addEventListener("click", downloadClosingPdf);
  $("bookingForm").addEventListener("submit", event => saveBooking(event).catch(error => showMessage(error.message, true)));
  $("memberRows").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "toggle-paid") togglePaid(button.dataset.memberId).catch(error => showMessage(error.message, true));
    if (button.dataset.action === "edit-member") openMemberModal(button.dataset.memberId);
  });
  $("memberForm").addEventListener("submit", event => saveMemberProfile(event).catch(error => showMessage(error.message, true)));
  $("closeMemberModal").addEventListener("click", () => $("memberModal").hidden = true);
  $("memberModal").addEventListener("click", event => { if (event.target === $("memberModal")) $("memberModal").hidden = true; });

  try { await refreshData(); }
  catch (error) { console.error(error); showMessage("Die Kassendaten konnten nicht geladen werden.", true); }
});
