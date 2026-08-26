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

    try {
      // Statusseite des Workers
      if (request.method === "GET" && url.pathname === "/") {
        return corsResponse({ ok: true, status: "online", service: "dart11en-turnier-push", version: "10.1-3k-sync" });
      }

      // Manueller Test-Push, z. B. /test-push?nickname=Red%20Dart
      if (request.method === "GET" && (url.pathname === "/test-push" || (url.pathname === "/" && url.searchParams.has("nickname")))) {
        validateSecrets(env);
        const nickname = String(url.searchParams.get("nickname") || "").trim();
        if (!nickname) {
          return corsResponse({ ok: false, error: "NICKNAME_FEHLT", beispiel: "/test-push?nickname=Red%20Dart" }, 400);
        }

        const accessToken = await getGoogleAccessToken(env);
        const result = await sendTestPush(env, accessToken, nickname);
        return corsResponse({ ok: true, ...result });
      }

      // Automatische Turnier-Synchronisierung
      if (["GET", "POST"].includes(request.method) && url.pathname === "/turnier-sync") {
        validateSecrets(env);
        const accessToken = await getGoogleAccessToken(env);
        const result = await syncTournamentPushes(env, accessToken);
        return corsResponse({ ok: true, ...result });
      }

      // 3K Bestleistungen: Events 7019 + 8683 zusammenführen und in Mitgliederprofile schreiben.
      if (request.method === "POST" && url.pathname === "/3k-sync") {
        validateSecrets(env);
        const accessToken = await getGoogleAccessToken(env);
        const result = await sync3kPerformances(env, accessToken);
        return corsResponse({ ok: true, ...result });
      }

      // Diagnose ohne Firestore-Schreibzugriff: zeigt nur, welcher 3K-Endpunkt antwortet.
      if (request.method === "GET" && url.pathname === "/3k-debug") {
        const eventId = Number(url.searchParams.get("event") || 7019);
        if (![7019, 8683].includes(eventId)) return corsResponse({ ok: false, error: "EVENT_NICHT_ERLAUBT" }, 400);
        const debug = await fetch3kPerformancePayload(eventId, true);
        return corsResponse({ ok: true, eventId, ...debug });
      }

      return corsResponse({ ok: false, error: "NOT_FOUND" }, 404);
    } catch (error) {
      console.error(error);
      return corsResponse({ ok: false, error: String(error?.message || error) }, 500);
    }
  },

  // Optionaler Cloudflare-Cron-Trigger: z. B. alle 6 Stunden.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        validateSecrets(env);
        const accessToken = await getGoogleAccessToken(env);
        await sync3kPerformances(env, accessToken);
      } catch (error) {
        console.error("3K Cron-Sync fehlgeschlagen:", error);
      }
    })());
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

async function sendTestPush(env, accessToken, nickname) {
  const subscriptions = await listPushSubscriptions(env, accessToken);
  const normalizedNickname = normalizeName(nickname);
  const matches = subscriptions.filter(subscription =>
    subscription.aktiv !== false &&
    normalizeName(subscription.nickname || subscription.benutzername) === normalizedNickname
  );

  if (!matches.length) {
    return {
      status: "kein-abo-gefunden",
      nickname,
      gefunden: 0,
      gesendet: 0,
      fehlgeschlagen: 0
    };
  }

  const notification = {
    title: "Dart11en Test-Push 🎯",
    body: `Hallo ${nickname}, deine Push-Benachrichtigungen funktionieren.`,
    tag: `dart11en-test-${Date.now()}`,
    url: "https://kevth22.github.io/turnier.dannis-treff/turnier-live-v3.html"
  };

  let sent = 0;
  const errors = [];

  for (const subscription of matches) {
    const result = await sendFcm(env, accessToken, subscription.token, notification);
    if (result.ok) {
      sent += 1;
    } else {
      errors.push({ status: result.status || null, error: result.error || "FCM_FEHLER" });
    }
  }

  return {
    status: sent > 0 ? "test-push-gesendet" : "test-push-fehlgeschlagen",
    nickname,
    gefunden: matches.length,
    gesendet: sent,
    fehlgeschlagen: matches.length - sent,
    fehler: errors
  };
}

async function syncTournamentPushes(env, accessToken) {
  const syncId = crypto.randomUUID();
  const sources = await Promise.all([
    readFirestoreDocument(env, accessToken, "turnierLive/aktuellesTurnierV3", "doppelko"),
    readFirestoreDocument(env, accessToken, "turnierLive/gruppenTurnierV3", "gruppenko")
  ]);

  const active = sources
    .filter(source => source?.data?.datenJson)
    .sort((a, b) => Number(b.data.aktualisiert || 0) - Number(a.data.aktualisiert || 0))[0];

  if (!active) return { syncId, status: "kein-aktives-turnier", gesendet: 0, uebersprungen: 0, diagnose: [] };

  let tournament;
  try {
    tournament = JSON.parse(active.data.datenJson);
  } catch {
    throw new Error("TURNIER_JSON_UNGUELTIG");
  }

  const runId = tournament.pushTurnierId
    || active.data.pushTurnierId
    || (tournament.erstellt ? `legacy-${active.type}-${tournament.erstellt}` : null);
  if (!runId) return { syncId, status: "turnier-id-fehlt", gesendet: 0, uebersprungen: 0, diagnose: [] };

  const matches = active.type === "gruppenko"
    ? extractGroupMatches(tournament)
    : extractDoubleKoMatches(tournament);

  const actionable = selectActionableMatches(matches, Number(tournament.bestOf) || 3);
  if (!actionable.length) {
    return { syncId, status: "keine-offenen-partien", runId, turnierTyp: active.type, gesendet: 0, uebersprungen: 0, diagnose: [] };
  }

  const subscriptions = await listPushSubscriptions(env, accessToken);
  let sent = 0;
  let skipped = 0;
  let noSubscription = 0;
  let failed = 0;
  const diagnose = [];

  for (const entry of actionable) {
    const players = entry.kind === "bye" ? [entry.player] : [entry.match.a, entry.match.b];

    for (const player of players) {
      const opponent = entry.kind === "bye"
        ? "Freilos"
        : (player === entry.match.a ? entry.match.b : entry.match.a);
      const state = entry.kind === "board"
        ? `board-${entry.match.board}`
        : entry.kind === "bye"
          ? "freilos"
          : "naechster-gegner";
      const eventIdentity = `${runId}|${active.type}|${entry.match.id}|${normalizeName(player)}|${state}`;
      const eventId = await sha256Hex(eventIdentity);
      const baseDiagnostic = {
        spieler: player,
        gegner: opponent,
        matchId: entry.match.id,
        art: entry.kind,
        board: entry.match.board || null,
        runId,
        eventId
      };

      const playerSubscriptions = subscriptions.filter(sub =>
        sub.aktiv !== false && normalizeName(sub.nickname || sub.benutzername) === normalizeName(player)
      );

      if (!playerSubscriptions.length) {
        noSubscription += 1;
        diagnose.push({ ...baseDiagnostic, ergebnis: "ohne-abo" });
        continue;
      }

      // Atomare Reservierung verhindert doppelte Pushs, wenn automatischer und
      // manueller Sync nahezu gleichzeitig laufen.
      const reservation = await reserveEvent(env, accessToken, eventId, {
        ...baseDiagnostic,
        status: "wird-gesendet",
        syncId,
        erstelltAm: Date.now()
      });

      if (!reservation.created) {
        skipped += 1;
        diagnose.push({
          ...baseDiagnostic,
          ergebnis: "bereits-gesendet-oder-in-bearbeitung",
          vorhandenerStatus: reservation.existing?.status || null,
          vorhandenerSyncId: reservation.existing?.syncId || null,
          gesendetAm: reservation.existing?.gesendetAm || reservation.existing?.erstelltAm || null
        });
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
        : entry.kind === "bye"
          ? {
              title: "Freilos erhalten 🎯",
              body: "Du hast ein Freilos erhalten. Damit bist du automatisch eine Runde weiter 😮‍💨",
              tag: `dart11en-freilos-${eventId}`,
              url: notificationUrl
            }
          : {
              title: "Dein nächster Gegner steht fest 🎯",
              body: `Dein nächster Gegner ist ${opponent}.`,
              tag: `dart11en-gegner-${eventId}`,
              url: notificationUrl
            };

      let successfulForPlayer = 0;
      const sendErrors = [];
      for (const subscription of playerSubscriptions) {
        const result = await sendFcm(env, accessToken, subscription.token, notification);
        if (result.ok) successfulForPlayer += 1;
        else sendErrors.push({ status: result.status || null, error: result.error || "FCM_FEHLER" });
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
          status: "gesendet",
          syncId,
          gesendetAm: Date.now(),
          erstelltAm: Date.now()
        });
        sent += successfulForPlayer;
        diagnose.push({ ...baseDiagnostic, ergebnis: "gesendet", gesendetAn: successfulForPlayer });
      } else {
        failed += 1;
        await deleteEventReservation(env, accessToken, eventId);
        diagnose.push({ ...baseDiagnostic, ergebnis: "fcm-fehler", fehler: sendErrors });
      }
    }
  }

  return {
    syncId,
    status: "synchronisiert",
    version: "10.1-3k-sync",
    runId,
    turnierTyp: active.type,
    partienGeprueft: actionable.length,
    gesendet: sent,
    uebersprungen: skipped,
    ohneAbo: noSubscription,
    fehlgeschlagen: failed,
    diagnose
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
  // Freilose sind ein eigenes Ereignis. Nur der echte Spieler wird informiert.
  const byeEntries = matches
    .filter(match => match && ((match.a === "Freilos" && match.b) || (match.b === "Freilos" && match.a)))
    .map(match => ({
      kind: "bye",
      match,
      player: match.a === "Freilos" ? match.b : match.a
    }));

  const open = matches.filter(match => isOpenMatch(match, bestOf));

  // Partien, die durch die aktuelle Board-Anzahl direkt starten, erhalten
  // ausschließlich den Board-Push. Die übrigen spielbereiten Partien erhalten
  // zunächst den Gegner-Push und später zusätzlich den Board-Push.
  const boardMatches = open.filter(match => Number(match.board) > 0);
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
    ...nextMatches.map(match => ({ kind: "next", match })),
    ...byeEntries
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

  const valid = subscriptions.filter(subscription =>
    typeof subscription.token === "string" && subscription.token.length > 20
  );

  // Derselbe Browser-Token darf nur einmal verwendet werden, auch wenn in
  // Firestore versehentlich mehrere Dokumente dazu existieren.
  return [...new Map(valid.map(subscription => [subscription.token, subscription])).values()];
}

async function readSentEvent(env, accessToken, eventId) {
  const response = await fetch(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/turnierPushGesendet/${eventId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`PUSHSTATUS_LESEN_${response.status}:${await response.text()}`);
  const json = await response.json();
  return firestoreFieldsToObject(json.fields || {});
}

async function reserveEvent(env, accessToken, eventId, data) {
  const url = new URL(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/turnierPushGesendet/${eventId}`);
  url.searchParams.set("currentDocument.exists", "false");
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: objectToFirestoreFields(data) })
  });

  if (response.ok) return { created: true, existing: null };
  if ([409, 412].includes(response.status)) {
    return { created: false, existing: await readSentEvent(env, accessToken, eventId) };
  }
  throw new Error(`PUSHSTATUS_RESERVIEREN_${response.status}:${await response.text()}`);
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

async function deleteEventReservation(env, accessToken, eventId) {
  const response = await fetch(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/turnierPushGesendet/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (![200, 204, 404].includes(response.status)) {
    console.warn("Push-Reservierung konnte nicht entfernt werden:", response.status, await response.text());
  }
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
        // Nur Data-Payload senden. Der Service Worker zeigt daraus genau
        // eine Benachrichtigung an. Eine zusätzliche notification-Payload
        // würde auf iOS dieselbe Meldung doppelt erzeugen.
        webpush: {
          headers: { Urgency: "high" },
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
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: objectToFirestoreFields(value) } };
  return { stringValue: String(value) };
}


// ---------------- 3K BESTLEISTUNGEN ----------------
const THREE_K_EVENTS = [7019, 8683];
const THREE_K_BASE = "https://backend6.3k-darts.com/2k-backend6/api/v1/frontend";

async function sync3kPerformances(env, accessToken) {
  const eventResults = [];
  const allRecords = [];
  for (const eventId of THREE_K_EVENTS) {
    const result = await fetch3kPerformancePayload(eventId, false);
    eventResults.push({ eventId, endpoint: result.endpoint, records: result.records.length });
    allRecords.push(...result.records.map(record => ({ ...record, eventId })));
  }

  if (!allRecords.length) {
    throw new Error("3K_KEINE_BESTLEISTUNGEN_GEFUNDEN: Bitte /3k-debug?event=7019 prüfen.");
  }

  const members = await listMembersFor3k(env, accessToken);
  const byMember = new Map();
  const unmatched = new Set();

  for (const record of allRecords) {
    const member = match3kPlayerToMember(record.player, members);
    if (!member) {
      if (record.player) unmatched.add(record.player);
      continue;
    }
    if (!byMember.has(member.id)) byMember.set(member.id, empty3kStats());
    merge3kRecord(byMember.get(member.id), record);
  }

  let updated = 0;
  for (const [memberId, stats] of byMember.entries()) {
    finalize3kStats(stats);
    await patchMember3kStats(env, accessToken, memberId, {
      ...stats,
      quelle: "3k",
      events: THREE_K_EVENTS,
      synchronisiertAm: new Date().toISOString()
    });
    updated += 1;
  }

  return {
    events: eventResults,
    aktualisiert: updated,
    nichtZugeordnet: [...unmatched].sort((a, b) => a.localeCompare(b, "de"))
  };
}

async function fetch3kPerformancePayload(eventId, debugOnly = false) {
  // 3K nutzt für events/11 backend6. Die Web-App hat je nach Version unterschiedliche
  // Pfade verwendet; deshalb werden die bekannten/naheliegenden öffentlichen Varianten
  // nacheinander geprüft. Nur JSON-Antworten werden akzeptiert.
  const candidates = [
    `${THREE_K_BASE}/event/${eventId}/performances`,
    `${THREE_K_BASE}/event/${eventId}/performance`,
    `${THREE_K_BASE}/performances/${eventId}`,
    `${THREE_K_BASE}/performance/${eventId}`,
    `${THREE_K_BASE}/event/${eventId}`
  ];
  const attempts = [];

  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json, text/plain, */*", "User-Agent": "Dart11en-3K-Sync/1.0" }
      });
      const text = await response.text();
      attempts.push({ endpoint, status: response.status, contentType: response.headers.get("content-type") || "", bytes: text.length });
      if (!response.ok || !text) continue;
      let json;
      try { json = JSON.parse(text); } catch { continue; }
      const records = extract3kRecords(json);
      if (records.length) return { endpoint, records, attempts };
      if (debugOnly) {
        // Für die Diagnose nur Struktur, niemals eine riesige Rohantwort zurückgeben.
        attempts[attempts.length - 1].topLevelKeys = json && typeof json === "object" ? Object.keys(json).slice(0, 40) : [];
      }
    } catch (error) {
      attempts.push({ endpoint, status: 0, error: String(error?.message || error) });
    }
  }

  if (debugOnly) return { endpoint: null, records: [], attempts };
  throw new Error(`3K_ENDPOINT_NICHT_ERKANNT_EVENT_${eventId}`);
}

function extract3kRecords(root) {
  const records = [];
  const seen = new Set();

  function walk(node, context = {}, depth = 0) {
    if (depth > 14 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, context, depth + 1);
      return;
    }
    if (typeof node !== "object") return;

    const categoryText = firstText(node, ["performanceType", "performanceName", "category", "type", "title", "label", "description", "name"]);
    const category = normalize3kCategory(categoryText) || context.category;
    const player = extract3kPlayer(node) || context.player;
    const ownValue = firstNumber(node, ["value", "score", "result", "points", "numberOfDarts", "darts", "legDarts", "performanceValue"]);
    const ownCount = firstNumber(node, ["count", "amount", "quantity", "number", "times", "anzahl"]);

    if (category && player) {
      let value = ownValue;
      let count = ownCount;
      if (category === "180") {
        if (!count && value && value !== 180) count = value;
        value = 180;
        count = Math.max(1, Number(count) || 1);
      } else if (Number.isFinite(value)) {
        count = Math.max(1, Number(count) || 1);
      }
      if (category === "180" || Number.isFinite(value)) {
        const record = { category, player: String(player).trim(), value: Number(value), count: Number(count) || 1 };
        if (isPlausible3kRecord(record)) {
          const key = `${record.category}|${normalize3kName(record.player)}|${record.value}|${record.count}|${depth}`;
          if (!seen.has(key)) { seen.add(key); records.push(record); }
        }
      }
    }

    const nextContext = { category: category || context.category, player: player || context.player };
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object") {
        const keyCategory = normalize3kCategory(key);
        walk(value, { ...nextContext, category: keyCategory || nextContext.category }, depth + 1);
      }
    }
  }

  walk(root);
  // Manche APIs enthalten dieselben Datensätze in mehreren Darstellungen. Gleiche
  // Spieler/Kategorie/Wert-Paare werden deshalb auf die größte gefundene Anzahl reduziert.
  const merged = new Map();
  for (const record of records) {
    const key = `${record.category}|${normalize3kName(record.player)}|${record.value}`;
    const old = merged.get(key);
    if (!old || record.count > old.count) merged.set(key, record);
  }
  return [...merged.values()];
}

function normalize3kCategory(value) {
  const text = String(value || "").toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (!text) return null;
  if (/\b180\b/.test(text) && !/171/.test(text)) return "180";
  if (text.includes("highscore") || text.includes("high score")) return "highscore";
  if (text.includes("highfinish") || text.includes("high finish")) return "highfinish";
  if (text.includes("shortgame") || text.includes("short game") || text.includes("shortleg") || text.includes("short leg")) return "shortgame";
  return null;
}

function extract3kPlayer(node) {
  for (const key of ["playerName", "participantName", "displayName", "fullName", "spielerName"]) {
    if (typeof node[key] === "string" && node[key].trim()) return node[key].trim();
  }
  for (const key of ["player", "participant", "spieler", "person"]) {
    const obj = node[key];
    if (!obj) continue;
    if (typeof obj === "string" && obj.trim()) return obj.trim();
    if (typeof obj === "object") {
      const direct = firstText(obj, ["displayName", "fullName", "name", "nickname", "nickName"]);
      if (direct) return direct;
      const full = [obj.firstName || obj.vorname, obj.lastName || obj.nachname].filter(Boolean).join(" ").trim();
      if (full) return full;
    }
  }
  return null;
}

function firstText(obj, keys) {
  for (const key of keys) if (typeof obj?.[key] === "string" && obj[key].trim()) return obj[key].trim();
  return "";
}
function firstNumber(obj, keys) {
  for (const key of keys) {
    const value = Number(obj?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return NaN;
}
function isPlausible3kRecord(record) {
  if (!record.player || !record.category || !Number.isFinite(record.count) || record.count < 1) return false;
  if (record.category === "180") return true;
  if (!Number.isFinite(record.value) || record.value < 1) return false;
  if (record.category === "highscore") return record.value >= 150 && record.value <= 180;
  if (record.category === "highfinish") return record.value >= 100 && record.value <= 180;
  if (record.category === "shortgame") return record.value >= 1 && record.value <= 60;
  return false;
}

function empty3kStats() { return { count180: 0, highscores: [], highfinishes: [], shortgames: [] }; }
function merge3kRecord(stats, record) {
  if (record.category === "180") { stats.count180 += record.count; return; }
  const key = record.category === "highscore" ? "highscores" : record.category === "highfinish" ? "highfinishes" : "shortgames";
  const existing = stats[key].find(item => item.value === record.value);
  if (existing) existing.count += record.count;
  else stats[key].push({ value: record.value, count: record.count });
}
function finalize3kStats(stats) {
  stats.highscores.sort((a, b) => b.value - a.value);
  stats.highfinishes.sort((a, b) => b.value - a.value);
  stats.shortgames.sort((a, b) => a.value - b.value);
}

async function listMembersFor3k(env, accessToken) {
  const members = [];
  let pageToken = "";
  do {
    const url = new URL(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/mitglieder`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`MITGLIEDER_LESEN_${response.status}:${await response.text()}`);
    const json = await response.json();
    for (const document of json.documents || []) {
      const id = decodeURIComponent(String(document.name || "").split("/").pop() || "");
      const data = firestoreFieldsToObject(document.fields || {});
      if (data.aktiv !== false && ["mitglied", "captain", "admin", "kassenwart"].includes(String(data.rolle || "").toLowerCase())) members.push({ id, ...data });
    }
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return members;
}

function match3kPlayerToMember(playerName, members) {
  const source = normalize3kName(playerName);
  if (!source) return null;
  const parenthetical = String(playerName || "").match(/\(([^)]+)\)/)?.[1] || "";
  const candidates = [source, normalize3kName(parenthetical)].filter(Boolean);
  let best = null;
  let bestScore = 0;
  for (const member of members) {
    const memberNames = [
      member.nickname,
      member.benutzername,
      [member.vorname, member.nachname].filter(Boolean).join(" "),
      `${[member.vorname, member.nachname].filter(Boolean).join(" ")} ${member.nickname || ""}`
    ].map(normalize3kName).filter(Boolean);
    let score = 0;
    for (const candidate of candidates) {
      for (const name of memberNames) {
        if (candidate === name) score = Math.max(score, 100);
        else if (candidate.includes(name) || name.includes(candidate)) score = Math.max(score, 80);
      }
    }
    if (score > bestScore) { bestScore = score; best = member; }
  }
  return bestScore >= 80 ? best : null;
}

function normalize3kName(value) {
  return String(value || "")
    .toLocaleLowerCase("de")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ").trim();
}

async function patchMember3kStats(env, accessToken, memberId, stats) {
  const base = `${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}/mitglieder/${encodeURIComponent(memberId)}`;
  const url = new URL(base);
  url.searchParams.append("updateMask.fieldPaths", "bestleistungen3k");
  url.searchParams.append("updateMask.fieldPaths", "bestleistungenGeaendertAm");
  url.searchParams.append("updateMask.fieldPaths", "bestleistungenGeaendertVon");
  const fields = objectToFirestoreFields({
    bestleistungen3k: stats,
    bestleistungenGeaendertAm: new Date().toISOString(),
    bestleistungenGeaendertVon: "3k-sync"
  });
  // Datumsfeld als echter Firestore Timestamp statt String.
  fields.bestleistungenGeaendertAm = { timestampValue: new Date().toISOString() };
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!response.ok) throw new Error(`MITGLIED_3K_SPEICHERN_${response.status}:${await response.text()}`);
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
