/**
 * Dart11en – Cloudflare Worker für persönliche Turnier-Pushs
 *
 * Benötigte Worker-Secrets:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *
 * Der Browser übermittelt keine Spieler oder Tokens. Der Worker liest den
 * offiziellen Turnierstand und die pushAbos direkt aus Firestore.
 */

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore";
const FIRESTORE_BASE = projectId => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse(null, 204);

    const url = new URL(request.url);
    if (request.method === "GET") {
      return corsResponse({ ok: true, status: "online", service: "dart11en-turnier-push" });
    }

    if (request.method !== "POST" || !["/", "/turnier-sync"].includes(url.pathname)) {
      return corsResponse({ ok: false, error: "NOT_FOUND" }, 404);
    }

    try {
      validateSecrets(env);
      const accessToken = await getGoogleAccessToken(env);
      const result = await syncTournamentPushes(env, accessToken);
      return corsResponse({ ok: true, ...result });
    } catch (error) {
      console.error(error);
      return corsResponse({ ok: false, error: String(error?.message || error) }, 500);
    }
  }
};

function corsResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function validateSecrets(env) {
  for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]) {
    if (!env[key]) throw new Error(`SECRET_FEHLT:${key}`);
  }
}

async function syncTournamentPushes(env, accessToken) {
  const sources = await Promise.all([
    readFirestoreDocument(env, accessToken, "turnierLive/aktuellesTurnierV3", "doppelko"),
    readFirestoreDocument(env, accessToken, "turnierLive/gruppenTurnierV3", "gruppenko")
  ]);

  const active = sources
    .filter(source => source?.data?.datenJson)
    .sort((a, b) => Number(b.data.aktualisiert || 0) - Number(a.data.aktualisiert || 0))[0];

  if (!active) return { status: "kein-aktives-turnier", gesendet: 0, uebersprungen: 0 };

  let tournament;
  try {
    tournament = JSON.parse(active.data.datenJson);
  } catch {
    throw new Error("TURNIER_JSON_UNGUELTIG");
  }

  const runId = tournament.pushTurnierId || active.data.pushTurnierId;
  if (!runId) return { status: "turnier-id-fehlt", gesendet: 0, uebersprungen: 0 };

  const matches = active.type === "gruppenko"
    ? extractGroupMatches(tournament)
    : extractDoubleKoMatches(tournament);

  const actionable = selectActionableMatches(matches, Number(tournament.bestOf) || 3);
  if (!actionable.length) return { status: "keine-offenen-partien", gesendet: 0, uebersprungen: 0 };

  const subscriptions = await listPushSubscriptions(env, accessToken);
  let sent = 0;
  let skipped = 0;
  let noSubscription = 0;

  for (const entry of actionable) {
    for (const player of [entry.match.a, entry.match.b]) {
      const opponent = player === entry.match.a ? entry.match.b : entry.match.a;
      const state = entry.kind === "board" ? `board-${entry.match.board}` : "naechster-gegner";
      const eventIdentity = `${runId}|${active.type}|${entry.match.id}|${normalizeName(player)}|${state}`;
      const eventId = await sha256Hex(eventIdentity);

      if (await eventAlreadySent(env, accessToken, eventId)) {
        skipped += 1;
        continue;
      }

      const playerSubscriptions = subscriptions.filter(sub =>
        sub.aktiv !== false && normalizeName(sub.nickname || sub.benutzername) === normalizeName(player)
      );

      if (!playerSubscriptions.length) {
        noSubscription += 1;
        continue;
      }

      const notificationUrl = buildTournamentUrl(active.type, entry.match);
      const notification = entry.kind === "board"
        ? {
            title: `Spiel beginnt – Board ${entry.match.board} 🎯`,
            body: `Du spielst jetzt gegen ${opponent}. Good Darts! 🍀`,
            tag: `dart11en-board-${eventId}`,
            url: notificationUrl
          }
        : {
            title: `${entry.match.pushRunde || "Nächster Gegner"} 🎯`,
            body: `Dein kommender Gegner ist ${opponent}.`,
            tag: `dart11en-gegner-${eventId}`,
            url: notificationUrl
          };

      let successfulForPlayer = 0;
      for (const subscription of playerSubscriptions) {
        const result = await sendFcm(env, accessToken, subscription.token, notification);
        if (result.ok) successfulForPlayer += 1;
      }

      if (successfulForPlayer > 0) {
        await markEventSent(env, accessToken, eventId, {
          runId,
          turnierTyp: active.type,
          matchId: entry.match.id,
          spieler: player,
          gegner: opponent,
          art: entry.kind,
          board: entry.match.board || null,
          gesendetAn: successfulForPlayer,
          runde: entry.match.pushRunde || null,
          gruppe: entry.match.pushGruppe || null,
          erstelltAm: Date.now()
        });
        sent += successfulForPlayer;
      }
    }
  }

  return {
    status: "synchronisiert",
    turnierTyp: active.type,
    partienGeprueft: actionable.length,
    gesendet: sent,
    uebersprungen: skipped,
    ohneAbo: noSubscription
  };
}

function extractDoubleKoMatches(data) {
  const matches = [];

  (Array.isArray(data.w) ? data.w : []).forEach((round, roundIndex) => {
    (round || []).forEach(match => matches.push({
      ...match,
      pushRunde: `Gewinnerbaum – Runde ${roundIndex + 1}`,
      pushBereich: "gewinnerbaum",
      pushRundenIndex: roundIndex + 1
    }));
  });

  (Array.isArray(data.l) ? data.l : []).forEach((round, roundIndex) => {
    (round || []).forEach(match => matches.push({
      ...match,
      pushRunde: `Verliererbaum – Runde ${roundIndex + 1}`,
      pushBereich: "verliererbaum",
      pushRundenIndex: roundIndex + 1
    }));
  });

  (Array.isArray(data.finale) ? data.finale : []).forEach((match, index) => {
    matches.push({
      ...match,
      pushRunde: index === 0 ? "Grand Final" : "Grand Final Reset",
      pushBereich: "finale",
      pushRundenIndex: index + 1
    });
  });

  return matches.filter(Boolean);
}

function extractGroupMatches(data) {
  const koMatches = [];
  (Array.isArray(data.koPhasen) ? data.koPhasen : []).forEach((phase, phaseIndex) => {
    const rounds = Array.isArray(phase?.runden) ? phase.runden : [];
    rounds.forEach((round, roundIndex) => {
      const roundTitle = koRoundTitle(round?.length, roundIndex + 1);
      (round || []).forEach(match => koMatches.push({
        ...match,
        pushRunde: rounds.length > 1
          ? `K.-o.-Baum ${phaseIndex + 1} – ${roundTitle}`
          : `K.-o.-Baum ${phaseIndex + 1} – Finale`,
        pushBereich: "gruppen-ko",
        pushKoBaum: phaseIndex + 1,
        pushRundenIndex: roundIndex + 1
      }));
    });
  });

  if (koMatches.length) return koMatches.filter(Boolean);

  const groupMatches = [];
  (Array.isArray(data.gruppen) ? data.gruppen : []).forEach(group => {
    (Array.isArray(group?.spiele) ? group.spiele : []).forEach((match, matchIndex) => {
      groupMatches.push({
        ...match,
        pushRunde: `Gruppe ${group.id} – Spiel ${matchIndex + 1}`,
        pushBereich: "gruppe",
        pushGruppe: group.id,
        pushSpielNummer: matchIndex + 1
      });
    });
  });
  return groupMatches;
}

function koRoundTitle(matchCount, fallbackRound) {
  const count = Number(matchCount);
  if (count === 1) return "Finale";
  if (count === 2) return "Halbfinale";
  if (count === 4) return "Viertelfinale";
  if (count === 8) return "Achtelfinale";
  if (count === 16) return "Sechzehntelfinale";
  return `Runde ${fallbackRound}`;
}

function buildTournamentUrl(type, match) {
  const page = type === "gruppenko" ? "turnier-live-v3.html" : "turnier-live-v3.html";
  const url = new URL(`https://kevth22.github.io/turnier.dannis-treff/${page}`);
  url.searchParams.set("match", String(match.id || ""));
  if (match.pushBereich) url.searchParams.set("bereich", String(match.pushBereich));
  if (match.pushGruppe) url.searchParams.set("gruppe", String(match.pushGruppe));
  return url.toString();
}

function selectActionableMatches(matches, bestOf) {
  const open = matches.filter(match => isOpenMatch(match, bestOf));
  const boardMatches = open.filter(match => Number(match.board) > 0);

  // Pro Spieler wird nur die nächste wartende Partie ausgewählt. Dadurch
  // verschickt die Gruppenphase nicht sofort alle späteren Gegner auf einmal.
  const occupiedPlayers = new Set(
    boardMatches.flatMap(match => [normalizeName(match.a), normalizeName(match.b)])
  );
  const nextMatches = [];

  for (const match of open.filter(match => !Number(match.board))) {
    const a = normalizeName(match.a);
    const b = normalizeName(match.b);
    if (occupiedPlayers.has(a) || occupiedPlayers.has(b)) continue;
    nextMatches.push(match);
    occupiedPlayers.add(a);
    occupiedPlayers.add(b);
  }

  return [
    ...boardMatches.map(match => ({ kind: "board", match })),
    ...nextMatches.map(match => ({ kind: "next", match }))
  ];
}

function isOpenMatch(match, bestOf) {
  if (!match?.a || !match?.b || match.a === "Freilos" || match.b === "Freilos") return false;
  const needed = Math.ceil(bestOf / 2);
  const scoreA = Number(match.scoreA);
  const scoreB = Number(match.scoreB);
  const finished = (scoreA === needed && scoreB < needed) || (scoreB === needed && scoreA < needed);
  return !finished;
}

function normalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("de");
}

async function readFirestoreDocument(env, accessToken, path, type) {
  const response = await fetch(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FIRESTORE_LESEN_${response.status}:${await response.text()}`);
  const json = await response.json();
  return { type, data: firestoreFieldsToObject(json.fields || {}) };
}

async function listPushSubscriptions(env, accessToken) {
  const subscriptions = [];
  let pageToken = "";

  do {
    const url = new URL(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/pushAbos`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`PUSHABOS_LESEN_${response.status}:${await response.text()}`);
    const json = await response.json();
    for (const document of json.documents || []) {
      subscriptions.push(firestoreFieldsToObject(document.fields || {}));
    }
    pageToken = json.nextPageToken || "";
  } while (pageToken);

  return subscriptions.filter(subscription => typeof subscription.token === "string" && subscription.token.length > 20);
}

async function eventAlreadySent(env, accessToken, eventId) {
  const response = await fetch(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/turnierPushGesendet/${eventId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`PUSHSTATUS_LESEN_${response.status}`);
  return true;
}

async function markEventSent(env, accessToken, eventId, data) {
  const response = await fetch(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/turnierPushGesendet/${eventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: objectToFirestoreFields(data) })
  });
  if (!response.ok) throw new Error(`PUSHSTATUS_SPEICHERN_${response.status}:${await response.text()}`);
}

async function sendFcm(env, accessToken, token, notification) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token,
        data: {
          title: notification.title,
          body: notification.body,
          tag: notification.tag,
          url: notification.url
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: "https://kevth22.github.io/turnier.dannis-treff/icon-192.png",
            badge: "https://kevth22.github.io/turnier.dannis-treff/icon-192.png",
            tag: notification.tag
          },
          fcm_options: { link: notification.url }
        }
      }
    })
  });

  if (response.ok) return { ok: true };

  const errorText = await response.text();
  console.warn("FCM-Versand fehlgeschlagen:", response.status, errorText);
  return { ok: false, status: response.status, error: errorText };
}

function firestoreFieldsToObject(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)]));
}

function firestoreValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(firestoreValue);
  if ("mapValue" in value) return firestoreFieldsToObject(value.mapValue.fields || {});
  return null;
}

function objectToFirestoreFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toFirestoreValue(value)]));
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { stringValue: String(value) };
}

async function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: FCM_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(env.FIREBASE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  if (!response.ok) throw new Error(`OAUTH_${response.status}:${await response.text()}`);
  const data = await response.json();
  return data.access_token;
}

async function importPrivateKey(pem) {
  const clean = String(pem)
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(clean), char => char.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64Url(text) {
  return base64UrlBytes(new TextEncoder().encode(text));
}

function base64UrlBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
