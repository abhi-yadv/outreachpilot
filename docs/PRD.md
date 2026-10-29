# OutreachPilot — product requirements

## Objective

For each lead supplied by the user, produce one researched, concise internship outreach email. The company URL is enough to start; an application email is required only to save the approved message as an unsent Gmail draft. The user decides when to send it from Gmail.

## User story

As a student seeking a technical internship, I want to enter a company URL, see a useful summary of what that company actually does, connect one of its relevant facts to my verified experience, and save an editable local draft even when I do not yet have an application email. Once I have a verified address, I can save the approved email to my own Gmail Drafts without automatic sending.

## Functional requirements

| Area | Requirement | Acceptance |
| --- | --- | --- |
| Lead | Company name, main URL, optional application email and contact name | No email address is guessed; invalid addresses are flagged; missing address does not block local research or drafting |
| Opportunity | Listed role or open internship inquiry | Listed role requires title, listing URL and recent manual listing check; open inquiry does not claim a vacancy |
| Research | Read company page and optionally a job page into excerpts | User can edit the excerpt and fact; source review expires after 30 days |
| Personalization | Use one exact source fact and one user-entered fit statement | Missing/unsupported source fact blocks approval |
| Draft | Short subject and plain-text body, fully editable | Subject, body, recipient and sender are visible before Gmail save |
| Review | Warnings for generic/pressure language, placeholders and misleading subject prefixes | Critical issues block approval; warnings explain their limits |
| Gmail | Verified recipient, OAuth connection to the expected account and required PDF CV | `drafts.create` saves an unsent draft; no send endpoint exists |
| Tracker | Researching, Drafted, Reviewed, Sent, Replied | User changes status manually; app never infers sent state |
| Backup | Download and restore a versioned local workspace file | Restore requires an explicit second click after record counts are shown |
| Duplicate guard | Reuse an identical Gmail draft request | Index survives a local server restart; uncertain failures require a Gmail check |

## Core sequence

`Profile → choose listed role or open inquiry → company research → optional posting check → source fact review → draft → writing review → approval → Gmail draft → manual send in Gmail`

## Non-goals for this local release

Bulk sending, contact scraping, deliverability guarantees, automatic follow-ups, persistent multi-user accounts and an autonomous AI agent. The deterministic draft can be edited to sound like the user. A model-generated email is not required.

## Technical design

React/TypeScript/Vite frontend; local browser storage; small Node API bound to loopback. Each analysis action fetches one public HTML URL with size/time/redirect limits. Company and job pages are separate actions; the selected fact is tied to one exact source URL and its saved excerpt. Gmail OAuth uses a state value and PKCE, verifies the connected email, holds tokens in memory, and calls only `users.drafts.create`. PDF CV content is transmitted to Gmail only when the user explicitly clicks Save in Gmail Drafts. A Git-ignored local index records draft IDs and content fingerprints for repeat-request protection.

## Quality evaluation

Test 20–30 permission-cleared or synthetic leads. For each draft, manually score factual accuracy, specificity, subject clarity, word count and editing effort. Report false positives from the phrase checker. Do not use inbox-placement claims as a metric.

## Local release status

Lead input, separate company and optional job-page research, open versus listed-role drafting, manual source and posting review, writing checks, required PDF attachment, Gmail draft API integration, local backup/restore, and repeat-request protection are implemented. A real lead was researched and its local draft reviewed; that test exposed awkward copied source wording, which was corrected in the template. On October 29, 2026, the live OAuth flow completed for the intended test account. The saved Gmail draft was opened and its recipient, text and PDF attachment verified. It remained unsent.

## Next milestones

1. Repeat the live flow after reconnecting and expand the real-lead review set.
2. Improve copy quality using a small reviewed example set and exact feedback from real drafts.
3. For any public deployment, replace local storage with authenticated per-user persistence and strengthen URL fetching, OAuth token storage and rate limiting. This is outside the local release.
