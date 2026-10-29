import type { AppData, CandidateProfile, Company } from '../types';

export const blankProfile: CandidateProfile = {
  name: '',
  education: '',
  availability: '',
  skills: '',
  experience: '',
  project: '',
  github: '',
  signoff: '',
};

const demoProfile: CandidateProfile = {
  name: 'Alex Morgan',
  education: 'Computer Science student',
  availability: 'Available for a six-month technical internship',
  skills: 'Python, SQL, React and data analysis',
  experience: 'Built a data quality dashboard that highlights missing values and duplicate records',
  project: 'Data Quality Dashboard',
  github: 'https://github.com/example',
  signoff: 'Alex Morgan',
};

const demoCompany: Company = {
  id: 'sample-company',
  name: 'Northstar Data',
  website: 'https://example.com',
  role: 'Data Engineering Intern',
  contactName: 'Hiring team',
  contactEmail: '',
  sourceUrl: 'https://example.com/careers',
  sourceText: 'Northstar Data builds data quality tools for analytics teams. The Data Engineering Intern works on data validation and Python workflows.',
  selectedFact: 'Northstar Data builds data quality tools for analytics teams.',
  subjectHook: 'Data quality work',
  matchingStrength: 'My data quality dashboard and Python experience connect to your data validation work.',
  status: 'Researching',
  updatedAt: new Date().toISOString(),
};

export function demoData(): AppData {
  return { profile: demoProfile, companies: [demoCompany], drafts: [] };
}

export function emptyData(): AppData {
  return { profile: { ...blankProfile }, companies: [], drafts: [] };
}

const STORAGE_KEY = 'outreachpilot:v1';

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoData();
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return demoData();
    const data = value as Partial<AppData>;
    if (!data.profile || !Array.isArray(data.companies) || !Array.isArray(data.drafts)) return demoData();
    return { profile: { ...blankProfile, ...data.profile }, companies: data.companies, drafts: data.drafts.map((draft) => draft.approved && !draft.approvedRecipient ? { ...draft, approved: false } : draft) };
  } catch {
    return demoData();
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
