# InterviewMate — AI Job Search Agent

> **Repository consolidation (26 Oct 2026):** `Rohit-Singh-1991/Job-pilot` is the canonical repository. The tracked `main` trees of Job-Pilot and the former InterviewMate repository were identical; InterviewMate-specific discovery, tests, and persistence setup work has been consolidated here. Continue all code changes in Job-Pilot. The app currently implements job discovery, resume preparation, application tracking, and guided portal handoff; it is not yet an autonomous application submitter or a separate live interview-practice platform.

InterviewMate is a Vercel-hosted Angular dashboard plus a GitHub Actions hourly job-discovery worker. **It is not yet a fully autonomous job-application agent.** Scheduled discovery is implemented; resume tailoring, recruiter outreach and live portal submission are not automated.

## Current dashboard features

- Candidate profile defaults populated from the resume and details supplied by the user; editable in the UI.
- Two separately stored master-resume slots: **Java + Angular Full Stack Developer** and **Lead Angular Developer**.
- Local browser storage for profile, tracker records, two master-resume files and a personal photo. None of these files/profile records are sent to a backend.
- Resume Studio creates an editable, self-contained HTML resume using verified profile facts, role-specific skills/summary and a **photo at the top-left**. Open the HTML in Chrome/Edge and Print → Save as PDF.
- The user can paste a job description, company, URL and verified recruiter email to prepare a targeted resume and a recruiter-email draft.
- Optional AI resume tailoring uses Ollama on the user's own computer. It does not send resumes to a paid cloud AI API; AI-selected skills are checked against the supplied profile/master resume, and every generated claim still requires review.
- Searchable PDF text is extracted client-side using PDF.js, and DOCX text is extracted locally using fflate and the DOCX XML document. Extracted text and master files are saved in browser-local IndexedDB for each career track. Heading-based sections can be reused in the generated resume. Scanned image-only PDFs may yield no text; no OCR is provided.
- Integrated Job Discovery combines the public Jobicy feed with Remote OK's public feed through a Vercel serverless endpoint. It filters by career track, excludes trainee/junior titles, rejects explicit non-India-only location restrictions, returns the original listing URL, credits the source and ranks results. The feeds cover only part of the market; confirm eligibility and hiring status on each original post. LinkedIn/Indeed/Naukri search links remain available for Delhi-NCR and hybrid roles.
- Application tracker, follow-up drafts and browser-local persistence.
- **Naukri-first Portal Assistant** with a prioritized handoff queue (Naukri → LinkedIn → Indeed → InstaHyre): opens role/location searches, validates pasted job URLs against the selected portal, prepares a Resume Studio handoff, and saves vacancies as `Saved` rather than `Applied`. Login, OTP/MFA, CAPTCHA, screening answers and the final submission remain user-controlled; no passwords or portal cookies are collected.
- A discovered listing can prefill the selected track's Resume Studio; a saved listing is marked `Saved`, never `Applied`.

## Important resume limitations

The two master files are stored separately. The current frontend extracts text locally from searchable PDFs and DOCX files. Legacy DOC files and scanned image-only PDFs need conversion to DOCX or a searchable PDF. No resume is uploaded to a remote server. Resume parsing is heuristic by section headings and the generated content must be checked against the master resume. Verify every date, role and skill against the relevant master resume before sending. Upload a photo in Resume Studio to place it at the top-left.

The app opens an email draft but does **not** send email automatically or attach the generated file for you. Check the recipient source, attach the PDF, read the message, then press Send yourself.


## Optional local AI resume tailoring

1. Install Ollama from https://ollama.com/download and run `ollama pull qwen2.5:3b`.
2. In Windows user environment variables, set `OLLAMA_ORIGINS` to include every app origin you use. For the current deployments, a combined value is:
   ```text
   https://jobpilot-ai-topaz.vercel.app,https://interviewmate-three.vercel.app,https://parrotassist-newdivide4-8630.vercel.app,http://localhost:4200,http://127.0.0.1:4200
   ```
   Preserve any other origins you already need; do not replace them with just one app's URL.
3. Fully quit Ollama from the system tray and restart it. In InterviewMate → Settings, click **Check local Ollama**. Chrome may also ask for local-network permission.
4. In Resume Studio, fill the job description and choose **Generate AI-tailored resume (Ollama)**. The request is sent only to your local Ollama endpoint. If the connection fails, use the standard resume generator or fix the local-origin setting.

Keep Ollama bound to localhost and never expose port 11434 to the public internet. The AI-generated resume is a draft; verify all claims before using it. This does not submit applications automatically.

## Portal assistant status

The first portal milestone is a **guided Naukri workflow**, not autonomous form submission. It helps find the original listing, validates the Naukri URL, records the vacancy without falsely marking it applied, and hands the role details to Resume Studio. LinkedIn, Indeed and InstaHyre are queued in that order. Direct application-form filling will be added only after the live form structure, user-authorized session handling, and submission confirmation can be tested safely. Do not share passwords or session cookies; complete login challenges and the final Apply/Submit action yourself.

## Backend and deployment

- Vercel production deployment: https://jobpilot-ai-topaz.vercel.app. The latest source commit's Vercel deployment is READY; the previously validated dashboard Playwright suite passed **70/70 checks** on 2026-10-16. The current strict worker tests pass **8/8**; current feed scan has no matches after rejecting weak or region-restricted results. See [the latest job-discovery run](https://github.com/Rohit-Singh-1991/InterviewMate/actions/runs/38845996314) and [the inbox](https://github.com/Rohit-Singh-1991/InterviewMate/issues/1).
- Angular dashboard deploys from `src/main.ts` and `src/styles.css`.
- The Java 21 / Spring Boot 3.5 service in the repository is a separate service; Vercel's current Angular deployment does not run that Java process.
- An hourly GitHub Actions workflow now fetches the two InterviewMate feed endpoints, applies track-fit and location filters, stores public listing IDs/timestamps in a GitHub issue inbox, and avoids repeats across runs. This is scheduled discovery, not a guarantee of 24/7 uptime; scans may be delayed and the feeds are limited public sources and do not cover every portal. Optional email digests are supported but not configured until the three Resend-related repository secrets are added.
- PostgreSQL, a durable job queue, server-side resume storage, OAuth/email credentials and authorized portal connectors are not configured. The separate Spring Boot service is not integrated into this dashboard.
- Vercel environment-variable check reported no project variables configured.
- Angular and build-tool dependencies were updated to audit-recommended patch releases. On 2026-10-16, CI's `npm audit` reported **0 dependency vulnerabilities**. This is the dependency audit result; a separate manual application-security review and permitted-integration review are still required.

## Is it 24/7?

Job discovery now runs hourly via GitHub Actions (subject to GitHub scheduling delays) and writes new matches to the [InterviewMate automated inbox](https://github.com/Rohit-Singh-1991/InterviewMate/issues/1). The dashboard itself still does not run continuously, and no applications are submitted. Master resumes and the photo remain in browser-local storage, so the worker cannot see them to tailor resumes. A complete agent still needs authenticated private storage, resume-generation in the backend, email setup, durable application history/retries, and authorized portal-specific submission integrations.

## Safety

- Portal submissions remain disabled; the worker does not apply for jobs or contact employers.
- The initial worker run surfaced two incorrect overseas matches; those results were retracted, and matching/location filters were tightened. The current scan returned zero candidates. Prefer no match over an irrelevant or ineligible match.
- Never bypass CAPTCHA, MFA, access controls, rate limits or portal restrictions.
- Never guess recruiter emails or send mass/duplicate outreach.
- Every tailored resume and draft email must be reviewed before use.

## Automated and desktop verification

Free Playwright + Chromium end-to-end checks run in GitHub Actions using synthetic test data. See [Playwright testing documentation](docs/PLAYWRIGHT_TESTING.md). Coverage includes both career tracks, API validation, PDF extraction, top-left photo layout, PDF printing, email drafts and tracker edge cases.

## Desktop verification

Use [the desktop test checklist](docs/DESKTOP_TEST_CHECKLIST.md) to test both tracks in Chrome or Edge using your real master resumes and professional photo. Headless Chromium has verified the live UI and a synthetic resume-to-PDF flow, but it cannot validate the exact section layout of your real resume or your desktop print settings.
