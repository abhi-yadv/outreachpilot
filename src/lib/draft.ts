import type { CandidateProfile, CheckResult, Company, Draft } from '../types';

export function sourceSupportsFact(company: Company): boolean {
  const fact = company.selectedFact.trim().replace(/[.\s]+$/, '').toLowerCase();
  return Boolean(fact && company.sourceText.toLowerCase().includes(fact));
}

function reviewedRecently(value: string | undefined, now: number): boolean {
  if (!value) return false;
  const checked = new Date(value).getTime();
  return Number.isFinite(checked) && checked <= now && now - checked <= 30 * 24 * 60 * 60 * 1000;
}

export function sourceIsFresh(company: Company, now = Date.now()): boolean {
  return reviewedRecently(company.sourceCheckedAt, now);
}

export function postingIsFresh(company: Company, now = Date.now()): boolean {
  return reviewedRecently(company.postingCheckedAt, now);
}

export function createGuidedDraft(profile: CandidateProfile, company: Company): Pick<Draft, 'subject' | 'body' | 'mode'> {
  const name = profile.name.trim() || '[your name]';
  const role = company.role.trim() || 'technical work';
  const posted = company.opportunityType === 'posted';
  const fact = company.selectedFact.trim();
  const safeFact = sourceSupportsFact(company) ? fact : '';
  const intro = profile.education.trim() ? `I'm ${name}, a ${profile.education.trim()}.` : `I'm ${name}.`;
  const availabilityInput = profile.availability.trim();
  const availability = !availabilityInput
    ? 'I am seeking a technical internship.'
    : /^available\b/i.test(availabilityInput)
      ? `I am ${availabilityInput.charAt(0).toLowerCase()}${availabilityInput.slice(1).replace(/[.]+$/, '')}.`
      : /^I\b/i.test(availabilityInput)
        ? `${availabilityInput.replace(/[.]+$/, '')}.`
        : `My availability is ${availabilityInput.replace(/[.]+$/, '')}.`;
  const relevant = company.matchingStrength.trim() || profile.experience.trim();
  const reason = posted
    ? `I saw the ${role} posting at ${company.name.trim()} and would like to be considered.`
    : `I'm reaching out about a possible internship in ${role} at ${company.name.trim()}.`;
  const work = relevant ? `${relevant.replace(/[.]+$/, '')}.` : '';
  const link = profile.github.trim() ? `\nGitHub: ${profile.github.trim()}` : '';

  return {
    subject: posted
      ? company.subjectHook?.trim() ? `${company.subjectHook.trim()} | ${role}` : `${role} | ${company.name.trim()}`
      : company.subjectHook?.trim() ? `${company.subjectHook.trim()} | internship inquiry` : `Internship inquiry | ${company.name.trim()}`,
    body: [
      `Hi ${company.contactName.trim() || 'team'},`,
      `${intro} ${availability}`,
      [reason, safeFact, work].filter(Boolean).join(' '),
      posted ? `If the role is still open, would you consider my application? I've attached my CV.` : `If your team considers interns for this work, I'd be glad to speak. I've attached my CV.`,
      `Thanks for your time,\n${profile.signoff.trim() || name}${link}`,
    ].filter(Boolean).join('\n\n'),
    mode: 'guided',
  };
}

// Review signals from the user's supplied examples. A phrase alone does not determine spam placement.
const pressureWords = [
  '100% more', '100% free', '100% satisfied', 'additional income', 'be your own boss',
  'best price', 'big bucks', 'billion', 'cash bonus', 'cents on the dollar',
  'consolidate debt', 'double your cash', 'double your income', 'earn extra cash',
  'earn money', 'eliminate bad credit', 'extra cash', 'extra income', 'expect to earn',
  'fast cash', 'financial freedom', 'free access', 'free consultation', 'free gift',
  'free hosting', 'free info', 'free investment', 'free membership', 'free money',
  'free preview', 'free quote', 'free trial', 'full refund', 'get out of debt',
  'get paid', 'giveaway', 'guaranteed', 'increase sales', 'increase traffic',
  'incredible deal', 'lower rates', 'lowest price', 'make money', 'million dollars',
  'miracle', 'money back', 'once in a lifetime', 'one time', 'pennies a day',
  'potential earnings', 'prize', 'promise', 'pure profit', 'risk-free',
  'satisfaction guaranteed', 'save big money', 'save up to', 'special promotion',
  'act now', 'apply now', 'become a member', 'call now', 'click below',
  'click here', 'get it now', 'do it today', "don't delete", 'exclusive deal',
  'get started now', 'important information regarding', 'information you requested',
  'instant', 'limited time', 'new customers only', 'order now', 'please read',
  'see for yourself', 'sign up free', 'take action', "this won't last", 'urgent',
  'what are you waiting for', 'while supplies last', 'will not believe your eyes',
  'winner', 'winning', 'you are a winner', 'you have been selected', 'hurry up',
];

const genericPhrases = [
  'your esteemed company', 'your innovative company', 'i have always admired your company',
  'i am passionate about technology', 'i am writing to express my interest',
];

export function checkDraft(subject: string, body: string, company: Company): CheckResult[] {
  const results: CheckResult[] = [];
  const combined = `${subject}\n${body}`;
  const lower = combined.toLowerCase();
  if (!subject.trim()) results.push({ id: 'subject', severity: 'critical', title: 'Subject is missing', detail: 'Add a short subject that accurately describes your outreach.' });
  const fallbackSubject = company.opportunityType === 'posted' ? `${company.role.trim()} | ${company.name.trim()}` : `Internship inquiry | ${company.name.trim()}`;
  if (!company.subjectHook?.trim() && subject.trim() === fallbackSubject) results.push({ id: 'subject-hook', severity: 'review', title: 'Make the subject specific', detail: 'Add a short subject angle from your verified research, or edit the subject directly.' });
  if (!body.trim()) results.push({ id: 'body', severity: 'critical', title: 'Email is empty', detail: 'Write or generate a message before review.' });
  if (company.id === 'sample-company') results.push({ id: 'sample-lead', severity: 'critical', title: 'Replace the sample lead', detail: 'Create a real company entry before approving a Gmail draft.' });
  if (/\bre\s*:|\bfwd\s*:/i.test(subject)) results.push({ id: 'thread', severity: 'critical', title: 'Misleading thread prefix', detail: 'Use Re: or Fwd: only for an actual existing conversation.' });
  if (/\[[^\]]+\]|\{\{[^}]+\}\}/.test(combined)) results.push({ id: 'placeholder', severity: 'critical', title: 'Unfilled placeholder', detail: 'Replace bracketed fields before approving the draft.' });
  if (/\bgithub\.com\/example\b/i.test(body)) results.push({ id: 'sample-link', severity: 'critical', title: 'Replace the sample GitHub link', detail: 'Use your real portfolio URL or remove the link.' });
  if (company.name.trim() && !lower.includes(company.name.trim().toLowerCase())) results.push({ id: 'company', severity: 'critical', title: 'Company name missing', detail: 'Check that this draft is addressed to the right company.' });
  if (company.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.contactEmail.trim())) results.push({ id: 'email', severity: 'critical', title: 'Recipient email looks invalid', detail: 'Verify the address before saving a Gmail draft.' });
  if (!company.website.trim()) results.push({ id: 'company-url', severity: 'critical', title: 'Company URL is missing', detail: 'Add the company website so your outreach is grounded in real company work.' });
  if (!company.companySummary?.trim()) results.push({ id: 'company-research', severity: 'critical', title: 'Company research is missing', detail: 'Read the company website or enter a short factual description of its work.' });
  if (!company.matchingStrength.trim()) results.push({ id: 'fit', severity: 'critical', title: 'Your connection to the work is missing', detail: 'Write one honest sentence linking your project or skill to this company or role.' });
  if (company.opportunityType === 'posted') {
    if (!company.postingUrl?.trim()) results.push({ id: 'posting-url', severity: 'critical', title: 'Job posting URL is missing', detail: 'Paste the exact listing for the role you selected.' });
    else if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(company.postingUrl.trim())) results.push({ id: 'posting-url-invalid', severity: 'critical', title: 'Job posting URL looks invalid', detail: 'Use the full link to the role listing.' });
    if (!company.postingText?.trim()) results.push({ id: 'posting-text', severity: 'critical', title: 'Job posting details are missing', detail: 'Read the listing or paste its relevant details.' });
    if (!postingIsFresh(company)) results.push({ id: 'posting-review', severity: 'critical', title: 'Confirm the role is still open', detail: 'Open the job posting, check its status, then mark it reviewed. Review again after 30 days.' });
  }
  if (!company.selectedFact.trim()) results.push({ id: 'missing-fact', severity: 'critical', title: 'Company detail is missing', detail: 'Select a specific sentence from company or role source material.' });
  if (company.selectedFact.trim() && !company.sourceUrl.trim()) results.push({ id: 'missing-source', severity: 'critical', title: 'Source URL is missing', detail: 'Open Evidence page details and add the exact page URL for your chosen fact.' });
  if (company.selectedFact.trim() && !sourceIsFresh(company)) results.push({ id: 'source-review', severity: 'critical', title: 'Review the source', detail: 'Open the source page, verify the fact, then mark it reviewed. Review again after 30 days.' });
  if (company.sourceUrl.trim() && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(company.sourceUrl.trim())) results.push({ id: 'source-url', severity: 'critical', title: 'Source URL looks invalid', detail: 'Use a full http or https link to the company or role page.' });
  for (const phrase of pressureWords) {
    if (new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(combined)) results.push({ id: `pressure-${phrase}`, severity: 'review', title: 'Pressure or exaggerated phrase', detail: 'Check whether this wording is accurate and necessary. A word alone cannot predict spam placement.', match: phrase });
  }
  for (const phrase of genericPhrases) {
    if (lower.includes(phrase)) results.push({ id: `generic-${phrase}`, severity: 'review', title: 'Generic wording', detail: 'Replace this with a sourced detail about the company or your relevant work.', match: phrase });
  }
  if ((combined.match(/!/g) || []).length > 1) results.push({ id: 'punctuation', severity: 'review', title: 'Too many exclamation marks', detail: 'A calm, direct tone usually reads more professionally.' });
  if (subject.length > 70) results.push({ id: 'length-subject', severity: 'review', title: 'Long subject', detail: 'Try to make the subject shorter and easier to scan.' });
  if (body.trim().split(/\s+/).length > 190) results.push({ id: 'length-body', severity: 'review', title: 'Long email', detail: 'Consider cutting details so the request is easy to read.' });
  if (company.selectedFact.trim() && !sourceSupportsFact(company)) results.push({ id: 'evidence', severity: 'critical', title: 'Company fact is not supported', detail: 'The selected fact is not present in the saved source text. Edit or remove it.' });
  if (sourceSupportsFact(company) && body.trim() && !body.toLowerCase().includes(company.selectedFact.trim().toLowerCase().replace(/[.\s]+$/, ''))) results.push({ id: 'personalization', severity: 'review', title: 'Selected fact is missing from the email', detail: 'Check that this message contains a specific, sourced reason for reaching out.' });
  if (results.length === 0) results.push({ id: 'clear', severity: 'good', title: 'No writing issues found', detail: 'Review the facts and recipient yourself. This does not guarantee inbox delivery.' });
  return results;
}
