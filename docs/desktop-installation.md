# Event Core desktop installation

Event Core uses one shared Next.js application for the browser website and the Windows desktop app.

## How it works

- Browser users visit the public website, landing page, login page, and dashboard.
- Desktop users install the Windows `.exe` app.
- The `.exe` opens Event Core directly at the desktop login screen.
- The landing page is not part of the desktop app flow.
- After login, users go directly to the dashboard.

## Build the Windows installer

Run this from the project root:

```bash
npm run desktop:build
```

The installer is created in:

```txt
dist/Event Core Setup 2.1.0.exe
```

## Publishing for subscribers and staff

Upload the installer to a file host such as Supabase Storage, S3, GitHub Releases, or another private download location.

Then set this environment variable in Vercel:

```txt
NEXT_PUBLIC_DESKTOP_INSTALLER_URL=https://your-download-url/Event%20Core%20Setup%202.1.0.exe
```

After that, subscribed users and staff can download the Windows app from the app download/help area.

## Important deployment note

The desktop app loads the deployed Event Core dashboard. When dashboard or login behavior changes, deploy the Next.js app to production first.

Rebuild the `.exe` only when Electron settings change, such as:

- app icon
- desktop app start URL
- window settings
- installer configuration

## Desktop auto-updates

The Windows app includes Electron auto-update support.

Normal dashboard UI changes still update through Vercel and do not require a new installer. Auto-update is only for desktop shell changes, such as icon, window settings, Electron behavior, or installer changes.

### Update feed location

The app is currently configured to check this update feed:

```txt
https://downloads.eventcore.app/desktop/
```

You can change this in `package.json` under:

```json
"build": {
  "publish": [
    {
      "provider": "generic",
      "url": "https://downloads.eventcore.app/desktop/"
    }
  ]
}
```

Use a stable download host for this folder, such as:

- Supabase Storage
- Amazon S3
- Cloudflare R2
- GitHub Releases with a different provider setup
- a private downloads subdomain

### Publishing a new desktop version

1. Increase the app version in `package.json`.

Example:

```json
"version": "0.1.1"
```

2. Build the installer:

```bash
npm run desktop:build
```

3. Upload these files from `dist/` to the update feed folder:

```txt
Event Core Setup 0.1.1.exe
Event Core Setup 0.1.1.exe.blockmap
latest.yml
```

4. Existing installed apps will check for updates automatically. When an update is downloaded, the user will see a prompt:

```txt
Event Core update ready
Restart now / Later
```

If the user chooses Restart now, the app restarts and installs the update.

### Local testing note

Auto-update only runs in the packaged `.exe`. It does not run during:

```bash
npm run desktop:dev
```
