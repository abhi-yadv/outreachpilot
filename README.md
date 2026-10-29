# OutreachPilot

A workspace for researching companies and preparing internship emails. Review a company fact, connect it to your experience, then save the email as a Gmail draft with your CV. You send it yourself from Gmail.

## What it does

- Reads a company page or job listing and keeps the source beside the draft.
- Supports applications to listed roles and open internship inquiries.
- Builds an editable email from your profile, a sourced detail and relevant experience.
- Checks for missing evidence, placeholders, misleading subjects and pressure language.
- Saves local drafts before you have an application email.
- Creates unsent Gmail drafts with a PDF CV after review.
- Tracks outreach and exports a private workspace backup.

Drafting uses an editable template. The wording checker cannot predict spam placement. Research and email copy need a final human review.

## Run it

Use Node.js 22 or newer.

```bash
git clone https://github.com/abhi-yadv/outreachpilot.git
cd outreachpilot
npm ci
cp .env.example .env
npm run start:local
```

On PowerShell, use `Copy-Item .env.example .env` for the copy step. Open [localhost:5173](http://127.0.0.1:5173).

Company research works without Gmail credentials. To save drafts in Gmail, follow [Gmail setup](docs/GMAIL_SETUP.md).

## Try one lead

1. Save your name, education, availability and verifiable experience in **Candidate profile**.
2. Add a company and choose a listed role or an open inquiry. A listed role needs its exact title and current posting URL.
3. Read the company and job pages. Select one detail, open its original source and mark it reviewed.
4. Connect your experience to the company's work in one sentence. Create and edit the draft.
5. Resolve required writing checks. Add a verified recipient, review the text and approve it.
6. Connect Gmail, attach your PDF CV and save the draft. Review it in Gmail before sending.

The **company URL** is the main website. The **source URL** is the page supporting the detail in your email. The app fills it when reading a page; paste an excerpt manually if a site blocks access.

Skills and project titles are profile notes. Choose relevant ones in **Your connection to their work** rather than putting the whole list into every email.

## How it is built

React and TypeScript handle the interface. Vite serves the frontend, and a small Node server reads public pages and talks to Gmail. Browser storage holds profiles, leads and drafts; OAuth tokens stay in server memory.

```text
src/App.tsx             Workspace, profile, tracker and review screens
src/lib/draft.ts        Email template and writing checks
src/lib/backup.ts       Workspace backup validation
server/research.mjs     Public page fetching and text extraction
server/gmail.mjs        OAuth and Gmail draft creation
server/draft-store.mjs  Repeat-request detection
```

See [development notes](docs/DEVELOPMENT.md) for the request flow and design decisions, and [project scope](docs/PRD.md) for remaining work.

## Checks

```bash
npm run lint
npm test
npm run build
```

GitHub Actions runs these on pushes and pull requests. Tests cover source matching, writing checks, backup validation, email MIME construction and repeated draft requests. A live Gmail OAuth test is still pending. The [draft review guide](docs/EVALUATION.md) tracks copy quality separately from code tests.

## Current limits

This version runs locally for one user. Page extraction can miss content, and matching text against a saved excerpt does not independently prove a claim. The draft template still needs editing for natural phrasing.

Clearing browser storage removes the workspace, so export backups from **Candidate profile**. An interrupted Gmail request may need a manual check before retrying. Restarting the server disconnects Gmail.

Keep `.env`, CVs, contact lists and private backups out of Git. Public deployment needs user authentication, durable storage and further OAuth and URL-fetching work. No reuse license has been selected yet.
