# Project Instructions — All AI Coding Agents

This file is auto-loaded by Cursor, Antigravity, and other tools that follow the AGENTS.md convention. (Claude Code specifically uses `CLAUDE.md` at this same root — same content, different tool.)

**Read `docs/AI_INSTRUCTIONS.md` in full before writing any code, every session, regardless of prior familiarity with this repo.** It is the master operating contract, not optional background reading.

## The five things to never forget, even under time pressure

1. **Never invent or rename** a database table, column, or API not in `docs/database_design.md` / `docs/api_specification.md`. Flag gaps, don't fill them silently.
2. **Six governing principles are non-negotiable** — full list in `docs/project_overview.md` "Governing Principles." Most commonly missed: AI never writes payment data, every override needs a logged reason, every OTP call needs `shouldCreateUser: false`.
3. **A session is not done** until its checkpoint in `docs/implementation_plan.md` passes, its tests in `docs/testing_strategy.md` pass, AND its feature logs exist in `build_history/`. All three.
4. **Log every feature you build** in `build_history/session_XX_.../feature_[name].md`, using `docs/templates/log_schema.md`, per `docs/BUILD_LOGGING_PROTOCOL.md`. Update `build_history/index.md` every time a log is created or changed.
5. **Automate Documentation:** Whenever you modify a function, update a file, or change the database schema, you MUST immediately open the corresponding `feature_[name].md` file in `build_history/` and update the "Core Logic & Necessary Functions" or "Database Schema Impact" sections. Do not wait until the end of the session.
6. **Check `docs/decision_log.md` before resolving any apparent contradiction** between documents yourself.

## Sanctioned cross-session touches

A handful of features legitimately span two sessions' files — expected, not a scope violation. Full list in `docs/AI_INSTRUCTIONS.md` Section 5.

## Which session am I building?

This file doesn't specify that — state your session number at the start of the conversation, or paste the matching block from `SESSION_PROMPTS.md`.
