# Portal compliance register

Re-check each portal's current terms and approved API permissions before enabling a connector. This is an engineering policy, not legal advice.

| Portal | Default | Safe initial route |
|---|---|---|
| LinkedIn | MANUAL_HANDOFF | Authorized integrations, alerts, user-provided links and manual submission; no website scraping or automated activity |
| Naukri | NOT_CONFIGURED | User-provided links/alerts until current terms and permissions are verified |
| Indeed | NOT_CONFIGURED | Approved APIs/feeds and user-provided links |
| Foundit | NOT_CONFIGURED | User-provided links/alerts |
| Instahyre | NOT_CONFIGURED | User-provided links/alerts |

Every connector must document policy source URL, review date, authentication method and permitted operations. Submission defaults to false. Never bypass CAPTCHA, MFA, access controls, rate limits or anti-bot protections. Never use stealth or proxy rotation to evade restrictions. Stop on unexpected required fields. Verify evidence before retrying uncertain submissions. Never store portal passwords or commit cookies/session state.

## Recruiter contacts
Store only explicitly published professional contact details with source URL and context. Never guess email patterns or scrape behind access controls. Draft relevant one-to-one outreach; require approval before sending, avoid duplicate messages and honor opt-outs.
