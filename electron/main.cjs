/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const APP_URL =
  process.env.EVENT_CORE_APP_URL ||
  "https://hall-management-saas-platform.vercel.app/login?desktop=1";
const APP_ORIGIN = new URL(APP_URL).origin;
const DESKTOP_LOGIN_URL = `${APP_ORIGIN}/login?desktop=1`;
const APP_ICON = path.join(__dirname, "assets", "icon.ico");
const UPDATE_FEED_URL = process.env.EVENT_CORE_UPDATE_FEED_URL;
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4;

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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "Event Core",
    backgroundColor: "#f5f6f8",
    icon: APP_ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(APP_URL);
  configureAutoUpdater(mainWindow);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents
      .executeJavaScript(
        "window.localStorage.setItem('eventCoreDesktopApp', 'true');",
        true
      )
      .catch(() => {});
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isMarketingRoot(url)) return;

    event.preventDefault();
    mainWindow.loadURL(DESKTOP_LOGIN_URL);
  });

  mainWindow.webContents.on("did-navigate-in-page", (_event, url) => {
    if (isMarketingRoot(url)) {
      mainWindow.loadURL(DESKTOP_LOGIN_URL);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isSameApp = new URL(url).origin === APP_ORIGIN;

    if (isMarketingRoot(url)) {
      mainWindow.loadURL(DESKTOP_LOGIN_URL);
      return { action: "deny" };
    }

    if (isSameApp) {
      return { action: "allow" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });
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
