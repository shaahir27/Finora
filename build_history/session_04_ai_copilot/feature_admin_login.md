---
feature_name: "Admin Login Page"
session: "Session 4 (hotfix)"
status: "completed"
type: "ux_feature"
---

# Feature Log: Admin Login Page

## Description
Adds a polished demo-mode admin login gate at `/admin/login`. This is a UI-level auth gate using `sessionStorage` with hardcoded demo credentials (`admin@school.edu` / `demo1234`). Real Supabase Auth for admins is a Session 6 scope item.

## Why This Session (Not Session 6)
The dashboard was completely unauthenticated — any visitor who knew the URL could access all admin data. A minimal login gate is necessary for the hackathon demo to feel credible, even before real auth is wired.

## Core Logic & Necessary Functions
- `apps/web/src/app/admin/login/page.tsx`: Login form with Forest Ledger glassmorphism design. On success, sets `sessionStorage["finora_admin_authed"] = "1"` and redirects to `/admin/dashboard`.
- `apps/web/src/app/admin/layout.tsx`: Updated to be a Client Component. Reads `sessionStorage` on mount; redirects to `/admin/login` if flag is absent. Shows a spinner while checking (prevents auth flash).
- `apps/web/src/app/page.tsx`: Root redirect changed from `/admin/dashboard` → `/admin/login`.
- Added "Sign out" button in sidebar footer (clears sessionStorage and redirects to login).
- Added "Reminders Queue" nav link to sidebar (was missing, `/admin/reminders` page now exists).

## Database Schema Impact
- None. Auth state is client-side only (sessionStorage). No new DB table.

## Notes for Session 6
- Replace `sessionStorage` flag with Supabase Auth session check (server-side).
- Replace hardcoded credentials with real email/password auth against the `USER` table.
- Move the auth check from `layout.tsx` to Next.js middleware for server-side protection.
