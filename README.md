# 210 Robotics Website and Member Platform

The production web platform for **210 Robotics at UT San Antonio**. The project combines the public organization website, member portal, administrative tools, team documentation, engineering operations, attendance, forms, donations, media, and integrations in one Next.js application.

## Live sites

| Address | Purpose |
| --- | --- |
| [210robotics.com](https://210robotics.com) | Primary public website and portal |
| [www.210robotics.com](https://www.210robotics.com) | Public website alias |
| [beta.210robotics.com](https://beta.210robotics.com) | Stable testing alias |
| [docs.210robotics.com](https://docs.210robotics.com) | Team wiki and code reference |
| [210robotics-210robotics.vercel.app](https://210robotics-210robotics.vercel.app) | Vercel project alias |

All web domains are served by the same Vercel project. Host-aware routing sends the docs hostname to the wiki while preserving the main-site navigation.

## What is included

### Public website

- Recruitment-focused home, About, Team, Members, VEX U, SIDC, and RoboRowdy pages
- News/blog publishing, events, sponsors, impact, resources, media gallery, contact, and join flows
- Database-backed website text, image, roster, sponsor, and navigation editing
- Google Calendar display and Drive-backed media synchronization
- Responsive navigation, accessibility support, metadata, sitemap, and reduced-motion styling

### Member portal

- Clerk email/password, Google, and Microsoft sign-in
- Manual account approval, suspension, restoration, and granular permission overrides
- Member profiles and synchronized public directory entries
- Sign-in/sign-out time tracking and manual hour or contribution entries
- Attendance scanning and signed QR-code check-in links
- Member activity history, attendance summaries, forms, polls, documentation, tasks, and engineering tools

### Administration and operations

- Account, role, permission, roster, sponsor, news, events, media, inquiry, and site-content management
- Meeting/activity creation, attendance review, QR-code download/printing, and record exports
- Form builder, file-upload fields, response analytics, and availability heatmaps
- Engineering notebook, BOM, manufacturing, scouting, inventory, purchasing, design changes, finance, dues, and audit history
- Discord server management, notifications, message capture, meeting recordings, transcription, and command integration

## Technology

- **Application:** Next.js 16 App Router, React 19, TypeScript, Server Components, Server Actions, Zod
- **UI:** Tailwind CSS, Lexend-based visual system, Tiptap rich-text editing, Lucide icons
- **Authentication:** Clerk
- **Database:** Neon Postgres with Drizzle ORM and committed SQL migrations
- **Files:** Vercel Blob plus Google Drive synchronization
- **Email:** Resend
- **Payments:** Stripe Checkout and webhooks
- **Hosting:** Vercel, with a separate always-on host for Discord voice
- **Testing:** Vitest, Testing Library, Playwright, ESLint, TypeScript

## Quick start

Requirements:

- Node.js 24.x, matching the Vercel project
- npm
- A Neon database
- Clerk keys for portal authentication

```powershell
Copy-Item .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. Optional integrations degrade gracefully when their keys are not configured, but authentication, member records, and most portal functions require Clerk and Neon.

Never commit `.env.local`, Vercel environment exports, service-account JSON, tokens, or production data.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js server using `.env.local` |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Validate TypeScript |
| `npm test` | Run Vitest tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run build` | Create a production build and register configured Discord commands |
| `npm run check` | Run lint, types, tests, and production build |
| `npm run db:generate` | Generate a Drizzle migration after schema changes |
| `npm run db:migrate` | Apply committed migrations |
| `npm run discord:link-server` | Configure the connected Discord server |
| `npm run discord:voice-worker` | Run the persistent voice worker locally |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Local development](docs/DEVELOPMENT.md)
- [Hosting and deployment](docs/HOSTING.md)
- [Operations runbook](docs/OPERATIONS.md)
- [Security model](docs/SECURITY.md)
- [Discord voice worker](workers/discord-voice/README.md)

## Repository policy

This repository contains no credentials or production database exports. Keep the GitHub repository private unless the organization deliberately reviews the code and approves public release. Protect the default branch, require the CI workflow, and use pull requests for production changes.

## Ownership

210 Robotics maintains this project for its public site and internal team operations. Production access should be limited to designated organization officers and technical administrators.
