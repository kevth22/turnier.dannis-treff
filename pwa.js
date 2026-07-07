(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.warn('Offline-Modus konnte nicht gestartet werden.', error);
      });
    });
  }

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;

    if (document.querySelector('.pwa-install-button')) return;
    const button = document.createElement('button');
    button.className = 'pwa-install-button';
    button.type = 'button';
    button.textContent = 'App installieren';
    button.setAttribute('aria-label', 'Dart11en App installieren');
    button.addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      button.remove();
    });
    document.body.appendChild(button);
  });

  window.addEventListener('appinstalled', () => {
    document.querySelector('.pwa-install-button')?.remove();
    installPrompt = null;
  });
})();
