import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDraftStore } from './draft-store.mjs';

describe('Gmail draft duplicate protection', () => {
  it('returns one draft for repeated and concurrent identical requests, including after restart', async () => {
    const file = join(tmpdir(), `outreachpilot-${randomUUID()}.json`);
    let calls = 0;
    const create = async () => {
      calls += 1;
      return {
        id: 'draft-1',
        url: 'https://mail.google.com/mail/u/0/#drafts',
        email: 'student@gmail.com',
      };
    };
    const input = {
      to: 'hr@example.com',
      subject: 'Data work',
      body: 'Hello',
      attachment: { name: 'CV.pdf', mime: 'application/pdf', data: 'JVBERg==' },
    };
    try {
      const store = createDraftStore(file);
      const [first, second] = await Promise.all([
        store.create('student@gmail.com', input, create),
        store.create('student@gmail.com', input, create),
      ]);
      expect(first.id).toBe('draft-1');
      expect(second.id).toBe('draft-1');
      const restarted = createDraftStore(file);
      expect((await restarted.create('student@gmail.com', input, create)).reused).toBe(true);
      expect(calls).toBe(1);
    } finally {
      await unlink(file).catch(() => {});
    }
  });
});
