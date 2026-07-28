# Native app packaging

Event Core is a Next.js SaaS app with API routes, Prisma, and Supabase access. For installable desktop and mobile apps, package a native shell that loads the deployed Event Core web app URL.

## Required deployed URL

Deploy the web app first, then use that URL for desktop and mobile packaging.

Example:

```bash
EVENT_CORE_APP_URL=https://app.your-domain.com
```

## Desktop app

Recommended wrapper: Electron.

Install dependencies when npm registry access is available:

```bash
npm install --save-dev electron electron-builder
```

Development:

```bash
set EVENT_CORE_APP_URL=https://app.your-domain.com
npm run desktop:dev
```

Build Windows installer:

```bash
set EVENT_CORE_APP_URL=https://app.your-domain.com
npm run desktop:build
```

Output will be created by Electron Builder in `dist/`.

## Mobile apps

Recommended wrapper: Capacitor.

Install dependencies when npm registry access is available:

```bash
npm install @capacitor/core @capacitor/android @capacitor/ios --save
npm install @capacitor/cli --save-dev
```

Update `capacitor.config.json`:

```json
{
  "server": {
    "url": "https://app.your-domain.com"
  }
}
```

Create native projects:

```bash
npm run mobile:add:android
npm run mobile:add:ios
```

Sync changes:

```bash
npm run mobile:sync
```

Open native projects:

```bash
npm run mobile:open:android
npm run mobile:open:ios
```

Android builds require Android Studio. iOS builds require macOS with Xcode.
