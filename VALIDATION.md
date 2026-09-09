# Phase 1 validation

Validated on Windows with Bun 1.3.4 using the repository's frozen lockfile.

- Core, API and web TypeScript checks passed.
- Vite production build passed. Vite reports an existing large-bundle advisory; it does not prevent deployment.
- 4 new UI interaction tests passed: account-scoped action completion, quarantine restore, topic summary display, and draft-only requests.
- 4 new analysis/policy tests passed: legacy priority compatibility, impossible/unknown deadlines, category validation, and default send rejection before any Gmail access.
- 7 existing triage prompt tests passed.
- 23 migration snapshot consistency checks passed.
- Temporary PGlite database: all 14 migrations executed successfully. Verified category constraints, message foreign keys, account isolation, quarantine restore, manual override retention, persisted draft text, unchanged message archive/trash state, and actual list/update service queries. PGlite was installed only in the external test workspace, not added as a product dependency.
- New service and UI files passed the repository's lint rules.

Not exercised: a Docker engine was not available in the development environment, so the full Docker stack was not started. Live Google OAuth, Gmail sync and provider calls require the user's credentials and were not executed. PGlite validation is not a substitute for testing the complete PostgreSQL 16 deployment. The upstream full test suite was not run.

See LOCAL_SETUP.md for startup and credential setup. No credentials or personal emails are included in the repository.

## Local workbench follow-up

Added a persistent PGlite driver, loopback-only local web proxy, browser-based Google setup, and start/stop launchers. Core, API and local web server TypeScript checks passed. Node launcher syntax passed. Full launch was attempted but blocked by the current execution permission policy while building the web page; no claim of successful full launch or Gmail connection is made. Added localDb.test.ts for migration/reopen persistence; it has not been run in this restricted turn.
