import { useEffect, useRef, useState } from 'react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useLocation, useNavigate } from 'react-router-dom'

const TOUR_EVENT = 'reviewer-organizer:start-tour'
const RUNNING_KEY = 'reviewer-organizer-tour-running'
const PAGE_KEY = 'reviewer-organizer-tour-page'
const SINGLE_KEY = 'reviewer-organizer-tour-single'

interface TourStep {
  element?: string
  title: string
  description: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

interface TourPage {
  path: string
  label: string
  steps: TourStep[]
}

export const TOUR_PAGES: TourPage[] = [
  {
    path: '/',
    label: 'Dashboard',
    steps: [
      { title: 'Welcome to Reviewer Organizer!', description: 'Let’s walk through the complete study workflow. You can exit anytime and restart from App Guide.' },
      { element: '[data-tour="dashboard-header"]', title: 'Your study command center', description: 'The dashboard is where you begin and return whenever you want an overview of your subjects.', side: 'bottom' },
      { element: '[data-tour="dashboard-subjects"]', title: 'Your subject library', description: 'Each subject keeps its PDFs, notes, questions, study progress, and test scores together.', side: 'top' },
    ],
  },
  {
    path: '/subjects',
    label: 'Subjects & materials',
    steps: [
      { element: '[data-tour="subjects-header"]', title: 'Create a subject', description: 'Start by creating one subject for each class or topic you want to study.', side: 'bottom' },
      { element: '[data-tour="subjects-search"]', title: 'Find subjects quickly', description: 'Search by subject name or description when your study library grows.', side: 'bottom' },
      { element: '[data-tour="subjects-content"]', title: 'Open a subject workspace', description: 'Inside a subject, use the tabs to upload PDFs, write or import notes, build a question bank, and start a study mode.', side: 'top' },
    ],
  },
  {
    path: '/classroom',
    label: 'Google Classroom',
    steps: [
      { element: '[data-tour="classroom-header"]', title: 'Connect Google Classroom', description: 'Connect the Google account that contains the active classes you want to organize.', side: 'bottom' },
      { element: '[data-tour="classroom-connect"]', title: 'Copy classes into the app', description: 'Your selected class names become persistent subjects, and teacher names become their descriptions.', side: 'top' },
    ],
  },
  {
    path: '/history',
    label: 'Test history',
    steps: [
      { element: '[data-tour="history-header"]', title: 'Track your learning', description: 'Test History keeps your previous scores, answers, skipped questions, and mastery decisions.', side: 'bottom' },
      { element: '[data-tour="history-content"]', title: 'Review past results', description: 'Open a completed test to see what you answered and which topics need more practice.', side: 'top' },
    ],
  },
  {
    path: '/settings',
    label: 'Settings & backup',
    steps: [
      { element: '[data-tour="settings-header"]', title: 'Protect your study data', description: 'Settings & Backup gives you an extra recovery copy alongside private cloud synchronization.', side: 'bottom' },
      { element: '[data-tour="settings-options"]', title: 'Back up and restore', description: 'Download backups regularly. You can restore a valid backup later if you need to recover your study workspace.', side: 'top' },
      { title: 'You are ready to study!', description: 'Create a subject, add your materials, and start reviewing. You can replay this full tour or any section from App Guide.' },
    ],
  },
]

function doneKey(userId: string) {
  return `reviewer-organizer-tour-done:${userId}`
}

function notifyTourStart() {
  window.dispatchEvent(new Event(TOUR_EVENT))
}

function prepareTour(pageIndex: number, single: boolean) {
  localStorage.setItem(RUNNING_KEY, 'true')
  localStorage.setItem(PAGE_KEY, String(pageIndex))
  if (single) localStorage.setItem(SINGLE_KEY, 'true')
  else localStorage.removeItem(SINGLE_KEY)
  notifyTourStart()
}

export function startFullTour() {
  prepareTour(0, false)
}

export function startTourAt(pageIndex: number) {
  if (!TOUR_PAGES[pageIndex]) return
  prepareTour(pageIndex, true)
}

export function useOnboardingTour(userId: string) {
  const location = useLocation()
  const navigate = useNavigate()
  const driverRef = useRef<Driver | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const restart = () => setRequestVersion((version) => version + 1)
    window.addEventListener(TOUR_EVENT, restart)
    return () => window.removeEventListener(TOUR_EVENT, restart)
  }, [])

  useEffect(() => {
    if (localStorage.getItem(doneKey(userId)) || localStorage.getItem(RUNNING_KEY)) return
    prepareTour(0, false)
  }, [userId])

  useEffect(() => {
    if (localStorage.getItem(RUNNING_KEY) !== 'true') return
    const pageIndex = Number(localStorage.getItem(PAGE_KEY) ?? 0)
    const tourPage = TOUR_PAGES[pageIndex]
    if (!tourPage) return
    if (location.pathname !== tourPage.path) {
      navigate(tourPage.path)
      return
    }

    let endReason: 'transition' | 'complete' | 'cancel' | null = null
    const cancelTour = () => {
      localStorage.removeItem(RUNNING_KEY)
      localStorage.removeItem(PAGE_KEY)
      localStorage.removeItem(SINGLE_KEY)
      localStorage.setItem(doneKey(userId), 'true')
    }
    const timer = window.setTimeout(() => {
      const steps: DriveStep[] = tourPage.steps.map((step) => ({
        ...(step.element ? { element: step.element, skipMissingElement: true, waitForElement: 800 } : {}),
        popover: {
          title: step.title,
          description: step.description,
          ...(step.side ? { side: step.side } : {}),
        },
      }))
      const isSingle = localStorage.getItem(SINGLE_KEY) === 'true'
      const isLastPage = pageIndex === TOUR_PAGES.length - 1
      const tour = driver({
        steps,
        showProgress: true,
        showButtons: ['previous', 'next', 'close'],
        progressText: '{{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: isSingle || isLastPage ? 'Finish' : 'Continue',
        allowClose: true,
        allowKeyboardControl: true,
        animate: true,
        overlayColor: '#16090a',
        overlayOpacity: 0.72,
        stagePadding: 12,
        stageRadius: 12,
        popoverClass: 'reviewer-tour-popover',
        onNextClick: () => {
          if (tour.hasNextStep()) {
            tour.moveNext()
            return
          }
          if (isSingle || isLastPage) {
            endReason = 'complete'
            cancelTour()
            tour.destroy()
            return
          }
          endReason = 'transition'
          localStorage.setItem(PAGE_KEY, String(pageIndex + 1))
          tour.destroy()
          navigate(TOUR_PAGES[pageIndex + 1].path)
        },
        onPrevClick: () => tour.movePrevious(),
        onCloseClick: () => {
          endReason = 'cancel'
          cancelTour()
          tour.destroy()
        },
        onDestroyed: () => {
          driverRef.current = null
          if (!endReason) cancelTour()
        },
      })
      driverRef.current = tour
      tour.drive()
    }, 120)

    return () => {
      window.clearTimeout(timer)
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [location.pathname, navigate, requestVersion, userId])
}
