---
feature_name: "Email Reminders via Resend"
session: "Session 6"
status: "completed"
---

## What was built
- Added `resend` dependency to the web app.
- Modified `markReminderSent` in `apps/web/src/app/actions/reminders.ts` to actually send an email using Resend if `channel === 'email'`.
- Fallbacks to `status: failed` with `dispatchError: 'no email on file'` if the parent has no email address.
- Maintains `simulated_sent` for WhatsApp and SMS channels.

## Governing Principles enforced
- **Principle 3 (No real WhatsApp/SMS)**: WhatsApp/SMS still strictly result in `simulated_sent` with no external API calls made. Only email actually fires a dispatch.

## Database Schema Impact
- **Modified**: Uses `dispatchError` field on `REMINDER_LOG` to track failed sends or missing emails.

## Core Logic & Necessary Functions
- `markReminderSent` parses the student's guardian links to find an email address, dispatches via Resend, and updates the `REMINDER_LOG` status accordingly (`sent` or `failed`).
