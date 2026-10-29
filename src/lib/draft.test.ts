import { describe, expect, it } from 'vitest';
import { demoData } from './data';
import { checkDraft, createGuidedDraft, sourceIsFresh, sourceSupportsFact } from './draft';

const { profile, companies } = demoData();
const company = companies[0];

describe('source grounded drafting', () => {
  it('uses the selected company fact only when it appears in source text', () => {
    expect(sourceSupportsFact(company)).toBe(true);
    const draft = createGuidedDraft(profile, company);
    expect(draft.body).toContain('data quality tools for analytics teams');
    const unsupported = { ...company, selectedFact: 'Northstar Data won a global award.' };
    expect(sourceSupportsFact(unsupported)).toBe(false);
    expect(createGuidedDraft(profile, unsupported).body).not.toContain('global award');
  });

  it('flags unsupported facts and misleading subject lines', () => {
    const unsupported = { ...company, selectedFact: 'Northstar Data won a global award.' };
    const checks = checkDraft('Re: urgent offer', 'Hi team, I have always admired your company!', unsupported);
    expect(checks.map((item) => item.id)).toEqual(expect.arrayContaining(['evidence', 'thread', 'pressure-urgent', 'generic-i have always admired your company']));
  });

  it('requires traceable personalization before approval', () => {
    const noSource = { ...company, sourceUrl: '', selectedFact: '' };
    const draft = createGuidedDraft(profile, noSource);
    const checks = checkDraft(draft.subject, draft.body, noSource);
    expect(checks.map((item) => item.id)).toEqual(expect.arrayContaining(['missing-fact']));
  });

  it('flags a supplied urgency phrase without blocking factual review', () => {
    const draft = createGuidedDraft(profile, company);
    const checks = checkDraft(draft.subject, `${draft.body}\nPlease read this limited time offer.`, company);
    expect(checks.map((item) => item.id)).toEqual(expect.arrayContaining(['pressure-please read', 'pressure-limited time']));
  });

  it('requires a recent manual source review', () => {
    expect(sourceIsFresh(company)).toBe(false);
    const recent = { ...company, sourceCheckedAt: new Date().toISOString() };
    expect(sourceIsFresh(recent)).toBe(true);
    expect(sourceIsFresh({ ...recent, sourceCheckedAt: '2020-01-01T00:00:00.000Z' })).toBe(false);
    const draft = createGuidedDraft(profile, company);
    expect(checkDraft(draft.subject, draft.body, company).map((item) => item.id)).toContain('source-review');
  });
});
