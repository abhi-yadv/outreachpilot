import { describe, expect, it } from 'vitest';
import { demoData } from './data';
import { exportBackup, parseBackup } from './backup';

describe('local backup', () => {
  it('round trips a workspace', () => {
    const data = demoData();
    expect(parseBackup(exportBackup(data))).toEqual(data);
  });

  it('rejects unrelated or malformed files', () => {
    expect(() => parseBackup('{broken')).toThrow('valid JSON');
    expect(() => parseBackup('{"app":"Other","version":1}')).toThrow('supported OutreachPilot');
    const invalid = JSON.parse(exportBackup(demoData()));
    invalid.data.companies[0].updatedAt = 'not-a-date';
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow('supported OutreachPilot');
  });
});
