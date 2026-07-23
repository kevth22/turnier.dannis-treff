import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const PROJECT_ID = "dannistreffturnier";
const POSITIVE_STATUSES = new Set(["Dabei", "Fahrer", "Komme direkt"]);
const DRY_RUN = String(process.env.DRY_RUN || "false").toLowerCase() === "true";

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("GitHub Secret FIREBASE_SERVICE_ACCOUNT fehlt.");

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT enthält kein gültiges JSON.");
  }
}

initializeApp({
  credential: cert(getServiceAccount()),
  projectId: PROJECT_ID
});

const db = getFirestore();
const messaging = getMessaging();

function berlinDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.filter(part => part.type !== "literal").map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function dateToUtcMs(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ""));
  if (!match) return null;

  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function daysUntil(dateString, todayString) {
  const target = dateToUtcMs(dateString);
  const today = dateToUtcMs(todayString);

  if (target === null || today === null) return null;
  return Math.round((target - today) / 86_400_000);
}

function displayDate(dateString) {
  const ms = dateToUtcMs(dateString);
  if (ms === null) return dateString;

  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(ms));
}

function reminderFor(spieltag, days, response) {
  const liga = spieltag.liga || "Spieltag";
  const datum = displayDate(spieltag.datum);
  const treffen = spieltag.treffen ? ` Treffen: ${spieltag.treffen} Uhr.` : "";
  const anwurf = spieltag.anwurf ? ` Anwurf: ${spieltag.anwurf} Uhr.` : "";
  const ort = spieltag.ort ? ` Ort: ${spieltag.ort}.` : "";

  if (days === 7 || days === 3) {
    return {
      title: "⚠️ Rückmeldung fehlt",
      body: `${liga} ist in ${days} Tagen (${datum}). Bitte gib deine Rückmeldung ab.`,
      tag: `spieltag-offen-${spieltag.id}-${days}`
    };
  }

  if (days === 2) {
    return {
      title: "🎯 Spieltag in 2 Tagen",
      body: `${liga} am ${datum}.${treffen}${anwurf}${ort}`,
      tag: `spieltag-2-${spieltag.id}`
    };
  }

  if (days === 1 && response && POSITIVE_STATUSES.has(response.status)) {
    return {
      title: "🎯 Morgen ist Spieltag",
      body: `${liga}.${treffen}${anwurf}${ort} Dein Status: ${response.status}.`,
      tag: `spieltag-1-${spieltag.id}`
    };
  }

  return null;
}

async function loadCollection(name) {
  const snapshot = await db.collection(name).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function groupTokensByUsername(pushSubscriptions) {
  const map = new Map();

  for (const subscription of pushSubscriptions) {
    const username = String(subscription.benutzername || "").trim().toLowerCase();
    const role = String(subscription.rolle || "").trim().toLowerCase();
    const token = String(subscription.token || "").trim();

    if (!username || !token || subscription.aktiv !== true || role === "gast") continue;

    if (!map.has(username)) map.set(username, []);
    map.get(username).push({ docId: subscription.id, token });
  }

  return map;
}

async function wasAlreadySent(logId) {
  const snapshot = await db.collection("pushVersand").doc(logId).get();
  return snapshot.exists;
}

async function markAsSent(logId, data) {
  await db.collection("pushVersand").doc(logId).set({
    ...data,
    gesendetAm: FieldValue.serverTimestamp()
  });
}

async function deactivateInvalidTokens(tokens, response) {
  const invalidCodes = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token"
  ]);

  const writes = [];

  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code;
    if (!invalidCodes.has(code)) return;

    const tokenInfo = tokens[index];
    if (!tokenInfo?.docId) return;

    writes.push(
      db.collection("pushAbos").doc(tokenInfo.docId).set({
        aktiv: false,
        deaktiviertGrund: code,
        deaktiviertAm: FieldValue.serverTimestamp()
      }, { merge: true })
    );
  });

  await Promise.all(writes);
}

async function sendToUser({ username, tokens, spieltag, days, response }) {
  const reminder = reminderFor(spieltag, days, response);
  if (!reminder || tokens.length === 0) return false;

  const logId = `${spieltag.id}_${days}_${username}`;

  if (await wasAlreadySent(logId)) {
    console.log(`Übersprungen, bereits gesendet: ${logId}`);
    return false;
  }

  console.log(`${DRY_RUN ? "[TEST] " : ""}Push für ${username}: ${reminder.title} – ${reminder.body}`);

  if (DRY_RUN) return true;

  const result = await messaging.sendEachForMulticast({
    tokens: tokens.map(item => item.token),
    notification: {
      title: reminder.title,
      body: reminder.body
    },
    webpush: {
      notification: {
        icon: "https://kevth22.github.io/turnier.dannis-treff/icon-192.png",
        badge: "https://kevth22.github.io/turnier.dannis-treff/icon-192.png",
        tag: reminder.tag,
        renotify: true
      },
      fcmOptions: {
        link: "https://kevth22.github.io/turnier.dannis-treff/kalender.html"
      }
    },
    data: {
      url: "./kalender.html",
      spieltagId: spieltag.id,
      typ: "spieltag-erinnerung"
    }
  });

  await deactivateInvalidTokens(tokens, result);

  if (result.successCount > 0) {
    await markAsSent(logId, {
      benutzername: username,
      spieltagId: spieltag.id,
      tageVorher: days,
      erfolgreich: result.successCount,
      fehlgeschlagen: result.failureCount
    });
  }

  console.log(`Ergebnis ${username}: ${result.successCount} erfolgreich, ${result.failureCount} fehlgeschlagen.`);
  return result.successCount > 0;
}

async function main() {
  const today = berlinDateString();
  console.log(`Prüfung für ${today}, Zeitzone Europe/Berlin.`);
  console.log(`Testmodus: ${DRY_RUN ? "ja" : "nein"}`);

  const [spieltage, responses, pushSubscriptions] = await Promise.all([
    loadCollection("spieltage"),
    loadCollection("zusagen"),
    loadCollection("pushAbos")
  ]);

  const tokensByUsername = groupTokensByUsername(pushSubscriptions);
  const responsesByKey = new Map();

  for (const response of responses) {
    const username = String(response.benutzername || "").trim().toLowerCase();
    if (!username || !response.spieltagId) continue;
    responsesByKey.set(`${response.spieltagId}_${username}`, response);
  }

  let considered = 0;
  let sent = 0;

  for (const spieltag of spieltage) {
    const days = daysUntil(spieltag.datum, today);
    if (![7, 3, 2, 1].includes(days)) continue;

    for (const [username, tokens] of tokensByUsername.entries()) {
      const response = responsesByKey.get(`${spieltag.id}_${username}`);

      const shouldSend =
        ((days === 7 || days === 3) && !response) ||
        (days === 2) ||
        (days === 1 && response && POSITIVE_STATUSES.has(response.status));

      if (!shouldSend) continue;

      considered += 1;

      try {
        if (await sendToUser({ username, tokens, spieltag, days, response })) {
          sent += 1;
        }
      } catch (error) {
        console.error(`Fehler bei ${username}, Spieltag ${spieltag.id}:`, error);
      }
    }
  }

  console.log(`Fertig. Geprüft: ${considered}, ausgelöst: ${sent}.`);
}

main().catch(error => {
  console.error("Abbruch:", error);
  process.exitCode = 1;
});
