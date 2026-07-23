---
feature_name: "Reminders Queue Action"
session: "Session 4"
status: "completed"
type: "core_feature"
---

# Feature Log: Reminders Queue Actions

## Description
Provides the backend logic for reading and updating the status of drafted AI reminders. Enforces Governing Principle 3: no delivery without an explicit "mark sent" action.

## Core Logic & Necessary Functions
- `apps/web/src/app/actions/reminders.ts` -> `getRemindersQueue`: Joins `ReminderLog` with `FeeAssignment` and `Student` for school-scoped reads. Computes `isStale` dynamically based on current remaining balance.
- `apps/web/src/app/actions/reminders.ts` -> `markReminderSent`: Explicitly transitions a reminder's status from `logged` to `simulated_sent`. This is the only function allowed to flip status.

## Database Schema Impact
- Interacts with the `ReminderLog` table added in this session.

## Testing & Verification
- Validated server-side logic visually by checking that `isStale` derives from the latest transaction records.
