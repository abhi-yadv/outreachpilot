import { randomBytes, createHash } from 'node:crypto';

const scope = 'https://www.googleapis.com/auth/gmail.compose';
const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:8787/api/gmail/callback';
const targetEmail = process.env.GMAIL_ALLOWED_EMAIL?.trim().toLowerCase() || null;
let pending = null;
let connection = null;

export function gmailConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && targetEmail);
}
export function gmailStatus() {
  return {
    configured: gmailConfigured(),
    connected: Boolean(connection),
    email: connection?.email || null,
    expectedEmail: targetEmail,
  };
}

export function authorizationUrl() {
  if (!gmailConfigured())
    throw new Error('Add your Google OAuth client ID, secret and Gmail address to .env first.');
  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  pending = { state, verifier, createdAt: Date.now() };
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `${scope} email`,
    access_type: 'offline',
    prompt: 'consent',
    login_hint: targetEmail,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.href;
}

export async function finishAuthorization(code, state) {
  if (!pending || pending.state !== state || Date.now() - pending.createdAt > 10 * 60_000)
    throw new Error('Gmail connection expired. Try connecting again.');
  const verifier = pending.verifier;
  pending = null;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token)
    throw new Error('Google did not authorize this connection.');
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = await userResponse.json();
  if (!userResponse.ok || user.email?.toLowerCase() !== targetEmail)
    throw new Error(`Connect ${targetEmail}, not a different Google account.`);
  connection = {
    email: user.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  return connection.email;
}

async function currentToken() {
  if (!connection) throw new Error('Connect Gmail first.');
  if (Date.now() < connection.expiresAt - 60_000) return connection.accessToken;
  if (!connection.refreshToken) throw new Error('Gmail connection expired. Reconnect.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) throw new Error('Gmail connection expired. Reconnect.');
  connection.accessToken = tokens.access_token;
  connection.expiresAt = Date.now() + tokens.expires_in * 1000;
  return connection.accessToken;
}

function safeHeader(value) {
  return value.replace(/[\r\n]/g, ' ').trim();
}
function safeFilename(value) {
  return safeHeader(value).replace(/["\\]/g, '_');
}
function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join('\r\n') || '';
}

export function buildMime({ to, subject, body, attachment }) {
  const headers = [
    `To: ${safeHeader(to)}`,
    `Subject: =?UTF-8?B?${Buffer.from(safeHeader(subject)).toString('base64')}?=`,
    'MIME-Version: 1.0',
  ];
  if (!attachment)
    return [
      ...headers,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(Buffer.from(body).toString('base64')),
    ].join('\r\n');
  const boundary = `outreachpilot_${randomBytes(12).toString('hex')}`;
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(body).toString('base64')),
    `--${boundary}`,
    `Content-Type: ${attachment.mime}; name="${safeFilename(attachment.name)}"`,
    `Content-Disposition: attachment; filename="${safeFilename(attachment.name)}"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(attachment.data),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

export async function createGmailDraft(input) {
  const token = await currentToken();
  const raw = Buffer.from(buildMime(input)).toString('base64url');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  const draft = await response.json();
  if (!response.ok || !draft.id)
    throw new Error('Gmail could not save the draft. Check the connection and try again.');
  return { id: draft.id, url: 'https://mail.google.com/mail/u/0/#drafts', email: connection.email };
}

export function disconnectGmail() {
  connection = null;
  pending = null;
}
