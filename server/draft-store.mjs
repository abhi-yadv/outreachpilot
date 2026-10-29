import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function createDraftStore(file) {
  let recordsPromise;
  let writes = Promise.resolve();
  const inFlight = new Map();

  async function records() {
    recordsPromise ??= (async () => {
      try {
        const value = JSON.parse(await readFile(file, 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Draft index is invalid.');
        return value;
      } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw new Error('Local draft index could not be read. Check .local-data before trying again.');
      }
    })();
    return recordsPromise;
  }

  async function persist(value) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value), { mode: 0o600 });
  }

  async function create(email, input, createInGmail) {
    const fingerprint = createHash('sha256').update(JSON.stringify({ email: email.toLowerCase(), input })).digest('hex');
    const saved = await records();
    if (saved[fingerprint]) return { ...saved[fingerprint], reused: true };
    if (inFlight.has(fingerprint)) return inFlight.get(fingerprint);
    const task = (async () => {
      const result = await createInGmail(input);
      saved[fingerprint] = { id: result.id, url: result.url, email: result.email };
      writes = writes.catch(() => {}).then(() => persist(saved));
      try { await writes; return result; }
      catch (error) { console.error('Could not persist Gmail draft index:', error); return { ...result, indexWarning: 'Draft saved in Gmail, but the local duplicate index could not be updated.' }; }
    })();
    inFlight.set(fingerprint, task);
    try { return await task; } finally { inFlight.delete(fingerprint); }
  }

  return { create };
}
