# JobPilot AI — desktop smoke-test checklist

Test in Chrome or Edge on the computer where you will use the tool. Use sample/test job data first. Do not send real applications while testing.

## Before starting
- [ ] Check the latest GitHub Actions run named **Playwright end-to-end checks**; it should be green before using the new changes.
- [ ] Open the live URL and confirm the dashboard fully renders without a blank page.
- [ ] Open DevTools → Console; note any red errors.
- [ ] Confirm the sidebar navigation opens Overview, Jobs, Resume studio, Applications, Recruiter outreach, Profile and Settings.
- [ ] Confirm status still says live portal submission is disabled; do not treat this as an error.
- [ ] In a new browser tab, open `/api/jobs?track=javaAngular` and `/api/jobs?track=leadAngular` on the live domain; each should return JSON. A `jobs: []` result can mean no recent source listings passed the track filter, not an app failure.

## Profile and local persistence
- [ ] Open Profile and verify name, email, phone, total/Java experience, locations, CTC and skills.
- [ ] Edit one harmless field, Save profile, refresh and confirm it remains.
- [ ] Confirm this is browser-local persistence, not server sync.

## Both master-resume tracks
- [ ] Resume Studio → choose Java + Angular Full Stack Developer; upload that master resume.
- [ ] Switch to Lead Angular Developer; upload the separate Lead Angular master resume.
- [ ] Refresh; confirm both filenames remain under the appropriate track.
- [ ] For searchable PDFs, check that extracted character count appears below each filename. If the file is scanned/image-only or shows no extracted text, the app will not OCR it; convert it to a searchable PDF before generation.
- [ ] Upload your own professional JPG/PNG/WebP photo; confirm filename is shown.
- [ ] Test file-size/type validation with an unsupported/large test file only if safe.

## Resume generation (test posting)
- [ ] Paste a sample job description and enter role, company and job URL.
- [ ] Select Java + Angular and Generate tailored resume.
- [ ] Open the downloaded HTML; check the portrait is at the top-left, contact details are correct, and role/skills match only verified facts.
- [ ] In Chrome/Edge, Print → Save as PDF; check page breaks, readability and the photo.
- [ ] Repeat for Lead Angular Developer with a different job description.
- [ ] Verify extracted sections and page order; complex multi-column PDFs may parse imperfectly.
- [ ] Check dates/employers/degree against the original master resume; report any discrepancy. Do not use a generated resume without that review.

## Recruiter-email draft
- [ ] Enter an email copied from the actual posting or company website (never test by guessing an address).
- [ ] Prepare recruiter email; verify recipient, subject, greeting, role, message and signature.
- [ ] Confirm a compose draft opens. Attach the relevant generated PDF manually.
- [ ] Close without sending a real message during the test.

## Job search and tracker
- [ ] In Job Discovery, select Java + Angular and click Discover remote jobs; confirm listing cards and source links appear when there are relevant jobs.
- [ ] Select Lead Angular and repeat. Jobicy may return no suitable Angular role in its recent feed; use the job-search links when there are zero matches.
- [ ] Check the listing location; remote does not always mean eligible from India. Follow the original post to confirm geography and whether applications are open.
- [ ] Click Tailor resume for this job and confirm Resume Studio receives the correct title, company, URL, description and career track.
- [ ] Confirm Jobicy attribution is visible and each job card opens the original source.
- [ ] Open LinkedIn Jobs, Indeed and Naukri search links; ensure query/location are sensible.
- [ ] Add a sample/test vacancy to the tracker with a follow-up date within 7 days.
- [ ] Refresh and confirm the record persists and the follow-up flag is sensible.
- [ ] Draft/copy a follow-up; check spelling, role and company.
- [ ] Remove the sample record after testing.

## Report back
Record the URL tested, browser/version, any console errors, whether the photo and downloads worked, and which steps failed. Do not share passwords, session cookies or authentication tokens.

## Known limitations to expect
- Automated Chromium checks run in GitHub Actions. Your actual master resumes, personal photo, browser storage and desktop print settings still need this manual check.
- Jobicy supplies a limited feed of recent remote listings (published within the last seven days); it is not a complete job market search, and geography must be checked. citeturn639519search0turn639519search1
- Master resume files are stored separately per track. Searchable PDFs are text-extracted locally; DOC/DOCX is not parsed and scanned PDFs need external OCR/searchable conversion.
- Recruiter email remains a draft: sender must attach the PDF and press Send.
- No automated job submission, durable server database, active background worker or 24/7 job scanner is enabled.
