(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.warn('Offline-Modus konnte nicht gestartet werden.', error);
      });
    });
  }

  let installPrompt = null;
  const istStartseite = /(?:^|\/)index\.html$/.test(location.pathname) || location.pathname.endsWith('/');
  const button = istStartseite ? document.getElementById('pwaInstallButton') : null;

  const istStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const buttonAusblenden = () => {
    if (!button) return;
    button.hidden = true;
    button.style.display = 'none';
  };

  const buttonEinblenden = () => {
    if (!button || istStandalone()) return;
    button.hidden = false;
    button.style.removeProperty('display');
  };

  // Wichtig für iPhone/PWA: Der Button startet im HTML verborgen und wird nur
  // in einem normalen Browserfenster eingeblendet. In der installierten App
  // bleibt er dadurch auch beim ersten Rendern unsichtbar.
  if (istStandalone()) buttonAusblenden();
  else buttonEinblenden();

  button?.addEventListener('click', async () => {
    if (istStandalone()) {
      buttonAusblenden();
      return;
    }

    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      return;
    }

    const istIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(istIOS
      ? 'Tippe unten auf „Teilen“ und anschließend auf „Zum Home-Bildschirm“. '
      : 'Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.');
  });

  window.addEventListener('beforeinstallprompt', event => {
    if (istStandalone()) {
      buttonAusblenden();
      return;
    }
    event.preventDefault();
    installPrompt = event;
    buttonEinblenden();
  });

  window.addEventListener('appinstalled', () => {
    buttonAusblenden();
    installPrompt = null;
  });

  // Falls sich der Display-Modus ändert, Status direkt nachziehen.
  const displayMode = window.matchMedia('(display-mode: standalone)');
  const onDisplayModeChange = () => istStandalone() ? buttonAusblenden() : buttonEinblenden();
  if (typeof displayMode.addEventListener === 'function') displayMode.addEventListener('change', onDisplayModeChange);
  else if (typeof displayMode.addListener === 'function') displayMode.addListener(onDisplayModeChange);

  // Nach dem vollständigen Laden noch einmal prüfen (iOS meldet standalone
  // in manchen Situationen erst zuverlässig nach dem initialen Dokumentlauf).
  window.addEventListener('pageshow', () => {
    if (istStandalone()) buttonAusblenden();
  });
})();
