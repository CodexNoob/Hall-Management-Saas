# Electron desktop shell

This folder is the correct location for the Electron main process and desktop-only assets. Electron code runs outside Next.js and must remain separate from `app/`, `features/`, and browser bundles.

## Files

- `main.cjs` creates the secure desktop window, loading screen, navigation policy, and updater.
- `assets/icon.ico` is used by the application window and Windows installer.

No preload script is currently required because the shell exposes no native APIs to the web application. If native functionality is added later, create `preload.cjs`, keep `contextIsolation: true`, keep `nodeIntegration: false`, and expose only narrowly scoped methods through `contextBridge`.

## Commands

```powershell
$env:EVENT_CORE_APP_URL="http://localhost:3000/login?desktop=1"
npm.cmd run desktop:dev
npm.cmd run desktop:build
```

The default URL is the production Event Core deployment. `EVENT_CORE_UPDATE_FEED_URL` can override the packaged auto-update feed.

## Security rules

- Same-origin Event Core links stay in the desktop view.
- External links open in the operating system browser.
- Renderer permissions are denied unless explicitly added and reviewed.
- The renderer remains sandboxed without Node integration.
- Business rules, credentials, and database access remain in the deployed web application.

