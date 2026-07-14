# 210 Robotics

Production website and member portal for 210 Robotics at UT San Antonio.

## Stack

- Next.js 16 App Router and TypeScript
- Clerk email/password authentication with manual member approval
- Neon Postgres and Drizzle ORM
- Vercel Blob media storage with Google Drive photo synchronization
- Resend transactional email

## Local setup

1. Copy `.env.example` to `.env.local` or pull the linked Vercel development environment.
2. Install dependencies with `npm install`.
3. Apply migrations with `npm run db:migrate`.
4. Run `npm run dev`.

There are no demo credentials or browser-only activity records. Authentication and portal features require the configured hosted services.

## Verification

Run `npm run check` before deployment. Production releases use a tested Vercel Preview artifact and promote that same artifact after migrations succeed.
