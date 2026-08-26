(() => {
  const PREIS_PRO_LEG = 0.50;
  const $ = id => document.getElementById(id);

  function parseJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function modus() {
    return localStorage.getItem('dart11enV3TurnierModus') || 'doppelko';
  }

  function zielLegs(bestOf) {
    const bo = Math.max(1, Number(bestOf) || 3);
    return Math.ceil(bo / 2);
  }

  function istBeendet(match, bestOf) {
    if (!match || !match.a || !match.b || match.a === 'Freilos' || match.b === 'Freilos') return false;
    const a = Number(match.scoreA), b = Number(match.scoreB), ziel = zielLegs(bestOf);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return (a === ziel && b < ziel) || (b === ziel && a < ziel);
  }

  function doppelKoMatches(data) {
    if (!data) return [];
    return [
      ...(Array.isArray(data.w) ? data.w.flat() : []),
      ...(Array.isArray(data.l) ? data.l.flat() : []),
      ...(Array.isArray(data.finale) ? data.finale : [])
    ].filter(Boolean).map(match => ({ match, bestOf: data.bestOf || localStorage.getItem('dart11enV3BestOf') || 3 }));
  }

  function gruppenKoMatches(data) {
    if (!data) return [];
    const out = [];
    for (const gruppe of data.gruppen || []) {
      for (const match of gruppe.spiele || []) out.push({ match, bestOf: data.bestOf || 3 });
    }
    for (const phase of data.koPhasen || []) {
      for (const runde of phase.runden || []) {
        for (const match of runde || []) out.push({ match, bestOf: data.bestOf || 3 });
      }
    }
    return out;
  }

  function aktuelleMatches() {
    if (modus() === 'gruppenko') return gruppenKoMatches(parseJson('dart11enV3GruppenKo'));
    return doppelKoMatches(parseJson('dart11enV3DoppelKo'));
  }

  function berechnen() {
    const stats = new Map();
    for (const { match, bestOf } of aktuelleMatches()) {
      if (!istBeendet(match, bestOf)) continue;
      const legs = Number(match.scoreA) + Number(match.scoreB);
      if (!Number.isFinite(legs) || legs <= 0) continue;
      for (const name of [match.a, match.b]) {
        if (!name || name === 'Freilos') continue;
        stats.set(name, (stats.get(name) || 0) + legs);
      }
    }
    return [...stats.entries()]
      .map(([name, legs]) => ({ name, legs, betrag: legs * PREIS_PRO_LEG }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  }

  function euro(value) {
    return Number(value || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  }

  function render() {
    const liste = $('legSpielerListe');
    if (!liste) return;
    const suche = String($('legSpielerSuche')?.value || '').trim().toLocaleLowerCase('de');
    const alle = berechnen();
    const gefiltert = suche ? alle.filter(x => x.name.toLocaleLowerCase('de').includes(suche)) : alle;

    const gesamtLegs = alle.reduce((sum, x) => sum + x.legs, 0);
    const gesamtBetrag = alle.reduce((sum, x) => sum + x.betrag, 0);
    if ($('legSpielerAnzahl')) $('legSpielerAnzahl').textContent = String(alle.length);
    if ($('legGesamtAnzahl')) $('legGesamtAnzahl').textContent = String(gesamtLegs);
    if ($('legGesamtBetrag')) $('legGesamtBetrag').textContent = euro(gesamtBetrag);

    liste.replaceChildren();
    for (const item of gefiltert) {
      const row = document.createElement('article');
      row.className = 'leg-player-row';
      const name = document.createElement('strong');
      name.className = 'leg-player-name';
      name.textContent = item.name;
      const legs = document.createElement('span');
      legs.className = 'leg-player-legs';
      legs.innerHTML = `<b>${item.legs}</b><small> Legs</small>`;
      const betrag = document.createElement('span');
      betrag.className = 'leg-player-money';
      betrag.textContent = euro(item.betrag);
      row.append(name, legs, betrag);
      liste.append(row);
    }

    const leer = $('legKeineTreffer');
    if (leer) {
      leer.hidden = gefiltert.length > 0;
      leer.textContent = alle.length === 0
        ? 'Noch keine abgeschlossenen Spiele vorhanden.'
        : 'Kein Spieler gefunden.';
    }
  }

  $('legSpielerSuche')?.addEventListener('input', render);
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-admin-page="legs"]');
    if (btn) setTimeout(render, 0);
  });
  window.addEventListener('storage', event => {
    if (['dart11enV3DoppelKo', 'dart11enV3GruppenKo', 'dart11enV3TurnierModus'].includes(event.key)) render();
  });
  window.dart11enLegUebersichtRendern = render;
  setInterval(() => {
    const section = $('legUebersichtBereich');
    if (section && !section.hidden && getComputedStyle(section).display !== 'none') render();
  }, 1500);
  render();
})();
