# Comments

## Purpose

Provides threaded comments on any entity, with storage, a comment API for listing reply trees, batched counts, posting, editing and soft-deleting, and a reusable comment thread UI.

## Requirements

### Requirement: Comment storage

The database SHALL store comments in a `comments` table with `id` (uuid primary key), `content` (text, not null), `entity_type` (text, not null), `entity_id` (uuid, not null), `parent_id` (nullable self-reference to `comments.id`, `ON DELETE CASCADE`), `author_id` (text, references the user, `ON DELETE CASCADE`), `deleted_at` (nullable timestamp marking a soft delete), `created_at` and `updated_at` (refreshed on every update), with indexes on `(entity_type, entity_id)`, `parent_id`, `author_id` and `deleted_at`. The target of a comment SHALL be polymorphic: there SHALL be no foreign key to the commented table, and the API SHALL NOT check that the commented entity exists.

#### Scenario: Deleting a user removes their comments

- **WHEN** a user is deleted
- **THEN** their comments, and by cascade the replies under them, SHALL be deleted

#### Scenario: Non-uuid entity ids are rejected

- **WHEN** a comment procedure is called with an `entityId` that is not a uuid
- **THEN** input validation SHALL reject the request

### Requirement: Comment API feature

The API SHALL expose a `comment` feature under `packages/api/src/v1/comment/` (input, output, handler, router), mounted as `comment` in the v1 router, reachable as `orpc.v1.comment.<method>()` and under the `Comments` OpenAPI tag. Every procedure SHALL use `protectedProcedure`, so a request without a signed-in user SHALL fail with `UNAUTHORIZED`. Any signed-in user SHALL be able to read and post comments on any entity; only the author of a comment SHALL be able to edit or delete it, with no administrator override. `entityType` SHALL be 1–64 characters and `entityId` a uuid.

#### Scenario: Unauthenticated call

- **WHEN** any `comment` procedure is called without a session or API key
- **THEN** it SHALL fail with `UNAUTHORIZED`

### Requirement: Listing comments as a reply tree

`comment.list` (GET) SHALL return the comments of one `(entityType, entityId)` as a tree: top-level comments with nested `replies` at any depth, each level ordered by `createdAt` ascending. Each comment SHALL include `id`, `content`, `entityType`, `entityId`, `parentId`, `author` (`id`, `name`, `email`, `image`), `deletedAt`, `createdAt`, `updatedAt` and `replies`, with timestamps as ISO strings. A soft-deleted comment SHALL be returned with empty `content` and its `deletedAt` set, and a soft-deleted top-level comment without replies SHALL be omitted.

#### Scenario: Thread with replies

- **WHEN** a comment has two replies and one of those has a reply of its own
- **THEN** `list` SHALL return the comment with both replies nested under it and the third comment nested under its parent reply

#### Scenario: Deleted comment with replies

- **WHEN** a top-level comment that has replies is deleted
- **THEN** `list` SHALL still return it, with empty `content` and `deletedAt` set, and its replies under it

#### Scenario: Deleted comment without replies

- **WHEN** a top-level comment without replies is deleted
- **THEN** `list` SHALL no longer return it

### Requirement: Batched comment counts

`comment.counts` (method `QUERY`) SHALL accept 1 to 100 entity refs and return, in request order, each ref with `count`: the number of its non-deleted comments, replies included, and `0` for entities without comments.

#### Scenario: Counts for a list

- **WHEN** `counts` is called for three cron runs where one has two comments and one deleted comment
- **THEN** that run SHALL report `2` and the other two `0`

#### Scenario: Batch limit

- **WHEN** `counts` is called with more than 100 entities
- **THEN** input validation SHALL reject the request

### Requirement: Posting comments and replies

`comment.create` (POST, `201`) SHALL create a comment authored by the caller with `content` trimmed to 1–4000 characters, on the given `(entityType, entityId)`, optionally as a reply through `parentId`, and return it with an empty `replies` list. A reply's parent SHALL exist and not be deleted, otherwise the call SHALL fail with `NOT_FOUND` ("Comentario padre no encontrado"); a parent that belongs to another entity SHALL fail with `BAD_REQUEST` ("El comentario padre pertenece a otra entidad").

#### Scenario: Posting a comment

- **WHEN** a signed-in user calls `comment.create` with content "  Revisado  "
- **THEN** a comment with content "Revisado" SHALL be stored with the caller as author

#### Scenario: Content too long or empty

- **WHEN** `comment.create` is called with blank content or more than 4000 characters
- **THEN** input validation SHALL reject the request

#### Scenario: Replying to a deleted comment

- **WHEN** `comment.create` is called with the `parentId` of a soft-deleted comment
- **THEN** it SHALL fail with `NOT_FOUND`

### Requirement: Editing and deleting own comments

`comment.update` (PATCH) SHALL replace the `content` (trimmed, 1–4000 characters) of a comment and return it; `comment.delete` (DELETE) SHALL soft-delete a comment by setting `deleted_at` and return `{ id, success: true }`. Both SHALL fail with `NOT_FOUND` ("Comentario no encontrado") for an unknown id, and with `FORBIDDEN` ("Solo puedes editar tus comentarios" / "Solo puedes eliminar tus comentarios") when the caller is not the author. Editing a deleted comment SHALL fail with `NOT_FOUND`; deleting an already deleted comment SHALL succeed without changes.

#### Scenario: Author edits a comment

- **WHEN** the author calls `comment.update` with new content
- **THEN** the content SHALL change and `updatedAt` SHALL advance

#### Scenario: Another user tries to delete

- **WHEN** a user calls `comment.delete` for a comment written by someone else
- **THEN** it SHALL fail with `FORBIDDEN` and the comment SHALL remain

#### Scenario: Deleting twice

- **WHEN** the author calls `comment.delete` on a comment that is already deleted
- **THEN** it SHALL return `success: true`

### Requirement: Comment thread UI

The `comments` frontend feature SHALL expose, through `@/features/comments`, `CommentsButton`, `CommentsSheet`, `CommentsPanel`, `useCommentCounts`, `useCommentCount` and the `CommentEntityRef` type, so any screen can attach a thread to an entity ref `{ entityType, entityId }`:

- `CommentsButton` SHALL show a comment icon with the count (a badge capped at "9+" when `compact`), have the accessible name "<label>: N" (default label "Comentarios") when there are comments, accept a `count` from a batched `useCommentCounts` call to skip its own count query, and open the thread in a side sheet (default title "Comentarios"). It SHALL stop events inside the sheet from reaching an enclosing clickable card or row.
- `CommentsPanel` SHALL show a form to post a top-level comment above the list. The form SHALL limit input to 4000 characters, be disabled while empty, submit with Enter, insert a line break with Shift+Enter and ignore Enter during IME composition.
- Each comment SHALL show the author's avatar (image or initials), name and date, and its content, or "Comentario eliminado" in italics when deleted. Non-deleted comments SHALL offer "Responder", which opens an inline reply form; "Editar" (inline form) and "Eliminar" (with a confirmation dialog) SHALL be offered only to the author of a non-deleted comment. Replies SHALL render indented under their parent.
- The list SHALL show loading, an error with "Reintentar", and the empty message "Todavía no hay comentarios. Sé el primero en escribir.".

Mutations SHALL show Spanish success and error toasts ("Comentario publicado", "Comentario actualizado", "Comentario eliminado") and refresh the thread and, when posting or deleting, the counts. `useCommentCounts` SHALL split more than 100 entities into parallel requests of 100 under a single query and keep the previous counts while the batch grows. Cron run rows SHALL use `CommentsButton` with `entityType: "cron-run"`, with counts loaded for all visible runs in one `useCommentCounts` call.

#### Scenario: Opening a thread from a cron run

- **WHEN** a user presses the compact comments button of a cron run that has 3 comments
- **THEN** a sheet SHALL open listing that run's comments, and the button's badge SHALL read "3"

#### Scenario: Actions on someone else's comment

- **WHEN** a user views a comment written by another user
- **THEN** only "Responder" SHALL be offered, not "Editar" or "Eliminar"

#### Scenario: Submitting with Enter

- **WHEN** a user types a comment and presses Enter without Shift
- **THEN** the comment SHALL be posted and the form cleared
