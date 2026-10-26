# JobPilot scheduled discovery

The `JobPilot hourly job discovery` workflow runs on GitHub Actions at minute 17 of every UTC hour and can also be started manually from **GitHub → Actions**. It is separate from the Angular dashboard runtime and uses the existing deployed `/api/jobs` endpoints for both career tracks.

## What it does

- Fetches recent remote-job listings for Java + Angular Full Stack and Lead Angular.
- Scores listings against each track, filters old listings (30 days where the feed supplies a publication date), and verifies links are HTTP(S).
- Posts up to five new matches per track per scan to the **JobPilot AI — Automated Job Inbox & Scan State** GitHub issue.
- Stores only public listing IDs and first-seen timestamps in a hidden marker in that issue to deduplicate runs. It does not store candidate resumes, profile data, passwords, browser cookies or portal credentials.
- Optionally sends a plain-text email digest through Resend when all three GitHub Actions secrets are configured.

## Optional email setup

In **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**, add:

- `RESEND_API_KEY`: a Resend API key allowed to send email.
- `JOBPILOT_NOTIFY_EMAIL`: the inbox where new-job digests should arrive.
- `JOBPILOT_FROM_EMAIL`: a sender address/domain already verified with Resend.

If these secrets are absent, discovery still runs and stores new matches in the GitHub issue inbox; email notifications are skipped. Do not put secrets in source code, issue comments, the dashboard or chat. The first scan can create a backlog, delivered up to five matches per track per hour.

## Important boundaries

This is the first unattended discovery stage, not a complete autonomous application agent. The current data sources are Jobicy and Remote OK through JobPilot. It cannot see the two master resumes stored in a user's browser, so it cannot tailor a private resume in a background run yet. No application is submitted and no employer is contacted automatically. A secure authenticated backend and private file storage are required before scheduled resume tailoring; approved portal-specific integrations and permission/terms review are required before any automatic submission. Never automate around CAPTCHA, MFA, access controls, or job-board restrictions.

GitHub scheduled workflows can be delayed, and GitHub automatically disables scheduled workflows in public repositories after 60 days with no repository activity. Therefore the workflow is an inexpensive hourly worker, not a high-availability guarantee.
