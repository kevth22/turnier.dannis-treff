(() => {
  const SETTINGS_KEY = "dart11enTurnierUiV5";
  const pageSections = {
    dashboard: ["dashboard", "statistikBereich", "spielerBereich"],
    teilnehmer: ["teilnehmerBereich"],
    konfiguration: ["auslosungBereich"],
    ergebnisse: ["ergebnisBereich"],
    turnierbaum: ["turnierBaumBereich", "gruppenBereich"],
    tv: ["tvBereich"],
    einstellungen: ["einstellungenBereich"]
  };
  const defaults = { compact: false, bottomNav: false, startPage: "dashboard", tournamentName: "Dart11en-Turnier" };

  function loadSettings(){
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; }
    catch { return { ...defaults }; }
  }
  function saveSettings(value){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)); }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.classList.contains("is-admin")) return;
    const drawer = document.getElementById("adminDrawer");
    const backdrop = document.getElementById("adminDrawerBackdrop");
    const openButton = document.getElementById("adminMenuButton");
    const closeButton = document.getElementById("adminMenuClose");
    const links = [...document.querySelectorAll("[data-admin-page]")];
    let settings = loadSettings();

    const closeDrawer = () => {
      drawer?.classList.remove("open");
      drawer?.setAttribute("aria-hidden", "true");
      openButton?.setAttribute("aria-expanded", "false");
      if (backdrop) backdrop.hidden = true;
      document.body.classList.remove("admin-menu-open");
    };
    const openDrawer = () => {
      if (backdrop) backdrop.hidden = false;
      drawer?.classList.add("open");
      drawer?.setAttribute("aria-hidden", "false");
      openButton?.setAttribute("aria-expanded", "true");
      document.body.classList.add("admin-menu-open");
    };
    const showPage = (page, updateHash = true) => {
      if (!pageSections[page]) page = "dashboard";
      document.querySelectorAll("[data-admin-section]").forEach(section => {
        section.classList.toggle("admin-page-hidden", section.dataset.adminSection !== page);
      });
      links.forEach(link => link.classList.toggle("active", link.dataset.adminPage === page));
      if (updateHash) history.replaceState(null, "", `#${page}`);
      closeDrawer();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    openButton?.addEventListener("click", openDrawer);
    closeButton?.addEventListener("click", closeDrawer);
    backdrop?.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });
    links.forEach(link => link.addEventListener("click", () => showPage(link.dataset.adminPage)));

    const compact = document.getElementById("settingCompact");
    const bottomNav = document.getElementById("settingBottomNav");
    const startPage = document.getElementById("settingStartPage");
    const tournamentName = document.getElementById("settingTournamentName");
    const message = document.getElementById("settingsMessage");
    const title = document.querySelector("#dashboard h2");

    function applySettings(){
      document.body.classList.toggle("turnier-compact", !!settings.compact);
      document.body.classList.toggle("hide-turnier-bottom-nav", !settings.bottomNav);
      if (compact) compact.checked = !!settings.compact;
      if (bottomNav) bottomNav.checked = !!settings.bottomNav;
      if (startPage) startPage.value = settings.startPage;
      if (tournamentName) tournamentName.value = settings.tournamentName;
      if (title) title.textContent = `🏆 ${settings.tournamentName || defaults.tournamentName}`;
    }
    document.getElementById("settingsSaveBtn")?.addEventListener("click", () => {
      settings = {
        compact: !!compact?.checked,
        bottomNav: !!bottomNav?.checked,
        startPage: startPage?.value || "dashboard",
        tournamentName: tournamentName?.value.trim() || defaults.tournamentName
      };
      saveSettings(settings); applySettings();
      if (message) message.textContent = "Einstellungen wurden gespeichert.";
    });
    document.getElementById("settingsResetBtn")?.addEventListener("click", () => {
      settings = { ...defaults }; saveSettings(settings); applySettings();
      if (message) message.textContent = "Standardeinstellungen wurden wiederhergestellt.";
    });

    applySettings();
    const hashPage = location.hash.replace("#", "");
    showPage(pageSections[hashPage] ? hashPage : settings.startPage, false);

    const statusSource = document.getElementById("status");
    const headerStatus = document.getElementById("headerTurnierStatus");
    if (statusSource && headerStatus) {
      const sync = () => headerStatus.textContent = statusSource.textContent.replace(/^[^\p{L}\p{N}]+/u, "").trim();
      sync(); new MutationObserver(sync).observe(statusSource, { childList:true, subtree:true, characterData:true });
    }
  });
})();
