import { getLogin, logout } from "./auth-utils.js";

function renderAccountControls() {
  const user = getLogin();
  const host = document.getElementById("accountControls");

  if (!host) return;

  const captainCard = document.getElementById("captainCard");
  const kasseCard = document.getElementById("kasseCard");
  const cameraCard = document.getElementById("cameraCard");
  const verwaltungSection = document.getElementById("verwaltungSection");

  if (!user) {
    host.innerHTML = `
      <a class="account-login-button index-login-button" href="login.html">
        🔐 Anmelden
      </a>
    `;
    if (captainCard) captainCard.hidden = true;
    if (kasseCard) kasseCard.hidden = true;
    if (cameraCard) cameraCard.hidden = true;
    if (verwaltungSection) verwaltungSection.hidden = true;
    return;
  }

  const role = String(user.rolle || "gast").toLowerCase();
  const canCaptain = ["admin", "captain"].includes(role);
  const canViewKasse = ["admin", "captain", "kassenwart"].includes(role);

  if (captainCard) captainCard.hidden = !canCaptain;
  if (kasseCard) kasseCard.hidden = !canViewKasse;
  if (cameraCard) cameraCard.hidden = !canCaptain;
  if (verwaltungSection) verwaltungSection.hidden = !(canCaptain || canViewKasse);

  const roleLabels = {
    admin: "Admin",
    captain: "Captain",
    kassenwart: "Kassenwart",
    mitglied: "Mitglied",
    gast: "Gast"
  };

  const adminAction = role === "admin"
    ? `<a class="index-account-action" href="konto-admin.html" aria-label="Konten verwalten" title="Konten verwalten">⚙️</a>`
    : "";

  host.innerHTML = `
    <div class="index-account-card">
      <a class="index-account-main" href="kader.html">
        <span class="index-account-avatar">👤</span>
        <span class="index-account-copy">
          <strong>${escapeHtml(user.nickname || user.benutzername)}</strong>
          <small>${escapeHtml(roleLabels[role] || role)}</small>
        </span>
      </a>
      <div class="index-account-actions">
        ${adminAction}
        <button id="logoutButton" class="index-account-action" type="button" aria-label="Abmelden" title="Abmelden">↪</button>
      </div>
    </div>
  `;

  document.getElementById("logoutButton")?.addEventListener("click", () => {
    logout(true);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", renderAccountControls);
