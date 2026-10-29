# OutreachPilot

An internship outreach workspace for one carefully researched lead at a time. Enter the company URL and HR email, review a short excerpt from the website, select one relevant fact, and create a concise email using your verified profile. Approve the exact recipient and text, then save it to Gmail **Drafts**. OutreachPilot has no send endpoint. You send manually in Gmail whenever you choose.

This is a local-first prototype. The app uses a deterministic template and editable review; it does not call an AI model to write the email. The writing checker flags generic phrases, pressure words, missing evidence, placeholders and misleading subjects. It cannot guarantee inbox placement.

## Workflow

1. Edit **Candidate profile** with facts you can support.
2. Choose **New company** and enter its name, role, HR email and URL.
3. Click **Analyze company URL**. The local API extracts a page excerpt; open the original page, correct the excerpt, select an exact company fact and add a short subject hook. Click **I reviewed the source** after checking it. The review expires after 30 days or when you change the source or fact.
4. Describe the connection between that fact and your own experience. Create a short draft.
5. Edit subject and body, resolve required checks, then approve.
6. Connect the intended Gmail account, attach a PDF CV, and click **Save in Gmail Drafts**. Open Gmail to send manually later.

If a site blocks automated reading or relies on JavaScript, paste the relevant text and source URL manually. The app does not guess HR addresses or scrape contact lists.

## Run locally

Requires Node.js 22+ and npm.

```bash
npm ci
cp .env.example .env
npm run start:local
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). On Windows PowerShell, `Copy-Item .env.example .env` also works. The website analysis requires the local server; draft editing works without Gmail credentials. `.env` is ignored by Git.

## Connect Gmail Drafts

The user must create their own Google Cloud OAuth client. There is no shared credential in this repository.

1. Create/select a Google Cloud project, enable the Gmail API, and configure the OAuth consent screen. For a personal test app, add the intended Gmail address as a test user if Google asks.
2. Create an OAuth client of type **Web application**. Add `http://127.0.0.1:8787/api/gmail/callback` as an authorized redirect URI.
3. Put the client ID and secret in `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Set `GMAIL_ALLOWED_EMAIL` to the account that should hold the drafts. Keep that address in your ignored `.env` file, not in public source files.
4. Restart the local API server, click **Connect** in the app, and approve Google's consent flow for the same account.
5. Review and approve each lead and message. Click **Save in Gmail Drafts**, then inspect the draft in that Gmail account.

OAuth access and refresh tokens are kept **in server memory only**. Restarting the server disconnects Gmail; existing Gmail drafts remain in Gmail. The app requests `gmail.compose` plus email identity to verify the account. Google's [Gmail scopes documentation](https://developers.google.com/workspace/gmail/api/auth/scopes) classifies `gmail.compose` as restricted, so distributing a public multi-user version requires further OAuth verification/security work. This local setup is for your own testing. The app contains no `drafts.send` or `messages.send` call.

Exact repeat requests to save the same recipient, subject, body and PDF are reused from a small local index in `.local-data/`. That folder is ignored by Git. If a save request fails ambiguously, check Gmail Drafts before trying again. Do not delete the local index while you are using the app.

## Back up your workspace

In **Candidate profile**, click **Download backup** to save a JSON file with your local profile, leads and drafts. Keep this file private. Choose that file under **Choose backup**, review its record counts, then click **Restore backup**. Restoring replaces this browser's workspace; it does not change existing Gmail drafts or OAuth credentials.

## Safety and limitations

- Automated extraction reads one public HTML page. It may miss content or be blocked; the user verifies the original page before drafting. Exact source matching checks the pasted/extracted excerpt, not independent truth.
- A public deployment needs authentication, persistent storage, access controls, rate limiting and stronger URL-fetch protections. The current server binds to `127.0.0.1` for local use only.
- Candidate profile, leads and draft text live in this browser's local storage. Clearing site data removes them. Do not enter sensitive contact lists on a shared computer.
- The local duplicate index can reduce accidental duplicate Gmail drafts; it cannot guarantee exactly-once creation if the server crashes between Gmail creation and local recording, or if the index is lost.
- An OAuth connection currently supports one local Gmail account at a time. Drafts remain unsent until the user sends them in Gmail.
- The synthetic Northstar Data sample and `example.com` URL are only a UI demonstration; they are not a real company lead.
- Never commit `.env`, OAuth credentials/tokens, a private CV, or real HR contact lists to GitHub.

## Verification

```bash
npm run lint
npm test
npm run build
```

The test suite covers source-backed drafting and review checks. Gmail draft creation requires an actual OAuth test account for end-to-end verification. See [the PRD](docs/PRD.md) for acceptance criteria and future milestones.

GitHub Actions runs lint, tests and build on pushes and pull requests. Use the [draft review guide](docs/EVALUATION.md) for real lead feedback before claiming that the copy is effective.

## Publish the code to GitHub

This checkout has local Git commits but no remote repository yet. Create an empty repository named `outreachpilot` under your GitHub account, then from this project folder run:

```bash
git remote add origin https://github.com/abhi-yadv/outreachpilot.git
git push -u origin main
```

Before the push, run `git status` and review `git ls-files`. The ignore rules exclude `.env`, `.local-data/`, installed packages and build output. Keep your actual CV, private backups and HR addresses outside the repository. Choose a license separately before inviting others to reuse the code.

## Structure

- `src/` — React and TypeScript interface, local data, draft and writing checks
- `server/research.mjs` — URL reading and HTML excerpt extraction
- `server/gmail.mjs` — OAuth and Gmail draft MIME creation
- `server/draft-store.mjs` — local duplicate-draft index
- `server/index.mjs` — local API routes (no send route)
- `docs/PRD.md` — product requirements and remaining roadmap
