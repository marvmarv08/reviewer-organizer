# Change Log

Purpose: Chronological record of durable project behavior, requirement, implementation, and operation changes.
Read when: You need recent durable changes or must record a state-changing task.
Skip when: You only need the active task or current state.

## 2026-09-09 — Repeat non-Easy cards without an idle countdown

- Product rule: A flashcard activity finishes only when every selected card has been rated Easy.
- Queue behavior: Again, Hard, and Good remain in the activity. A card returns when its interval expires, or immediately when the other queued cards are finished, so the student never waits on an empty countdown screen.
- Persistence: The selected 1-minute, 5-minute, 45-minute, or adaptive interval remains saved for future due-card scheduling.
- UX: Removed the blocking `Next card queued` countdown and clarified the rating guidance beneath the buttons.
- Evidence: all 38 automated tests, ESLint, TypeScript production build, PWA generation, and diff validation pass locally; phone acceptance remains pending.
- Delivery: GitHub Pages workflow `34251493694` successfully deployed commit `f24a3c1`.

## 2026-09-08 — Keep Easy cards out of the active session

- Change: Choosing Easy now removes the card from the current session instead of scheduling a same-session return.
- Persistence: Easy still saves its one-day due time and one-tier mastery promotion, so it appears in a future due-card session.
- Other ratings: Again, Hard, and Good continue returning automatically in the active session at their selected intervals.
- Evidence: the Easy-removal regression test and the existing timed-queue tests pass; all 37 tests, ESLint, TypeScript, the production build, PWA generation, and diff validation pass locally.
- Delivery: GitHub Pages workflow `34236423227` successfully deployed commit `c419ab8`.
- Remaining risk: final phone acceptance is still required after deployment.

## 2026-09-08 — Return every flashcard rating during the active session

- Change: Again, Hard, Good, and Easy ratings now all remain in the active session and return automatically when their saved intervals expire.
- Queue behavior: A due scheduled card moves behind the card currently being answered and ahead of unanswered cards; a not-yet-due card never appears early.
- UX: If the available cards finish before the next interval, the session shows a live countdown and opens the scheduled card automatically without a refresh.
- Persistence: The existing Supabase due time, interval, ease, repetition, lapse, and mastery updates remain unchanged; this change only improves current-session queue handling.
- Evidence: focused scheduling tests cover before-due, after-due, simultaneous, and all-rating scheduled cards; all 36 tests, ESLint, TypeScript, the production build, PWA generation, and diff validation pass locally.
- Delivery: GitHub Pages workflow `34233701930` successfully deployed commit `7b54c82`.
- Remaining risk: a one-day Easy interval can intentionally leave a countdown if the student keeps the same session open; returning to Study modes remains the practical way to stop waiting.

## 2026-09-08 — Honor Again timing during active flashcard sessions

- Root cause: Again retries were appended to the fixed end of the session, while the due-time clock stopped after the session began. The stored one-minute schedule therefore could not affect the active queue.
- Change: Active flashcard sessions now check due times every second and move an elapsed Again retry directly behind the card currently being answered, ahead of unanswered cards.
- UX: A card never interrupts the question already on screen. If the normal queue finishes before the minute expires, a visible countdown waits and opens the retry automatically without refreshing.
- Evidence: focused scheduling tests cover the 59-second waiting state, 60-second queue promotion, and stable simultaneous retries; all 35 tests, ESLint, TypeScript, the production build, PWA generation, and diff validation pass locally.
- Delivery: GitHub Pages workflow `34232164964` successfully deployed commit `93c6d79`.
- Remaining risk: real browser timing and background-tab behavior still require Marvin's acceptance.

## 2026-09-08 — Delete questions during Flashcard and Quick Review

- Change: Added a confirmed Delete this question action to every active flashcard, before and after answer reveal.
- Change: Added a minimal trash-icon Delete action beside Next question in Quick Review.
- Synchronization: The action removes the question from Supabase first, then local IndexedDB and the current card session; test-history snapshots remain unchanged.
- Session behavior: The next card stays in the current position, deleting the final card ends the session cleanly, and cloud failures leave the card available with an error message.
- Evidence: ESLint, 24 automated tests, TypeScript production build, PWA generation, and diff validation pass locally.
- Delivery: GitHub Pages workflow `34186773367` deployed commit `b0c67a4`; the published bundle contains both deletion controls and their confirmation behavior.
- Remaining risk: Marvin must manually accept both live review layouts, the confirmation dialog, next-question behavior, and cross-device deletion.

## 2026-09-08 — Add secure password recovery

- Change: Added a Forgot Password screen, Supabase reset-email request, recovery-session detection, matching new-password confirmation, password update, and sign-out after recovery.
- Redirects: Signup confirmation and password-reset requests now explicitly return to the application base URL instead of relying only on the Supabase default Site URL.
- Security: Recovery uses Supabase's temporary authenticated session and never handles a service-role key or stores a password outside the submitted form state.
- Evidence: ESLint, 24 automated tests, TypeScript production build, PWA generation, dependency audit, diff validation, and local app-shell HTTP smoke test passed.
- Delivery: GitHub Pages workflow `34183851166` deployed commit `4c3a580`; the live app shell and published bundle contain the reset request and new-password screens.
- Remaining risk: A real delivered reset email and the complete recovery link flow require manual acceptance.

## 2026-09-05 — Google Classroom PDF import foundation

- Change: Added read-only Google OAuth, active-course discovery, Classroom attachment selection, Drive PDF validation, and import into the existing private Supabase PDF workflow.
- Security: Google access tokens remain only in React memory and are cleared on disconnect, refresh, expiry, or an unauthorized response. No Google client secret is used or stored.
- Deployment: GitHub Pages reads the public OAuth Client ID from the repository Actions variable `VITE_GOOGLE_CLIENT_ID`.
- Evidence: lint, 21 automated tests, production build, and a local HTTP app-shell smoke test passed.
- Remaining risk: real Google consent, school-admin policy, course listing, and PDF download require Marvin's manual acceptance before deployment.
- Acceptance repair: The first real course returned no Coursework or Classwork Material attachments because PDFs may also be posted to the Classroom Stream. Announcement attachments are now included through the additional read-only `classroom.announcements.readonly` scope.
- Root cause repair: Real Classroom attachment metadata nests the file under `material.driveFile.driveFile`; the initial parser incorrectly expected `material.driveFile.id`, so it silently discarded valid attachments. Tests now use the real nested API shape.
- Delivery: GitHub Pages workflow `33969982633` deployed commit `736e3ee` successfully, and the live bundle was verified to contain the Classroom import UI and announcement scope.
- Acceptance: Marvin confirmed that the repaired local application successfully reads the PDF attachment from his real Google Classroom course.

## 2026-08-31 — Make note synchronization observable and resilient

- Change: Note creation and editing now await direct Supabase persistence, display a saving state, preserve the local copy on failure, and surface the cloud error instead of silently closing.
- Change: Note deletion now confirms remote deletion before removing the local record.
- Change: Authenticated data resynchronizes when the browser regains internet, returns to the foreground, or receives focus, covering missed Realtime events.
- Change: Added an idempotent migration enabling subjects, PDF metadata, notes, questions, and test history in the `supabase_realtime` publication without changing RLS policies.
- Evidence: Marvin confirmed the production SQL completed successfully; ESLint, eight automated tests, TypeScript, and production PWA build pass locally.
- Remaining risk: phone-to-laptop note create, edit, and delete plus two-account denial require live acceptance after deployment.

## 2026-08-31 — Store reviewer PDFs privately across devices

- Change: Added private `reviewer-pdfs` uploads with per-user paths, `pdf_reviewers` metadata synchronization, short-lived signed open URLs, and coordinated cloud deletion.
- Change: Added IndexedDB version 3, separating lightweight PDF metadata from temporary local binary files so subject pages do not load every PDF into iPhone memory.
- Change: Existing browser PDFs migrate automatically after sign-in; their local binary remains intact until both Storage upload and metadata persistence succeed.
- Change: Backup format version 3 downloads cloud-only PDFs when creating a complete backup and restores them as pending local files for secure re-upload.
- Evidence: ESLint, eight automated tests, TypeScript, production PWA build, and diff validation pass locally.
- Remaining risk: authenticated production upload, signed opening on iPhone, phone-to-laptop visibility, deletion, legacy-data migration, and two-account denial still require live acceptance after deployment.

## 2026-08-31 — Reduce iPhone subject-route resource pressure

- Change: Added explicit Supabase Realtime channel cleanup when the authenticated user lifecycle changes.
- Change: Coalesced bursts of Realtime table notifications and queued one follow-up synchronization instead of running overlapping refreshes.
- Change: Replaced full clear-and-rebuild local synchronization with incremental upserts and deletion reconciliation across subjects, notes, questions, and test history.
- Change: Removed `color-mix()` from subject cards and banners for broader iPhone WebKit compatibility.
- Evidence: ESLint, seven automated tests, TypeScript, and production PWA build pass locally.
- Remaining risk: the screenshot proves an iPhone Safari content-process crash but not its exact internal WebKit cause; the repair requires live deployment and reproduction testing on Marvin's phone.

## 2026-08-31 — Adopt a simple BatStateU-inspired application shell

- Change: Replaced the navy and blue application shell with a restrained deep-red, white, warm-gray, and gold visual system inspired by Batangas State University.
- Change: Reused the project-provided university seal in the sidebar, simplified card shapes, strengthened active navigation, and grouped synchronization and account controls in the sidebar footer.
- Change: Adopted a Classroom-inspired subject flow: each subject is a fully clickable rectangular card with a colored banner and live PDF, note, and question counts; opening it reveals the existing content tabs in a clearer workspace banner.
- Change: Corrected the former local-only status label to describe private cloud synchronization with offline device availability.
- Evidence: ESLint, seven automated tests, TypeScript production build, PWA generation, and production-logo presence checks passed.
- Remaining risk: Marvin must visually accept the desktop and phone layouts before this design is considered final; the production build also reports a non-blocking JavaScript chunk-size warning, and the change has not been deployed by this task.

## 2026-08-31 — Adopt multi-user Supabase authentication

- Change: Reversed the earlier account-free boundary and approved public email/password sign-up, sign-in, sign-out, email verification, and password recovery.
- Change: Each cloud table and PDF object must belong to an authenticated user and be protected by Row Level Security and private storage policies.
- Change: IndexedDB remains as a per-user offline cache rather than the only data source.
- Evidence: Marvin explicitly requested that different people use the application without sharing data.
- Remaining risk: Supabase project configuration, SMTP readiness, security policies, synchronization conflicts, and existing local-data ownership migration require implementation and verification before live release.

## 2026-08-31 — Identification tests with manual mastery levels

- Change: Replaced multiple-choice questions with typed identification answers supporting multiple accepted variants and normalized case/spacing.
- Change: Removed automatic promotion and demotion. After checking an answer, the student explicitly chooses the previous level, current level, or next level.
- Change: Moved all four Start Test actions into each subject's Question Bank and removed the global Practice Test navigation entry.
- Change: Added skip handling, manual level decisions in history, database conversion for existing questions, and backward-compatible restore for version 1 backups.
- Evidence: lint, seven focused identification/manual-level and legacy-backup tests, TypeScript checking, production PWA build, and production dependency audit passed.
- Remaining risk: live phone acceptance and migration testing with a real user-created version 1 backup remain recommended.

## 2026-08-31 — Responsive laptop-to-mobile preview

- Change: Expanded the compact-layout breakpoint to 850 CSS pixels and strengthened phone layouts for navigation, cards, files, forms, history, tests, and modals.
- Change: Added a dismissible backdrop for the slide-out navigation and short-screen handling for landscape or highly zoomed windows.
- Evidence: lint, four mastery tests, TypeScript checking, production build, and CSS breakpoint inspection passed.
- Remaining risk: final visual acceptance depends on Marvin's laptop scaling and target phone/browser.

## 2026-08-31 — Keep the application account-free

- Change: Confirmed that Reviewer Organizer remains a personal standalone application without sign-up, sign-in, authentication, Supabase, or cloud synchronization.
- Evidence: Marvin explicitly rejected adding the sign-up feature after discussing an account-based architecture.
- Remaining risk: study data remains device-specific and must be moved using backup and restore.

## 2026-08-31 — GitHub Pages deployment

- Change: Published the application at `https://burgosmarvin79-cyber.github.io/reviewer-organizer/` using an automated GitHub Actions workflow.
- Change: Set Vite's repository base path to `/reviewer-organizer/` and used hash-based client navigation to prevent internal-page refresh errors on static hosting.
- Evidence: local lint, tests, and repository-path build passed; GitHub Actions run `33322288775` succeeded; live page, manifest, and service worker returned HTTPS 200.
- Remaining risk: installation prompts and the complete data workflow require acceptance testing on Marvin's phone and browser.

## 2026-08-31 — Version 1 foundation

- Change: Chose an installable Progressive Web App to preserve the requested web interface and standalone offline behavior.
- Change: Chose IndexedDB through Dexie because PDFs and structured study records exceed the practical purpose of localStorage.
- Change: Defined four mastery levels with promotion after three consecutive correct answers and one-level demotion after an incorrect answer.
- Change: Stored question snapshots in test history so later question edits do not rewrite the historical record.
- Change: Included complete local backup and restore because browser-local data has no cloud copy.
- Evidence: lint, four mastery tests, production build, dependency audit, and production HTTP smoke test passed.
- Remaining risk: browser-specific storage and install behavior needs manual acceptance on the user's target device.
## 2026-08-31 — Review-first questionnaire import

- Change: Added `.txt` and `.json` bulk import for ChatGPT-generated identification questionnaires inside each subject's Question Bank.
- Change: Required a versioned JSON contract, rejected malformed questions, filtered duplicates, and added a selectable preview before records are saved and synchronized.
- Evidence: lint, twelve automated tests including four focused import-validation cases, TypeScript checking, and the production PWA build passed.
- Remaining risk: a real questionnaire generated from Marvin's uploaded notes still needs manual content and cross-device acceptance testing.
## 2026-08-31 — Confirm question cloud saves

- Change: Manual question creation/editing and bulk questionnaire imports now await an authenticated Supabase upsert before updating the local question bank.
- Change: Failed cloud writes remain visible in the form instead of closing and implying cross-device synchronization succeeded.
- Evidence: lint, twelve automated tests, TypeScript checking, and the production PWA build passed.
- Remaining risk: live phone-to-laptop import and realtime arrival still require acceptance testing with Marvin's Supabase account.
## 2026-08-31 — Subject-focused dashboard

- Change: Removed global PDF, question, average-score, mastery-ladder, and latest-activity panels from the main dashboard.
- Change: Kept the dashboard focused on clickable subjects and added per-subject summary cards for PDFs, questions, average score, and completed tests.
- Evidence: lint, twelve automated tests, TypeScript checking, and production build passed after the change.
## 2026-08-31 — Batch question selection and deletion

- Change: Added Question Bank selection mode with select-visible, clear-selection, and confirmed delete-selected actions.
- Change: Batch deletion removes records for the signed-in owner from Supabase before removing their local cache; test-history snapshots remain available.
- Evidence: lint, twelve automated tests, TypeScript checking, and production build passed.
## 2026-08-31 — Isolate local caches by signed-in account

- Change: Added an account-owner marker and cache switch that clears subjects, PDFs, PDF binaries, notes, questions, test sessions, and settings before loading another user's cloud data.
- Change: Authentication setup now switches the local cache before enabling the new user's sync and realtime subscriptions.
- Evidence: lint, twelve automated tests, TypeScript checking, and production build passed.
- Remaining risk: two-account phone/laptop acceptance testing is still required with real Supabase accounts.
## 2026-08-31 — Subject progress and visible sync state

- Change: Added per-subject mastery progress, last-study date, average score, test count, and Continue Test action.
- Change: Added a live sidebar sync status that distinguishes offline, syncing, synced, and error states; existing reconnect, focus, and visibility refresh triggers continue retrying cloud synchronization.
- Evidence: lint, twelve automated tests, TypeScript checking, and production build passed.
- Remaining risk: a durable per-record offline mutation queue remains a future enhancement; current retry behavior depends on local records and the existing synchronization reconciliation.
## 2026-08-31 — Multiple study modes per subject

- Change: Added a Study modes tab with flashcards, quick review, missed-question review, and mixed practice across all levels.
- Change: Review modes are separate from mastery tests; they help recall and practice without changing a question's mastery level automatically.
- Evidence: lint, twelve automated tests, TypeScript checking, and production build passed.
- Remaining risk: mixed practice currently provides immediate feedback but does not create a formal test-history record.

## 2026-09-04 — Repair common ChatGPT note JSON

- Change: Note import now safely repairs complete JSON code fences and unescaped double quotes inside note content immediately followed by the required level field.
- Change: Updated the ChatGPT prompt to request plain text without Markdown symbols and single quotes for HTML attribute examples.
- Evidence: focused lint passed, all seventeen application tests passed, and the production PWA build completed.
- Remaining risk: severely malformed or structurally ambiguous JSON remains rejected instead of being guessed.

## 2026-09-04 — Repair generated questionnaire quotes

- Change: Questionnaire import now repairs unescaped double quotes inside generated text values, including HTML attribute examples such as `name="value"`.
- Evidence: the real failure pattern received from Marvin passed a focused regression test; source lint, all nineteen application tests, and the production PWA build passed.
- Remaining risk: structurally ambiguous files remain rejected instead of being guessed.

## 2026-09-04 — Expose the full-coverage notes prompt

- Change: Added a copyable Notes Generator prompt inside the Notes import screen so the desktop workflow asks ChatGPT to review every PDF page and capture all important material.
- Evidence: source lint, all nineteen application tests, and the production PWA build passed.
- Remaining risk: AI-generated coverage still requires student review against the original PDF; the app cannot guarantee that an external model omitted nothing.

## 2026-09-07 — Add configurable flashcard sessions

- Change: Made Flashcards a separate featured section within Study Modes and added a pre-session setup for mastery-tier selection, card count, and optional question shuffling.
- Change: Restored the post-reveal Previous level, Keep here, and Next level decisions, with cloud persistence before an updated card advances.
- Change: Added phone-focused layouts with single-column controls, larger tap targets, and a clearer two-step setup flow.
- Evidence: source lint, all 24 application tests including selected-tier session coverage, and the production PWA build passed.
- Remaining risk: final visual acceptance still needs testing on Marvin's target phone browser.

## 2026-09-08 — Add adaptive spaced-repetition scheduling

- Change: Replaced manual post-card tier movement with Again, Hard, Good, and Easy ratings whose displayed intervals adapt to each card's review history.
- Timing: New cards begin at Again 1 minute, Hard 5 minutes, Good 45 minutes, and Easy 1 day; later intervals remain adaptive.
- Mastery rule: Easy advances the question by one mastery tier, capped at Tier 4; Again, Hard, and Good keep the current tier.
- Change: Added due-only sessions, due/learning/mastered summaries, same-session requeue for forgotten cards, and a compact responsive rating layout while preserving manual mastery tiers.
- Refresh behavior: The flashcard setup recalculates due cards every five seconds and immediately when the app returns from the background, so newly due cards appear without a manual page refresh.
- Persistence: Added additive question scheduling fields for state, due time, interval, ease, repetitions, and lapses, protected by the existing per-user Row Level Security policy.
- Evidence: source lint, all 30 automated tests, TypeScript checking, and the production PWA build passed locally.
- Remaining risk: the additive production Supabase migration and real-device visual acceptance are pending.

## 2026-09-13 — Add an interactive new-user app guide

- Change: Added an App Guide entry between Connect Google Classroom and Settings & Backup in the sidebar.
- Change: Added a six-step walkthrough covering the dashboard, subjects, study materials, Google Classroom import, study modes, history, and backups, with progress, step navigation, helpful tips, and direct workflow shortcuts.
- Evidence: lint, all thirty-eight automated tests, TypeScript checking, and the production PWA build passed.
- Remaining risk: final visual acceptance on Marvin's target laptop and phone remains recommended.
