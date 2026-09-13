# Current State

Purpose: Current project phase, stable facts, blockers, and next recommended actions.
Read when: Starting or resuming project work.
Skip when: Only reading historical decisions or one-off command output.

## Phase

Version 1 foundation deployed for user acceptance testing.

## Current Top Objective

Complete and validate the private Supabase workflow while refining the application through a simple BatStateU-inspired interface.

## Stable Facts

- Repository: public GitHub repository `marvmarv08/reviewer-organizer`.
- Product format: browser-based web application.
- Development must include beginner-friendly explanations of each important component, its purpose, how it connects to the system, verification steps, and meaningful tradeoffs or risks.

## What Exists

- Local Git repository and public GitHub repository.
- Project memory and active build task.
- React and TypeScript Progressive Web App with responsive navigation and offline service worker.
- IndexedDB database for subjects, PDFs, notes, questions, settings, and test-history snapshots.
- Subject, PDF, note, question-bank, practice-test, dashboard, history, and backup interfaces.
- Question Bank bulk import for `.txt` or `.json` questionnaires, including strict validation, duplicate filtering, and selectable review before saving.
- Notes import includes an in-app full-coverage ChatGPT prompt that requests page-by-page PDF review before producing import-ready notes.
- Main dashboard now presents subjects only; each subject workspace contains its own PDF, question, mastery, score, and test summary.
- Question Bank supports selecting visible questions and deleting a confirmed batch from Supabase and local storage.
- Subject workspaces include Study modes for flashcards, quick review, missed questions, and mixed practice. Flashcards have a separate mobile-friendly setup where students choose mastery tiers, card count, and whether to shuffle the session; Again, Hard, Good, and Easy schedule the next review, while Easy also advances mastery by one tier.
- During an active flashcard session, Again, Hard, and Good stay queued until rated Easy. They move ahead when their interval expires, or return immediately when no other card remains; Easy removes the card from the activity while preserving its future due schedule.
- An active Flashcard or Quick Review question can be deleted with confirmation; deletion is synchronized to Supabase and local storage, preserves test-history snapshots, and keeps the remaining session position valid.
- The sidebar includes an App Guide between Connect Google Classroom and Settings & Backup, with a six-step interactive walkthrough, progress tracking, and shortcuts to each relevant workflow.
- Authenticated account switches clear the previous account's IndexedDB cache before hydrating the new account, preventing cross-account local-data leakage.
- Subject workspaces now show mastery progress, last-study date, and a Continue Test action; the sidebar shows offline, syncing, synced, or error status and retries on reconnect/focus.
- Manual and bulk question saves now wait for confirmed private Supabase persistence before updating the local question bank, preventing phone uploads from appearing successful before cloud synchronization finishes.
- Automated mastery-rule tests and production build configuration.
- Email authentication, per-user Supabase study-data synchronization, deletion synchronization, and realtime subscriptions.
- Password recovery can send a Supabase reset email to the production app, accept the recovery session, require matching new-password fields, update the password, and sign the temporary recovery session out.
- Private Supabase PDF upload, cross-device metadata synchronization, signed five-minute open links, cloud deletion, and automatic migration of legacy browser PDFs.
- Local Google Classroom integration can authorize a test user, list active courses, discover Drive PDF attachments from coursework, classwork materials, and Stream announcements, and import a selected PDF through the existing private Supabase storage workflow.
- Awaited note persistence, foreground/online resynchronization, and Supabase Realtime publication for subjects, PDF metadata, notes, questions, and test history.
- BatStateU-inspired red, white, and warm-neutral application shell using the university seal already provided for the project.

## What Works

- Google OAuth now lists active Classroom courses and imports Drive PDFs from coursework, classwork materials, or Stream announcements into the signed-in student's private PDF library. Marvin confirmed the real local course/PDF flow before deployment on 2026-09-05.
- Lint, seven automated tests, and production build pass after the 2026-08-31 interface update.
- Questionnaire and note import validation are covered by focused tests; the application suite now contains thirty-eight passing tests.
- Production output serves the application shell, service worker, and install manifest successfully.
- Marvin confirmed the real Google consent, course selection, and Classroom PDF discovery flow locally on 2026-09-05.
- GitHub Pages deploys automatically from `main` and the live HTTPS site returns the app shell, PWA manifest, and service worker successfully.
- The active-session card queue is covered by focused before-due, after-due, simultaneous-retry, non-Easy retention, and Easy-removal tests.
- All 38 automated tests, ESLint, TypeScript production build, PWA generation, and diff validation pass after the local no-wait queue revision.

## Known Issues

- The password-recovery flow is deployed and passes local code plus live-bundle checks, but still requires a real reset-email acceptance test.
- Complete two-account RLS isolation, live note and PDF cross-device behavior, offline conflict behavior, and recovery paths still require verification.
- Manual desktop and phone visual acceptance of the BatStateU-inspired interface remains required.
- An iPhone Safari subject-route crash was reported. A local repair now cleans up Realtime channels, coalesces cloud events, incrementally reconciles IndexedDB, and removes `color-mix()` from subject surfaces; live iPhone verification remains pending deployment.
- The revised no-wait active-session queue is deployed and requires real phone acceptance.

## Current Blockers

- None. Product direction and repository visibility are confirmed.

## Next Recommended Actions

- Deploy the locally verified private-PDF workflow, then upload on phone, open on laptop, test deletion, and confirm a second account cannot access the signed-in owner's PDF.

## Last Updated

2026-09-13
