# Local development

## Prerequisites

- Node.js 24.x
- npm
- Git
- A Neon development database
- Clerk development instance

Optional integrations can be added incrementally. Do not use production credentials for routine local development.

## Setup

```powershell
git clone <repository-url>
Set-Location 210-robotics-website
Copy-Item .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Configure at minimum:

```text
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DATABASE_URL=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

Add `http://localhost:3000` to Clerk's allowed origins and redirect URLs. Create a development Clerk webhook only when webhook behavior is being tested; normal authenticated requests can create or relink the local member record.

## Environment strategy

Use separate resources or branches for local development, Vercel Preview, and Production:

- **Development:** local `.env.local`, Clerk test instance, Neon development branch
- **Preview:** Vercel Preview variables, Clerk test instance or approved preview origins, Neon preview branch
- **Production:** Vercel Production variables, production Clerk instance, production Neon branch

Never copy a production database URL, private key, bot token, webhook secret, or Blob token into source control.

The complete variable inventory is documented in `.env.example`. Variables with `NEXT_PUBLIC_` are sent to the browser; all others must remain server-only.

## Database changes

1. Edit `src/db/schema.ts`.
2. Generate a migration:

   ```powershell
   npm run db:generate
   ```

3. Inspect the generated SQL and snapshot.
4. Apply it to the development database:

   ```powershell
   npm run db:migrate
   ```

5. Test both the upgraded database and a clean migration path.
6. Commit the schema, SQL migration, snapshot, and journal together.

Never edit an already-applied migration. Create a new forward migration instead.

## Quality checks

Run the focused test while developing, then the complete gate:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Or:

```powershell
npm run check
```

End-to-end tests:

```powershell
npx playwright install chromium
npm run test:e2e
```

Temporary Clerk test users created by end-to-end tests must be deleted after validation.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/app` | App Router pages, Server Actions, route handlers, metadata |
| `src/components` | Interactive and presentational UI |
| `src/db` | Drizzle schema and lazy database client |
| `src/lib` | Authorization, integrations, domain logic, exports |
| `src/workers` | Application worker helpers |
| `workers/discord-voice` | Standalone persistent Discord voice service |
| `drizzle` | Committed database migrations |
| `public/media` | Bundled public brand and fallback media |
| `public/doxygen` | Generated code-reference site |
| `scripts` | Deployment and administrative scripts |
| `e2e` | Playwright tests |
| `.github/workflows` | GitHub CI |

## Next.js conventions

This project uses Next.js 16:

- request APIs such as `cookies`, `headers`, `params`, and `searchParams` are asynchronous;
- `src/proxy.ts` replaces legacy middleware;
- server-side authorization is repeated at the data operation;
- database and third-party clients must never initialize at module scope;
- Server Components are the default; client components are limited to interactive islands.

Read the version-matched documentation in `node_modules/next/dist/docs/` before changing framework-sensitive behavior.

## Content and uploads

Existing bundled/static URLs are retained as fallbacks. New admin edits are stored in Neon and uploaded media is stored in Blob, allowing content changes without redeployment.

Upload routes validate:

- authenticated user and purpose-specific permission;
- content type and decoded media;
- file-size limits;
- ownership and database references before replacement cleanup.

Do not place user uploads in `public/`.

## Doxygen updates

`public/doxygen` is generated documentation. When replacing it:

1. regenerate the Doxygen HTML from the source repository;
2. preserve the 210 Robotics wrapper and return links;
3. run an internal link audit;
4. verify `/doxygen/index.html` on the docs hostname;
5. avoid committing temporary render or crawl files outside the final generated tree.

## Discord voice worker

The voice worker is a separate process. For local testing:

```powershell
npm run discord:voice-worker
```

It requires a Discord bot token, the shared worker secret, and the local website URL. Use a test server and test bot rather than production Discord credentials.
