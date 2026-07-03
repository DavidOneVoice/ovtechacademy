# OVTech Academy

React + Vite application for the OVTech Academy website and admin dashboard.

## Environment setup

Firebase and EmailJS credentials are read from Vite environment variables. Copy the
example file, then replace the placeholder values with the values from the active
Firebase web app and EmailJS account:

```bash
cp .env.example .env.local
```

Required Firebase variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

If Firebase Authentication returns `auth/configuration-not-found`, the deployed
site is using a Firebase web API key/configuration that does not belong to an
active Firebase Authentication project. Update these variables in the deployment
environment with the current Firebase project settings, and make sure the Email/
Password sign-in provider is enabled in Firebase Authentication.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
