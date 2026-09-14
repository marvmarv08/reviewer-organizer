import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startFullTour, startTourAt, TOUR_PAGES } from './onboarding-tour'

describe('onboarding tour launch controls', () => {
  beforeEach(() => localStorage.clear())

  it('starts the full walkthrough from the dashboard', () => {
    const started = vi.fn()
    window.addEventListener('reviewer-organizer:start-tour', started, { once: true })

    startFullTour()

    expect(localStorage.getItem('reviewer-organizer-tour-running')).toBe('true')
    expect(localStorage.getItem('reviewer-organizer-tour-page')).toBe('0')
    expect(localStorage.getItem('reviewer-organizer-tour-single')).toBeNull()
    expect(started).toHaveBeenCalledOnce()
  })

  it('starts one requested section without continuing to later pages', () => {
    startTourAt(2)

    expect(TOUR_PAGES[2].path).toBe('/classroom')
    expect(localStorage.getItem('reviewer-organizer-tour-page')).toBe('2')
    expect(localStorage.getItem('reviewer-organizer-tour-single')).toBe('true')
  })

  it('ignores an invalid section index', () => {
    startTourAt(99)

    expect(localStorage.getItem('reviewer-organizer-tour-running')).toBeNull()
  })
})
