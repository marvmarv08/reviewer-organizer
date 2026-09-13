/**
 * Main React interface for Reviewer Organizer.
 * The feature sections below connect screens to the local database and cloud helpers.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertCircle, ArrowLeft, BarChart3, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, CloudOff, RefreshCw,
  Copy, Download,
  FileText, GraduationCap, History, Home, Menu, NotebookPen, Pencil, Plus, School, Search,
  Settings, ShieldCheck, Trash2, Upload, X,
} from 'lucide-react'
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createBackup, restoreBackup, validateBackup } from './backup'
import { db, deleteSubjectCascade } from './db'
import { createFlashcardSession, flashcardIntervals, formatReviewInterval, isAcceptedAnswer, isQuestionDue, LEVEL_NAMES, moveQuestion, prioritizeDueFlashcardRepeat, randomSelection, recordAnswer, scheduleFlashcard, updateFlashcardSessionAfterRating } from './mastery'
import { normalizeQuestionPrompt, parseQuestionImport, type ImportableQuestion } from './question-import'
import { normalizeNoteTitle, parseNoteImport, type ImportableNote } from './note-import'
import type { MasteryLevel, Note, NoteLevel, Question, ReviewRating, Subject, TestAnswer, TestSession } from './types'
import { supabase } from './lib/supabase'
import { enableUserSync, getSyncStatus, subscribeToSyncStatus, subscribeToUserChanges, switchUserCache, syncUserData, unsubscribeFromUserChanges, type SyncStatus } from './sync'
import type { Session } from '@supabase/supabase-js'
import { deleteNote, deleteQuestions, deleteSubject, saveNote, saveQuestion, saveQuestions, saveSubject } from './remote'
import { createPdfOpenUrl, createPdfReviewer, deletePdfReviewer, deleteSubjectPdfs } from './pdf-storage'
import noteGeneratorPrompt from '../templates/chatgpt-notes-import-prompt.txt?raw'
import { GoogleClassroomImport } from './GoogleClassroomImport'
import { GoogleClassroomConnect } from './GoogleClassroomConnect'

const COLORS = ['#a51d25', '#7a171d', '#c74b50', '#d49a28', '#59636f', '#8b5e3c']
const NOTE_LEVEL_NAMES: Record<NoteLevel, string> = { 1: 'Level 1 · Current', 2: 'Level 2 · Completed', 3: 'Final notes reviewer' }
type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password' | 'update-password'

function authRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}

// Authentication gate: only a signed-in user can enter the private study workspace.
function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void client.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update-password')
        setPassword('')
        setPasswordConfirmation('')
        setError('')
        setMessage('Your reset link is verified. Choose a new password.')
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])
  const userId = session?.user.id
  useEffect(() => {
    // On login, isolate the cache, sync it, and keep it fresh across devices.
    if (!userId) return
    let cancelled = false
    const refresh = () => { if (!cancelled) void syncUserData(userId).catch(() => undefined) }
    const activate = async () => {
      await switchUserCache(userId)
      if (cancelled) return
      enableUserSync(userId)
      refresh()
      subscribeToUserChanges(userId)
    }
    void activate().catch(() => undefined)
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      cancelled = true
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      unsubscribeFromUserChanges()
    }
  }, [userId])

  if (!supabase) return <div className="auth-screen"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><Check /></span><div><strong>Reviewer</strong><small>Organizer</small></div></div><p className="eyebrow">Secure study space</p><h1>Sign in to continue</h1><p>The app is ready for accounts, but the Supabase connection is not configured in this copy yet.</p><div className="notice">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to this folder’s <code>.env.local</code>, then restart the dev server.</div></section></div>
  if (loading) return <div className="auth-screen"><div className="auth-card"><p>Loading your secure study space…</p></div></div>
  if (session && mode !== 'update-password') return <Layout userEmail={session.user.email} />

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    const client = supabase
    if (!client) return
    const action = mode === 'sign-in'
      ? client.auth.signInWithPassword({ email, password })
      : client.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } })
    const { data, error: authError } = await action
    if (authError) return setError(authError.message)
    if (!data.session && mode === 'sign-up') setMessage('Account created. Check your email to confirm your account, then sign in.')
  }

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    const client = supabase
    if (!client) return
    const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() })
    if (resetError) return setError(resetError.message)
    setMessage('Check your email for a password reset link. You can close this page after the email arrives.')
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (password !== passwordConfirmation) return setError('Passwords do not match.')
    const client = supabase
    if (!client) return
    const { error: updateError } = await client.auth.updateUser({ password })
    if (updateError) return setError(updateError.message)
    await client.auth.signOut()
    setPassword('')
    setPasswordConfirmation('')
    setMode('sign-in')
    setMessage('Password updated. Sign in with your new password.')
  }

  const resetRequest = mode === 'forgot-password'
  const passwordUpdate = mode === 'update-password'
  const title = resetRequest ? 'Reset your password' : passwordUpdate ? 'Choose a new password' : mode === 'sign-in' ? 'Welcome back' : 'Create your account'
  const description = resetRequest
    ? 'Enter your account email and we’ll send you a secure reset link.'
    : passwordUpdate
      ? 'Use at least six characters, then sign in again with your new password.'
      : mode === 'sign-in'
        ? 'Sign in to access your subjects and progress.'
        : 'Your reviewers and notes will be isolated to your account.'

  return <div className="auth-screen"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><Check /></span><div><strong>Reviewer</strong><small>Organizer</small></div></div><p className="eyebrow">Private study space</p><h1>{title}</h1><p>{description}</p><div className="auth-divider"><span>{passwordUpdate ? 'secure password update' : 'use your account'}</span></div>{resetRequest ? <form className="form" onSubmit={requestPasswordReset}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>{error && <p className="form-error">{error}</p>}{message && <p className="notice">{message}</p>}<button className="button primary full">Send reset link</button></form> : passwordUpdate ? <form className="form" onSubmit={updatePassword}><label>New password<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label>Confirm new password<input type="password" required minLength={6} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" /></label>{error && <p className="form-error">{error}</p>}{message && <p className="notice">{message}</p>}<button className="button primary full">Update password</button></form> : <form className="form" onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label>Password<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /></label>{error && <p className="form-error">{error}</p>}{message && <p className="notice">{message}</p>}<button className="button primary full">{mode === 'sign-in' ? 'Sign in' : 'Sign up'}</button>{mode === 'sign-in' && <button type="button" className="text-button auth-secondary-action" onClick={() => { setMode('forgot-password'); setPassword(''); setError(''); setMessage('') }}>Forgot password?</button>}</form>} {!passwordUpdate && <button className="text-button" onClick={() => { setMode(resetRequest || mode === 'sign-up' ? 'sign-in' : 'sign-up'); setPassword(''); setError(''); setMessage('') }}>{resetRequest ? 'Back to sign in' : mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</button>}</section></div>
}

function id() {
  return crypto.randomUUID()
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  useEffect(() => {
    // Lock the page behind the modal, then restore its previous scroll behavior.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header>
        {children}
      </section>
    </div>
  )
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action}</div>
}

// Application shell: shared navigation, account controls, sync status, and routes.
function Layout({ userEmail }: { userEmail?: string } = {}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus())
  useEffect(() => subscribeToSyncStatus(setSyncStatus), [])
  const links = [
    { to: '/', label: 'Dashboard', icon: <Home /> },
    { to: '/subjects', label: 'Subjects', icon: <BookOpen /> },
    { to: '/history', label: 'Test history', icon: <History /> },
    { to: '/classroom', label: 'Connect Google Classroom', icon: <School /> },
    { to: '/guide', label: 'App guide', icon: <CircleHelp /> },
    { to: '/settings', label: 'Settings & backup', icon: <Settings /> },
  ]
  return (
    <div className="app-shell">
      {menuOpen && <button className="mobile-overlay" onClick={() => setMenuOpen(false)} aria-label="Close navigation menu" />}
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand app-brand"><span className="brand-mark"><img src="/reviewer-organizer/reviewer-logo.jpg" alt="Reviewer Organizer logo" /></span><div><strong>Reviewer Organizer</strong><small>Study workspace</small></div></div>
        <nav>{links.map((link) => <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={() => setMenuOpen(false)}>{link.icon}<span>{link.label}</span></NavLink>)}</nav>
        <div className="sidebar-footer">
          <div className={`sync-badge sync-${syncStatus}`}>{syncStatus === 'offline' ? <CloudOff /> : syncStatus === 'syncing' ? <RefreshCw className="spin" /> : syncStatus === 'error' ? <AlertCircle /> : <CheckCircle2 />}<span><strong>{syncStatus === 'offline' ? 'Offline mode' : syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync needs attention' : 'Synced to private cloud'}</strong><small>{syncStatus === 'offline' ? 'Changes will retry when online' : syncStatus === 'syncing' ? 'Updating your other devices' : syncStatus === 'error' ? 'We will retry when you reconnect' : 'Your account data is up to date'}</small></span></div>
          {userEmail && <div className="account-card"><span className="account-avatar">{userEmail.charAt(0).toUpperCase()}</span><div><strong>{userEmail}</strong><small>Student account</small></div><button className="icon-button" onClick={() => void supabase?.auth.signOut()} aria-label="Sign out" title="Sign out"><ArrowLeft /></button></div>}
        </div>
      </aside>
      <main className="main-content">
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}><Menu /></button>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/subjects/:subjectId" element={<SubjectPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/classroom" element={<GoogleClassroomConnect />} />
          <Route path="/guide" element={<AppGuidePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

// Dashboard and subject management ------------------------------------------------
function Dashboard() {
  const subjects = useLiveQuery(() => db.subjects.orderBy('name').toArray(), [])
  if (!subjects) return <p>Loading your study space…</p>
  return <div className="page">
    <header className="page-header"><div><p className="eyebrow">Your study command center</p><h1>Choose a subject to begin</h1><p>Keep each subject's PDFs, notes, questions, mastery, and scores together in one workspace.</p></div><Link className="button primary" to="/subjects"><BookOpen /> Manage subjects</Link></header>
    <section className="panel subjects-preview dashboard-subjects"><div className="section-heading"><div><p className="eyebrow">Your library</p><h2>Subjects</h2></div><Link to="/subjects">Manage subjects <ChevronRight /></Link></div>
      {subjects.length === 0 ? <EmptyState icon={<BookOpen />} title="Create your first subject" text="A subject keeps related PDFs, notes, questions, mastery, and scores together." action={<Link className="button primary" to="/subjects"><Plus /> Add subject</Link>} /> : <div className="card-grid">{subjects.map((subject) => <SubjectCard key={subject.id} subject={subject} />)}</div>}
    </section>
  </div>
}

function SubjectCard({ subject }: { subject: Subject }) {
  // useLiveQuery automatically redraws counts whenever these IndexedDB tables change.
  const counts = useLiveQuery(async () => ({
    pdfs: await db.pdfs.where('subjectId').equals(subject.id).count(),
    notes: await db.notes.where('subjectId').equals(subject.id).count(),
    questions: await db.questions.where('subjectId').equals(subject.id).count(),
  }), [subject.id])
  return <Link className="subject-card" to={`/subjects/${subject.id}`} style={{ '--subject-color': subject.color } as React.CSSProperties}>
    <div className="subject-card-banner"><span className="subject-card-icon"><BookOpen /></span><div><p>Subject workspace</p><h3>{subject.name}</h3></div></div>
    <div className="subject-card-content">
      <p>{subject.description || 'PDFs, notes, questions, and practice materials.'}</p>
      <div className="resource-summary" aria-label="Subject content summary">
        <span><FileText /><strong>{counts?.pdfs ?? 0}</strong><small>PDFs</small></span>
        <span><NotebookPen /><strong>{counts?.notes ?? 0}</strong><small>Notes</small></span>
        <span><CircleHelp /><strong>{counts?.questions ?? 0}</strong><small>Questions</small></span>
      </div>
      <footer><span>Open subject</span><ChevronRight /></footer>
    </div>
  </Link>
}

function SubjectForm({ subject, onClose }: { subject?: Subject; onClose: () => void }) {
  const [name, setName] = useState(subject?.name ?? '')
  const [description, setDescription] = useState(subject?.description ?? '')
  const [color, setColor] = useState(subject?.color ?? COLORS[0])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    const savedSubject = { id: subject?.id ?? id(), name: trimmed, description: description.trim(), color, googleClassroomCourseId: subject?.googleClassroomCourseId, createdAt: subject?.createdAt ?? now, updatedAt: now }
    // Local-first write updates the screen immediately; the cloud call persists it.
    await db.subjects.put(savedSubject)
    await saveSubject(savedSubject)
    onClose()
  }
  return <form className="form" onSubmit={submit}><label>Subject name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="e.g. General Biology" /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} placeholder="What are you studying?" /></label><fieldset><legend>Color</legend><div className="color-picker">{COLORS.map((item) => <button key={item} type="button" className={color === item ? 'selected' : ''} style={{ background: item }} onClick={() => setColor(item)} aria-label={`Choose ${item}`} />)}</div></fieldset><div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary">{subject ? 'Save changes' : 'Create subject'}</button></div></form>
}

function SubjectsPage() {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Subject | 'new' | null>(null)
  const subjects = useLiveQuery(() => db.subjects.orderBy('name').toArray(), []) ?? []
  const filtered = subjects.filter((subject) => `${subject.name} ${subject.description}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Study library</p><h1>Subjects</h1><p>Every subject contains its own PDF reviewers, notes, and question bank.</p></div><button className="button primary" onClick={() => setEditing('new')}><Plus /> Add subject</button></header><div className="toolbar"><label className="search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subjects" /></label></div>{filtered.length ? <div className="card-grid">{filtered.map((subject) => <SubjectCard key={subject.id} subject={subject} />)}</div> : <EmptyState icon={<BookOpen />} title={subjects.length ? 'No matching subjects' : 'No subjects yet'} text={subjects.length ? 'Try another search.' : 'Create a subject to organize your first study materials.'} action={!subjects.length ? <button className="button primary" onClick={() => setEditing('new')}><Plus /> Add subject</button> : undefined} />}{editing && <Modal title={editing === 'new' ? 'New subject' : 'Edit subject'} onClose={() => setEditing(null)}><SubjectForm subject={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /></Modal>}</div>
}

type SubjectTab = 'pdfs' | 'notes' | 'questions' | 'review'

// One subject workspace groups all study resources under the same subject ID.
function SubjectPage() {
  const { subjectId = '' } = useParams()
  const [subjectParams] = useSearchParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<SubjectTab>(['questions', 'review', 'notes'].includes(subjectParams.get('tab') ?? '') ? subjectParams.get('tab') as SubjectTab : 'pdfs')
  const [editing, setEditing] = useState(false)
  const subject = useLiveQuery(() => db.subjects.get(subjectId), [subjectId])
  if (subject === undefined) return <p>Loading subject…</p>
  if (!subject) return <EmptyState icon={<BookOpen />} title="Subject not found" text="It may have been deleted." action={<Link className="button primary" to="/subjects">Back to subjects</Link>} />
  const currentSubject = subject
  async function remove() {
    // Typed confirmation protects against accidental cascading deletion.
    const confirmation = window.prompt(`Deleting this subject also deletes all of its PDFs, notes, questions, and test history. Type “${currentSubject.name}” to continue.`)
    if (confirmation !== currentSubject.name) return
    await deleteSubjectPdfs(currentSubject.id)
    await deleteSubjectCascade(currentSubject.id)
    await deleteSubject(currentSubject.id)
    navigate('/subjects')
  }
  return <div className="page"><Link className="back-link" to="/subjects"><ArrowLeft /> All subjects</Link><header className="subject-hero" style={{ '--subject-color': subject.color } as React.CSSProperties}><span><BookOpen /></span><div><p className="eyebrow">Subject workspace</p><h1>{subject.name}</h1><p>{subject.description || 'Add a description to explain this subject.'}</p></div><div className="hero-actions"><button className="button ghost" onClick={() => setEditing(true)}><Pencil /> Edit</button><button className="button danger" onClick={remove}><Trash2 /> Delete</button></div></header><SubjectSummary subjectId={subject.id} /><div className="tabs" role="tablist"><button className={tab === 'pdfs' ? 'active' : ''} onClick={() => setTab('pdfs')}><FileText /> PDF reviewers</button><button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}><NotebookPen /> Notes</button><button className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}><CircleHelp /> Question bank</button><button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}><GraduationCap /> Study modes</button></div>{tab === 'pdfs' && <PdfPanel subjectId={subject.id} />}{tab === 'notes' && <NotesPanel subjectId={subject.id} />}{tab === 'questions' && <QuestionsPanel subjectId={subject.id} />}{tab === 'review' && <StudyModesPanel subjectId={subject.id} />}{editing && <Modal title="Edit subject" onClose={() => setEditing(false)}><SubjectForm subject={subject} onClose={() => setEditing(false)} /></Modal>}</div>
}

function SubjectSummary({ subjectId }: { subjectId: string }) {
  const summary = useLiveQuery(async () => {
    const [pdfs, notes, questions, sessions] = await Promise.all([
      db.pdfs.where('subjectId').equals(subjectId).count(), db.notes.where('subjectId').equals(subjectId).count(),
      db.questions.where('subjectId').equals(subjectId).toArray(), db.testSessions.where('subjectId').equals(subjectId).reverse().sortBy('completedAt'),
    ])
    return { pdfs, notes, questions, sessions }
  }, [subjectId])
  if (!summary) return null
  const average = summary.sessions.length ? Math.round(summary.sessions.reduce((total, session) => total + session.percentage, 0) / summary.sessions.length) : 0
  // Progress means reaching the final-review bucket, not merely answering once.
  const nextLevel = ([1, 2, 3, 4] as MasteryLevel[]).find((level) => summary.questions.some((question) => question.level === level))
  const progress = summary.questions.length ? Math.round((summary.questions.filter((question) => question.level === 4).length / summary.questions.length) * 100) : 0
  return <section className="subject-summary" aria-label="Subject summary"><article><span className="stat-icon gold"><FileText /></span><div><strong>{summary.pdfs}</strong><small>PDF reviewers</small></div></article><article><span className="stat-icon violet"><CircleHelp /></span><div><strong>{summary.questions.length}</strong><small>Questions</small></div></article><article><span className="stat-icon green"><BarChart3 /></span><div><strong>{average}%</strong><small>Average score</small></div></article><article><span className="stat-icon blue"><Clock3 /></span><div><strong>{summary.sessions.length}</strong><small>Tests completed</small></div></article><div className="subject-progress"><div><strong>Mastery progress</strong><span>{progress}% at Final Test Reviewer</span></div><div className="bar"><i style={{ width: `${progress}%` }} /></div><small>{summary.sessions[0] ? `Last studied ${dateLabel(summary.sessions[0].completedAt)}` : 'No test completed yet'}</small>{nextLevel && <Link className="button ghost" to={`/test?subject=${subjectId}&level=${nextLevel}`}>Continue Test {nextLevel}<ChevronRight /></Link>}</div></section>
}

// Study mode launchers and flashcard-style review ---------------------------------
function StudyModesPanel({ subjectId }: { subjectId: string }) {
  const questions = useLiveQuery(() => db.questions.where('subjectId').equals(subjectId).toArray(), [subjectId]) ?? []
  const missed = questions.filter((question) => question.totalAttempts > question.totalCorrect).length
  const modes = [
    { mode: 'quick', title: 'Quick review', text: 'See prompts, answers, and explanations at your own pace.', icon: <RefreshCw /> },
    { mode: 'missed', title: 'Missed questions', text: `${missed} question${missed === 1 ? '' : 's'} to revisit from past tests.`, icon: <CircleHelp /> },
    { mode: 'mixed', title: 'Mixed test', text: 'Practice questions from every mastery level in one session.', icon: <GraduationCap /> },
  ] as const
  return <div className="study-sections"><section className="panel flashcard-feature"><div className="flashcard-feature-copy"><span className="flashcard-feature-icon"><BookOpen /></span><div><p className="eyebrow">Flashcard practice</p><h2>Build a focused card session</h2><p>Choose your mastery tiers, decide how many cards to review, and shuffle the questions before you begin.</p></div></div><div className="flashcard-feature-meta"><span>{questions.length} card{questions.length === 1 ? '' : 's'} available</span><Link className="button primary" to={`/review?subject=${subjectId}&mode=flashcards`}>Set up flashcards <ChevronRight /></Link></div></section><section className="panel"><div className="section-heading"><div><p className="eyebrow">More ways to practice</p><h2>Other study modes</h2></div></div><div className="study-mode-grid">{modes.map((item) => <Link key={item.mode} className="study-mode-card" to={`/review?subject=${subjectId}&mode=${item.mode}`}><span>{item.icon}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><ChevronRight /></Link>)}</div></section></div>
}

type ReviewMode = 'flashcards' | 'quick' | 'missed' | 'mixed'

function ReviewPage() {
  const [params] = useSearchParams()
  const subjectId = params.get('subject') ?? ''
  const requestedMode = params.get('mode') as ReviewMode | null
  const mode: ReviewMode = requestedMode && ['flashcards', 'quick', 'missed', 'mixed'].includes(requestedMode) ? requestedMode : 'flashcards'
  const subject = useLiveQuery(() => subjectId ? db.subjects.get(subjectId) : undefined, [subjectId])
  const questions = useLiveQuery(() => subjectId ? db.questions.where('subjectId').equals(subjectId).toArray() : Promise.resolve([] as Question[]), [subjectId]) ?? []
  const [flashcardLevels, setFlashcardLevels] = useState<MasteryLevel[]>([1, 2, 3, 4])
  const [flashcardCount, setFlashcardCount] = useState(10)
  const [shuffleFlashcards, setShuffleFlashcards] = useState(true)
  const [dueOnly, setDueOnly] = useState(true)
  const [flashcardSession, setFlashcardSession] = useState<Question[] | null>(null)
  const [reviewNow, setReviewNow] = useState(() => Date.now())
  const hasActiveFlashcardSession = flashcardSession !== null
  useEffect(() => {
    if (mode !== 'flashcards') return
    const refreshDueCards = () => setReviewNow(Date.now())
    const timer = window.setInterval(refreshDueCards, hasActiveFlashcardSession ? 1_000 : 5_000)
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refreshDueCards() }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshWhenVisible) }
  }, [mode, hasActiveFlashcardSession])
  const dueTime = new Date(reviewNow)
  const dueCount = questions.filter((question) => isQuestionDue(question, dueTime)).length
  const flashcardCandidates = questions.filter((question) => flashcardLevels.includes(question.level) && (!dueOnly || isQuestionDue(question, dueTime)))
  const pool = mode === 'flashcards' ? (flashcardSession ?? []) : questions.filter((question) => mode !== 'missed' || question.totalAttempts > question.totalCorrect)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [savingLevel, setSavingLevel] = useState(false)
  const [levelError, setLevelError] = useState('')
  useEffect(() => {
    if (mode !== 'flashcards' || !hasActiveFlashcardSession) return
    setFlashcardSession((session) => session ? prioritizeDueFlashcardRepeat(session, index, new Date(reviewNow)) : session)
  }, [hasActiveFlashcardSession, index, mode, reviewNow])
  const current = pool[index]
  function next() { setIndex((value) => value + 1); setRevealed(false); setTypedAnswer(''); setChecked(false); setLevelError('') }
  function checkMixed(event: FormEvent) { event.preventDefault(); if (!current || checked || !typedAnswer.trim()) return; setChecked(true); if (isAcceptedAnswer(typedAnswer, current.acceptedAnswers)) setCorrectCount((value) => value + 1) }
  function toggleFlashcardLevel(level: MasteryLevel) {
    setFlashcardLevels((levels) => levels.includes(level) ? levels.filter((item) => item !== level) : [...levels, level])
  }
  function startFlashcards() {
    if (!flashcardCandidates.length) return
    setFlashcardSession(createFlashcardSession(questions, flashcardLevels, flashcardCount, shuffleFlashcards))
    setReviewNow(Date.now())
    setIndex(0)
    setRevealed(false)
  }
  async function rateFlashcard(rating: ReviewRating) {
    if (!current || mode !== 'flashcards' || !revealed || savingLevel) return
    setSavingLevel(true)
    setLevelError('')
    try {
      const updated = scheduleFlashcard(current, rating)
      await saveQuestion(updated)
      await db.questions.put(updated)
      setFlashcardSession((session) => session ? updateFlashcardSessionAfterRating(session, index, updated, rating) : null)
      next()
    } catch (error) {
      setLevelError(error instanceof Error ? error.message : 'Could not update this question level.')
    } finally {
      setSavingLevel(false)
    }
  }
  async function deleteCurrentReviewQuestion() {
    if (!current || !['flashcards', 'quick'].includes(mode) || savingLevel || (mode === 'flashcards' && !flashcardSession)) return
    if (!window.confirm('Delete this question from all your signed-in devices? Test history snapshots will remain.')) return
    setSavingLevel(true)
    setLevelError('')
    try {
      await deleteQuestions([current.id])
      await db.questions.delete(current.id)
      const remaining = pool.filter((question) => question.id !== current.id)
      if (mode === 'flashcards') setFlashcardSession(remaining)
      setIndex(Math.min(index, Math.max(remaining.length - 1, 0)))
      setRevealed(false)
      setTypedAnswer('')
      setChecked(false)
    } catch (error) {
      setLevelError(error instanceof Error ? error.message : 'Could not delete this question from the cloud.')
    } finally {
      setSavingLevel(false)
    }
  }
  if (!subject) return <div className="page"><p>Loading study mode…</p></div>
  if (mode === 'flashcards' && !flashcardSession) return <div className="page narrow flashcard-setup-page"><Link className="back-link" to={`/subjects/${subjectId}?tab=review`}><ArrowLeft /> Study modes</Link><header className="page-header flashcard-setup-header"><div><p className="eyebrow">Smart flashcards</p><h1>{dueCount} card{dueCount === 1 ? '' : 's'} due now</h1><p>Review difficult cards sooner and let strong memories rest longer.</p></div></header><section className="panel flashcard-setup"><div className="srs-summary"><span><strong>{dueCount}</strong><small>Due now</small></span><span><strong>{questions.filter((question) => question.reviewState === 'learning').length}</strong><small>Learning</small></span><span><strong>{questions.filter((question) => question.reviewState === 'mastered').length}</strong><small>Mastered</small></span></div><div className="setup-step"><div className="setup-step-heading"><span>1</span><div><h2>Select mastery tiers</h2><p>Choosing Easy moves a card up by one tier; other ratings keep its tier.</p></div></div><div className="flashcard-level-grid">{([1, 2, 3, 4] as MasteryLevel[]).map((level) => { const count = questions.filter((question) => question.level === level).length; const selected = flashcardLevels.includes(level); return <button key={level} type="button" className={`flashcard-level-option level-card-${level}${selected ? ' selected' : ''}`} aria-pressed={selected} disabled={!count} onClick={() => toggleFlashcardLevel(level)}><span className={`level-pill level-${level}`}>Tier {level}</span><strong>{LEVEL_NAMES[level]}</strong><small>{count} card{count === 1 ? '' : 's'}</small><i>{selected ? <Check /> : null}</i></button> })}</div></div><div className="setup-step"><div className="setup-step-heading"><span>2</span><div><h2>Set your session</h2><p>{flashcardCandidates.length} card{flashcardCandidates.length === 1 ? '' : 's'} available with these filters.</p></div></div><div className="flashcard-options"><label><span>Number of cards</span><input type="number" inputMode="numeric" min={1} max={Math.max(flashcardCandidates.length, 1)} value={Math.min(flashcardCount, Math.max(flashcardCandidates.length, 1))} disabled={!flashcardCandidates.length} onChange={(event) => setFlashcardCount(Math.max(1, Number(event.target.value) || 1))} /></label><label className="shuffle-option"><input type="checkbox" checked={dueOnly} onChange={(event) => setDueOnly(event.target.checked)} /><span><strong>Due cards only</strong><small>Recommended for spaced repetition.</small></span></label><label className="shuffle-option"><input type="checkbox" checked={shuffleFlashcards} onChange={(event) => setShuffleFlashcards(event.target.checked)} /><span><strong>Shuffle questions</strong><small>Show the cards in a fresh random order.</small></span></label></div></div><button className="button primary full flashcard-start" disabled={!flashcardCandidates.length} onClick={startFlashcards}><BookOpen /> Start {Math.min(flashcardCount, flashcardCandidates.length)} flashcard{Math.min(flashcardCount, flashcardCandidates.length) === 1 ? '' : 's'}</button>{!flashcardCandidates.length && <p className="flashcard-empty">No cards match this schedule. Turn off <strong>Due cards only</strong> to practice ahead.</p>}</section></div>
  if (!pool.length) return <div className="page narrow"><Link className="back-link" to={`/subjects/${subjectId}?tab=review`}><ArrowLeft /> Study modes</Link><EmptyState icon={<CircleHelp />} title={mode === 'flashcards' ? 'Flashcard session complete' : mode === 'missed' ? 'No missed questions' : 'No questions yet'} text={mode === 'flashcards' ? 'No cards remain in this session. Return to Study modes to build another set.' : mode === 'missed' ? 'Great work—there are no questions marked incorrect from past tests.' : 'Add questions to this subject before starting a review mode.'} /></div>
  if (!current) return <div className="page narrow"><Link className="back-link" to={`/subjects/${subjectId}?tab=review`}><ArrowLeft /> Study modes</Link><section className="result-card"><span className="result-icon"><GraduationCap /></span><p className="eyebrow">Review complete</p><h1>{mode === 'mixed' ? `${correctCount}/${pool.length}` : pool.length}</h1><p>{mode === 'mixed' ? 'correct answers in this mixed practice session' : 'questions reviewed'}</p><Link className="button primary" to={`/subjects/${subjectId}?tab=review`}>Back to study modes</Link></section></div>
  const intervals = flashcardIntervals(current)
  return <div className="page narrow"><Link className="back-link" to={`/subjects/${subjectId}?tab=review`}><ArrowLeft /> {subject.name} study modes</Link><header className="page-header"><div><p className="eyebrow">{mode === 'flashcards' ? 'Smart flashcards' : mode === 'quick' ? 'Quick review' : mode === 'missed' ? 'Missed questions' : 'Mixed test'}</p><h1>Question {index + 1} of {pool.length}</h1></div></header><section className="review-card"><p className="eyebrow">{mode === 'mixed' ? 'Type your answer' : 'Think first, then reveal'}</p><h2>{current.prompt}</h2>{mode === 'mixed' ? <form className="identification-form" onSubmit={checkMixed}><input autoFocus disabled={checked} value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Enter your answer" /><button className="button primary" disabled={checked || !typedAnswer.trim()}>Check answer</button></form> : <>{(revealed || mode === 'quick') && <div className="review-answer"><strong>{current.acceptedAnswers[0]}</strong><p>{current.explanation}</p></div>}{mode === 'flashcards' && !revealed && <button className="button primary full" onClick={() => setRevealed(true)}>Reveal answer</button>}</>}{checked && <div className={isAcceptedAnswer(typedAnswer, current.acceptedAnswers) ? 'feedback correct' : 'feedback wrong'}><strong>{isAcceptedAnswer(typedAnswer, current.acceptedAnswers) ? 'Correct!' : 'Review this answer'}</strong><p>Answer: <b>{current.acceptedAnswers[0]}</b></p><p>{current.explanation}</p></div>}{mode === 'flashcards' && revealed && <div className="srs-rating-panel"><div><p>How well did you remember?</p><span className={`review-state review-state-${current.reviewState ?? 'new'}`}>{current.reviewState ?? 'new'}</span></div><div className="srs-rating-grid">{(['again', 'hard', 'good', 'easy'] as ReviewRating[]).map((rating) => <button key={rating} className={`srs-rating srs-${rating}`} disabled={savingLevel} onClick={() => void rateFlashcard(rating)}><strong>{rating[0].toUpperCase() + rating.slice(1)}</strong><small>{formatReviewInterval(intervals[rating])}{rating === 'easy' && current.level < 4 ? ` · Tier ${current.level + 1}` : ''}</small></button>)}</div><small className="srs-rating-hint">Again, Hard, and Good keep this card in the activity until you mark it Easy. It returns when due, or immediately after the other queued cards are finished.</small>{levelError && <p className="form-error">{levelError}</p>}</div>}{mode === 'flashcards' && <div className="flashcard-card-actions"><button className="button danger" disabled={savingLevel} onClick={() => void deleteCurrentReviewQuestion()}><Trash2 /> Delete this question</button>{!revealed && levelError && <p className="form-error">{levelError}</p>}</div>}{mode === 'quick' && <div className="quick-review-actions"><button className="text-button danger-text" disabled={savingLevel} onClick={() => void deleteCurrentReviewQuestion()}><Trash2 /> Delete</button><button className="button primary" disabled={savingLevel} onClick={next}>{index === pool.length - 1 ? 'Finish review' : 'Next question'} <ChevronRight /></button>{levelError && <p className="form-error">{levelError}</p>}</div>}{mode === 'mixed' && checked && <button className="button primary full" onClick={next}>{index === pool.length - 1 ? 'Finish review' : 'Next question'} <ChevronRight /></button>}</section></div>
}

// PDF, note, and question resource management ------------------------------------
function PdfPanel({ subjectId }: { subjectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pdfs = useLiveQuery(() => db.pdfs.where('subjectId').equals(subjectId).reverse().sortBy('createdAt'), [subjectId]) ?? []
  async function addPdf(file?: File) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return window.alert('Please choose a PDF file.')
    if (file.size > 50 * 1024 * 1024) return window.alert('This PDF is larger than the 50 MB cloud-storage limit.')
    setBusy(true); setMessage('Uploading PDF to your private cloud storage…')
    try {
      await createPdfReviewer(subjectId, file)
      setMessage('PDF uploaded and available on your signed-in devices.')
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : 'Upload failed.'} The local copy is preserved and will retry when you reconnect.`)
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }
  async function openPdf(pdf: (typeof pdfs)[number]) {
    try { window.location.assign(await createPdfOpenUrl(pdf)) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open this PDF.') }
  }
  async function removePdf(pdf: (typeof pdfs)[number]) {
    if (!window.confirm(`Delete ${pdf.name} from all your signed-in devices?`)) return
    try { await deletePdfReviewer(pdf); setMessage('PDF deleted from private cloud storage.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete this PDF.') }
  }
  return <><section className="panel"><div className="section-heading"><div><p className="eyebrow">Private cloud library</p><h2>PDF reviewers</h2></div><><input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => void addPdf(event.target.files?.[0])} /><button className="button primary" disabled={busy} onClick={() => inputRef.current?.click()}><Upload /> {busy ? 'Uploading…' : 'Add PDF'}</button></></div>{message && <div className="notice pdf-notice">{message}</div>}{pdfs.length ? <div className="document-list">{pdfs.map((pdf) => <article key={pdf.id}><span className="file-icon"><FileText /></span><div><strong>{pdf.name}</strong><small>{(pdf.size / 1024 / 1024).toFixed(1)} MB · {pdf.storagePath ? 'cloud synced' : 'waiting for upload'} · added {dateLabel(pdf.createdAt)}</small></div><button className="button ghost" disabled={!pdf.storagePath} onClick={() => void openPdf(pdf)}>Open</button><button className="icon-button danger-text" onClick={() => void removePdf(pdf)} aria-label={`Delete ${pdf.name}`}><Trash2 /></button></article>)}</div> : <EmptyState icon={<FileText />} title="No PDF reviewers" text="Upload a PDF once, then open it from any device signed in to your account." />}</section>{import.meta.env.VITE_GOOGLE_CLIENT_ID ? <GoogleClassroomImport subjectId={subjectId} /> : <section className="panel classroom-unavailable"><h3>Google Classroom is not configured</h3><p>Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env.local</code>, then restart the app.</p></section>}</>
}

function NoteForm({ subjectId, note, onClose }: { subjectId: string; note?: Note; onClose: () => void }) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [level, setLevel] = useState<NoteLevel>(note?.level ?? 1)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaving(true); const now = new Date().toISOString()
    const savedNote = { id: note?.id ?? id(), subjectId, title: title.trim(), content: content.trim(), level, createdAt: note?.createdAt ?? now, updatedAt: now }
    await db.notes.put(savedNote)
    try { await saveNote(savedNote); onClose() }
    catch (saveError) { setError(`${saveError instanceof Error ? saveError.message : 'Cloud save failed.'} The note remains saved on this device.`) }
    finally { setSaving(false) }
  }
  return <form className="form" onSubmit={submit}><label>Title<input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Notes<textarea className="large-textarea" required value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write your own explanation, summary, or reminder…" /></label><label>Reviewer level<select value={level} onChange={(event) => setLevel(Number(event.target.value) as NoteLevel)}>{([1, 2, 3] as NoteLevel[]).map((item) => <option key={item} value={item}>{NOTE_LEVEL_NAMES[item]}</option>)}</select><small>Move it when you decide the topic is completed or ready for final-exam review.</small></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button></div></form>
}

function NotesPanel({ subjectId }: { subjectId: string }) {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Note | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [reading, setReading] = useState<Note | null>(null)
  const [levelFilter, setLevelFilter] = useState<NoteLevel>(1)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const notes = useLiveQuery(() => db.notes.where('subjectId').equals(subjectId).reverse().sortBy('updatedAt'), [subjectId]) ?? []
  const filtered = notes.filter((note) => (note.level ?? 1) === levelFilter && `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase()))
  async function moveNote(note: Note, level: NoteLevel) {
    const updated = { ...note, level, updatedAt: new Date().toISOString() }
    await saveNote(updated); await db.notes.put(updated)
  }
  function toggleSelected(noteId: string) { setSelectedIds((current) => { const next = new Set(current); if (next.has(noteId)) next.delete(noteId); else next.add(noteId); return next }) }
  async function removeSelected() {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!window.confirm(`Delete ${ids.length} selected note${ids.length === 1 ? '' : 's'} from all your signed-in devices?`)) return
    try { await Promise.all(ids.map(deleteNote)); await db.notes.bulkDelete(ids); setSelectedIds(new Set()); setSelecting(false) }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Could not delete the selected notes.') }
  }
  async function removeNote(note: Note) {
    if (!window.confirm(`Delete “${note.title}” from all your signed-in devices?`)) return
    try { await deleteNote(note.id); await db.notes.delete(note.id) }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Could not delete this note.') }
  }
  return <section className="panel"><div className="section-heading"><div><p className="eyebrow">Organized study notes</p><h2>Notes</h2><p className="notes-subtitle">Move topics forward when you decide they are ready.</p></div><div className="heading-actions"><button className="button ghost" onClick={() => { setSelecting(!selecting); if (selecting) setSelectedIds(new Set()) }}>{selecting ? 'Cancel selection' : 'Select notes'}</button><button className="button ghost" onClick={() => setImporting(true)}><Upload /> Import notes</button><button className="button primary" onClick={() => setEditing('new')}><Plus /> New note</button></div></div><div className="note-level-tabs" role="tablist">{([1, 2, 3] as NoteLevel[]).map((level) => <button key={level} className={levelFilter === level ? 'active' : ''} onClick={() => setLevelFilter(level)}>{NOTE_LEVEL_NAMES[level]} <span>{notes.filter((note) => (note.level ?? 1) === level).length}</span></button>)}</div>{selecting && filtered.length > 0 && <div className="selection-toolbar"><span>{selectedIds.size} selected</span><button className="text-button" onClick={() => setSelectedIds((current) => { const next = new Set(current); filtered.forEach((note) => next.add(note.id)); return next })}>Select visible</button><button className="text-button" onClick={() => setSelectedIds(new Set())}>Clear</button><button className="button danger" disabled={!selectedIds.size} onClick={() => void removeSelected()}><Trash2 /> Delete selected</button></div>}{notes.length > 0 && <label className="search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes in this level" /></label>}{filtered.length ? <div className="note-grid">{filtered.map((note) => <article key={note.id} className={selectedIds.has(note.id) ? 'note-selected' : ''}>{selecting && <label className="note-checkbox"><input type="checkbox" checked={selectedIds.has(note.id)} onChange={() => toggleSelected(note.id)} aria-label={`Select ${note.title}`} /></label>}<div><span className={`note-level note-level-${note.level ?? 1}`}>{NOTE_LEVEL_NAMES[note.level ?? 1]}</span><h3>{note.title}</h3><small>Edited {dateLabel(note.updatedAt)}</small></div><p>{note.content}</p><footer><button className="button primary" onClick={() => setReading(note)}>Read</button><button className="button ghost" onClick={() => setEditing(note)}><Pencil /> Edit</button><select className="note-move" value={note.level ?? 1} onChange={(event) => void moveNote(note, Number(event.target.value) as NoteLevel)} aria-label={`Move ${note.title}`}>{([1, 2, 3] as NoteLevel[]).map((item) => <option key={item} value={item}>{item === 3 ? 'Final notes' : `Level ${item}`}</option>)}</select><button className="icon-button danger-text" onClick={() => void removeNote(note)}><Trash2 /></button></footer></article>)}</div> : <EmptyState icon={<NotebookPen />} title={notes.length ? 'No notes in this level' : 'No notes yet'} text={notes.length ? 'Move notes here when you are ready.' : 'Write or import organized notes to begin.'} />}{editing && <Modal title={editing === 'new' ? 'New note' : 'Edit note'} onClose={() => setEditing(null)}><NoteForm subjectId={subjectId} note={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /></Modal>}{importing && <Modal title="Import notes" onClose={() => setImporting(false)}><NoteImportForm subjectId={subjectId} existingNotes={notes} onClose={() => setImporting(false)} /></Modal>}{reading && <Modal title={reading.title} className="reading-modal" onClose={() => setReading(null)}><article className="reading-view"><small>{NOTE_LEVEL_NAMES[reading.level ?? 1]} · Edited {dateLabel(reading.updatedAt)}</small><div>{reading.content}</div></article></Modal>}</section>
}

function NoteImportForm({ subjectId, existingNotes, onClose }: { subjectId: string; existingNotes: Note[]; onClose: () => void }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ImportableNote[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  async function copyGeneratorPrompt() {
    try {
      await navigator.clipboard.writeText(noteGeneratorPrompt)
      setPromptCopied(true)
      setError('')
    } catch {
      setError('Could not copy automatically. Allow clipboard access in your browser and try again.')
    }
  }
  function review(value = text) {
    try {
      const result = parseNoteImport(value)
      const existingTitles = new Set(existingNotes.map((note) => normalizeNoteTitle(note.title)))
      const importable = result.notes.filter((note) => !existingTitles.has(normalizeNoteTitle(note.title)))
      const duplicates = result.notes.filter((note) => existingTitles.has(normalizeNoteTitle(note.title))).map((note) => `Skipped note already in this subject: “${note.title}”`)
      if (!importable.length) throw new Error('Every note in this file already exists in this subject.')
      setPreview(importable); setSelected(new Set(importable.map((_, index) => index))); setWarnings([...result.warnings, ...duplicates]); setError('')
    } catch (reason) { setPreview([]); setSelected(new Set()); setWarnings([]); setError(reason instanceof Error ? reason.message : 'Could not read these notes.') }
  }
  async function chooseFile(file?: File) {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) return setError('Choose a notes file smaller than 4 MB.')
    const value = await file.text(); setFileName(file.name); setText(value); review(value)
  }
  async function importNotes() {
    const chosen = preview.filter((_, index) => selected.has(index)); if (!chosen.length) return setError('Select at least one note to import.')
    setSaving(true); setError('')
    try { const now = new Date().toISOString(); const saved = chosen.map((note) => ({ id: id(), subjectId, ...note, createdAt: now, updatedAt: now })); await Promise.all(saved.map(saveNote)); await db.notes.bulkAdd(saved); onClose() }
    catch (reason) { setSaving(false); setError(reason instanceof Error ? reason.message : 'The notes could not be imported.') }
  }
  if (preview.length) return <div className="note-import form"><div className="import-summary"><Check /><div><strong>{preview.length} notes ready</strong><small>{selected.size} selected for this subject</small></div></div>{warnings.length > 0 && <div className="import-warnings"><strong>Review notes</strong>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}<div className="import-select-actions"><button type="button" className="text-button" onClick={() => setSelected(new Set(preview.map((_, index) => index)))}>Select all</button><button type="button" className="text-button" onClick={() => setSelected(new Set())}>Clear all</button></div><div className="import-preview">{preview.map((note, index) => <label key={`${note.title}-${index}`} className={selected.has(index) ? 'selected' : ''}><input type="checkbox" checked={selected.has(index)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })} /><div><strong>{note.title}</strong><small>{note.content}</small></div></label>)}</div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button ghost" onClick={() => { setPreview([]); setError('') }}>Back</button><button type="button" className="button primary" disabled={saving || !selected.size} onClick={() => void importNotes()}><Upload /> {saving ? 'Importing…' : `Import ${selected.size} notes`}</button></div></div>
  return <div className="note-import form"><div className="import-guide"><NotebookPen /><div><strong>Generate complete notes with ChatGPT</strong><p>Copy the full-coverage prompt, paste it into ChatGPT, and attach your PDF. It asks ChatGPT to check every page and include all important material.</p><button type="button" className="button ghost" onClick={() => void copyGeneratorPrompt()}><Copy /> {promptCopied ? 'Prompt copied' : 'Copy full-coverage prompt'}</button></div></div><label className="file-drop"><Upload /><strong>{fileName || 'Choose generated notes file'}</strong><span>.txt or .json · maximum 4 MB</span><input type="file" accept=".txt,.json,text/plain,application/json" onChange={(event) => void chooseFile(event.target.files?.[0])} /></label><div className="import-divider"><span>or paste the generated JSON</span></div><label>Notes JSON<textarea className="large-textarea" value={text} onChange={(event) => { setText(event.target.value); setFileName('') }} placeholder={'{\n  "format": "reviewer-organizer-notes",\n  "version": 1,\n  "notes": [...]\n}'} /></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button type="button" className="button primary" disabled={!text.trim()} onClick={() => review()}><Check /> Review notes</button></div></div>
}

function QuestionForm({ subjectId, question, onClose }: { subjectId: string; question?: Question; onClose: () => void }) {
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(question?.acceptedAnswers?.length ? question.acceptedAnswers : [''])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  function updateAnswer(index: number, value: string) { setAcceptedAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? value : answer)) }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaving(true)
    const cleaned = [...new Set(acceptedAnswers.map((answer) => answer.trim()).filter(Boolean))]
    if (!cleaned.length) { setSaving(false); return setError('Add at least one accepted answer.') }
    const now = new Date().toISOString()
    const savedQuestion = { id: question?.id ?? id(), subjectId, prompt: prompt.trim(), acceptedAnswers: cleaned, explanation: explanation.trim(), level: question?.level ?? 1, totalAttempts: question?.totalAttempts ?? 0, totalCorrect: question?.totalCorrect ?? 0, lastAnsweredAt: question?.lastAnsweredAt, createdAt: question?.createdAt ?? now, updatedAt: now }
    try { await saveQuestion(savedQuestion); await db.questions.put(savedQuestion); onClose() }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save this question to the cloud.'); setSaving(false) }
  }
  return <form className="form" onSubmit={submit}><label>Identification question<textarea autoFocus required value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. Who wrote Noli Me Tangere?" /></label><fieldset><legend>Accepted answers</legend><div className="answer-editor">{acceptedAnswers.map((answer, index) => <div key={index}><input value={answer} onChange={(event) => updateAnswer(index, event.target.value)} placeholder={index === 0 ? 'Primary correct answer' : 'Alternative accepted answer'} /><button type="button" className="icon-button" disabled={acceptedAnswers.length === 1} onClick={() => setAcceptedAnswers((current) => current.filter((_, answerIndex) => answerIndex !== index))}><X /></button></div>)}</div>{acceptedAnswers.length < 8 && <button type="button" className="text-button" onClick={() => setAcceptedAnswers([...acceptedAnswers, ''])}><Plus /> Add accepted answer</button>}<small>Capitalization and extra spaces are ignored. Add spelling variants when needed.</small></fieldset><label>Explanation<textarea required value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Explain the answer so the student can review it after checking." /></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving to cloud…' : 'Save question'}</button></div></form>
}

function QuestionImportForm({ subjectId, existingQuestions, onClose }: { subjectId: string; existingQuestions: Question[]; onClose: () => void }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ImportableQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function review(value = text) {
    try {
      const result = parseQuestionImport(value)
      const existingPrompts = new Set(existingQuestions.map((question) => normalizeQuestionPrompt(question.prompt)))
      const importable = result.questions.filter((question) => !existingPrompts.has(normalizeQuestionPrompt(question.prompt)))
      const existingDuplicates = result.questions
        .filter((question) => existingPrompts.has(normalizeQuestionPrompt(question.prompt)))
        .map((question) => `Skipped question already in this subject: “${question.prompt}”`)
      if (!importable.length) throw new Error('Every question in this file is already in this subject.')
      setPreview(importable)
      setSelected(new Set(importable.map((_, index) => index)))
      setWarnings([...result.warnings, ...existingDuplicates])
      setError('')
    } catch (reason) {
      setPreview([])
      setSelected(new Set())
      setWarnings([])
      setError(reason instanceof Error ? reason.message : 'Could not read this questionnaire.')
    }
  }

  async function chooseFile(file?: File) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return setError('Choose a questionnaire file smaller than 2 MB.')
    const value = await file.text()
    setFileName(file.name)
    setText(value)
    review(value)
  }

  async function importQuestions() {
    const chosen = preview.filter((_, index) => selected.has(index))
    if (!chosen.length) return setError('Select at least one question to import.')
    setSaving(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const savedQuestions = chosen.map((question) => ({
        id: id(), subjectId, ...question, totalAttempts: 0, totalCorrect: 0, createdAt: now, updatedAt: now,
      }))
      await saveQuestions(savedQuestions)
      await db.questions.bulkAdd(savedQuestions)
      onClose()
    } catch (reason) {
      setSaving(false)
      setError(reason instanceof Error ? reason.message : 'The questions could not be imported.')
    }
  }

  if (preview.length) return <div className="question-import form">
    <div className="import-summary"><Check /><div><strong>{preview.length} questions ready</strong><small>{selected.size} selected for this subject</small></div></div>
    {warnings.length > 0 && <div className="import-warnings"><strong>Review notes</strong>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    <div className="import-select-actions"><button type="button" className="text-button" onClick={() => setSelected(new Set(preview.map((_, index) => index)))}>Select all</button><button type="button" className="text-button" onClick={() => setSelected(new Set())}>Clear all</button></div>
    <div className="import-preview">{preview.map((question, index) => <label key={`${question.prompt}-${index}`} className={selected.has(index) ? 'selected' : ''}><input type="checkbox" checked={selected.has(index)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })} /><div><strong>{question.prompt}</strong><span>Answer: {question.acceptedAnswers.join(' / ')}</span><small>{question.explanation}</small></div></label>)}</div>
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions"><button type="button" className="button ghost" onClick={() => { setPreview([]); setError('') }}>Back</button><button type="button" className="button primary" disabled={saving || !selected.size} onClick={() => void importQuestions()}><Upload /> {saving ? 'Importing…' : `Import ${selected.size} questions`}</button></div>
  </div>

  return <div className="question-import form">
    <div className="import-guide"><FileText /><div><strong>Upload the questionnaire from ChatGPT</strong><p>Use a <code>.txt</code> or <code>.json</code> file containing JSON only. Your notes or PDF should not be uploaded here.</p></div></div>
    <label className="file-drop"><Upload /><strong>{fileName || 'Choose questionnaire file'}</strong><span>.txt or .json · maximum 2 MB</span><input type="file" accept=".txt,.json,text/plain,application/json" onChange={(event) => void chooseFile(event.target.files?.[0])} /></label>
    <div className="import-divider"><span>or paste the JSON</span></div>
    <label>Questionnaire JSON<textarea className="large-textarea" value={text} onChange={(event) => { setText(event.target.value); setFileName('') }} placeholder={'{\n  "format": "reviewer-organizer-questions",\n  "version": 1,\n  "questions": [...]\n}'} /></label>
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button type="button" className="button primary" disabled={!text.trim()} onClick={() => review()}><Check /> Review questions</button></div>
  </div>
}

function QuestionsPanel({ subjectId }: { subjectId: string }) {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<MasteryLevel | 0>(0)
  const [editing, setEditing] = useState<Question | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const questions = useLiveQuery(() => db.questions.where('subjectId').equals(subjectId).reverse().sortBy('updatedAt'), [subjectId]) ?? []
  const filtered = questions.filter((question) => (!level || question.level === level) && `${question.prompt} ${question.explanation}`.toLowerCase().includes(search.toLowerCase()))
  function toggleSelected(questionId: string) {
    setSelectedIds((current) => { const next = new Set(current); if (next.has(questionId)) next.delete(questionId); else next.add(questionId); return next })
  }
  async function removeSelected() {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!window.confirm(`Delete ${ids.length} selected question${ids.length === 1 ? '' : 's'} from all your signed-in devices? Test history snapshots will remain.`)) return
    try {
      await deleteQuestions(ids)
      await db.questions.bulkDelete(ids)
      setSelectedIds(new Set())
      setSelecting(false)
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not delete the selected questions from the cloud.') }
  }
  function selectVisible() {
    setSelectedIds((current) => { const next = new Set(current); filtered.forEach((question) => next.add(question.id)); return next })
  }
  async function moveSpecificQuestion(question: Question, targetLevel: MasteryLevel) {
    try {
      const updated = moveQuestion(question, targetLevel)
      // Commit locally first so the move survives refreshes and offline edits.
      await db.questions.put(updated)
      await saveQuestion(updated)
    }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Could not update this question level.') }
  }
  return <section className="panel"><div className="section-heading"><div><p className="eyebrow">Manual mastery practice</p><h2>Question bank</h2></div><div className="heading-actions"><button className="button ghost" onClick={() => { setSelecting(!selecting); if (selecting) setSelectedIds(new Set()) }}>{selecting ? 'Cancel selection' : 'Select questions'}</button><button className="button ghost" onClick={() => setImporting(true)}><Upload /> Import questions</button><button className="button primary" onClick={() => setEditing('new')}><Plus /> Add question</button></div></div><div className="test-level-grid">{([1, 2, 3, 4] as MasteryLevel[]).map((item) => { const count = questions.filter((question) => question.level === item).length; return <article key={item} className={`test-level-card level-card-${item}`}><div className={`level-pill level-${item}`}>{LEVEL_NAMES[item]}</div><strong>{count}</strong><span>{count === 1 ? 'question' : 'questions'}</span><Link className="button primary" aria-disabled={!count} to={count ? `/test?subject=${subjectId}&level=${item}` : '#'} onClick={(event) => { if (!count) event.preventDefault() }}><GraduationCap /> Start test</Link></article> })}</div>{questions.length > 0 && <div className="toolbar"><label className="search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions" /></label><select value={level} onChange={(event) => setLevel(Number(event.target.value) as MasteryLevel | 0)}><option value={0}>All levels</option>{[1, 2, 3, 4].map((item) => <option key={item} value={item}>{LEVEL_NAMES[item as MasteryLevel]}</option>)}</select></div>}{selecting && questions.length > 0 && <div className="selection-toolbar"><span>{selectedIds.size} selected</span><button className="text-button" onClick={selectVisible}>Select visible</button><button className="text-button" onClick={() => setSelectedIds(new Set())}>Clear</button><button className="button danger" disabled={!selectedIds.size} onClick={() => void removeSelected()}><Trash2 /> Delete selected</button></div>}{filtered.length ? <div className="question-list">{filtered.map((question) => <article key={question.id} className={selectedIds.has(question.id) ? 'question-selected' : ''}>{selecting && <label className="question-checkbox"><input type="checkbox" checked={selectedIds.has(question.id)} onChange={() => toggleSelected(question.id)} aria-label={`Select ${question.prompt}`} /></label>}<div className={`level-pill level-${question.level}`}>{LEVEL_NAMES[question.level]}</div><h3>{question.prompt}</h3><p>{question.acceptedAnswers.length} accepted answer{question.acceptedAnswers.length === 1 ? '' : 's'} · {question.totalAttempts} attempts</p><footer><button className="button ghost" onClick={() => setEditing(question)}><Pencil /> Edit</button>{question.level > 1 && <button className="button ghost" onClick={() => void moveSpecificQuestion(question, (question.level - 1) as MasteryLevel)}><ArrowLeft /> Move down</button>}{question.level < 4 && <button className="button primary" onClick={() => void moveSpecificQuestion(question, (question.level + 1) as MasteryLevel)}>Move up <ChevronRight /></button>}<button className="icon-button danger-text" onClick={() => window.confirm('Delete this question? Its snapshots remain in test history.') && void db.questions.delete(question.id)}><Trash2 /></button></footer></article>)}</div> : <EmptyState icon={<CircleHelp />} title={questions.length ? 'No matching questions' : 'No questions yet'} text={questions.length ? 'Adjust your search or level filter.' : 'Add or import identification questions to begin your manual mastery ladder.'} />}{editing && <Modal title={editing === 'new' ? 'New identification question' : 'Edit identification question'} onClose={() => setEditing(null)}><QuestionForm subjectId={subjectId} question={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /></Modal>}{importing && <Modal title="Import questions" onClose={() => setImporting(false)}><QuestionImportForm subjectId={subjectId} existingQuestions={questions} onClose={() => setImporting(false)} /></Modal>}</section>
}

// Practice test runner and permanent history -------------------------------------
function TestPage() {
  const [params] = useSearchParams()
  const subjectId = params.get('subject') ?? ''
  const requestedLevel = Number(params.get('level'))
  const level = ([1, 2, 3, 4].includes(requestedLevel) ? requestedLevel : 1) as MasteryLevel
  const subject = useLiveQuery(async () => subjectId ? await db.subjects.get(subjectId) : undefined, [subjectId])
  const [size, setSize] = useState(10)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [answers, setAnswers] = useState<TestAnswer[]>([])
  const [startedAt, setStartedAt] = useState('')
  const [completed, setCompleted] = useState<TestSession | null>(null)
  const available = useLiveQuery(() => subjectId ? db.questions.where('[subjectId+level]').equals([subjectId, level]).count() : Promise.resolve(0), [subjectId, level]) ?? 0
  const current = questions[index]
  async function start() {
    const pool = await db.questions.where('[subjectId+level]').equals([subjectId, level]).toArray()
    setQuestions(randomSelection(pool, size)); setIndex(0); setTypedAnswer(''); setChecked(false); setAnswers([]); setCompleted(null); setStartedAt(new Date().toISOString())
  }
  async function checkAnswer() {
    if (!current || !typedAnswer.trim() || checked) return
    const wasCorrect = isAcceptedAnswer(typedAnswer, current.acceptedAnswers)
    const updated = recordAnswer(current, wasCorrect)
    await db.questions.put(updated)
    const answer: TestAnswer = { questionId: current.id, prompt: current.prompt, selectedAnswer: typedAnswer.trim(), correctAnswer: current.acceptedAnswers[0], acceptedAnswers: current.acceptedAnswers, explanation: current.explanation, wasCorrect, levelBefore: current.level, levelAfter: current.level, answeredAt: new Date().toISOString() }
    setAnswers((items) => [...items, answer]); setChecked(true)
  }
  async function finishSession(finalAnswers: TestAnswer[]) {
    const answered = finalAnswers.filter((answer) => !answer.wasSkipped)
    const correctCount = answered.filter((answer) => answer.wasCorrect).length
    const session: TestSession = { id: id(), subjectId, subjectName: subject?.name ?? 'Deleted subject', level, startedAt, completedAt: new Date().toISOString(), questionCount: finalAnswers.length, correctCount, skippedCount: finalAnswers.length - answered.length, percentage: answered.length ? Math.round((correctCount / answered.length) * 100) : 0, answers: finalAnswers }
    await db.testSessions.add(session); setCompleted(session); setQuestions([])
  }
  async function advance(finalAnswers: TestAnswer[]) {
    if (index < questions.length - 1) { setAnswers(finalAnswers); setIndex(index + 1); setTypedAnswer(''); setChecked(false); return }
    await finishSession(finalAnswers)
  }
  async function chooseLevel(targetLevel: MasteryLevel) {
    if (!current || !checked) return
    await db.questions.put(moveQuestion(current, targetLevel))
    const finalAnswers = answers.map((answer, answerIndex) => answerIndex === answers.length - 1 ? { ...answer, levelAfter: targetLevel } : answer)
    await advance(finalAnswers)
  }
  async function skipQuestion() {
    if (!current || checked) return
    const skipped: TestAnswer = { questionId: current.id, prompt: current.prompt, selectedAnswer: '', correctAnswer: current.acceptedAnswers[0], acceptedAnswers: current.acceptedAnswers, explanation: current.explanation, wasCorrect: false, wasSkipped: true, levelBefore: current.level, levelAfter: current.level, answeredAt: new Date().toISOString() }
    await advance([...answers, skipped])
  }
  if (!subjectId || !params.get('level')) return <div className="page narrow"><EmptyState icon={<CircleHelp />} title="Choose a test inside a subject" text="Open a subject's Question Bank and select one of its four test levels." action={<Link className="button primary" to="/subjects">Open subjects</Link>} /></div>
  if (completed) return <div className="page narrow"><section className="result-card"><span className="result-icon"><GraduationCap /></span><p className="eyebrow">Test complete</p><h1>{completed.percentage}%</h1><p>{completed.correctCount} correct · {completed.skippedCount ?? 0} skipped · {completed.questionCount} total questions</p><div className="result-actions"><Link className="button primary" to={`/subjects/${subjectId}?tab=questions`}>Back to question bank</Link><Link className="button ghost" to="/history">View history</Link></div></section></div>
  if (!current) return <div className="page narrow"><Link className="back-link" to={`/subjects/${subjectId}?tab=questions`}><ArrowLeft /> Question bank</Link><header className="page-header"><div><p className="eyebrow">{subject?.name ?? 'Subject'} · identification</p><h1>{LEVEL_NAMES[level]}</h1><p>Questions are random. You decide whether each answered question stays here or moves to another level.</p></div></header><section className="panel setup-card"><label>Number of questions<input type="number" min={1} max={50} value={size} onChange={(event) => setSize(Math.max(1, Math.min(50, Number(event.target.value))))} /></label><div className="availability"><CircleHelp /><span>{available} question{available === 1 ? '' : 's'} available at this level</span></div><button className="button primary full" disabled={!available} onClick={() => void start()}><GraduationCap /> Begin identification test</button></section></div>
  const latestAnswer = answers.at(-1)
  return <div className="page narrow"><div className="test-progress"><span>Question {index + 1} of {questions.length}</span><div className="bar"><i style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div><span>{LEVEL_NAMES[level]}</span></div><section className="question-card"><p className="eyebrow">Type your answer</p><h1>{current.prompt}</h1><form className="identification-form" onSubmit={(event) => { event.preventDefault(); void checkAnswer() }}><input autoFocus disabled={checked} value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Enter your answer" aria-label="Your answer" />{!checked && <div className="test-actions split"><button type="button" className="button ghost" onClick={() => void skipQuestion()}>Skip question</button><button className="button primary" disabled={!typedAnswer.trim()}>Check answer</button></div>}</form>{checked && latestAnswer && <><div className={latestAnswer.wasCorrect ? 'feedback correct' : 'feedback wrong'}><strong>{latestAnswer.wasCorrect ? 'Correct!' : 'Incorrect'}</strong><p>Correct answer: <b>{current.acceptedAnswers[0]}</b></p><p>{current.explanation}</p></div><div className="manual-level-controls"><p>Where should this question go next?</p><div><button className="button ghost" disabled={current.level === 1} onClick={() => void chooseLevel((current.level - 1) as MasteryLevel)}><ArrowLeft /> Previous level</button><button className="button ghost" onClick={() => void chooseLevel(current.level)}>Keep here</button><button className="button primary" disabled={current.level === 4} onClick={() => void chooseLevel((current.level + 1) as MasteryLevel)}>Next level <ChevronRight /></button></div></div></>}</section></div>
}

function HistoryPage() {
  const sessions = useLiveQuery(() => db.testSessions.orderBy('completedAt').reverse().toArray(), []) ?? []
  const [selected, setSelected] = useState<TestSession | null>(null)
  function responseText(answer: TestAnswer) { return answer.selectedAnswer || answer.choices?.find((choice) => choice.id === answer.selectedChoiceId)?.text || 'No answer' }
  function correctText(answer: TestAnswer) { return answer.correctAnswer || answer.choices?.find((choice) => choice.id === answer.correctChoiceId)?.text || 'Unavailable' }
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Learning record</p><h1>Test history</h1><p>Review scores, typed answers, skipped questions, and manual level decisions.</p></div></header>{sessions.length ? <div className="history-list">{sessions.map((session) => <button key={session.id} onClick={() => setSelected(session)}><span className={session.percentage >= 75 ? 'score good' : 'score'}>{session.percentage}%</span><div><strong>{session.subjectName}</strong><small>{LEVEL_NAMES[session.level]} · {dateLabel(session.completedAt)}{session.skippedCount ? ` · ${session.skippedCount} skipped` : ''}</small></div><div className="history-count">{session.correctCount}/{session.questionCount}<ChevronRight /></div></button>)}</div> : <EmptyState icon={<History />} title="No test history" text="Open a subject's Question Bank and complete an identification test." action={<Link className="button primary" to="/subjects">Open subjects</Link>} />}{selected && <Modal title={`${selected.subjectName} · ${selected.percentage}%`} onClose={() => setSelected(null)}><div className="history-detail"><p>{LEVEL_NAMES[selected.level]} · {dateLabel(selected.completedAt)} · {selected.correctCount} correct · {selected.skippedCount ?? 0} skipped</p>{selected.answers.map((answer, index) => <article key={`${answer.questionId}-${index}`}><span className={answer.wasSkipped ? 'answer-mark skipped' : answer.wasCorrect ? 'answer-mark correct' : 'answer-mark wrong'}>{answer.wasSkipped ? <ChevronRight /> : answer.wasCorrect ? <Check /> : <X />}</span><div><strong>{answer.prompt}</strong><p>{answer.wasSkipped ? 'Skipped without answering' : `Your answer: ${responseText(answer)}`}</p>{!answer.wasCorrect && !answer.wasSkipped && <p>Correct answer: {correctText(answer)}</p>}<small>{answer.explanation}</small>{answer.levelBefore !== answer.levelAfter && <small className="history-move">Moved from {LEVEL_NAMES[answer.levelBefore]} to {LEVEL_NAMES[answer.levelAfter]}</small>}</div></article>)}</div></Modal>}</div>
}

// New-user walkthrough -----------------------------------------------------------
const GUIDE_STEPS = [
  {
    title: 'Start from your dashboard',
    text: 'The dashboard is your study command center. It gives you a quick view of every subject and lets you continue where you left off.',
    tip: 'Return here whenever you want a simple overview of your study workspace.',
    action: 'Open dashboard',
    to: '/',
    icon: <Home />,
  },
  {
    title: 'Create your first subject',
    text: 'Create one subject for each class or topic. Every subject keeps its own PDFs, notes, questions, study progress, and scores together.',
    tip: 'Use a clear name such as “General Biology” so your materials stay easy to find.',
    action: 'Open subjects',
    to: '/subjects',
    icon: <BookOpen />,
  },
  {
    title: 'Add your study materials',
    text: 'Open a subject and use its PDF Reviewers tab to upload a PDF. You can also add notes and build a question bank in the other tabs.',
    tip: 'You need to create a subject before you can add study materials to it.',
    action: 'Choose a subject',
    to: '/subjects',
    icon: <Upload />,
  },
  {
    title: 'Connect Google Classroom',
    text: 'Open Connect Google Classroom, sign in to Google, and select the active classes you want to copy into Reviewer Organizer as subjects.',
    tip: 'Your class names and teacher names stay available in the app after you save the selected classes.',
    action: 'Connect Google Classroom',
    to: '/classroom',
    icon: <GraduationCap />,
  },
  {
    title: 'Review and test yourself',
    text: 'Use flashcards for quick recall or take an identification test. Questions can move through mastery levels as your knowledge improves.',
    tip: 'Add questions to a subject first, then open its Study Modes tab to begin reviewing.',
    action: 'Choose a subject',
    to: '/subjects',
    icon: <CircleHelp />,
  },
  {
    title: 'Check progress and protect your work',
    text: 'Test History keeps your past results. Settings & Backup lets you download a recovery copy of your study data or restore an earlier backup.',
    tip: 'Download a fresh backup regularly, especially after adding many notes or questions.',
    action: 'Open settings & backup',
    to: '/settings',
    icon: <ShieldCheck />,
  },
]

function AppGuidePage() {
  const [stepIndex, setStepIndex] = useState(0)
  const step = GUIDE_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === GUIDE_STEPS.length - 1
  const progress = ((stepIndex + 1) / GUIDE_STEPS.length) * 100

  return <div className="page guide-page"><header className="page-header"><div><p className="eyebrow">New user walkthrough</p><h1>App guide</h1><p>Follow these steps to learn the complete Reviewer Organizer workflow at your own pace.</p></div></header><section className="guide-layout"><nav className="guide-step-list" aria-label="Walkthrough steps">{GUIDE_STEPS.map((item, index) => <button key={item.title} className={index === stepIndex ? 'active' : index < stepIndex ? 'complete' : ''} onClick={() => setStepIndex(index)} aria-current={index === stepIndex ? 'step' : undefined}><span>{index < stepIndex ? <Check /> : index + 1}</span><strong>{item.title}</strong></button>)}</nav><section className="panel guide-card" aria-live="polite"><div className="guide-progress"><div><span>Step {stepIndex + 1} of {GUIDE_STEPS.length}</span><strong>{Math.round(progress)}% complete</strong></div><div className="bar" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div></div><span className="guide-icon">{step.icon}</span><p className="eyebrow">Step {stepIndex + 1}</p><h2>{step.title}</h2><p className="guide-description">{step.text}</p><div className="guide-tip"><CheckCircle2 /><p><strong>Helpful tip</strong>{step.tip}</p></div><Link className="button ghost guide-link" to={step.to}>{step.action}<ChevronRight /></Link><footer className="guide-actions"><button className="button ghost" disabled={isFirst} onClick={() => setStepIndex((current) => current - 1)}><ArrowLeft /> Previous</button>{isLast ? <Link className="button primary" to="/">Finish guide <Check /></Link> : <button className="button primary" onClick={() => setStepIndex((current) => current + 1)}>Next step <ChevronRight /></button>}</footer></section></section></div>
}

// Backup and preferences ----------------------------------------------------------
function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const storageEstimate = useLiveQuery(async () => navigator.storage?.estimate?.(), [])
  async function downloadBackup() {
    setMessage('Preparing backup…'); const backup = await createBackup(); const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `reviewer-organizer-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); setMessage('Backup downloaded successfully.')
  }
  async function importBackup(file?: File) {
    if (!file) return
    try { const parsed: unknown = JSON.parse(await file.text()); validateBackup(parsed); if (!window.confirm('Restoring replaces all current study data. Continue?')) return; await restoreBackup(parsed); setMessage('Backup restored successfully.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not restore this backup.') } finally { if (fileRef.current) fileRef.current.value = '' }
  }
  async function requestPersistence() { const granted = await navigator.storage?.persist?.(); setMessage(granted ? 'Persistent storage is enabled.' : 'The browser did not grant persistent storage. Keep regular backups.') }
  const used = storageEstimate?.usage ? `${(storageEstimate.usage / 1024 / 1024).toFixed(1)} MB used` : 'Storage estimate unavailable'
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Data safety</p><h1>Settings & backup</h1><p>Your study records sync privately to your account, while backups provide an extra recovery copy.</p></div></header><div className="settings-grid"><section className="panel"><span className="setting-icon"><Download /></span><h2>Complete backup</h2><p>Download subjects, PDFs, notes, questions, progress, and test history into one file.</p><button className="button primary" onClick={() => void downloadBackup()}><Download /> Download backup</button></section><section className="panel"><span className="setting-icon"><Upload /></span><h2>Restore backup</h2><p>Replace the current database using a valid Reviewer Organizer backup.</p><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} /><button className="button ghost" onClick={() => fileRef.current?.click()}><Upload /> Choose backup</button></section><section className="panel"><span className="setting-icon"><ShieldCheck /></span><h2>Storage protection</h2><p>{used}. Ask the browser to reduce the chance of automatic cleanup.</p><button className="button ghost" onClick={() => void requestPersistence()}><ShieldCheck /> Request protection</button></section></div>{message && <div className="notice">{message}</div>}<section className="panel learn-card"><h2>Important to remember</h2><p>GitHub contains the app’s public source code—not your private study records. PDFs sync through private Supabase Storage, while local browser storage supports migration and offline metadata.</p></section></div>
}

// AuthGate is the root because account isolation must happen before any page loads.
export default function App() { return <AuthGate /> }
