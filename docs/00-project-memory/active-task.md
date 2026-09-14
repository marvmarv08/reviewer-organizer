---
pmm_schema: pmm.task/v1
task_id: add-private-supabase-backend
parent_task_id: none
task_kind: primary
execution_status: active
verification_status: pending
delivery_status: deployed
owner: codex-root
branch: main
base_sha: 5b51133c1658acec4e09e2994ea49ebd7d00c489
revision: 41
verification_head: none
verification_source_hash: none
verified_at: none
updated_at: 2026-09-14T01:30:02Z
---

# Active Task

Purpose: Single primary task contract, verifier, retry state, and integration checkpoint.
Read when: Starting, executing, verifying, integrating, or recovering this task.
Skip when: The task is unrelated to the current execution context.

## Status

- Title: Complete private Supabase workflow and BatStateU-inspired interface
- Runtime Profile: Sprint
- Risk Level: normal
- Loop Budget: 3
- Current Attempt: 1
- Stop Condition: required behavior is verified or a concrete blocker is recorded.

## Task

- Objective: Complete the private Supabase workflow and present it through a simple, organized BatStateU-inspired interface
- Scope: Backend architecture, migrations, RLS, private storage, private login, IndexedDB migration, synchronization, interface layout and visual system, tests, documentation, and deployment
- Allowed Files or Areas: Supabase and local-data code, authentication and application interface, styling and branding assets, tests, project documentation, and deployment configuration
- Forbidden Actions: unrelated edits, destructive operations, publication, and production writes without explicit authorization.
- Source Artifacts: project instructions, current source, and task request.

## Harness

- Agent Mode: solo
- Owner: codex-root
- Branch: main
- Parent Task: none
- Tools: project-local tools and pmm lifecycle helpers.
- Environment Notes: one writer owns this task file and branch.

## Verifier

- Required Checks: Verify authentication success and denial paths, RLS isolation, private PDF access, offline sync, data migration, lint, tests, build, and deployment rollback readiness
- Manual Acceptance: task-specific acceptance remains explicit.
- Evidence Needed: fresh command output bound to the current HEAD and source hash.

## Critic

- Pass/Fail: pending
- Missing Evidence: required checks have not completed.
- False-Pass Risk: stale or unrelated evidence must not count.
- Next Action: execute the first unverified acceptance step.

## Repair

- Last Failure: none
- Failure Class: none
- Attempted Fix: none
- Next Concrete Action: Manually accept the automatically randomized Simple Flashcards order on signed-in desktop and phone, including stable Next/Undo navigation and unchanged mastery.

## Record

- Verification Evidence: pending after checkpoint
- Delivery Status: deployed
- Delivery Evidence: GitHub Pages workflow 34742661817 successfully deployed spotlight App Guide commit b75f913.
- Docs Updated: PRD, current state, change log, and active task.
- Remaining Risk: Live phone acceptance of the revised no-wait queue remains pending.
- Memory Promotion Decision: pending
- Last Updated: 2026-09-09
