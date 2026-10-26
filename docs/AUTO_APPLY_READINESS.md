# 24/7 auto-apply readiness

## Current production boundary

Job-Pilot currently provides scheduled public job discovery, relevance/location filtering, duplicate suppression in a GitHub issue, an optional Resend digest, browser-local resume preparation, an application tracker, and a guided portal handoff. It does **not** submit applications unattended. A successful discovery or Playwright run must not be interpreted as proof that a job application was submitted.

## Blocking work before unattended submission

1. **Authenticated durable backend** — add per-user authentication, database-backed job/application records, encrypted provider credentials only where needed, audit logs, backups, and retention/deletion controls. Do not store job-board passwords or raw browser cookies.
2. **Private resume access** — move from browser-only master-resume files to explicit opt-in private storage, with access controls and a delete/export path. Do not send a resume to an employer until the user has selected and reviewed it.
3. **Verified candidate policy** — persist approved target titles, locations, work modes, salary floor, experience, sponsorship/work authorization answers, exclusions, and per-application limits. Never infer or invent answers to screening questions.
4. **Portal connector approval** — for each portal, record the current policy/terms URL, review date, authentication method, permitted operations, and whether programmatic submission is explicitly allowed. Prefer official APIs or documented partner integrations. Until approved, keep that portal in manual handoff mode.
5. **Human review / staged rollout** — default to preview-only; add an explicit per-portal enable switch and a test mode. For the initial rollout, require approval before final submission. Do not automate around CAPTCHA, MFA, access controls, anti-bot protections, or rate limits.
6. **Idempotent submission ledger** — use a stable user+job+portal key, unique database constraint, state machine (discovered → eligible → prepared → awaiting approval → submitting → submitted/failed/needs-human), and evidence for every transition. On timeout, verify the portal's application status before retrying.
7. **Reliable worker** — use a durable queue, leases/heartbeats, bounded concurrency, exponential backoff with jitter, per-portal rate limits, dead-letter handling, and a pause/kill switch. GitHub scheduled Actions can be delayed and are not a high-availability job queue.
8. **Observability** — alert on worker failures, expired credentials, feed outages, quota exhaustion, duplicate prevention, and uncertain submission outcomes. Keep an audit trail without logging resume contents, secrets, or session tokens.
9. **Production acceptance tests** — verify signup/sign-in/redirects, per-user data isolation, private resume access, one approved test portal from discovery through submission confirmation, duplicate retries, pause/resume, and email delivery. Test with a sandbox or employer-approved test listing before live rollout.

## Existing manual configuration checks

- GitHub repository secrets required for discovery digests: `RESEND_API_KEY`, `JOBPILOT_NOTIFY_EMAIL`, and `JOBPILOT_FROM_EMAIL`. Secret existence/value cannot be confirmed by reading repository source; inspect Actions logs for the notification outcome without printing secret values.
- Supabase Auth URL configuration must retain the existing project-wide Site URL if other apps depend on it. Add the Job-Pilot production URL and any needed preview/localhost URLs to the Redirect URLs allowlist. Test email confirmation and password recovery in a real browser.
- Verify the Vercel production deployment is Ready after each main-branch change and check its deployment logs.
- Use the canonical inbox at https://github.com/Rohit-Singh-1991/Job-pilot/issues/1.

## Definition of done for 24/7 auto-apply

Do not label the product "24/7 auto-apply ready" until all of the following are evidenced in production:

- A scheduled worker runs continuously enough for the agreed service level, with visible last-success time and a user-controlled pause switch.
- Eligible listings are sourced with provenance and filtered against saved candidate preferences.
- A reviewed resume version is selected for each application and all required answers come from user-verified facts.
- Only a documented, permitted connector can submit; human challenges and unsupported flows stop for manual action.
- Submission success is confirmed by portal evidence and persisted once; uncertain outcomes are reconciled before retry.
- Email notifications, failure alerts, per-user authorization, data deletion, rate limiting, and security review pass acceptance tests.

## Manual test available now

Open https://jobpilot-ai-topaz.vercel.app and test discovery for both career tracks, resume preparation/export, tracker updates, sign-in/sign-out and optional cloud sync. Treat portal submission as a manual handoff. The current app is not an unattended applicant.
