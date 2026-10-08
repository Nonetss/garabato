# Cron Scheduling

## Purpose

Lets oRPC procedures declare themselves cron-eligible or carry a fixed schedule, and runs an in-process `Bun.cron` scheduler that persists job definitions and run history, prevents overlaps, recovers orphaned runs and syncs code-declared schedules.

## Requirements

### Requirement: Cron-eligible procedure metadata

The system SHALL let any oRPC procedure declare itself schedulable by attaching the metadata `{ cron: { eligible: true } }`, or declare a fixed schedule of its own by attaching `{ cron: { schedule: "<cron expression>" } }`, optionally with a job `name` and `description`. The two forms SHALL be mutually exclusive at the type level: a procedure declares either `eligible` or `schedule`, never both. No registry, list, or per-procedure wiring beyond that metadata SHALL be required.

#### Scenario: Procedure opts in

- **WHEN** a procedure declares `.meta({ cron: { eligible: true } })`
- **THEN** the system SHALL treat it as a cron handler whose key is its dot path inside the version router (for example `health.check`)

#### Scenario: Procedure declares its own schedule

- **WHEN** a procedure declares `.meta({ cron: { schedule: "0 3 * * *" } })`
- **THEN** the system SHALL treat it as a code-declared schedule whose key is its dot path inside the version router, and SHALL run it on that UTC expression without any job being created through the API

#### Scenario: Both forms declared

- **WHEN** a procedure's cron metadata sets both `eligible` and `schedule`
- **THEN** type-checking SHALL fail

#### Scenario: Procedure does not opt in

- **WHEN** a procedure declares no cron metadata
- **THEN** the system SHALL NOT expose it as a cron handler and SHALL reject any attempt to schedule it

### Requirement: Cron handler discovery

The system SHALL discover cron handlers by walking the version router at runtime, collecting for each eligible procedure its key, route summary, description, tags, and its input schema converted to JSON Schema. The same walk SHALL collect, separately, every code-declared schedule with its key, cron expression, route summary and description. Both results SHALL be computed once and cached for the process lifetime. Resolving a key for execution SHALL accept both eligible procedures and procedures with a code-declared schedule.

#### Scenario: Listing discovered handlers

- **WHEN** the discovery module is asked for the cron handlers
- **THEN** it SHALL return every cron-eligible procedure in the version router, sorted by key, and SHALL NOT include procedures that declare a `schedule`

#### Scenario: Listing code-declared schedules

- **WHEN** the discovery module is asked for the code-declared schedules
- **THEN** it SHALL return every procedure declaring `cron.schedule`, sorted by key, with its expression

#### Scenario: Handler input schema exposed

- **WHEN** a cron-eligible procedure declares a zod input schema
- **THEN** the discovered handler entry SHALL carry that schema converted to JSON Schema, and `null` when the procedure takes no input or conversion fails

#### Scenario: Resolving an unknown key

- **WHEN** a key that resolves neither to a cron-eligible procedure nor to a procedure with a code-declared schedule is resolved
- **THEN** the system SHALL throw a `NOT_FOUND` error

### Requirement: Persistent cron job definitions

The system SHALL persist cron job definitions with a unique name, optional description, cron expression, timezone, enabled flag, handler key, optional JSON payload, the last and next run timestamps, and the job's origin: `manual` for jobs created through the API and `code` for jobs synced from a code-declared schedule. Existing and API-created jobs SHALL default to `manual`. At most one active (not soft-deleted) `code` job SHALL exist per handler key.

#### Scenario: Job stored with schedule metadata

- **WHEN** a cron job is created
- **THEN** the system SHALL store its definition with origin `manual` and, when the job is enabled, compute and store its next run timestamp

#### Scenario: Duplicate job name

- **WHEN** a cron job is created with a name that already exists
- **THEN** the system SHALL reject it with a validation error naming the conflict

### Requirement: Cron expression validation

The system SHALL validate cron expressions before persisting them, and SHALL reject any timezone other than UTC because the underlying `Bun.cron` runtime schedules in UTC only.

#### Scenario: Invalid expression

- **WHEN** a job is created or updated with an unparseable cron expression
- **THEN** the system SHALL reject the write with a validation error quoting the expression

#### Scenario: Non-UTC timezone

- **WHEN** a job is created with a timezone other than `UTC`
- **THEN** the system SHALL reject the write with a validation error stating that only UTC is supported

### Requirement: Unknown handler key rejection

The system SHALL reject creating or updating a cron job through the API whose handler key does not correspond to a discovered cron-eligible procedure. A procedure that declares a `schedule` SHALL NOT be accepted as the handler of an API-created job.

#### Scenario: Job created with an unknown handler key

- **WHEN** a job is created with a handler key that is not cron-eligible
- **THEN** the system SHALL reject the write with a validation error and persist nothing

#### Scenario: Job created with a code-scheduled handler key

- **WHEN** a job is created or updated through the API with the key of a procedure that declares a `schedule`
- **THEN** the system SHALL reject the write with a validation error and persist nothing

### Requirement: In-process scheduler

The system SHALL run an in-process scheduler that loads enabled job definitions from the database, registers each one with `Bun.cron`, and periodically re-reads the definitions so that changes made through the API take effect without a restart. Jobs SHALL be re-registered only when their schedule, handler key, payload, or enabled flag changed.

#### Scenario: Enabled job is scheduled

- **WHEN** the scheduler starts or refreshes and finds an enabled job
- **THEN** it SHALL register the job with its cron expression and store the computed next run timestamp

#### Scenario: Job disabled or deleted

- **WHEN** a job is disabled or deleted
- **THEN** the next scheduler refresh SHALL unregister it and it SHALL NOT execute again

#### Scenario: Unchanged job on refresh

- **WHEN** a refresh finds a job whose schedule, handler key, payload and enabled flag are unchanged
- **THEN** the scheduler SHALL leave the existing registration in place

#### Scenario: Unschedulable job

- **WHEN** registering a job with `Bun.cron` fails
- **THEN** the scheduler SHALL log the error and continue scheduling the remaining jobs

### Requirement: Job execution through the procedure

When a job fires, the system SHALL invoke its handler procedure directly in-process — not over HTTP — passing the job's stored payload as the procedure input and a context marked as a cron execution carrying the job id and job name. When the job is bound to a user, the context SHALL carry a real session for that user, created for the run and revoked when it ends, so every authorization check applies that user's actual permissions exactly as it would over HTTP. When the job is bound to no user, the context SHALL carry no user or session. The cron marking SHALL NOT itself grant any access a user-bound or user-less caller would not have.

#### Scenario: Job fires

- **WHEN** a scheduled job's cron expression fires and the job is still enabled
- **THEN** the system SHALL call the resolved procedure with the job payload (or an empty object when the payload is null) and a cron-marked context

#### Scenario: Job bound to an administrator runs an admin-only procedure

- **WHEN** a job bound to an administrator fires against a procedure restricted to administrators
- **THEN** the procedure SHALL run with that administrator as the caller and SHALL NOT be rejected as unauthorized

#### Scenario: Job bound to no user runs a protected procedure

- **WHEN** a job bound to no user fires against a procedure that requires an authenticated user
- **THEN** the procedure SHALL reject the call as unauthorized and the run SHALL be recorded as `failed`

#### Scenario: Job bound to a non-administrator runs an admin-only procedure

- **WHEN** a job bound to a user who is not an administrator fires against a procedure restricted to administrators
- **THEN** the procedure SHALL reject the call as forbidden and the run SHALL be recorded as `failed`

#### Scenario: Job session is revoked

- **WHEN** a run of a user-bound job finishes, successfully or not
- **THEN** the session created for that run SHALL be revoked

#### Scenario: Job disabled between registration and firing

- **WHEN** a job fires but has since been disabled or deleted in the database
- **THEN** the system SHALL NOT execute the handler

### Requirement: Run history

The system SHALL record one run row per execution attempt, carrying the job id, handler key, status (`running`, `success`, `failed`, `skipped`), start timestamp, finish timestamp, and the error message when the run failed. On completion the parent job's last and next run timestamps SHALL be updated for both success and failure.

#### Scenario: Successful run

- **WHEN** a handler completes without throwing
- **THEN** the run SHALL be marked `success` with its finish timestamp, and the job's last and next run timestamps SHALL be updated

#### Scenario: Failed run

- **WHEN** a handler throws
- **THEN** the run SHALL be marked `failed` with the error message recorded, the failure SHALL be logged, the scheduler SHALL keep running, and the job's last and next run timestamps SHALL be updated

### Requirement: Overlap protection

The system SHALL NOT run two executions of the same job concurrently. When a job fires while a previous run of that job is still recorded as `running`, the system SHALL record a `skipped` run instead of executing the handler.

#### Scenario: Previous run still in progress

- **WHEN** a job fires and a `running` run already exists for it
- **THEN** the system SHALL record a `skipped` run explaining that the previous run is still in progress, and SHALL NOT execute the handler

### Requirement: Orphaned run recovery

On startup the system SHALL mark every run still in `running` state as `failed`, since such rows can only be left behind by a process that died mid-run.

#### Scenario: Backend restarts mid-run

- **WHEN** the backend starts and finds runs in `running` state
- **THEN** it SHALL mark them `failed` with an explanatory error message and log how many were recovered

### Requirement: Startup consistency reporting

On startup the system SHALL log a warning for every persisted manual job whose handler key no longer resolves to a cron-eligible procedure, and an error for every discovered handler or code-declared schedule that cannot be resolved. Neither condition SHALL prevent the scheduler from starting.

#### Scenario: Stored job points at a removed procedure

- **WHEN** the backend starts and a stored manual job's handler key is no longer cron-eligible
- **THEN** the system SHALL log a warning identifying the job and key, and SHALL still start the scheduler

### Requirement: Scheduler lifecycle

The scheduler SHALL start as part of backend startup and stop cleanly on process termination signals, unregistering all jobs and clearing its refresh timer. Starting an already-started scheduler SHALL be a no-op.

#### Scenario: Backend shuts down

- **WHEN** the backend receives `SIGINT` or `SIGTERM`
- **THEN** the scheduler SHALL stop its refresh timer and unregister every scheduled job before the process exits

### Requirement: Code-declared schedule sync

On backend startup, after the administrator seed and orphaned-run recovery and before the scheduler starts, the system SHALL reconcile the persisted `code` jobs with the code-declared schedules. Each code-declared job SHALL take the `name` declared in its meta, defaulting to its handler key, and the `description` declared in its meta, defaulting to the procedure's route description or summary; it SHALL run in UTC with a null payload, and be enabled. Each code-declared job SHALL be bound to the administrator account configured for the seed (the user whose email is `ADMIN_EMAIL`), and the sync SHALL reconcile that binding on every startup. When no such account is configured or it does not exist, code-declared jobs SHALL be bound to no user and the system SHALL log a warning naming them; when the account exists but is not an administrator, the system SHALL still bind it and SHALL log a warning, granting it no additional access. Sync failures for one schedule SHALL be logged and SHALL NOT prevent the others from syncing or the scheduler from starting.

#### Scenario: New schedule declared in code

- **WHEN** the backend starts and a procedure declares a valid `schedule` with no active `code` job for its key
- **THEN** the system SHALL create an enabled `code` job for that key with the declared expression, its next run timestamp, and the seed administrator as its run-as user

#### Scenario: Declared expression, name or description changed

- **WHEN** the backend starts and the active `code` job for a key stores a different expression, name or description than the ones declared in code
- **THEN** the system SHALL update the job in place (and its next run timestamp), keeping the same job and its run history

#### Scenario: Run-as user changed

- **WHEN** the backend starts and the active `code` job for a key is bound to a different user (or to none) than the seed administrator currently resolved
- **THEN** the system SHALL rebind the job in place to the resolved user (or to none), keeping the same job and its run history

#### Scenario: Seed administrator not configured or missing

- **WHEN** the backend starts and `ADMIN_EMAIL` is unset or names no existing user
- **THEN** the system SHALL bind every code-declared job to no user, SHALL log a warning naming those jobs, and SHALL still start the scheduler

#### Scenario: Seed account is not an administrator

- **WHEN** the backend starts and the user named by `ADMIN_EMAIL` exists but is not an administrator
- **THEN** the system SHALL bind code-declared jobs to that user, SHALL log a warning, and admin-only procedures SHALL reject those runs as forbidden

#### Scenario: Code-declared schedule on an admin-only procedure

- **WHEN** a procedure restricted to administrators declares a `schedule` and the seed administrator exists
- **THEN** each scheduled run SHALL execute as that administrator, including every procedure it invokes with its own context, and SHALL NOT fail as unauthorized

#### Scenario: Code-declared schedule on a public procedure without a run-as user

- **WHEN** a public or cron-only procedure declares a `schedule` and no seed administrator can be resolved
- **THEN** each scheduled run SHALL still execute with no user

#### Scenario: Schedule removed from code

- **WHEN** the backend starts and an active `code` job's key no longer declares a `schedule`
- **THEN** the system SHALL soft-delete that job so it stops running and disappears from listings, keeping its run history

#### Scenario: Invalid declared expression

- **WHEN** the backend starts and a procedure declares a `schedule` that is not a valid UTC cron expression
- **THEN** the system SHALL log an error naming the key and expression, SHALL disable its active `code` job if one exists, and SHALL NOT schedule it

#### Scenario: Name collides with another job

- **WHEN** creating or updating a `code` job fails because another active job already uses its name
- **THEN** the system SHALL log an error naming the key and the name, and SHALL leave that declared procedure unsynced
