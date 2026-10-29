# Connect Gmail

Each person running OutreachPilot supplies their own Google Cloud OAuth client. The repository does not include a shared client secret.

## Google Cloud

1. Create or select a project and enable the **Gmail API**.
2. Configure Google Auth Platform with an app name, support email and developer contact email.
3. For a personal Gmail account, choose **External**, keep the app in **Testing**, and add the intended account as a test user.
4. Create an OAuth client of type **Web application**.
5. Add the exact redirect URI `http://127.0.0.1:8787/api/gmail/callback`.

## Local configuration

Copy `.env.example` to `.env`. Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GMAIL_ALLOWED_EMAIL`. Use the account that should hold the drafts. Keep the secret in `.env`, which is ignored by Git; do not put it in source files, screenshots or issues.

Restart the server, click **Connect** in the workspace and review Google's consent screen. Sign in with the same account as `GMAIL_ALLOWED_EMAIL`.

## Verify a draft

Approve the reviewed email and recipient, attach a PDF CV under 3.5 MB, then click **Save in Gmail Drafts**. Check the recipient, subject, message and attachment in that account's Drafts folder. Send it manually when ready.

The app requests `gmail.compose` and email identity. Google's [compose scope](https://developers.google.com/workspace/gmail/api/auth/scopes) includes managing drafts and sending mail, and is classified as restricted. OutreachPilot only implements draft creation and has no send endpoint. Distributing a public app requires additional OAuth verification work.

Tokens stay in server memory. Restarting the server requires reconnection; existing Gmail drafts remain in Gmail. Identical save requests are checked against an ignored `.local-data/` index. If a request fails without a clear result, inspect Gmail before retrying.
