# Hosting and deployment

## Production topology

### Vercel web application

- **Vercel project:** `210_robotics`
- **Framework:** Next.js
- **Node.js:** 24.x
- **Install command:** `npm install`
- **Build command:** `npm run build`
- **Output:** `.next`
- **Region:** selected by Vercel; server code must not depend on local persistent files

The project uses Git integration for previews and production releases. Pull requests and non-production branches should create Preview deployments. The protected default branch should be the only automatic Production source.

### Domains

| Domain | Role |
| --- | --- |
| `210robotics.com` | Primary production domain |
| `www.210robotics.com` | Public alias |
| `beta.210robotics.com` | Testing/stable validation alias |
| `docs.210robotics.com` | Wiki and Doxygen hostname |
| `210robotics-210robotics.vercel.app` | Vercel project alias |

Attach each domain in the Vercel project. Use the exact DNS records Vercel displays; do not copy a record from another project or alter unrelated root-domain records. The docs hostname points to the same deployment and is routed by `src/proxy.ts`.

## Managed services

| Service | Responsibility | Required production configuration |
| --- | --- | --- |
| Neon | Postgres application database | `DATABASE_URL` |
| Clerk | Authentication, SSO, verification, sessions | publishable key, secret key, webhook signing secret |
| Vercel Blob | Public uploads | `BLOB_READ_WRITE_TOKEN` |
| Private Blob store | Internal documents and recordings | `PRIVATE_DOCUMENTS_READ_WRITE_TOKEN` |
| Resend | Inquiry and confirmation email | API key and verified from-address |
| Google Drive | Photos, documents, recordings, sponsor sources | folder IDs and optional service account |
| Stripe | Donations | publishable key, secret key, webhook secret |
| Discord | Bot, notifications, commands, message capture | application, bot, guild, public key, client secret |
| AI Gateway/Gemini | Assistant and transcription | gateway or Gemini configuration |
| Always-on Docker host | Discord voice capture | worker URL, bot token, shared worker secret |

Store all values in Vercel environment settings, never in GitHub. Maintain separate Development, Preview, and Production sets.

## Provider configuration

### Clerk

Configure:

- allowed origins for the Vercel preview URL, project alias, primary domain, beta domain, and docs domain where authentication is used;
- sign-in and sign-up redirect destinations for `/portal`, `/pending`, and `/sso-callback`;
- Google and Microsoft social connections;
- webhook endpoint `https://210robotics.com/api/webhooks/clerk`;
- webhook events `user.created`, `user.updated`, and `user.deleted`.

The webhook secret is server-only. Production accounts still require application-level approval even after Clerk verifies the identity.

### Neon

Use a pooled/serverless-compatible production connection string. Migrations must be applied before a deployment that requires the new schema is promoted.

Recommended branching:

- production branch for Production;
- long-lived development branch for local work;
- disposable branch per substantial Preview when schema behavior needs isolation.

### Vercel Blob

Use separate public and private stores/tokens. Do not expose either write token to the browser. The application issues purpose-specific upload authorization and stores metadata in Neon.

### Resend

Verify the sending domain used by `INQUIRY_FROM_EMAIL`. Keep `admin@210robotics.com` able to receive administrative notifications and replies. If Resend is unavailable, inquiries remain stored and delivery records show the pending/failed state.

### Stripe

Set the webhook endpoint to:

```text
https://210robotics.com/api/webhooks/stripe
```

Subscribe to the Checkout events handled by the route, including completed, expired, and asynchronous payment outcome events. Use test keys in Preview and live keys only in Production.

### Google Drive

Photo synchronization can read a public folder without credentials. Private documents, recordings, and reliable API synchronization require a service account with access only to the intended folders.

Prefer `GOOGLE_SERVICE_ACCOUNT_JSON` as a Vercel secret. The split email/private-key variables are supported as an alternative.

### Discord

The website hosts the Discord interaction endpoint:

```text
https://210robotics.com/api/discord/interactions
```

The production build runs the command-registration script when credentials are present. The separate voice worker must be deployed to an always-on Docker service with outbound HTTPS, WebSocket, and UDP support. See `workers/discord-voice/README.md`.

## Scheduled jobs

Vercel invokes these routes according to `vercel.json`:

| UTC schedule | Route | Purpose |
| --- | --- | --- |
| `0 11 * * *` | `/api/cron/sync-media` | Synchronize configured Drive media |
| `0 13 * * *` | `/api/cron/operations` | Reconcile and generate operational follow-ups |
| `30 12 * * *` | `/api/cron/discord` | Discord reminders and synchronization |

All cron routes require `Authorization: Bearer $CRON_SECRET`. Vercel supplies this header for configured cron invocations when the secret is configured.

## Release procedure

1. Review the change and database migration.
2. Install from the lockfile and run:

   ```powershell
   npm ci
   npm run check
   ```

3. Create a Vercel Preview from the release branch.
4. Apply migrations to the target Neon branch.
5. Smoke-test public navigation, authentication, portal authorization, uploads, forms, attendance, docs, email, and any changed integration.
6. Promote the tested artifact or merge the protected release branch to Production.
7. Confirm all configured aliases point to the Ready deployment.
8. Re-test `210robotics.com`, `beta.210robotics.com`, and `docs.210robotics.com`.
9. Inspect Vercel runtime logs for errors.
10. Retain the previous healthy deployment for rollback.

Do not deploy a separately rebuilt artifact after preview validation when promotion is available; promote the exact tested deployment.

## Rollback

For an application-only incident:

1. identify the last healthy Vercel deployment;
2. use Vercel Rollback or promote that deployment;
3. verify all aliases;
4. inspect logs and affected integrations.

For a schema incident, prefer a new forward migration. Do not roll back application code to a version that cannot operate against the current database schema.

## GitHub repository settings

Recommended:

- private visibility;
- `main` as the default branch;
- pull requests required before merge;
- required `CI` workflow;
- at least one approving officer/maintainer;
- conversation resolution required;
- force-push and branch deletion blocked on `main`;
- Dependabot and secret scanning enabled;
- Vercel Git integration installed only for this repository.

GitHub should contain source and migration files only. Runtime secrets belong to Vercel and provider dashboards.
