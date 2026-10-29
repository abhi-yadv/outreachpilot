export type OutreachStatus = 'Researching' | 'Drafted' | 'Reviewed' | 'Sent' | 'Replied';

export interface CandidateProfile {
  name: string;
  education: string;
  availability: string;
  skills: string;
  experience: string;
  project: string;
  github: string;
  signoff: string;
}

export interface Company {
  id: string;
  name: string;
  website: string;
  opportunityType?: 'posted' | 'open';
  role: string;
  postingUrl?: string;
  postingText?: string;
  postingCheckedAt?: string;
  companySummary?: string;
  contactName: string;
  contactEmail: string;
  sourceUrl: string;
  sourceText: string;
  selectedFact: string;
  subjectHook?: string;
  sourceFetchedAt?: string;
  sourceCheckedAt?: string;
  matchingStrength: string;
  status: OutreachStatus;
  updatedAt: string;
}

export interface Draft {
  id: string;
  companyId: string;
  subject: string;
  body: string;
  mode: 'guided';
  approved: boolean;
  approvedRecipient?: string;
  gmailDraftId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  profile: CandidateProfile;
  companies: Company[];
  drafts: Draft[];
}

export interface CheckResult {
  id: string;
  severity: 'critical' | 'review' | 'good';
  title: string;
  detail: string;
  match?: string;
}
