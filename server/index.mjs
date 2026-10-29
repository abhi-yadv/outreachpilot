import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { z } from 'zod';
import { analyzeCompanyUrl } from './research.mjs';
import {
  authorizationUrl,
  createGmailDraft,
  disconnectGmail,
  finishAuthorization,
  gmailStatus,
} from './gmail.mjs';
import { createDraftStore } from './draft-store.mjs';

const port = Number(process.env.PORT || 8787);
const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:5173';
const draftStore = createDraftStore(
  resolve(import.meta.dirname, '..', '.local-data', 'draft-ids.json'),
);
const draftSchema = z.object({
  to: z.email(),
  subject: z.string().min(3).max(150),
  body: z.string().min(30).max(10000),
  attachment: z.object({
    name: z.string().max(150),
    mime: z.literal('application/pdf'),
    data: z.string().max(5_000_000),
  }),
});

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function readBody(request, limit = 6_000_000) {
  const parts = [];
  let bytes = 0;
  for await (const part of request) {
    bytes += part.length;
    if (bytes > limit) throw new Error('Request is too large.');
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  if (request.method === 'GET' && url.pathname === '/api/health')
    return json(response, 200, { ok: true });
  if (request.method === 'GET' && url.pathname === '/api/gmail/status')
    return json(response, 200, gmailStatus());
  if (request.method === 'GET' && url.pathname === '/api/gmail/connect') {
    try {
      response.writeHead(302, { Location: authorizationUrl(), 'Cache-Control': 'no-store' });
      response.end();
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/gmail/callback') {
    try {
      if (url.searchParams.has('error')) throw new Error('Google connection was cancelled.');
      await finishAuthorization(url.searchParams.get('code'), url.searchParams.get('state'));
      response.writeHead(302, {
        Location: `${origin}/?gmail=connected`,
        'Cache-Control': 'no-store',
      });
      response.end();
    } catch (error) {
      response.writeHead(302, {
        Location: `${origin}/?gmail=error&reason=${encodeURIComponent(error.message)}`,
        'Cache-Control': 'no-store',
      });
      response.end();
    }
    return;
  }
  if (request.method !== 'POST' || request.headers.origin !== origin)
    return json(response, 403, { error: 'Request not allowed.' });
  try {
    if (url.pathname === '/api/research') {
      const input = z.object({ url: z.url() }).parse(await readBody(request, 1000));
      return json(response, 200, await analyzeCompanyUrl(input.url));
    }
    if (url.pathname === '/api/gmail/draft') {
      const input = draftSchema.parse(await readBody(request));
      if (
        !input.attachment.name.toLowerCase().endsWith('.pdf') ||
        Buffer.from(input.attachment.data, 'base64').subarray(0, 4).toString() !== '%PDF'
      )
        throw new Error('Attach a valid PDF CV.');
      const connectedEmail = gmailStatus().email;
      if (!connectedEmail) throw new Error('Connect Gmail first.');
      return json(response, 200, await draftStore.create(connectedEmail, input, createGmailDraft));
    }
    if (url.pathname === '/api/gmail/disconnect') {
      disconnectGmail();
      return json(response, 200, { connected: false });
    }
    return json(response, 404, { error: 'Not found.' });
  } catch (error) {
    const known =
      error instanceof z.ZodError || /URL|website|page|PDF|large|Connect|Gmail/.test(error.message);
    return json(response, known ? 400 : 500, {
      error: known ? error.message : 'Request failed. Try again or paste source text manually.',
    });
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`OutreachPilot API listening on http://127.0.0.1:${port}`),
);
