# Cron Management

## Purpose

Exposes procedures and a web interface to list, inspect, create, edit, enable, delete and run cron jobs, browse their run history and live run events, and comment on runs, while keeping code-declared jobs read-only.

## Requirements

### Requirement: Cron job listing endpoints

The system SHALL expose authenticated procedures to list all cron jobs and to read a single job by id, returning the full definition (name, description, expression, timezone, enabled flag, handler key, the route tags of the procedure behind it, payload, origin — `manual` or `code` — last and next run timestamps, and creation/update timestamps) with timestamps serialised as ISO strings.

#### Scenario: Authenticated user lists jobs

- **WHEN** an authenticated user calls `v1.cron.list`
- **THEN** the system SHALL return every cron job definition ordered by name, code-declared jobs included

#### Scenario: Unauthenticated request

- **WHEN** a request without an authenticated user calls any cron procedure
- **THEN** the system SHALL throw an `UNAUTHORIZED` error

#### Scenario: Unknown job id

- **WHEN** `v1.cron.get` is called with an id that does not exist
- **THEN** the system SHALL throw a `NOT_FOUND` error

### Requirement: Cron handler catalogue endpoint

The system SHALL expose an authenticated procedure that returns the discovered cron-eligible procedures — key, summary, description, tags and input JSON Schema — so clients can offer a handler picker and render payload fields without hardcoding anything. Procedures that declare a code schedule SHALL NOT appear in the catalogue.

#### Scenario: Client fetches the catalogue

- **WHEN** an authenticated user calls `v1.cron.handlers`
- **THEN** the system SHALL return every cron-eligible procedure with its key, summary, description, tags and input JSON Schema, and no procedure declaring a `schedule`

### Requirement: Cron job management endpoints

The system SHALL expose admin-only procedures to create, update, enable/disable and delete cron jobs. Every mutation SHALL trigger a scheduler refresh so the change takes effect immediately. Deleting a job SHALL delete its run history.

#### Scenario: Admin creates a job

- **WHEN** an admin calls `v1.cron.create` with a valid name, expression and cron-eligible handler key
- **THEN** the system SHALL persist the job, refresh the scheduler, and return the created definition

#### Scenario: Non-admin attempts a mutation

- **WHEN** an authenticated non-admin user calls `v1.cron.create`, `update`, `setEnabled` or `remove`
- **THEN** the system SHALL throw a `FORBIDDEN` error and change nothing

#### Scenario: Admin toggles a job

- **WHEN** an admin calls `v1.cron.setEnabled`
- **THEN** the system SHALL persist the new enabled flag, recompute the next run timestamp when enabling and clear it when disabling, and refresh the scheduler

#### Scenario: Admin deletes a job

- **WHEN** an admin calls `v1.cron.remove`
- **THEN** the system SHALL delete the job and its runs, refresh the scheduler, and return the deleted id

#### Scenario: Validation failure surfaces as a client error

- **WHEN** a mutation fails cron-expression, handler-key or unique-name validation
- **THEN** the system SHALL respond with a `BAD_REQUEST` error carrying the validation message

### Requirement: Cron run history endpoint

The system SHALL expose an authenticated procedure returning the recent runs of a job, most recent first, optionally filtered by status and bounded by a caller-supplied limit with a sane default.

#### Scenario: User inspects run history

- **WHEN** an authenticated user calls `v1.cron.listRuns` for a job
- **THEN** the system SHALL return that job's runs ordered by start time descending, each with status, timestamps and error message

### Requirement: Cron run events endpoint

The system SHALL expose an authenticated streamed procedure, `v1.cron.watchRuns`, that takes a job id and pushes an event over server-sent events each time one of that job's runs starts, finishes (successfully or not) or is skipped. The stream SHALL first send a `subscribed` event once it is listening, then one `run` event per change carrying the run id and its new status. It SHALL NOT send events for other jobs. It SHALL be a read declared with the `GET` method and SHALL NOT be cron-eligible. Events SHALL be delivered only to subscribers connected to the backend instance that ran the job, consistent with the single-instance scheduler.

#### Scenario: Run lifecycle is pushed

- **WHEN** a user is subscribed to `v1.cron.watchRuns` for a job and that job fires and succeeds
- **THEN** the stream SHALL deliver a `run` event with status `running` and then one with status `success` for the same run id

#### Scenario: Skipped run is pushed

- **WHEN** a job fires while its previous run is still `running`
- **THEN** subscribers of that job SHALL receive a `run` event with status `skipped`

#### Scenario: Other jobs are filtered out

- **WHEN** a user is subscribed for job A and job B runs
- **THEN** the stream SHALL NOT deliver any event for job B

#### Scenario: Unknown job

- **WHEN** a user subscribes with the id of a job that does not exist or was removed
- **THEN** the call SHALL fail with `NOT_FOUND` and no stream SHALL be opened

#### Scenario: Anonymous caller

- **WHEN** an unauthenticated client calls `v1.cron.watchRuns`
- **THEN** the call SHALL fail with `UNAUTHORIZED`

#### Scenario: A failing listener does not affect the run

- **WHEN** publishing a run event throws
- **THEN** the run SHALL still be recorded with its real outcome and the failure SHALL be logged as a warning

### Requirement: Cron-only procedures

The system SHALL provide a procedure builder that rejects any call whose context is not marked as a cron execution, so a procedure can be exposed to the scheduler without being callable over HTTP. The request context built for HTTP requests SHALL never carry the cron marker.

#### Scenario: HTTP call to a cron-only procedure

- **WHEN** a client calls a cron-only procedure over HTTP, even as an admin
- **THEN** the system SHALL throw a `FORBIDDEN` error stating the endpoint is cron-only

#### Scenario: Scheduler call to a cron-only procedure

- **WHEN** the scheduler invokes a cron-only procedure with a cron-marked context
- **THEN** the handler SHALL execute

### Requirement: Cron management web interface

The system SHALL provide an authenticated `/crons` page listing every job with its schedule, handler, enabled state and last/next run, and a `/crons/{id}` detail page showing the job definition, a summary of its latest runs and its recent run history. The run history on the detail page SHALL be filterable by run status and grouped by day. Both pages SHALL be reachable from the main navigation. The detail page SHALL keep the job, the run summary and the run history current by subscribing to `v1.cron.watchRuns` and refetching them when an event arrives, and SHALL NOT poll.

#### Scenario: User opens the crons page

- **WHEN** an authenticated user navigates to `/crons`
- **THEN** the page SHALL list every cron job with its schedule, handler key, enabled state and last and next run

#### Scenario: User opens a job detail

- **WHEN** a user selects a job
- **THEN** the detail page SHALL show its definition and its recent runs with status, duration and any error message

#### Scenario: User reads the run pulse

- **WHEN** a user opens the detail page of a job that has at least one run
- **THEN** the page SHALL show a strip with one mark per run for up to the latest 48 runs, oldest to newest, whose height reflects the run's duration and whose tone reflects its status
- **AND** the page SHALL show, computed over that same window, the success rate (successful runs over successful plus failed runs), the current streak of consecutive successful runs counted from the newest finished run, and the p50 and p95 durations of successful runs

#### Scenario: Job without runs

- **WHEN** a user opens the detail page of a job with no runs
- **THEN** the page SHALL NOT show the run pulse and SHALL show the empty history state

#### Scenario: User filters the run history by status

- **WHEN** a user selects "Fallidas" or "Omitidas" in the history filter
- **THEN** the history SHALL list only runs with status `failed` or `skipped` respectively, fetched from `v1.cron.listRuns` with the matching `status` input, and SHALL keep loading further pages on scroll
- **AND** the selected filter SHALL be reflected in the page URL so that reloading the page restores it

#### Scenario: Filter matches no runs

- **WHEN** the selected status filter matches no runs of the job
- **THEN** the history SHALL show an empty state naming the active filter instead of a list

#### Scenario: History grouped by day

- **WHEN** the run history is shown
- **THEN** runs SHALL be grouped under a heading per calendar day of their start time, newest day first, and each run SHALL keep its error or result disclosure and its comments control

#### Scenario: Detail page updates when a run changes

- **WHEN** a user has a job's detail page open and that job starts, finishes or skips a run
- **THEN** the pulse, the job's last and next run and the run history SHALL refresh without a reload and without the page polling

#### Scenario: Idle detail page sends no requests

- **WHEN** a job's detail page stays open while none of its runs change
- **THEN** the page SHALL NOT send any request other than its open event subscription

#### Scenario: Subscription recovers after a disconnect

- **WHEN** the run-event subscription drops (for example, the backend restarts) and later reconnects
- **THEN** the page SHALL refetch the pulse, the job and the history once on reconnecting, so changes made while disconnected are shown

### Requirement: Schema-driven job editor

The web interface SHALL let an admin create and edit a job by choosing a handler from the discovered catalogue and filling in a payload form generated from that handler's input JSON Schema, rather than typing raw JSON.

#### Scenario: Admin picks a handler

- **WHEN** an admin selects a handler in the create or edit dialog
- **THEN** the form SHALL render payload fields derived from that handler's input JSON Schema

#### Scenario: Handler has no input

- **WHEN** the selected handler declares no input schema
- **THEN** the form SHALL render no payload fields and submit a null payload

#### Scenario: Mutation feedback

- **WHEN** a create, update, toggle or delete succeeds or fails
- **THEN** the interface SHALL show a notification and refresh the affected job data

### Requirement: Comments on cron runs

The cron detail interface SHALL let authenticated users open a comment thread
for every execution in its run history. Each thread SHALL be associated with
that individual cron run and SHALL remain independent from every other run.

#### Scenario: User comments on a run

- **WHEN** an authenticated user opens the comments control for a run and
  publishes a comment
- **THEN** the comment SHALL be stored and displayed in that run's thread

#### Scenario: User opens another run's comments

- **WHEN** an authenticated user opens the comments control for a different
  run of the same cron job
- **THEN** the interface SHALL show only the comments associated with that
  different run

### Requirement: Code-declared jobs are read-only

The system SHALL refuse every change and manual run of a job whose origin is `code`, regardless of the caller's role. Only the startup sync SHALL write to such jobs. The refusal SHALL use `CONFLICT`, because it comes from the job's origin and not from the caller's permissions.

#### Scenario: Admin attempts to modify a code-declared job

- **WHEN** an admin calls `v1.cron.update`, `v1.cron.setEnabled` or `v1.cron.remove` for a `code` job
- **THEN** the system SHALL throw a `CONFLICT` error with a Spanish message stating the job is declared in code, and SHALL change nothing

#### Scenario: Admin attempts to run a code-declared job now

- **WHEN** an admin calls `v1.cron.runNow` for a `code` job
- **THEN** the system SHALL throw a `CONFLICT` error and SHALL NOT record or start a run

#### Scenario: Reading a code-declared job

- **WHEN** an authenticated user calls `v1.cron.get` or `v1.cron.listRuns` for a `code` job
- **THEN** the system SHALL return its definition and run history like any other job

### Requirement: Read-only rendering of code-declared jobs

The web interface SHALL render code-declared jobs dimmed with a lock marker (whose hint says they are declared in code) on `/crons` and a lock marker on `/crons/{id}`, SHALL group every job under the tags returned with it, and SHALL NOT offer any control that changes or runs them: no enabled toggle, edit, delete or "run now". Their enabled state, schedule, run pulse, run history and run comments SHALL remain visible.

#### Scenario: Admin views a code-declared job in the list

- **WHEN** an admin opens `/crons` and a `code` job is listed
- **THEN** its row SHALL be dimmed, show the lock marker in place of the pause control and its enabled state as read-only, with no edit or delete actions

#### Scenario: Admin opens a code-declared job detail

- **WHEN** an admin opens `/crons/{id}` for a `code` job
- **THEN** the page SHALL show the lock marker and SHALL NOT show the "run now" control, while the run pulse, history and comments stay available
