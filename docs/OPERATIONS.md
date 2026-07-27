# Operations runbook

## Daily ownership

Designated super administrators should own:

- account approvals and permission reviews;
- failed inquiry/email delivery follow-up;
- attendance and activity corrections;
- media synchronization health;
- scheduled-job and integration alerts;
- database, Blob, Clerk, Stripe, Discord, and Vercel access reviews.

## Account lifecycle

### Approve a member

1. Confirm the person's identity and organization membership.
2. Open the pending accounts panel.
3. Set display name, organization role, program/team, public visibility, and access preset.
4. Review permission overrides; grant only what the person needs.
5. Approve the account.
6. Confirm the member can reach `/portal` and appears publicly only if explicitly marked public.

### Suspend or restore

Suspension blocks active-member access and removes the account from public member queries. Restoration returns the member to active status without erasing audit history.

### Elevated access

Review officers, directors, leads, mentors, and administrative overrides at least once per semester. Only a super administrator should grant ownership-level access or access-management authority.

## Content publishing

Public pages preserve their layout while editable text and image slots are stored in Neon. Before publishing:

- preview text and image changes;
- verify mobile crops and image alt text;
- check links;
- confirm no private contact, finance, attendance, or permission data is exposed.

Archived roster, sponsor, news, and media records retain history and can be restored when supported.

## Attendance and meetings

- Create an activity using the appropriate category: Event, Workshop, Meeting, Outreach, or Training.
- Add the event description and notes; the shared calendar remains the schedule source.
- Generate the signed QR code and print or download it as needed.
- Members and mentors can scan inside the portal or open the fallback link, authenticate, and check in.
- Review duplicate, late, or corrected attendance in the admin activity log.
- Member profiles show attendance counts by category and total recorded hours.

Attendance tokens must remain unguessable and time/event scoped. Rotate `ATTENDANCE_TOKEN_SECRET` if signed links may have been exposed.

## Forms and availability polls

- Forms are unlisted and accessed through their generated link or QR code.
- Anonymous submissions require name and email.
- Signed-in submissions are tied to the member automatically.
- Matching anonymous email addresses can be linked to active accounts.
- File uploads follow purpose, type, and size restrictions.
- Availability polls support anonymous/signed-in submissions and an aggregate orange heatmap.

Before deleting a form, export or record required response data. Respect the organization's data-retention policy.

## Media and Drive synchronization

The scheduled sync runs daily. Admins can request an immediate refresh.

If refresh fails:

1. confirm the folder still exists and is shared with the configured service account or publicly readable;
2. verify the folder ID;
3. inspect `/api/cron/sync-media` logs;
4. check Blob quota and Neon connectivity;
5. retry after correcting access.

Profile, roster, sponsor, and post-cover uploads must not appear automatically in the gallery. Gallery deletion creates a deletion marker so Drive refresh does not immediately re-import intentionally removed items.

## Inquiry and email delivery

Every inquiry is stored before email delivery.

If email is missing:

1. confirm the inquiry exists in the admin inbox;
2. inspect its delivery records;
3. verify the Resend API key, sending-domain status, and from-address;
4. check provider logs and Vercel logs;
5. follow up manually from `admin@210robotics.com` when necessary.

Never delete an inquiry solely to hide a delivery failure; retain the operational record until the issue is resolved.

## Database operations

- Apply only committed migrations.
- Take or verify a Neon restore point/branch before high-risk migrations.
- Use a forward migration to repair production.
- Never edit production rows directly unless the admin UI cannot perform the correction and the change is documented.
- Export required audit/finance data before destructive retention operations.

## Deployment incident

1. Check Vercel deployment status and runtime logs.
2. Determine whether the issue is application, provider, DNS, environment, or database related.
3. If application-only, roll back to the last healthy deployment.
4. If provider-specific, disable or isolate the affected optional integration while keeping core member/public functions available.
5. Re-test authentication, database reads, uploads, and the affected route.
6. Document the incident and remediation.

## Integration-specific checks

### Clerk

- verify allowed origins and redirects;
- verify webhook delivery;
- confirm account relinking by email;
- ensure a regular member cannot open admin routes.

### Stripe

- check Checkout session and webhook logs;
- confirm a paid donation appears once in both donation and finance views;
- never manually mark a payment paid without provider evidence.

### Discord

- check interaction endpoint validity and bot permissions;
- verify the scheduled reminder job;
- check the voice worker `/health` endpoint;
- keep a single voice-worker replica;
- rotate the bot token and shared secret together after exposure.

### Docs

- verify `docs.210robotics.com` opens the wiki;
- verify main navigation links return to `210robotics.com`;
- verify `/doxygen/index.html` loads its styles and linked pages.

## Backup and retention

At minimum:

- use Neon recovery/branching features appropriate to the plan;
- retain the previous healthy Vercel deployment;
- retain original Drive documents and media;
- retain audit history for administrative changes;
- periodically export critical finance, attendance, member, and engineering records.

Do not store database exports in GitHub.
