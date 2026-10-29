import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, CircleAlert, Clipboard,
  Download, FileText, LayoutDashboard, Link2, Mail, Menu, Plus, Search, Upload,
  Send, ShieldCheck, Sparkles, Trash2, UserRound, WandSparkles, X,
} from 'lucide-react';
import type { AppData, CandidateProfile, Company, Draft, OutreachStatus } from './types';
import { demoData, emptyData, loadData, saveData } from './lib/data';
import { checkDraft, createGuidedDraft, postingIsFresh, sourceIsFresh, sourceSupportsFact } from './lib/draft';
import { exportBackup, parseBackup } from './lib/backup';

type Section = 'workspace' | 'tracker' | 'profile' | 'guide';
type Toast = { message: string; kind: 'success' | 'error' } | null;

const statuses: OutreachStatus[] = ['Researching', 'Drafted', 'Reviewed', 'Sent', 'Replied'];

function newCompany(): Company {
  return {
    id: crypto.randomUUID(), name: '', website: '', opportunityType: 'open', role: 'software, data or AI',
    postingUrl: '', postingText: '', companySummary: '', contactName: '', contactEmail: '',
    sourceUrl: '', sourceText: '', selectedFact: '', subjectHook: '', matchingStrength: '',
    status: 'Researching', updatedAt: new Date().toISOString(),
  };
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [section, setSection] = useState<Section>('workspace');
  const [selectedId, setSelectedId] = useState<string | null>(() => loadData().companies[0]?.id ?? null);
  const [companyForm, setCompanyForm] = useState<Company>(() => loadData().companies[0] ?? newCompany());
  const [draftForm, setDraftForm] = useState<Draft | null>(null);
  const [profileForm, setProfileForm] = useState<CandidateProfile>(() => loadData().profile);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [toast, setToast] = useState<Toast>(null);
  const [gmail, setGmail] = useState<{ configured: boolean; connected: boolean; email: string | null; expectedEmail: string | null } | null>(null);
  const [working, setWorking] = useState(false);
  const [cv, setCv] = useState<File | null>(null);
  const [pendingBackup, setPendingBackup] = useState<AppData | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => { saveData(data); }, [data]);
  useEffect(() => {
    refreshGmail();
    const params = new URLSearchParams(location.search);
    if (params.get('gmail') === 'connected') setToast({ message: 'Gmail connected. Review each draft before saving it.', kind: 'success' });
    if (params.get('gmail') === 'error') setToast({ message: params.get('reason') || 'Gmail connection failed.', kind: 'error' });
    if (params.has('gmail')) history.replaceState(null, '', location.pathname);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const savedDraft = data.drafts.find((draft) => draft.companyId === selectedId);
  const activeDraft = draftForm ?? savedDraft ?? null;
  const checks = useMemo(() => checkDraft(activeDraft?.subject ?? '', activeDraft?.body ?? '', companyForm), [activeDraft, companyForm]);
  const criticalCount = checks.filter((check) => check.severity === 'critical').length;
  const reviewCount = checks.filter((check) => check.severity === 'review').length;
  const filteredCompanies = data.companies.filter((company) => {
    const matches = `${company.name} ${company.role} ${company.contactName}`.toLowerCase().includes(query.toLowerCase());
    return matches && (statusFilter === 'All' || company.status === statusFilter);
  });
  const profileReady = Boolean(data.profile.name.trim() && data.profile.education.trim() && !(data.profile.name === 'Alex Morgan' && data.profile.github === 'https://github.com/example'));
  const opportunityType = companyForm.opportunityType || 'open';
  const nextStep = (() => {
    if (!profileReady) return 'First, add your real name and education in Candidate profile.';
    if (!companyForm.name.trim() || !companyForm.website.trim()) return 'Add a company name and website, then choose a listed role or open inquiry.';
    if (!companyForm.companySummary?.trim()) return 'Read the company website to understand its products or services.';
    if (opportunityType === 'posted' && (!companyForm.role.trim() || !companyForm.postingUrl?.trim())) return 'Add the exact role title and its job posting URL.';
    if (!sourceIsFresh(companyForm)) return 'Choose one fact from the company or role page and mark its source reviewed.';
    if (opportunityType === 'posted' && !postingIsFresh(companyForm)) return 'Check that the listed role is still open and mark its posting reviewed.';
    if (!activeDraft) return 'Create a draft, then edit its subject and message.';
    if (!activeDraft.approved) return 'Resolve the red review items and approve the draft.';
    return activeDraft.gmailDraftId ? 'Draft saved in Gmail. You choose when to send it.' : 'Attach your CV and save the approved message in Gmail Drafts.';
  })();

  const notify = (message: string, kind: 'success' | 'error' = 'success') => setToast({ message, kind });
  function refreshGmail() { fetch('/api/gmail/status').then((response) => response.json()).then(setGmail).catch(() => setGmail(null)); }
  const updateCompany = (field: keyof Company, value: string) => {
    const sourceChanged = ['website', 'sourceUrl', 'sourceText', 'selectedFact'].includes(field);
    const pageChanged = ['website', 'sourceUrl', 'sourceText'].includes(field);
    setCompanyForm((current) => {
      const postingChanged = ['postingUrl', 'postingText'].includes(field) || (field === 'role' && current.opportunityType === 'posted');
      const next = { ...current, [field]: value, ...(sourceChanged ? { sourceCheckedAt: undefined } : {}), ...(pageChanged ? { sourceFetchedAt: undefined } : {}), ...(postingChanged ? { postingCheckedAt: undefined } : {}) };
      if (field === 'website') next.companySummary = '';
      if (field === 'name' && current.name.trim() && current.name.trim().toLowerCase() !== value.trim().toLowerCase()) {
        next.companySummary = '';
        next.sourceUrl = '';
        next.sourceText = '';
        next.selectedFact = '';
        next.sourceCheckedAt = undefined;
        next.postingCheckedAt = undefined;
      }
      if ((field === 'website' && current.sourceUrl === current.website) || (field === 'postingUrl' && current.sourceUrl === current.postingUrl)) {
        next.sourceUrl = '';
        next.sourceText = '';
        next.selectedFact = '';
        next.sourceCheckedAt = undefined;
      }
      if (field === 'postingText' && current.sourceUrl === current.postingUrl) next.sourceCheckedAt = undefined;
      return next;
    });
    setDraftForm((current) => {
      const draft = current ?? savedDraft;
      return draft ? { ...draft, approved: false, approvedRecipient: undefined, gmailDraftId: undefined } : null;
    });
  };
  function chooseOpportunity(type: 'posted' | 'open') {
    if ((companyForm.opportunityType || 'open') === type) return;
    setCompanyForm((current) => {
      const next = { ...current, opportunityType: type, role: type === 'open' ? 'software, data or AI' : '', postingUrl: '', postingText: '', postingCheckedAt: undefined };
      if (type === 'open' && current.postingUrl && current.sourceUrl === current.postingUrl) {
        next.sourceUrl = '';
        next.sourceText = '';
        next.selectedFact = '';
        next.sourceCheckedAt = undefined;
      }
      return next;
    });
    setDraftForm((current) => { const draft = current ?? savedDraft; return draft ? { ...draft, approved: false, approvedRecipient: undefined, gmailDraftId: undefined } : null; });
  }
  const updateProfile = (field: keyof CandidateProfile, value: string) => setProfileForm((current) => ({ ...current, [field]: value }));

  function selectCompany(company: Company) {
    setSelectedId(company.id);
    setCompanyForm(company);
    setDraftForm(null);
    setSection('workspace');
    setMobileMenu(false);
  }

  function addCompany() {
    setSelectedId(null);
    setCompanyForm(newCompany());
    setDraftForm(null);
    setSection('workspace');
    setMobileMenu(false);
  }

  function saveCompany(): boolean {
    if (!companyForm.name.trim() || !companyForm.role.trim()) {
      notify('Add a company name and role first.', 'error');
      return false;
    }
    const duplicate = data.companies.some((item) => item.id !== companyForm.id && item.name.trim().toLowerCase() === companyForm.name.trim().toLowerCase() && item.role.trim().toLowerCase() === companyForm.role.trim().toLowerCase());
    if (duplicate) {
      notify('This company and role already exist in your workspace.', 'error');
      return false;
    }
    const saved = { ...companyForm, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, companies: [saved, ...current.companies.filter((item) => item.id !== saved.id)] }));
    setSelectedId(saved.id);
    setCompanyForm(saved);
    notify('Company research saved.');
    return true;
  }

  function generateDraft() {
    if (!companyForm.name.trim() || !companyForm.role.trim()) {
      notify('Add a company name and role before drafting.', 'error');
      return;
    }
    if (!data.profile.name.trim() || !data.profile.education.trim()) {
      notify('Add your name and education in Candidate profile first.', 'error');
      return;
    }
    if (data.profile.name === 'Alex Morgan' && data.profile.github === 'https://github.com/example') {
      notify('Replace the sample candidate profile before creating a real draft.', 'error');
      return;
    }
    const content = createGuidedDraft(data.profile, companyForm);
    const now = new Date().toISOString();
    setDraftForm({ id: savedDraft?.id ?? crypto.randomUUID(), companyId: companyForm.id, ...content, approved: false, createdAt: savedDraft?.createdAt ?? now, updatedAt: now });
    notify('Draft ready for your review.');
  }

  async function analyzeUrl(target: 'company' | 'posting') {
    const requestedUrl = target === 'posting' ? companyForm.postingUrl : companyForm.website;
    if (!requestedUrl?.trim()) { notify(target === 'posting' ? 'Add the job posting URL first.' : 'Add the company URL first.', 'error'); return; }
    setWorking(true);
    try {
      const response = await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: requestedUrl.trim() }) });
      const result = await response.json() as { url?: string; excerpt?: string; suggestedFact?: string; error?: string };
      if (!response.ok || !result.excerpt) throw new Error(result.error || 'Could not read this website.');
      setCompanyForm((current) => {
        const evidence = { sourceUrl: result.url || requestedUrl, sourceText: result.excerpt || '', selectedFact: result.suggestedFact || '', sourceFetchedAt: new Date().toISOString(), sourceCheckedAt: undefined };
        if (target === 'posting') return { ...current, postingText: result.excerpt || '', postingCheckedAt: undefined, ...evidence };
        return { ...current, companySummary: result.suggestedFact || result.excerpt?.slice(0, 400) || '', ...((current.opportunityType !== 'posted' || !current.sourceText.trim()) ? evidence : {}) };
      });
      setDraftForm((current) => { const draft = current ?? savedDraft; return draft ? { ...draft, approved: false, approvedRecipient: undefined, gmailDraftId: undefined } : null; });
      notify(target === 'posting' ? 'Job page loaded. Check that the role is current and review the fact.' : 'Company page loaded. Review what the company does and the fact you will mention.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not analyze URL.', 'error'); }
    finally { setWorking(false); }
  }

  function markPostingChecked() {
    if (!companyForm.postingUrl?.trim() || !companyForm.postingText?.trim()) { notify('Read or paste the job posting before confirming it.', 'error'); return; }
    setCompanyForm((current) => ({ ...current, postingCheckedAt: new Date().toISOString() }));
    notify('Job posting marked as reviewed today.');
  }

  function markSourceChecked() {
    if (!companyForm.sourceUrl.trim() || !sourceSupportsFact(companyForm)) { notify('Add a source URL and an exact fact from its text first.', 'error'); return; }
    setCompanyForm((current) => ({ ...current, sourceCheckedAt: new Date().toISOString() }));
    notify('Source marked reviewed today. Save the research to keep this date.');
  }

  function downloadBackup() {
    const blob = new Blob([exportBackup(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `outreachpilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Backup downloaded. Keep it private; it contains your leads and drafts.');
  }

  async function loadBackup(file: File | undefined) {
    if (!file) return;
    setPendingBackup(null);
    if (file.size > 2_000_000) { notify('Backup file is too large (2 MB maximum).', 'error'); return; }
    try { setPendingBackup(parseBackup(await file.text())); notify('Backup checked. Review its counts before restoring.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Could not read backup.', 'error'); }
  }

  function restoreBackup() {
    if (!pendingBackup) return;
    const next = pendingBackup;
    setData(next);
    setProfileForm(next.profile);
    setSelectedId(next.companies[0]?.id ?? null);
    setCompanyForm(next.companies[0] ?? newCompany());
    setDraftForm(null);
    setPendingBackup(null);
    setSection('workspace');
    notify('Backup restored in this browser.');
  }

  async function pushGmailDraft() {
    if (!activeDraft?.approved || criticalCount || activeDraft.approvedRecipient !== companyForm.contactEmail.trim()) { notify('Approve this recipient and draft before saving to Gmail.', 'error'); return; }
    if (activeDraft.gmailDraftId) { notify('This version is already in Gmail Drafts. Edit and approve a new version first.', 'error'); return; }
    if (!companyForm.contactEmail.trim()) { notify('Add the HR email address first.', 'error'); return; }
    if (!cv) { notify('Attach your PDF CV before saving the Gmail draft.', 'error'); return; }
    if (!gmail?.connected) { notify('Connect the intended Gmail account first.', 'error'); return; }
    setWorking(true);
    try {
      if (cv.type !== 'application/pdf' || cv.size > 3_500_000) throw new Error('Choose a PDF CV under 3.5 MB.');
      const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read the CV.')); reader.readAsDataURL(cv); });
      const attachment: { name: string; mime: 'application/pdf'; data: string } = { name: cv.name, mime: 'application/pdf', data: encoded };
      const response = await fetch('/api/gmail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: companyForm.contactEmail.trim(), subject: activeDraft.subject, body: activeDraft.body, attachment }) });
      const result = await response.json() as { id?: string; error?: string; email?: string; indexWarning?: string; reused?: boolean };
      if (!response.ok || !result.id) throw new Error(result.error || 'Gmail draft was not saved.');
      const synced = { ...activeDraft, gmailDraftId: result.id };
      setDraftForm(synced);
      setData((current) => ({ ...current, drafts: current.drafts.map((item) => item.id === synced.id ? synced : item) }));
      notify(result.indexWarning || `${result.reused ? 'Already saved' : 'Saved'} in ${result.email} Drafts. Nothing was sent.`, result.indexWarning ? 'error' : 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Gmail draft failed.', 'error'); }
    finally { setWorking(false); }
  }

  function saveDraft(approve: boolean) {
    if (!activeDraft) return;
    if (!companyForm.name.trim() || !companyForm.role.trim()) { notify('Save the company details first.', 'error'); return; }
    if (approve && criticalCount > 0) { notify('Resolve the required checks before approval.', 'error'); return; }
    if (approve && !companyForm.contactEmail.trim()) { notify('Add the HR email before approval.', 'error'); return; }
    const now = new Date().toISOString();
    const company = { ...companyForm, status: (approve ? 'Reviewed' : 'Drafted') as OutreachStatus, updatedAt: now };
    const draft = { ...activeDraft, approved: approve, approvedRecipient: approve ? companyForm.contactEmail.trim() : undefined, gmailDraftId: undefined, updatedAt: now };
    setData((current) => ({ ...current, companies: [company, ...current.companies.filter((item) => item.id !== company.id)], drafts: [draft, ...current.drafts.filter((item) => item.id !== draft.id)] }));
    setSelectedId(company.id);
    setCompanyForm(company);
    setDraftForm(draft);
    notify(approve ? 'Draft approved and saved locally.' : 'Draft saved locally.');
  }

  async function copyDraft() {
    if (!activeDraft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${activeDraft.subject}\n\n${activeDraft.body}`);
      notify('Subject and email copied.');
    } catch {
      notify('Clipboard unavailable. Select and copy the draft fields.', 'error');
    }
  }

  function changeStatus(company: Company, status: OutreachStatus) {
    const updated = { ...company, status, updatedAt: new Date().toISOString() };
    setData((current) => ({ ...current, companies: current.companies.map((item) => item.id === company.id ? updated : item) }));
    if (selectedId === company.id) setCompanyForm(updated);
  }

  const nav = [
    { id: 'workspace' as const, label: 'Draft workspace', icon: LayoutDashboard },
    { id: 'tracker' as const, label: 'Outreach tracker', icon: Send },
    { id: 'profile' as const, label: 'Candidate profile', icon: UserRound },
    { id: 'guide' as const, label: 'How it works', icon: BookOpen },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Mail size={20} strokeWidth={2.4} /></div><div><strong>OutreachPilot</strong><span>Personalized outreach studio</span></div></div>
        <button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={20} /></button>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => <button key={item.id} className={`nav-item ${section === item.id ? 'active' : ''}`} onClick={() => { setSection(item.id); setMobileMenu(false); }}><item.icon size={18} />{item.label}{section === item.id && <span className="nav-dot" />}</button>)}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-row"><span className="sidebar-label">YOUR COMPANIES</span><button className="icon-button small" aria-label="Add company" onClick={addCompany}><Plus size={17} /></button></div>
        <div className="company-list">
          {data.companies.length === 0 ? <p className="sidebar-empty">No companies yet</p> : data.companies.map((company) => <button key={company.id} className={`company-item ${selectedId === company.id && section === 'workspace' ? 'selected' : ''}`} onClick={() => selectCompany(company)}><span className="company-avatar">{company.name.slice(0, 1).toUpperCase()}</span><span className="company-item-copy"><strong>{company.name}</strong><small>{company.role}</small></span></button>)}
        </div>
        <div className="sidebar-bottom"><span className="status-dot" /> Local workspace <span className="sidebar-bottom-note">· data stays in this browser</span></div>
      </aside>

      {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>{section === 'workspace' ? 'Draft studio' : section === 'tracker' ? 'Outreach tracker' : section === 'profile' ? 'Candidate profile' : 'How it works'}</strong></div><div className="topbar-right"><span className={`mode-badge ${gmail?.connected ? 'online' : ''}`}><span className="status-dot" />{gmail?.connected ? `Gmail: ${gmail.email}` : 'Gmail disconnected'}</span><span className="avatar">{data.profile.name.slice(0, 1).toUpperCase() || 'Y'}</span></div></header>

        {section === 'workspace' && <div className="page workspace-page">
          <div className="page-heading"><div><div className="eyebrow"><Sparkles size={14} /> THE DRAFT STUDIO</div><h1>Write outreach that feels <em>personal.</em></h1><p>Ground each email in a real company detail and your actual experience.</p></div><button className="button button-outline" onClick={addCompany}><Plus size={17} /> New company</button></div>

          <div className="next-step"><strong>Next step</strong><span>{nextStep}</span>{!profileReady && <button className="button button-outline" onClick={() => setSection('profile')}>Open profile <ArrowRight size={15}/></button>}</div>
          <div className="workflow-strip" aria-label="Workflow"><span className={`workflow-step ${profileReady ? 'current' : ''}`}><span>01</span>Profile</span><span className="workflow-line"/><span className={`workflow-step ${companyForm.name ? 'current' : ''}`}><span>02</span>Research</span><span className="workflow-line"/><span className={`workflow-step ${activeDraft ? 'current' : ''}`}><span>03</span>Draft</span><span className="workflow-line"/><span className={`workflow-step ${activeDraft?.approved ? 'current' : ''}`}><span>04</span>Review &amp; Gmail</span></div>

          <div className="workspace-grid">
            <div className="workspace-left">
              <section className="card research-card"><div className="card-head"><div className="card-heading"><span className="step-icon"><Search size={18} /></span><div><h2>Company and opportunity</h2><p>Choose what you are asking for, then check the evidence.</p></div></div><span className="step-number">STEP 02</span></div>
                {selectedId === 'sample-company' && <div className="sample-note"><Sparkles size={15}/> Sample company and profile for demonstration. Replace with your own before real outreach.</div>}
                <div className="choice-heading">Which type of email?</div>
                <div className="opportunity-choices" role="group" aria-label="Outreach type"><button type="button" className={opportunityType === 'posted' ? 'selected' : ''} onClick={() => chooseOpportunity('posted')} aria-pressed={opportunityType === 'posted'}><strong>Apply to a listed role</strong><small>You have a current job posting link.</small></button><button type="button" className={opportunityType === 'open' ? 'selected' : ''} onClick={() => chooseOpportunity('open')} aria-pressed={opportunityType === 'open'}><strong>Open internship inquiry</strong><small>No advertised role required; ask about future fit.</small></button></div>
                <div className="url-explainer"><strong>Company URL</strong> is the main website. <strong>Source URL</strong> is the exact page supporting the fact in your email; analysis fills it for you. For a listed role, also add the <strong>job posting URL</strong>.</div>
                <div className="form-grid"><Field label="Company name" required value={companyForm.name} onChange={(v) => updateCompany('name', v)} placeholder="e.g. Acme Analytics" /><Field label="Company URL (main website)" required type="url" value={companyForm.website} onChange={(v) => updateCompany('website', v)} placeholder="https://company.com" /><Field label="HR email (recipient)" required type="email" value={companyForm.contactEmail} onChange={(v) => updateCompany('contactEmail', v)} placeholder="The address you provide" /><Field label="Contact name (if known)" value={companyForm.contactName} onChange={(v) => updateCompany('contactName', v)} placeholder="e.g. Priya" /><Field label={opportunityType === 'posted' ? 'Exact role title from the listing' : 'Internship area you want'} required value={companyForm.role} onChange={(v) => updateCompany('role', v)} placeholder={opportunityType === 'posted' ? 'e.g. Data Engineering Intern' : 'e.g. AI/ML, data or software'} />{opportunityType === 'posted' && <Field label="Job posting URL" required type="url" value={companyForm.postingUrl || ''} onChange={(v) => updateCompany('postingUrl', v)} placeholder="https://company.com/careers/role" />}</div>
                <div className="analyze-row"><button className="button button-soft" disabled={working} onClick={() => void analyzeUrl('company')}><Search size={16}/>{working ? 'Reading page...' : 'Read company website'}</button><span>See what the company builds or sells; verify it on their site.</span></div>
                <label className="field full"><span>What the company does <small>Auto-filled from the company website; edit if needed</small></span><textarea rows={3} value={companyForm.companySummary || ''} onChange={(e) => updateCompany('companySummary', e.target.value)} placeholder="A short, factual overview of its products or services..." /></label>
                {opportunityType === 'posted' && <div className="posting-block"><div className="analyze-row"><button className="button button-soft" disabled={working} onClick={() => void analyzeUrl('posting')}><Search size={16}/>{working ? 'Reading page...' : 'Read job posting'}</button>{companyForm.postingUrl && <a href={companyForm.postingUrl} target="_blank" rel="noreferrer"><Link2 size={14}/> Open listing</a>}</div><label className="field full"><span>What the listing says <small>Check the title, team and whether applications are still open</small></span><textarea rows={3} value={companyForm.postingText || ''} onChange={(e) => updateCompany('postingText', e.target.value)} placeholder="Auto-filled from the job page, or paste relevant listing text..." /></label><div className="source-review"><span>{companyForm.postingCheckedAt ? postingIsFresh(companyForm) ? `Posting checked ${dateLabel(companyForm.postingCheckedAt)}` : 'Posting check expired; verify it again.' : 'The app cannot confirm vacancies automatically.'}</span><button className="button button-soft" onClick={markPostingChecked}><Check size={15}/> I confirmed this listing is current</button></div></div>}
                <details className="evidence-details"><summary>Evidence page details (source URL and text)</summary><p>This is the exact page used for the one fact in the email. It may be the company page or the job posting. If automatic reading fails, paste the page text here.</p><Field label="Source URL" type="url" value={companyForm.sourceUrl} onChange={(v) => updateCompany('sourceUrl', v)} placeholder="Auto-filled by page analysis" /><label className="field full"><span>Source text</span><textarea rows={4} value={companyForm.sourceText} onChange={(e) => updateCompany('sourceText', e.target.value)} placeholder="Paste relevant text from the page..." /></label></details>
                <label className="field full"><span>One verified fact to mention <small>Copy one short sentence from the source page</small></span><textarea rows={2} value={companyForm.selectedFact} onChange={(e) => updateCompany('selectedFact', e.target.value)} placeholder="e.g. The team builds tools for data quality..." /></label>
                <Field label="Short subject angle (optional)" value={companyForm.subjectHook || ''} onChange={(v) => updateCompany('subjectHook', v)} placeholder="e.g. Data quality work" />
                {companyForm.selectedFact.trim() && <div className={`evidence-state ${sourceSupportsFact(companyForm) ? 'supported' : 'unsupported'}`}>{sourceSupportsFact(companyForm) ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{sourceSupportsFact(companyForm) ? 'Fact found in source text' : 'Fact not found in source text — verify or paste the exact sentence'}{companyForm.sourceUrl && <a href={companyForm.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={14}/> Open source</a>}</div>}
                <div className="source-review"><span>{companyForm.sourceCheckedAt ? sourceIsFresh(companyForm) ? `Source reviewed ${dateLabel(companyForm.sourceCheckedAt)} · review again in 30 days` : 'Source review expired. Check the page again.' : companyForm.sourceFetchedAt ? 'Website excerpt fetched. Please verify it on the original page.' : 'Open the source and verify the selected fact before approval.'}</span><button className="button button-soft" onClick={markSourceChecked}><Check size={15}/> I reviewed the source</button></div>
                <label className="field full"><span>Your connection to their work <small>One honest sentence about a relevant project or skill</small></span><textarea rows={2} value={companyForm.matchingStrength} onChange={(e) => updateCompany('matchingStrength', e.target.value)} placeholder="e.g. I built a Python data quality dashboard that relates to your validation work." /></label>
                <div className="card-actions"><span className="helper-text"><ShieldCheck size={15}/> You verify the facts. No email is sent.</span><button className="button button-outline" onClick={saveCompany}>Save research</button></div>
              </section>
              <section className="card generate-card"><div className="card-heading"><span className="step-icon violet"><WandSparkles size={18}/></span><div><h2>Create a draft</h2><p>Start with a sourced detail and a relevant contribution.</p></div></div><div className="generate-actions"><button className="button button-primary" onClick={generateDraft}><Sparkles size={17}/>Create draft<ArrowRight size={16}/></button></div><p className="small-print">Short, editable copy. Review every detail before saving it in Gmail.</p></section>
            </div>

            <div className="workspace-right"><section className="card draft-card"><div className="card-head"><div className="card-heading"><span className="step-icon blue"><FileText size={18}/></span><div><h2>Your draft</h2><p>Edit every word before you approve.</p></div></div><span className={`draft-state ${activeDraft?.approved ? 'approved' : ''}`}>{activeDraft?.approved ? 'Approved' : activeDraft ? 'In progress' : 'No draft yet'}</span></div>
              {activeDraft ? <><div className="draft-meta"><span>Personalized draft</span><span>{wordCount(activeDraft.body)} words</span></div><label className="field full"><span>Subject</span><input value={activeDraft.subject} onChange={(e) => setDraftForm({ ...activeDraft, subject: e.target.value, approved: false, gmailDraftId: undefined })}/></label><label className="field full"><span>Message</span><textarea className="draft-body" value={activeDraft.body} onChange={(e) => setDraftForm({ ...activeDraft, body: e.target.value, approved: false, gmailDraftId: undefined })}/></label><div className="draft-actions"><button className="button button-outline" onClick={() => saveDraft(false)}>Save draft</button><button className="button button-primary" onClick={() => saveDraft(true)}><Check size={17}/> Approve draft</button></div><button className="text-action" onClick={() => void copyDraft()}><Clipboard size={15}/> Copy subject and message</button><div className="gmail-box"><h3>Save to Gmail Drafts</h3><p>Recipient: {companyForm.contactEmail || 'Add an HR email above'} · Sender: {gmail?.email || gmail?.expectedEmail || 'Not connected'}</p><label className="field"><span>Attach CV (PDF, required)</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => setCv(event.target.files?.[0] || null)}/></label>{gmail?.connected ? <button className="button button-primary" disabled={working || !activeDraft.approved || Boolean(activeDraft.gmailDraftId)} onClick={() => void pushGmailDraft()}><Mail size={16}/>{activeDraft.gmailDraftId ? 'Saved in Gmail Drafts' : 'Save in Gmail Drafts'}</button> : gmail?.configured ? <a className="button button-outline" href="http://127.0.0.1:8787/api/gmail/connect">Connect {gmail.expectedEmail}</a> : <p>Google OAuth setup is needed. Follow the README; no email will be sent automatically.</p>}{activeDraft.gmailDraftId && <a className="text-action" href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noreferrer">Open Gmail Drafts</a>}</div></> : <div className="draft-empty"><div className="empty-illustration"><Mail size={34}/><span><Sparkles size={16}/></span></div><h3>A better first impression starts here.</h3><p>Add company research, then generate a draft. You can edit everything before you use it.</p></div>}
            </section>
            <section className="card checks-card"><div className="checks-heading"><div><span className="eyebrow">QUALITY REVIEW</span><h2>Writing checks</h2></div>{activeDraft && <span className={`check-count ${criticalCount ? 'has-critical' : ''}`}>{criticalCount ? `${criticalCount} required fixes` : reviewCount ? `${reviewCount} suggestions` : 'Ready to review'}</span>}</div>{activeDraft ? <><p className="checks-intro"><strong>Red:</strong> fix before approval. <strong>Amber:</strong> wording suggestion; review it yourself. These checks cannot guarantee inbox delivery.</p><div className="check-list">{checks.map((check) => <div className={`check-item ${check.severity}`} key={check.id}><span className="check-icon">{check.severity === 'good' ? <Check size={15}/> : <CircleAlert size={15}/>}</span><div><strong>{check.title}</strong><p>{check.detail}</p>{check.match && <code>“{check.match}”</code>}</div></div>)}</div></> : <p className="checks-intro">Create a draft first. This panel will then show missing facts, recipient issues and wording suggestions. No action is needed here yet.</p>}</section></div>
          </div>
        </div>}

        {section === 'tracker' && <div className="page"><div className="page-heading"><div><div className="eyebrow"><Send size={14}/> OUTREACH PIPELINE</div><h1>Every conversation, <em>in one place.</em></h1><p>Track each opportunity from first research to a reply.</p></div><button className="button button-primary" onClick={addCompany}><Plus size={17}/> Add company</button></div><div className="stats-grid"><Stat title="Companies" value={data.companies.length} icon={<LayoutDashboard size={19}/>} /><Stat title="Drafts saved" value={data.drafts.length} icon={<FileText size={19}/>} /><Stat title="Reviewed" value={data.companies.filter((company) => company.status === 'Reviewed').length} icon={<CheckCircle2 size={19}/>} /><Stat title="Replies" value={data.companies.filter((company) => company.status === 'Replied').length} icon={<Mail size={19}/>} /></div><section className="card table-card"><div className="table-head"><div><h2>All outreach</h2><p>Only records saved in this browser appear here.</p></div><div className="table-controls"><label className="search-box"><Search size={17}/><input aria-label="Search companies" placeholder="Search companies..." value={query} onChange={(e) => setQuery(e.target.value)} /></label><label className="select-wrap"><select aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={15}/></label></div></div><div className="table-scroll"><table><thead><tr><th>COMPANY</th><th>ROLE</th><th>CONTACT</th><th>STATUS</th><th>UPDATED</th><th></th></tr></thead><tbody>{filteredCompanies.map((company) => <tr key={company.id}><td><div className="table-company"><span className="company-avatar">{company.name.slice(0,1).toUpperCase()}</span><strong>{company.name}</strong>{company.id === 'sample-company' && <small>DEMO</small>}</div></td><td>{company.role}</td><td>{company.contactName || '—'}</td><td><select aria-label={`Status for ${company.name}`} className={`status-select status-${company.status.toLowerCase()}`} value={company.status} onChange={(e) => changeStatus(company, e.target.value as OutreachStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td>{dateLabel(company.updatedAt)}</td><td><button className="table-open" aria-label={`Open ${company.name}`} onClick={() => selectCompany(company)}><ArrowRight size={17}/></button></td></tr>)}</tbody></table>{filteredCompanies.length === 0 && <div className="table-empty">No companies match this view. <button onClick={addCompany}>Add one</button></div>}</div></section></div>}

        {section === 'profile' && <div className="page"><div className="page-heading"><div><div className="eyebrow"><UserRound size={14}/> YOUR VERIFIED DETAILS</div><h1>Make it sound like <em>you.</em></h1><p>These details are the only candidate facts the draft generator may use.</p></div></div><div className="profile-layout"><section className="card profile-card"><div className="card-head"><div className="card-heading"><span className="step-icon"><UserRound size={18}/></span><div><h2>Candidate profile</h2><p>Use claims you can verify and discuss confidently.</p></div></div></div><div className="form-grid"><Field label="Full name" value={profileForm.name} onChange={(v) => updateProfile('name', v)} placeholder="Your name"/><Field label="Education / current role" value={profileForm.education} onChange={(v) => updateProfile('education', v)} placeholder="e.g. CS student at..."/><Field label="Internship availability" value={profileForm.availability} onChange={(v) => updateProfile('availability', v)} placeholder="e.g. Jan–Jun 2027"/><Field label="Skills" value={profileForm.skills} onChange={(v) => updateProfile('skills', v)} placeholder="Skills you can demonstrate"/><Field label="Project title" value={profileForm.project} onChange={(v) => updateProfile('project', v)} placeholder="A relevant project"/><Field label="GitHub URL" value={profileForm.github} onChange={(v) => updateProfile('github', v)} placeholder="https://github.com/..."/></div><label className="field full"><span>One verified experience or achievement</span><textarea rows={3} value={profileForm.experience} onChange={(e) => updateProfile('experience', e.target.value)} placeholder="Describe what you actually did..."/></label><Field label="Email sign-off" value={profileForm.signoff} onChange={(v) => updateProfile('signoff', v)} placeholder="Usually your name"/><div className="card-actions"><span className="helper-text"><ShieldCheck size={15}/> Your profile stays in this browser until you export a backup.</span><button className="button button-primary" onClick={() => { setData((current) => ({ ...current, profile: profileForm })); notify('Candidate profile saved.'); }}>Save profile</button></div></section><aside className="profile-tips"><div className="tip-icon"><ShieldCheck size={24}/></div><h3>Trustworthy outreach starts here</h3><p>Only enter skills, dates and achievements you can back up. Company claims need a source in the draft workspace.</p><div className="tip-divider"/><p><strong>Portfolio tip</strong><br/>Use synthetic sample data in public screenshots. Never commit personal contact lists, CVs, OAuth tokens or model keys.</p><div className="tip-divider"/><h3>Private backup</h3><p>Download your local leads and drafts. Restore replaces this browser's workspace after you review the file.</p><div className="backup-actions"><button className="button button-outline" onClick={downloadBackup}><Download size={15}/> Download backup</button><label className="button button-soft"><Upload size={15}/> Choose backup<input type="file" accept="application/json,.json" onChange={(event) => { void loadBackup(event.target.files?.[0]); event.target.value = ''; }}/></label></div>{pendingBackup && <div className="backup-review"><strong>Ready to restore</strong><p>{pendingBackup.companies.length} companies · {pendingBackup.drafts.length} drafts. This will replace the current local workspace.</p><button className="button button-primary" onClick={restoreBackup}>Restore backup</button><button className="text-action" onClick={() => setPendingBackup(null)}>Cancel</button></div>}<div className="profile-reset"><button onClick={() => { const next = emptyData(); setData(next); setProfileForm(next.profile); setSelectedId(null); setCompanyForm(newCompany()); setDraftForm(null); notify('Started an empty local workspace.'); }}><Trash2 size={14}/> Start an empty workspace</button><button onClick={() => { const next = demoData(); setData(next); setProfileForm(next.profile); setSelectedId(next.companies[0].id); setCompanyForm(next.companies[0]); setDraftForm(null); notify('Sample workspace loaded.'); }}>Reload sample data</button></div></aside></div></div>}

        {section === 'guide' && <div className="page guide-page">
          <div className="page-heading"><div><div className="eyebrow"><BookOpen size={14}/> PRODUCT GUIDE</div><h1>One lead, <em>one careful draft.</em></h1><p>Complete each step; nothing is sent automatically.</p></div></div>
          <div className="guide-grid">
            <GuideCard number="01" icon={<UserRound size={22}/>} title="Your profile" text="Save your real name, education and verifiable experience. The sample profile cannot be used for real outreach."/>
            <GuideCard number="02" icon={<Search size={22}/>} title="Choose the outreach type" text="Use Listed role when you have a current job posting URL. Use Open inquiry when you want to ask about internships without claiming a vacancy."/>
            <GuideCard number="03" icon={<Link2 size={22}/>} title="Check the source" text="Company URL is the homepage. Source URL is the exact page for one fact you mention. The app fills it when it reads a page; you verify the fact."/>
            <GuideCard number="04" icon={<ShieldCheck size={22}/>} title="Review and save" text="Edit the draft, fix red issues, review amber suggestions, attach your PDF CV and save an unsent Gmail draft."/>
          </div>
          <section className="card guide-banner"><div><span className="eyebrow">GMAIL CONNECTION</span><h2>Drafts stay in your Gmail until you send them.</h2><p>A Google OAuth client is needed to connect your account; setup is in the README. The app creates drafts only.</p></div><button className="button button-outline" onClick={() => setSection('workspace')}>Back to draft <ArrowRight size={15}/></button></section>
        </div>}
      </main>

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.kind === 'success' ? <CheckCircle2 size={18}/> : <CircleAlert size={18}/>}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={16}/></button></div>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return <label className="field"><span>{label}{required && <i>*</i>}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/></label>;
}

function Stat({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <div className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-value">{value.toString().padStart(2, '0')}</span><span className="stat-title">{title}</span></div>;
}

function GuideCard({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) {
  return <div className="guide-card"><span className="guide-number">{number}</span><span className="guide-icon">{icon}</span><h2>{title}</h2><p>{text}</p></div>;
}

export default App;
