import { db, getLogin } from './auth-utils.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const SETTINGS_REF = doc(db, 'einstellungen', 'turnierAnmeldung');

const DEFAULTS = {
  titel: 'DANNIS TREFF Turnier 2026',
  untertitel: 'Melde dich an und sei dabei!',
  datum: '2026-08-01',
  anwurf: '19:30',
  anmeldeschluss: '18:30',
  ort: 'Dannis Treff, Emil-Zimmermann-Allee 10, 45897 Gelsenkirchen',
  maxTeilnehmer: 32,
  startgeld: 10,
  paypalBetrag: 10.62,
  paypalHandle: 'DanielaRoth222',
  spielmodus: '501 Master Out',
  turnierform: 'Doppel K.O.',
  bestOf: 'Best of 3',
  auszahlungTitel: '100 % Ausschüttung',
  platz1: 50,
  platz2: 30,
  platz3: 20,
  bestLady: 'Best Lady erhält eine Flasche Sekt',
  anmeldungAktiv: true
};

let currentConfig = { ...DEFAULTS };

function euro(value) {
  return Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDatum(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(iso || '');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function applyConfig(config) {
  currentConfig = { ...DEFAULTS, ...config };
  window.dart11enTurnierConfig = currentConfig;

  setText('turnierTitel', currentConfig.titel);
  setText('turnierUntertitel', currentConfig.untertitel);
  setText('turnierDatumAnwurf', `${formatDatum(currentConfig.datum)}: ${currentConfig.anwurf} Uhr`);
  setText('turnierAnmeldeschluss', `Anmeldeschluss: ${currentConfig.anmeldeschluss} Uhr`);
  setText('turnierOrt', currentConfig.ort);
  setText('turnierMaxTeilnehmer', `Maximal ${currentConfig.maxTeilnehmer} Teilnehmer`);
  setText('turnierStartgeld', `Startgeld: ${euro(currentConfig.startgeld)}`);
  setText('auszahlungTitel', `🏆 ${currentConfig.auszahlungTitel}`);
  setText('platz1Wert', `${currentConfig.platz1} %`);
  setText('platz2Wert', `${currentConfig.platz2} %`);
  setText('platz3Wert', `${currentConfig.platz3} %`);
  setText('bestLadyText', `🍾 ${currentConfig.bestLady}`);
  setText('spielmodusText', currentConfig.spielmodus);
  setText('turnierformText', currentConfig.turnierform);
  setText('bestOfText', currentConfig.bestOf);
  setText('statusStartgeld', euro(currentConfig.startgeld));
  setText('paypalGesamt', euro(currentConfig.paypalBetrag));
  setText('paypalStartgeld', euro(currentConfig.startgeld));
  setText('paypalGebuehr', euro(Math.max(0, Number(currentConfig.paypalBetrag) - Number(currentConfig.startgeld))));
  setText('barzahlungWert', euro(currentConfig.startgeld));
  setText('paypalzahlungWert', euro(currentConfig.paypalBetrag));
  setText('paypalHandleText', `👉 @${currentConfig.paypalHandle}`);
  setText('footerTurnierTitel', currentConfig.titel);

  const paypal = document.getElementById('paypalLink');
  if (paypal) paypal.href = `https://paypal.me/${encodeURIComponent(currentConfig.paypalHandle)}/${Number(currentConfig.paypalBetrag).toFixed(2)}EUR`;

  const panel = document.getElementById('turnierAnmeldungStatus');
  if (panel) {
    panel.hidden = currentConfig.anmeldungAktiv !== false;
    panel.textContent = '🔒 Die Anmeldung ist derzeit geschlossen.';
  }
  const form = document.querySelector('.anmeldung');
  if (form) form.classList.toggle('anmeldung-geschlossen', currentConfig.anmeldungAktiv === false);

  document.dispatchEvent(new CustomEvent('turnierConfigLoaded', { detail: currentConfig }));
}

function fillAdminForm(config) {
  setValue('cfgTitel', config.titel);
  setValue('cfgUntertitel', config.untertitel);
  setValue('cfgDatum', config.datum);
  setValue('cfgAnwurf', config.anwurf);
  setValue('cfgAnmeldeschluss', config.anmeldeschluss);
  setValue('cfgOrt', config.ort);
  setValue('cfgMaxTeilnehmer', config.maxTeilnehmer);
  setValue('cfgStartgeld', config.startgeld);
  setValue('cfgPaypalBetrag', config.paypalBetrag);
  setValue('cfgPaypalHandle', config.paypalHandle);
  setValue('cfgSpielmodus', config.spielmodus);
  setValue('cfgTurnierform', config.turnierform);
  setValue('cfgBestOf', config.bestOf);
  setValue('cfgAuszahlungTitel', config.auszahlungTitel);
  setValue('cfgPlatz1', config.platz1);
  setValue('cfgPlatz2', config.platz2);
  setValue('cfgPlatz3', config.platz3);
  setValue('cfgBestLady', config.bestLady);
  const active = document.getElementById('cfgAnmeldungAktiv');
  if (active) active.checked = config.anmeldungAktiv !== false;
}

function readAdminForm() {
  const num = (id, fallback) => {
    const value = Number(document.getElementById(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    titel: document.getElementById('cfgTitel')?.value.trim() || DEFAULTS.titel,
    untertitel: document.getElementById('cfgUntertitel')?.value.trim() || DEFAULTS.untertitel,
    datum: document.getElementById('cfgDatum')?.value || DEFAULTS.datum,
    anwurf: document.getElementById('cfgAnwurf')?.value || DEFAULTS.anwurf,
    anmeldeschluss: document.getElementById('cfgAnmeldeschluss')?.value || DEFAULTS.anmeldeschluss,
    ort: document.getElementById('cfgOrt')?.value.trim() || DEFAULTS.ort,
    maxTeilnehmer: Math.max(1, Math.round(num('cfgMaxTeilnehmer', 32))),
    startgeld: Math.max(0, num('cfgStartgeld', 10)),
    paypalBetrag: Math.max(0, num('cfgPaypalBetrag', 10.62)),
    paypalHandle: (document.getElementById('cfgPaypalHandle')?.value || DEFAULTS.paypalHandle).replace(/^@/, '').trim(),
    spielmodus: document.getElementById('cfgSpielmodus')?.value.trim() || DEFAULTS.spielmodus,
    turnierform: document.getElementById('cfgTurnierform')?.value.trim() || DEFAULTS.turnierform,
    bestOf: document.getElementById('cfgBestOf')?.value.trim() || DEFAULTS.bestOf,
    auszahlungTitel: document.getElementById('cfgAuszahlungTitel')?.value.trim() || DEFAULTS.auszahlungTitel,
    platz1: Math.max(0, num('cfgPlatz1', 50)),
    platz2: Math.max(0, num('cfgPlatz2', 30)),
    platz3: Math.max(0, num('cfgPlatz3', 20)),
    bestLady: document.getElementById('cfgBestLady')?.value.trim() || DEFAULTS.bestLady,
    anmeldungAktiv: document.getElementById('cfgAnmeldungAktiv')?.checked !== false
  };
}

async function loadConfig() {
  try {
    const snap = await getDoc(SETTINGS_REF);
    applyConfig(snap.exists() ? { ...DEFAULTS, ...snap.data() } : DEFAULTS);
  } catch (error) {
    console.error('Turnier-Einstellungen konnten nicht geladen werden:', error);
    applyConfig(DEFAULTS);
  }
}

function setupAdmin() {
  const login = getLogin();
  const role = String(login?.rolle || '').toLowerCase();
  const allowed = ['admin', 'captain'].includes(role);
  const launcher = document.getElementById('turnierSettingsButton');
  const modal = document.getElementById('turnierSettingsOverlay');
  const form = document.getElementById('turnierSettingsForm');
  if (!launcher || !modal || !form) return;
  launcher.hidden = !allowed;
  if (!allowed) return;

  launcher.addEventListener('click', () => {
    fillAdminForm(currentConfig);
    modal.hidden = false;
    document.body.classList.add('modal-open');
  });
  document.getElementById('turnierSettingsClose')?.addEventListener('click', () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  });
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const saveButton = document.getElementById('turnierSettingsSave');
    if (saveButton) saveButton.disabled = true;
    try {
      const next = readAdminForm();
      await setDoc(SETTINGS_REF, {
        ...next,
        geaendertVon: login?.benutzername || login?.nickname || 'admin',
        geaendertAm: serverTimestamp()
      }, { merge: true });
      applyConfig(next);
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      alert('Turnierdaten gespeichert. Startseite und Anmeldung verwenden jetzt diese Angaben.');
    } catch (error) {
      console.error(error);
      alert('Turnierdaten konnten nicht gespeichert werden.');
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setupAdmin();
  await loadConfig();
});
