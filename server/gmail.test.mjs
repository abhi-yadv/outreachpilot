import { describe, expect, it } from 'vitest';
import { buildMime } from './gmail.mjs';

describe('Gmail draft MIME', () => {
  it('contains the intended recipient and plain-text body', () => {
    const mime = buildMime({
      to: 'hr@example.com',
      subject: 'Internship | Example',
      body: 'Hello team,\nI am interested in the role.',
    });
    expect(mime).toContain('To: hr@example.com');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).not.toContain('Bcc:');
    expect(
      Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString(),
    ).toContain('interested in the role');
  });

  it('adds an optional PDF attachment with a safe filename', () => {
    const mime = buildMime({
      to: 'hr@example.com',
      subject: 'Internship',
      body: 'Hello team, my CV is attached.',
      attachment: {
        name: 'CV.pdf',
        mime: 'application/pdf',
        data: Buffer.from('%PDF-1.4 sample').toString('base64'),
      },
    });
    expect(mime).toContain('filename="CV.pdf"');
    expect(mime).toContain('Content-Type: multipart/mixed');
    expect(mime).toContain(Buffer.from('%PDF-1.4 sample').toString('base64'));
  });
});
