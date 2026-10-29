# Development notes

## Draft flow

Profiles, company records and drafts live in browser local storage. Selecting a lead loads an editable copy into the workspace. Research requests go through `/api/research`; the browser does not call company pages directly.

The research server checks URLs, DNS results, redirects, response type and size before extracting text with Cheerio. This avoids several obvious unsafe URLs, but it is not a hardened public crawler. Failed extraction has a manual excerpt fallback.

`createGuidedDraft` combines the profile and company record. A selected company detail is used only when it occurs in the saved source text. `checkDraft` returns required fixes and wording suggestions. Required fixes block approval; suggestions leave the decision to the reviewer. Source and role reviews expire after 30 days.

## Gmail flow

The server creates an OAuth URL with state and PKCE. The callback verifies state and the connected email before holding tokens in memory. Client credentials come from the ignored `.env` file.

`POST /api/gmail/draft` accepts the reviewed text, recipient and PDF. The server validates input and the PDF signature, builds a MIME message and calls `users.drafts.create`. It exposes no send route.

The local draft index fingerprints the account and request content to reuse an identical completed request. A crash between Gmail saving the message and the index being written can still leave an uncertain result. Check Gmail manually before retrying such a request.

## Design decisions

- Local storage keeps setup small for the first single-user version. Backups compensate for browser data being easy to clear.
- A template makes candidate claims easy to inspect. Adding an LLM should preserve evidence checks and approval.
- Company and job URLs are separate because a company's existence does not establish a vacancy.
- The application email is optional until approval; some listings accept only an application form.
- Copy checks report specific issues instead of an invented deliverability score.

## Next changes

Complete the live OAuth test first. Then review copy quality across more leads, improve job-requirement extraction and split `App.tsx` as the screens grow. Multi-user hosting needs a separate plan for authentication, persistence and token storage.
