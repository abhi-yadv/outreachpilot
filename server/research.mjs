import { lookup } from 'node:dns/promises';
import { load } from 'cheerio';

function isPrivateAddress(address) {
  if (address.includes(':')) return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80') || address.startsWith('::ffff:');
  const parts = address.split('.').map(Number);
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168 || parts[0] >= 224;
}

async function checkedUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || ![80, 443, 0].includes(Number(url.port || 0))) throw new Error('Use a public http or https company page URL.');
  if (!url.hostname.includes('.') || url.hostname.endsWith('.local') || url.hostname.endsWith('.localhost')) throw new Error('Use a public company website URL.');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('This URL does not resolve to a public website.');
  return url;
}

export async function analyzeCompanyUrl(raw) {
  let url = await checkedUrl(raw);
  let response;
  for (let redirects = 0; redirects < 3; redirects++) {
    response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'OutreachPilot/0.1 (local research preview)', Accept: 'text/html' } });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location) throw new Error('The website redirected without a destination.');
    url = await checkedUrl(new URL(location, url).href);
  }
  if (!response?.ok) throw new Error(`Website returned ${response?.status || 'no response'}. Paste a source excerpt manually.`);
  if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('This page is not HTML. Paste relevant text manually.');
  if (Number(response.headers.get('content-length') || 0) > 1_000_000) throw new Error('Page is too large. Paste a relevant excerpt manually.');
  if (!response.body) throw new Error('Website returned no page content.');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) throw new Error('Page is too large. Paste a relevant excerpt manually.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const rawHtml = new TextDecoder().decode(Buffer.concat(chunks));
  const $ = load(rawHtml);
  $('script,style,nav,footer,header,form,svg,iframe,noscript').remove();
  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim() || '';
  const lines = [description, ...$('main h1,main h2,main p,article h1,article h2,article p').toArray().map((element) => $(element).text().replace(/\s+/g, ' ').trim())].filter((line) => line.length >= 35 && line.length <= 700);
  const unique = [...new Set(lines)];
  if (!unique.length) throw new Error('No useful page text was found. Paste a relevant excerpt manually.');
  return { title, url: url.href, excerpt: unique.slice(0, 12).join('\n').slice(0, 6000), suggestedFact: unique[0] };
}
