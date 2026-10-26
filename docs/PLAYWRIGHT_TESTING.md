# Playwright end-to-end verification

This repository uses the free, open-source Playwright framework with Chromium on GitHub Actions. It replaces metered TinyFish browser automation for repeatable JobPilot workflow tests; the app and tests do not use TinyFish.

The workflow runs on pushes and pull requests to `main` and can be started manually under **Playwright end-to-end checks → Run workflow**.

## Coverage

- Live Vercel dashboard and safe-mode banner.
- Both job-feed API tracks, JSON schema, job URL validation, unknown-track rejection and HTTP method rejection.
- Parallel job discovery and discovered-job-to-Resume-Studio handoff.
- Independent Java + Angular and Lead Angular job drafts and master-resume files.
- Browser-local searchable-PDF extraction, photo embedding/top-left layout, generated HTML rendering and Chromium Print-to-PDF.
- Recruiter email validation and compose URL/body construction, without sending.
- Naukri-first Portal Assistant: rejects URLs from the wrong domain, saves a valid Naukri listing as `Saved` (never `Applied`), and removes the synthetic tracker fixture.
- Profile and tracker persistence after reload.
- Required tracker fields, unsafe URLs, duplicate vacancies, follow-up dates, final-status handling, follow-up draft greeting and deletion.
- Browser console errors and unhandled runtime errors.

## Safety and limitations

Tests use synthetic PDFs, a generated one-pixel photo and `example.com` addresses; they never use the user's local resume, photo or mail account, and never submit an application or email. Failure screenshots use synthetic records only and expire after three days.

Playwright and Chromium are installed only on the CI runner with `npm install --no-save`; they are not production dependencies. GitHub Actions is subject to the repository/account's included runner quota.

The Jobicy feed changes over time and may return zero suitable Lead Angular listings. Tests check schema and empty-result handling rather than requiring a positive count. A passing suite is not sufficient to enable an autonomous agent: secure backend storage, a durable worker/scheduler, approved portal integrations, explicit mail-send permissions, security remediation and application confirmation handling remain future work.


## Latest verified run

On 2026-10-16, the live Playwright suite passed **70/70 checks** on GitHub Actions: [run 38840366819](https://github.com/Rohit-Singh-1991/TheInterviewMate/actions/runs/38840366819). Java CI also passed. The patched dependency set returned **0 vulnerabilities** from `npm audit` in that run. This verifies synthetic browser flows and does not replace manual review of the user's real resume/photo, desktop PDF output, or a separate application-security review.
