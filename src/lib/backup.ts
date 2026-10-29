import { z } from 'zod';
import type { AppData } from '../types';

const short = z.string().max(2000);
const date = short.refine((value) => Number.isFinite(new Date(value).getTime()));
const companySchema = z.object({
  id: short,
  name: short,
  website: short,
  opportunityType: z.enum(['posted', 'open']).optional(),
  role: short,
  postingUrl: short.optional(),
  postingText: z.string().max(25000).optional(),
  postingCheckedAt: date.optional(),
  companySummary: z.string().max(25000).optional(),
  contactName: short,
  contactEmail: short,
  sourceUrl: short,
  sourceText: z.string().max(25000),
  selectedFact: short,
  subjectHook: short.optional(),
  sourceFetchedAt: date.optional(),
  sourceCheckedAt: date.optional(),
  matchingStrength: short,
  status: z.enum(['Researching', 'Drafted', 'Reviewed', 'Sent', 'Replied']),
  updatedAt: date,
});
const draftSchema = z.object({
  id: short,
  companyId: short,
  subject: short,
  body: z.string().max(12000),
  mode: z.literal('guided'),
  approved: z.boolean(),
  approvedRecipient: short.optional(),
  gmailDraftId: short.optional(),
  createdAt: date,
  updatedAt: date,
});
const profileSchema = z.object({
  name: short,
  education: short,
  availability: short,
  skills: short,
  experience: short,
  project: short,
  github: short,
  signoff: short,
});
const backupSchema = z.object({
  app: z.literal('OutreachPilot'),
  version: z.literal(1),
  exportedAt: date,
  data: z.object({
    profile: profileSchema,
    companies: z.array(companySchema).max(2000),
    drafts: z.array(draftSchema).max(2000),
  }),
});

export function exportBackup(data: AppData): string {
  return JSON.stringify(
    { app: 'OutreachPilot', version: 1, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}

export function parseBackup(raw: string): AppData {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('This is not a valid JSON backup.');
  }
  const result = backupSchema.safeParse(value);
  if (!result.success) throw new Error('This file is not a supported OutreachPilot backup.');
  const ids = new Set(result.data.data.companies.map((company) => company.id));
  if (
    ids.size !== result.data.data.companies.length ||
    result.data.data.drafts.some((draft) => !ids.has(draft.companyId))
  )
    throw new Error('Backup has duplicate or missing company records.');
  return {
    ...result.data.data,
    drafts: result.data.data.drafts.map((draft) =>
      draft.approved && !draft.approvedRecipient ? { ...draft, approved: false } : draft,
    ),
  };
}
