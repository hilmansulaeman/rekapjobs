# Job Tracker

Mobile-first PWA to track job applications, with Google Sheets as the main datastore.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![React Router](https://img.shields.io/badge/React_Router-v7-orange.svg)

## Overview

Job Tracker is built for quick daily logging of job applications from phone or desktop. Data is stored in Google Sheets, supports Google Sign-In, and keeps offline submissions in queue until connection is back.

### Main Capabilities

- Add and save job applications quickly
- Track progress stages (Applied, Interview, Offered, Accepted, Rejected, Withdrawn)
- View history and recap pages
- Optional receipt scan endpoint (`/api/scan-receipt`)
- Google OAuth login flow
- Offline queue + background sync to `/api/sync`
- PWA install support with service worker

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React Router v7 (Framework Mode) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Data Layer | Google Sheets API v4 + Google Drive API |
| Validation | Zod |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Google Cloud project with APIs enabled:
  - Google Sheets API
  - Google Drive API
- Service Account JSON key
- Google OAuth credentials (Web application)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/hilmansulaeman/rekapjobs.git
cd rekapjobs

# 2. Install dependencies
npm install

# 3. Create or edit .env and fill required variables
touch .env

# 4. Start development server
npm run dev
```

App runs on `http://localhost:5180`.

## Environment Variables

Set these in your `.env` file.

### Required

- `SESSION_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_MASTER_SPREADSHEET_ID`

### Optional

- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_USER_SHEETS_FOLDER_ID`
- `GOOGLE_SPREADSHEET_ID`
- `ALLOWED_GOOGLE_EMAILS`
- `ALLOWED_GOOGLE_DOMAIN`

### Private Key Format Note

For `GOOGLE_PRIVATE_KEY`, use one line with escaped newlines:

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

## Google Sheets Setup

1. Create a master spreadsheet for user mapping and copy its ID to `GOOGLE_MASTER_SPREADSHEET_ID`.
2. Share master spreadsheet with your service account email as Editor.
3. (Optional) Create a Google Drive folder and put its ID in `GOOGLE_USER_SHEETS_FOLDER_ID`.
4. Share that folder with service account email as Editor.
5. During onboarding, app creates/uses per-user spreadsheet and prepares `Applications` tab.

## Routes

- `/` add new job application
- `/history` view application history
- `/recap` recap summary
- `/settings` app settings
- `/login` login page
- `/auth/google` start Google OAuth flow
- `/auth/google/callback` OAuth callback
- `/onboarding/spreadsheet` spreadsheet onboarding
- `/api/sync` sync pending offline entries
- `/api/scan-receipt` scan receipt endpoint

## Project Structure

```text
job-tracker/
├── app/
│   ├── components/
│   ├── lib/
│   ├── routes/
│   ├── app.css
│   ├── root.tsx
│   └── routes.ts
├── public/
│   ├── manifest.webmanifest
│   └── sw.js
├── docs/
├── scripts/
├── package.json
├── react-router.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server on port 5180 |
| `npm run build` | Build for production |
| `npm run start` | Serve production build |
| `npm run typecheck` | Generate route types and run TypeScript check |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
