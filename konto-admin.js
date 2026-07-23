import {
  getLogin,
  normalizeUsername,
  setNewPassword
} from "./auth-utils.js";

const $ = id => document.getElementById(id);
const user = getLogin();

if (!user || String(user.rolle).toLowerCase() !== "admin") {
  $("accessDenied").hidden = false;
} else {
  $("adminPanel").hidden = false;
}

function showMessage(message, success = false) {
  const box = $("adminMessage");
  box.textContent = message;
  box.className = `konto-meldung ${success ? "erfolg" : "fehler"}`;
  box.hidden = false;
}

async function resetPassword() {
  const username = normalizeUsername($("adminUsername").value);
  const password = $("temporaryPassword").value;
  const repeated = $("temporaryPasswordRepeat").value;

  if (!username) {
    showMessage("Bitte einen Benutzernamen eingeben.");
    return;
  }

  if (password.length < 8) {
    showMessage("Das Startpasswort muss mindestens 8 Zeichen haben.");
    return;
  }

  if (password !== repeated) {
    showMessage("Die Passwörter stimmen nicht überein.");
    return;
  }

  const button = $("resetButton");
  button.disabled = true;
  button.textContent = "Wird zurückgesetzt …";

  try {
    await setNewPassword(username, password, true);
    showMessage(`Das Passwort für „${username}“ wurde zurückgesetzt.`, true);
    $("temporaryPassword").value = "";
    $("temporaryPasswordRepeat").value = "";
  } catch (error) {
    console.error(error);
    if (error.message === "USER_NOT_FOUND") {
      showMessage("Dieser Benutzer wurde nicht gefunden.");
    } else {
      showMessage("Das Passwort konnte nicht zurückgesetzt werden.");
    }
  } finally {
    button.disabled = false;
    button.textContent = "Passwort zurücksetzen";
  }
}

$("resetButton").addEventListener("click", resetPassword);
