/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserView, BrowserWindow, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const APP_URL =
  process.env.EVENT_CORE_APP_URL ||
  "https://event-core-saas.vercel.app/login?desktop=1";
const APP_ORIGIN = new URL(APP_URL).origin;
const DESKTOP_LOGIN_URL = `${APP_ORIGIN}/login?desktop=1`;
const APP_ICON = path.join(__dirname, "assets", "icon.ico");
const UPDATE_FEED_URL = process.env.EVENT_CORE_UPDATE_FEED_URL;
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4;
const MIN_LOADING_SCREEN_MS = 850;
const STARTUP_FADE_MS = 200;
const STARTUP_REVEAL_FALLBACK_MS = 7000;
const APP_BACKGROUND_COLOR = "#0F172A";
const DEFAULT_WINDOW_OPTIONS = {
  width: 1440,
  height: 900,
  minWidth: 1024,
  minHeight: 720,
  title: "Event Core",
  backgroundColor: APP_BACKGROUND_COLOR,
  icon: APP_ICON
};
const LOADING_SCREEN_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        height: 100%;
        margin: 0;
      }

      body {
        align-items: center;
        background: linear-gradient(135deg, #ffffff 0%, #f7f4ed 52%, #f1f5f9 100%);
        color: #071427;
        display: flex;
        font-family: "Segoe UI", Arial, sans-serif;
        justify-content: center;
        overflow: hidden;
        opacity: 1;
        transition: opacity 200ms ease;
      }

      body.is-leaving {
        opacity: 0;
      }

      .loader {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .mark {
        animation: spin 1.35s linear infinite;
        color: #1f4d73;
        height: 84px;
        width: 84px;
      }

      .mark-inner {
        animation: zoom 1.35s ease-in-out infinite;
        transform-origin: center;
      }

      .title {
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .subtitle {
        color: #64748b;
        font-size: 13px;
        font-weight: 600;
        margin-top: -10px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes zoom {
        0%,
        100% {
          transform: scale(0.92);
        }

        50% {
          transform: scale(1.08);
        }
      }
    </style>
  </head>
  <body>
    <div class="loader" role="status" aria-label="Loading Event Core">
      <svg class="mark" viewBox="0 0 96 96" fill="none" aria-hidden="true">
        <g class="mark-inner" fill="currentColor">
          <circle cx="48" cy="48" r="18" />
          <rect x="44" y="6" width="8" height="24" rx="4" />
          <rect x="44" y="66" width="8" height="24" rx="4" />
          <rect x="66" y="44" width="24" height="8" rx="4" />
          <rect x="6" y="44" width="24" height="8" rx="4" />
          <circle cx="48" cy="16" r="8" />
          <circle cx="48" cy="80" r="8" />
          <circle cx="80" cy="48" r="8" />
          <circle cx="16" cy="48" r="8" />
        </g>
      </svg>
      <div class="title">Event Core</div>
      <div class="subtitle">Loading your workspace...</div>
    </div>
  </body>
</html>`;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForRendererToBeReady(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  try {
    await webContents.executeJavaScript(
      `new Promise((resolve) => {
        const waitForFonts = document.fonts && document.fonts.ready
          ? Promise.race([
              document.fonts.ready,
              new Promise((fontResolve) => setTimeout(fontResolve, 1500))
            ])
          : Promise.resolve();

        const waitForDom = new Promise((domResolve) => {
          const hasRenderedContent = () => {
            const nextRoot = document.querySelector("#__next");
            const appRoot = document.querySelector("main, form, section, [data-event-core-auth]");
            return Boolean((nextRoot && nextRoot.childElementCount > 0) || appRoot);
          };

          if (hasRenderedContent()) {
            domResolve();
            return;
          }

          const observer = new MutationObserver(() => {
            if (!hasRenderedContent()) return;
            observer.disconnect();
            domResolve();
          });

          observer.observe(document.documentElement, {
            childList: true,
            subtree: true
          });

          setTimeout(() => {
            observer.disconnect();
            domResolve();
          }, 1800);
        });

        Promise.all([waitForFonts, waitForDom]).then(resolve);
      })`,
      true
    );
  } catch {
    // If renderer inspection fails, fall back to did-finish-load instead of
    // leaving users stuck on the startup screen.
  }
}

function isMarketingRoot(url) {
  try {
    const nextUrl = new URL(url);
    return nextUrl.origin === APP_ORIGIN && nextUrl.pathname === "/";
  } catch {
    return false;
  }
}

function configureAutoUpdater(mainWindow) {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  if (UPDATE_FEED_URL) {
    autoUpdater.setFeedURL({
      provider: "generic",
      url: UPDATE_FEED_URL
    });
  }

  autoUpdater.on("update-downloaded", async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Event Core update ready",
      message: "A new Event Core desktop update has been downloaded.",
      detail: "Restart the app to install the latest desktop version."
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", () => {
    // Keep update failures silent for users. The web app still loads normally.
  });

  autoUpdater.checkForUpdates().catch(() => {});

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, UPDATE_CHECK_INTERVAL_MS);
}

function attachAppWindowHandlers(webContents) {
  webContents.on("did-finish-load", () => {
    const currentUrl = webContents.getURL();

    if (!currentUrl.startsWith(APP_ORIGIN)) {
      return;
    }

    webContents
      .executeJavaScript(
        "window.localStorage.setItem('eventCoreDesktopApp', 'true');",
        true
      )
      .catch(() => {});
  });

  webContents.on("will-navigate", (event, url) => {
    if (!isMarketingRoot(url)) return;

    event.preventDefault();
    webContents.loadURL(DESKTOP_LOGIN_URL);
  });

  webContents.on("did-navigate-in-page", (_event, url) => {
    if (isMarketingRoot(url)) {
      webContents.loadURL(DESKTOP_LOGIN_URL);
    }
  });

  webContents.setWindowOpenHandler(({ url }) => {
    const isSameApp = new URL(url).origin === APP_ORIGIN;

    if (isMarketingRoot(url)) {
      webContents.loadURL(DESKTOP_LOGIN_URL);
      return { action: "deny" };
    }

    if (isSameApp) {
      return { action: "allow" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    ...DEFAULT_WINDOW_OPTIONS,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_SCREEN_HTML)}`);

  const appView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const resizeAppView = () => {
    if (mainWindow.isDestroyed()) {
      return;
    }

    const [width, height] = mainWindow.getContentSize();
    appView.setBounds({ x: 0, y: 0, width, height });
  };

  const hideAppView = () => {
    appView.setBounds({ x: -10, y: -10, width: 1, height: 1 });
  };

  mainWindow.setBrowserView(appView);
  hideAppView();
  appView.setAutoResize({ width: true, height: true });
  mainWindow.on("resize", resizeAppView);

  attachAppWindowHandlers(appView.webContents);
  configureAutoUpdater(mainWindow);

  const startedAt = Date.now();
  const rendererLoaded = new Promise((resolve) => {
    appView.webContents.once("did-finish-load", resolve);
    appView.webContents.once("did-fail-load", resolve);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  let didRevealAppView = false;
  const revealAppView = async () => {
    if (didRevealAppView) {
      return;
    }

    didRevealAppView = true;
    await waitForRendererToBeReady(appView.webContents);

    const elapsed = Date.now() - startedAt;
    await wait(Math.max(0, MIN_LOADING_SCREEN_MS - elapsed));

    if (mainWindow.isDestroyed()) {
      return;
    }

    await mainWindow.webContents
      .executeJavaScript("document.body.classList.add('is-leaving');", true)
      .catch(() => {});
    await wait(STARTUP_FADE_MS);

    resizeAppView();
    appView.webContents.focus();
  };

  rendererLoaded.then(revealAppView);
  setTimeout(revealAppView, STARTUP_REVEAL_FALLBACK_MS);
  appView.webContents.loadURL(APP_URL);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
