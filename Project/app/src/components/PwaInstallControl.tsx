import { useEffect, useState } from 'react';
import './pwa-install.css';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isInstalled() {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || standaloneNavigator.standalone === true;
}

export default function PwaInstallControl() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setInstalled(isInstalled());
    setOnline(navigator.onLine);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setHelpOpen(false);
    };
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const install = async () => {
    if (!installEvent) {
      setHelpOpen((open) => !open);
      return;
    }

    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      if (choice.outcome === 'accepted') setInstalled(true);
      else setHelpOpen(true);
    } catch {
      setHelpOpen(true);
    } finally {
      setInstalling(false);
    }
  };

  if (installed) return null;

  return (
    <aside className="pwa-install-control" aria-label="DineFlow app installation">
      {helpOpen && (
        <div className="pwa-install-help" id="pwa-install-help" role="status">
          <strong>Install DineFlow on this device</strong>
          <p>
            In Chrome, select the install icon at the right of the address bar. You can also open the
            <span className="pwa-menu-dots" aria-label="three-dot menu"> ⋮ </span> menu and choose
            <b> Cast, save and share → Install page as app</b>.
          </p>
          {!window.isSecureContext && (
            <p className="pwa-install-secure-note">
              Chrome requires a secure origin. On this computer, open DineFlow at localhost; a LAN IP needs HTTPS.
            </p>
          )}
          <small>{online ? 'You’re online. Your workspace is ready.' : 'You’re offline. Reconnect to sign in and sync restaurant data.'}</small>
        </div>
      )}
      <button
        className="pwa-install-button"
        type="button"
        onClick={() => void install()}
        aria-expanded={helpOpen}
        aria-controls="pwa-install-help"
        disabled={installing}
      >
        <span aria-hidden="true">⇩</span>
        {installing ? 'Opening install…' : 'Install app'}
      </button>
    </aside>
  );
}
