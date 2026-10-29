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

  it('keeps an open inquiry distinct from a listed-role application', () => {
    const realProfile = { ...profile, name: 'Sam Lee', github: '' };
    const base = { ...company, id: 'real-lead', name: 'Northstar Data', contactEmail: 'hr@example.com', sourceCheckedAt: new Date().toISOString() };
    const open = { ...base, opportunityType: 'open' as const, role: 'data engineering' };
    const openDraft = createGuidedDraft(realProfile, open);
    expect(openDraft.subject).toContain('internship inquiry');
    expect(openDraft.body).toContain('possible internship in data engineering');
    expect(openDraft.body).not.toContain('posting');

    const posted = { ...base, opportunityType: 'posted' as const, role: 'Data Engineering Intern', postingUrl: 'https://example.com/jobs/data-intern', postingText: 'Data Engineering Intern role is open.', postingCheckedAt: new Date().toISOString() };
    const postedDraft = createGuidedDraft(realProfile, posted);
    expect(postedDraft.body).toContain('Data Engineering Intern posting');
    expect(checkDraft(postedDraft.subject, postedDraft.body, posted).some((check) => check.id === 'posting-review')).toBe(false);
    expect(checkDraft(postedDraft.subject, postedDraft.body, { ...posted, postingCheckedAt: undefined }).map((check) => check.id)).toContain('posting-review');
  });
});
