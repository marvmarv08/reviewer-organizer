# Reviewer Organizer Product Requirements

## Purpose

Reviewer Organizer is an installable, offline-first web application that helps students keep study materials together and turn questions into a progressive mastery routine across their devices.

## Version 1 Scope

- Create, edit, search, and delete subjects.
- Store PDF reviewers within a subject; add, open, and delete them.
- Create, edit, search, and delete notes within a subject.
- Create, edit, filter, and delete identification questions with one primary answer, optional accepted alternatives, and an explanation.
- Bulk-import ChatGPT-generated identification questions from a validated Reviewer Organizer JSON questionnaire, with duplicate warnings and a selectable preview before saving.
- Run randomized tests for one subject and one mastery level at a time.
- Offer subject review modes: configurable smart flashcards, simple flashcards, quick review, missed-question review, and mixed practice across levels.
- Let students use Simple Flashcards with an automatically randomized question order to reveal an answer, move to the next question, or undo one question without changing mastery or review scheduling.
- Let students select one or more mastery tiers, choose a card count, and optionally randomize question order before starting flashcards.
- After revealing a flashcard answer, let the student rate it Again, Hard, Good, or Easy; Easy moves it forward one mastery tier.
- Let the student manually keep a question at its current level or move it one level forward or backward after checking an answer.
- Allow questions to be skipped without changing their level or counting them as answered.
- Record completed test history and answer snapshots.
- Display dashboard totals, mastery distribution, recent tests, and suggested next steps.
- Export and restore a complete local backup, including PDFs.
- Work offline after the first successful load and support installation as a Progressive Web App.
- Let students sign up, verify their email, sign in, sign out, and recover a forgotten password.
- Synchronize each authenticated student's records and PDFs through Supabase while preserving a per-user offline cache.
- Enforce database and file-storage policies that prevent students from accessing one another's data.

## Mastery Levels

1. Test 1 — new questions.
2. Test 2 — questions the student is starting to master.
3. Test 3 — questions mastered from Test 2.
4. Final Test Reviewer — questions mastered from Test 3.

Level changes are manual. Correct and incorrect answers update statistics but never move a question automatically. After checking an answer, the student chooses **Previous level**, **Keep here**, or **Next level**. Test 1 cannot move backward and the Final Test Reviewer cannot move forward.

## Approved Product Rules

- Version 1 uses identification questions. Answer checking ignores capitalization and repeated surrounding/internal spaces, and each question may define multiple accepted answers.
- Tests contain up to 10 questions by default and never repeat a question in one session.
- A flashcard activity finishes only after every selected card is rated Easy. Again, Hard, and Good keep a card in the activity; if no other card remains, the card returns immediately instead of forcing the student to wait for its saved review interval.
- Tests cover one subject and one mastery level.
- Typed answers lock after the student chooses **Check answer**. The correct answer and explanation appear immediately, followed by the manual level controls.
- Deleting a subject requires typing its name and removes its related content and history.
- PDF uploads are limited to 50 MB to match the configured Supabase Free-project ceiling; failed uploads retain a temporary local copy for retry.
- Authentication uses email and password first; social sign-in may be added in a later version.
- Public sign-up is enabled, with email confirmation required before normal authenticated use.
- Student data belongs to the authenticated owner, synchronizes with Supabase, and is never committed to GitHub.

## Main Limitation

Supabase provides the cloud source of truth, while IndexedDB provides a per-user offline working copy of study records and lightweight PDF metadata. Private PDF binaries are fetched on demand to avoid exhausting mobile-browser memory. Backup and restore remain important safeguards against accidental deletion or account-access problems.
