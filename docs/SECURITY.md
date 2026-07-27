# Security

## Reporting

Report suspected vulnerabilities or credential exposure privately to `admin@210robotics.com`. Do not open a public GitHub issue containing exploit details, personal data, tokens, or screenshots of private portal content.

## Trust boundaries

- Clerk authenticates identities.
- Neon member records determine approval state and organization access.
- The application computes effective permissions from role presets and explicit overrides.
- Server Components, Server Actions, route handlers, uploads, exports, and database operations enforce authorization independently.
- `src/proxy.ts` controls routing but is not treated as the only security boundary.

## Account model

New accounts default to `PENDING`. Only `ACTIVE` accounts can use member tools. Suspended accounts are blocked and excluded from public member queries.

Explicit permission denials override both role presets and explicit allows. Access-management authority is reserved for the super administrator. Administrators must not grant capabilities they do not possess.

Clerk owns password, SSO, verification, session, and reset security. The application never stores passwords.

## Public-data policy

Public member pages may show only approved profile fields such as:

- display name;
- organization role;
- program/team;
- biography and photo when enabled.

Never expose member email, permission set, security role, private hours/contributions, attendance details, internal documents, finance records, or inquiry contents on public routes.

## Secret handling

Secrets belong in Vercel/provider environment settings:

- database URLs;
- Clerk, Stripe, Resend, Discord, Google, Blob, GitHub, and AI tokens;
- service-account JSON/private keys;
- cron, attendance, fingerprint, and worker signing secrets.

Rules:

1. never commit `.env.local` or provider exports;
2. never paste secrets into issues, pull requests, logs, screenshots, or documentation;
3. expose only variables explicitly prefixed `NEXT_PUBLIC_`;
4. rotate a credential immediately after suspected exposure;
5. use separate test and production credentials;
6. scope service accounts and bot permissions to the minimum required resources.

GitHub secret scanning and push protection should be enabled. The repository should remain private unless an explicit public-release review is completed.

## Signed endpoints

- Clerk and Stripe webhooks verify provider signatures.
- Vercel cron routes require the configured bearer secret.
- Attendance links use a dedicated signing secret.
- Voice-worker completion requests use a shared worker secret.
- Public form abuse controls use non-reversible fingerprints and rate limits.

Do not reuse one secret for multiple purposes.

## Upload security

Uploads require purpose-specific authorization and server validation. Validate decoded content rather than trusting file extensions. Private files are downloaded through authorized routes; public Blob URLs must contain only intended public media.

When replacing or deleting Blob content:

- remove it only after confirming no database record still references it;
- never delete Drive-synchronized or bundled assets through Blob cleanup;
- preserve audit history for administrative changes.

## Dependency and release security

- Keep Next.js and React on security-patched versions.
- Review Dependabot alerts.
- Run lint, type checks, unit tests, integration tests, and a production build before release.
- Protect the default branch and require CI.
- Keep the last healthy production deployment available for rollback.
- Apply database migrations before promoting code that depends on them.

## Incident response

For credential exposure:

1. revoke and rotate the affected secret at the provider;
2. update Vercel environment variables and the separate voice worker if applicable;
3. redeploy;
4. review provider, Vercel, audit, and database logs;
5. invalidate sessions or signed links when applicable;
6. document affected data and required notifications.

For unauthorized account access:

1. suspend the member record;
2. revoke Clerk sessions;
3. review audit events, uploads, exports, and permission changes;
4. restore correct roles/overrides;
5. rotate affected credentials.
