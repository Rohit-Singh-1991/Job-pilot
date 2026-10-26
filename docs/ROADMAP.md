# Roadmap to production

## Current implementation (dashboard)

- Angular dashboard with prefilled, editable candidate profile.
- Browser-local profile and application tracker persistence.
- Two separately named master-resume slots (Java + Angular and Lead Angular).
- Local photo storage and HTML resume export with the photo placed top-left.
- A job-specific summary/skills emphasis based on supplied description and known resume facts.
- Client-side PDF.js text extraction for searchable PDF master resumes, saved by career track. Parsed section use is heuristic; scanned PDFs are not OCRed; DOC/DOCX text extraction is not implemented.
- Job-search links, plus a public Jobicy remote-feed endpoint and in-dashboard listing cards. The API was smoke-tested for both tracks, returns JSON, filters by track technology, deduplicates response entries and preserves source URLs. Results are recent remote listings only; geographic eligibility must be checked.
- From a discovered listing, copy the title, company, description and URL into that track's Resume Studio.
- Email draft preparation only in the dashboard; no automatic employer outreach or resume attachment.
- GitHub Actions hourly discovery worker; see [AUTOMATION_SETUP.md](AUTOMATION_SETUP.md). It scores both career tracks, filters named region restrictions and weak matches, and persists deduplicated public job listings in a GitHub issue inbox. Latest tests pass 8/8. The latest filtered scan returned zero candidates.
- Safe-mode default; live applications are disabled.

## Implemented in the repository but not production-integrated

- Spring Boot API baseline with health/connector/scoring endpoints and tests described in README.
- Java CI workflow.
- Optional Docker Compose definitions for PostgreSQL and Ollama.

The Java service is not part of the deployed Vercel Angular site and should be independently built/tested/deployed before the UI calls it.

## Still not implemented or not verified

- Live dashboard runtime and interaction coverage is automated in GitHub Actions with Playwright/Chromium; the latest run passed 70/70 checks, including the remote-feed APIs, parallel track search and empty-result handling. Desktop testing with the user's own resume/photo remains pending.
- Playwright verified searchable-PDF extraction for both career tracks, local photo embedding/top-left layout, and Chromium PDF printing with synthetic files. The user's real master resumes/photo and desktop print output still require manual verification.
- DOC/DOCX extraction, OCR for scanned PDFs, robust parsing validation, proper DOCX/PDF file generation, and complete resume versioning.
- True DOCX/PDF generation and preview tests; current export is HTML for printing to PDF.
- Separate editable profile/skill details persisted per track (master files are separate; shared candidate contact fields remain common).
- Authenticated user accounts, secure backend file storage, database migrations, backup and recovery.
- Broader job ingestion and a database are not implemented. The new hourly worker reads the combined Jobicy + Remote OK API feed, applies track-fit/location scoring and persists a limited 30-day deduplication state in a GitHub issue. Feed responses are cached hourly. It is not a durable queue or a complete job-source integration; no match is preferred to weak or location-ineligible roles.
- Durable queue, retry/backoff policy, user pause/stop controls and a full audit trail. A basic hourly GitHub Actions schedule is present; schedules can be delayed.
- Ollama connection/structured AI responses and factual verification.
- Recruiter contact discovery from verified public source URLs and approval-based email sending with attachments.
- Authorized portal connectors and portal-specific integration tests. Do not enable automatic submissions until terms/permissions are reviewed.
- Manual application-security and integration-permission review. The latest `npm audit` now reports 0 dependency vulnerabilities after patch-level Angular/build-tool updates; CI repeats the audit and E2E tests on pushes.
- End-to-end verification on desktop for both career tracks.

## Required production sequence

1. Confirm build and runtime render.
2. Test local browser persistence, photo upload, both master-resume slots, generated resume layout, print-to-PDF and email draft.
3. Add an authenticated backend and persistent database/file storage.
4. Expand the current hourly GitHub Actions discovery worker to additional allowed job feeds, verify source provenance and long-term deduplication, and migrate state from the issue marker to a durable database/queue.
5. Improve resume parsing/generation backed by verified facts; add mail integration with user approval and attachment handling.
6. Add approved portal connector(s), audit/security checks, retries and idempotency.
7. Run test-mode scenarios end-to-end; enable live submission only after explicit review and reliable confirmation evidence.

The dashboard Playwright E2E run previously passed 70/70 checks; strict worker tests now pass 8/8, Java CI passes, and npm audit previously reported 0 dependency vulnerabilities after patch-level updates. The current hourly workflow is a first stage of background discovery, not guaranteed 24/7 availability or an autonomous production application agent. Authenticated email sending remains unconfigured, and automatic resume tailoring/application submission remains disabled/not implemented.
