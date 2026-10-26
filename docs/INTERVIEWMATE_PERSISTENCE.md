# InterviewMate persistence and notifications

## Database provisioned

The connected Supabase project has an InterviewMate-specific set of tables and a private Storage bucket. These objects are separate from DigiCreators tables:

- `interviewmate_profiles`: candidate profile and track preferences.
- `interviewmate_resume_assets`: metadata for master/tailored resume and photo objects.
- `interviewmate-private` Storage bucket: private files; each authenticated user is restricted to objects under their own user-ID folder.
- `interviewmate_jobs`: normalized public job listings by track and source.
- `interviewmate_saved_jobs`: per-user saved-job status.
- `interviewmate_applications`: per-user application tracker and follow-up details.
- `interviewmate_notification_preferences`: per-user email preference settings.

Row Level Security is enabled on all six tables. Authenticated users can read public listing data and access only their own profile, resume metadata, saved jobs, applications, and notification preferences. No service-role key belongs in the Angular client.

## Current integration boundary

Provisioning the database does not by itself migrate existing browser-local data. The dashboard still uses browser-local storage for the current profile, resume files, and tracker until Supabase Auth and the persistence service are integrated and tested. Existing local data should not be deleted or silently overwritten during migration.

Recommended migration sequence:
1. Add Supabase Auth and a user-visible sign-in flow.
2. On opt-in, migrate profile and tracker records for the signed-in user.
3. Upload resume/photo files to the private bucket using `<auth.uid()>/<track>/<filename>` paths and store only object metadata in `interviewmate_resume_assets`.
4. Keep PDF/DOCX text extraction local by default; only persist extracted resume text after clear user consent.
5. Import job listings server-side using a backend secret or trusted worker, never a browser service-role key.
6. Add integration tests for row isolation between two synthetic users before enabling the database path in production.

## Resend email digests

The existing GitHub Actions discovery workflow already contains a Resend API call, gated on three repository secrets:

- `RESEND_API_KEY`: a Resend API key with email-sending access.
- `JOBPILOT_NOTIFY_EMAIL`: destination address for InterviewMate job alerts.
- `JOBPILOT_FROM_EMAIL`: a verified sender on the verified `digicreators.shop` domain, for example `InterviewMate <admin@digicreators.shop>`.

Configure these in GitHub repository **Settings → Secrets and variables → Actions → New repository secret**. Never commit or paste the API key into source control or a chat. The workflow sends only when new matches are saved; it does not email employers or submit applications.

## Verification

After adding secrets, use **Actions → InterviewMate hourly job discovery → Run workflow**. Confirm the run succeeds, the inbox issue is updated, and a new-match notification is received when the run has at least one new eligible match. A zero-match run is valid and should not send an empty digest.

The Settings tab now contains opt-in Supabase email/password sign-in plus explicit Upload and Import actions for profile and tracker records. This change is under test and is not considered complete until the Playwright build passes and a test account verifies RLS-backed round trips. Resume/photo files remain in browser IndexedDB in this iteration; no files are uploaded automatically.
