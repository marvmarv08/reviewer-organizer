import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CloudDownload, LogOut, RefreshCw, School } from 'lucide-react'
import { db } from './db'
import { classroomInstructorDescription, listActiveCourses, listCourseInstructorNames, type ClassroomCourseWithTeachers } from './google-classroom'
import { saveSubject } from './remote'
import type { Subject } from './types'
import { useGoogleClassroom } from './use-google-classroom'

const SUBJECT_COLORS = ['#a51d25', '#7a171d', '#c74b50', '#d49a28', '#59636f', '#8b5e3c']

function courseColor(courseId: string) {
  const total = [...courseId].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return SUBJECT_COLORS[total % SUBJECT_COLORS.length]
}

export function GoogleClassroomConnect() {
  const google = useGoogleClassroom()
  const subjects = useLiveQuery(() => db.subjects.toArray(), []) ?? []
  const [courses, setCourses] = useState<ClassroomCourseWithTeachers[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const importedIds = new Set(subjects.map((subject) => subject.googleClassroomCourseId).filter(Boolean))

  useEffect(() => {
    if (!google.connected) { setCourses([]); setSelected(new Set()); return }
    let cancelled = false
    setBusy(true); setMessage('Loading your active Classroom courses…')
    void listActiveCourses(google.fetchClassroomApi)
      .then(async (items) => Promise.all(items.map(async (course) => ({
        ...course,
        instructorNames: await listCourseInstructorNames(google.fetchClassroomApi, course.id),
      }))))
      .then((items) => {
        if (cancelled) return
        setCourses(items)
        setSelected(new Set(items.filter((course) => !importedIds.has(course.id)).map((course) => course.id)))
        setMessage(items.length ? '' : 'No active Google Classroom courses were found.')
      })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not load Google Classroom courses.') })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
    // Imported IDs are intentionally read when Google connects; Dexie updates badges separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.connected, google.fetchClassroomApi])

  function toggle(courseId: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(courseId)) next.delete(courseId); else next.add(courseId); return next })
  }

  async function importSelected() {
    const chosen = courses.filter((course) => selected.has(course.id))
    if (!chosen.length) return
    setBusy(true); setMessage(`Saving ${chosen.length} class${chosen.length === 1 ? '' : 'es'} as subjects…`)
    try {
      for (const course of chosen) {
        const existing = subjects.find((subject) => subject.googleClassroomCourseId === course.id)
        const now = new Date().toISOString()
        const subject: Subject = {
          id: existing?.id ?? crypto.randomUUID(),
          name: course.name.trim() || 'Untitled Classroom course',
          description: classroomInstructorDescription(course.instructorNames),
          color: existing?.color ?? courseColor(course.id),
          googleClassroomCourseId: course.id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        await saveSubject(subject)
        await db.subjects.put(subject)
      }
      setSelected(new Set())
      setMessage(`${chosen.length} Classroom subject${chosen.length === 1 ? '' : 's'} saved. They will stay in your app after restart.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the selected Classroom subjects.')
    } finally { setBusy(false) }
  }

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return <div className="page"><section className="panel"><h1>Connect Google Classroom</h1><p>Google Classroom is not configured for this app yet.</p></section></div>

  return <div className="page">
    <header className="page-header" data-tour="classroom-header"><div><p className="eyebrow">Classroom sync</p><h1>Connect your Google Classroom</h1><p>Copy your active classes into Reviewer Organizer as persistent subjects.</p></div>
      {google.connected ? <button className="button ghost" onClick={google.disconnect}><LogOut /> Disconnect</button> : <button className="button primary" data-tour="classroom-connect-button" onClick={() => google.login()}><CloudDownload /> Connect Google Classroom</button>}
    </header>
    <section className="panel classroom-connect-panel" data-tour="classroom-connect">
      <div className="classroom-connect-intro"><School /><div><h2>Your classes</h2><p>Class names become subject names. Teacher names become subject descriptions.</p></div></div>
      {(google.error || message) && <div className="notice">{google.error || message}</div>}
      {busy && <p className="classroom-status"><RefreshCw className="spin" /> Contacting Google…</p>}
      {!google.connected && <div className="empty-state"><School /><h3>Google Classroom is not connected</h3><p>Connect the Google account whose active classes you want to copy.</p></div>}
      {courses.length > 0 && <><div className="classroom-course-list">{courses.map((course) => {
        const imported = importedIds.has(course.id)
        return <label key={course.id} className={selected.has(course.id) ? 'selected' : ''}><input type="checkbox" checked={selected.has(course.id)} disabled={busy} onChange={() => toggle(course.id)} /><span><strong>{course.name}</strong><small>{classroomInstructorDescription(course.instructorNames)}{course.section ? ` · ${course.section}` : ''}</small></span>{imported && <em><Check /> Saved</em>}</label>
      })}</div><button className="button primary" disabled={busy || !selected.size} onClick={() => void importSelected()}><CloudDownload /> Save {selected.size || ''} selected class{selected.size === 1 ? '' : 'es'} as subjects</button></>}
      <small className="classroom-privacy">Read-only Google access is temporary. Only the copied class details are saved in your private Reviewer Organizer account.</small>
    </section>
  </div>
}
