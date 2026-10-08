# Free-text search (`packages/api`)

How to write a `search` procedure, and how to keep it fast when its table grows. Read this before adding a type-ahead endpoint, a free-text filter on a `list`, or a trigram index. The navbar search calls such a procedure for an entity listed in pages (`references/frontend/navigation-and-layouts.md`).

## The `search` procedure

A `search` is a sibling of the entity's `list`, not a mode of it. `list` builds full rows for a page; `search` answers "which records match this text" for a picker or the navbar, and does nothing else.

- **Input**: `{ query: searchQuery(), limit: searchLimit() }` from `#shared/search` (trimmed, at least 2 characters; default 5, max 20). Existing examples: `apiKey.search`, `organization.search`, `organization.searchTeams`.
- **Output**: only what the caller shows and matches on: the id (or the route params), the label fields and any term the caller needs as an extra match keyword (an address, a code). No nested objects, counts or derived data.
- **Query**: one select with no lateral joins and no follow-up loads. Filter with `likePattern(input.query)` (it escapes `%`, `_` and `\`) through `ilike`. Order by prefix matches first, then by label, then by id: ``desc(sql`${label} ilike ${input.query} || '%'`)``, `asc(label)`, `asc(id)`. Then `limit(input.limit)`.
- **Router**: the same builder as the entity's `list`, so it never returns records the list pages can't show, `method: "GET"`, the same tags as the feature's `list`.

A one-table match can stay in the relational API, as `organization.search` does (`where: { OR: [{ name: { ilike: pattern } }, { slug: { ilike: pattern } }] }`). An `OR` over columns of the same table is fine: PostgreSQL combines that table's indexes with a BitmapOr.

## Matching across several tables

When the text has to match columns on more than one table (a record's name plus its related address), never write the `OR` across a join. The planner can't use an index for an `OR` whose sides belong to different tables, so the query scans everything. Instead:

1. Build the matching ids as a `union` (`import { union } from "drizzle-orm/pg-core"`) of one select per column. Each select is a predicate on a single table, joining only to get back to the record's id:
   ```ts
   function searchMatchIds(text: string) {
     const pattern = likePattern(text)
     return union(
       db.select({ id: deviceTable.id }).from(deviceTable)
         .where(ilike(deviceTable.name, pattern)),
       db.select({ id: deviceTable.id }).from(deviceTable)
         .innerJoin(addressTable, eq(addressTable.id, deviceTable.addressId))
         .where(ilike(sql`${addressTable.ip}::text`, pattern)),
     )
   }
   ```
   (`deviceTable`/`addressTable` are illustrative; no feature in this repo needs a cross-table search yet.)
2. Filter the outer query with `inArray(table.id, searchMatchIds(input.query))` and keep the rest of the `where` (soft deletes, ownership) there.
3. If the entity's `list` offers the same free-text filter, it uses the same helper, so the `search` and the filtered `list` always return the same set.

## Trigram indexes

A B-tree index can serve `like 'abc%'` but not `ilike '%abc%'`, so a "contains" search reads the whole table. A GIN trigram index (`pg_trgm`) can serve it: it splits text into three-character sequences and keeps, for each one, the rows that contain it.

**When to add them.** Only when a searched table is large: from tens of thousands of rows, or when `EXPLAIN ANALYZE` of the `search` query shows a sequential scan taking more than a few milliseconds. On small tables a scan is as fast as the index, and every index adds write cost.

**The extension is not enabled yet.** `gin_trgm_ops` needs `pg_trgm`, and no migration in `packages/db/src/migrations/` creates it. drizzle-kit doesn't emit `CREATE EXTENSION` from the schema, so the first trigram index needs a custom migration before it: the user runs `drizzle-kit generate --custom --name=enable_pg_trgm` from `packages/db`, which creates an empty `<timestamp>_<name>/{migration.sql,snapshot.json}`, and writes `CREATE EXTENSION IF NOT EXISTS pg_trgm;` below its placeholder comment. Any other extension the schema can't express is added the same way.

**Declaring an index.** In the table's schema file, next to its other indexes:

```ts
// Column: the index stores trigrams of the column as is.
index("device_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
// Expression: for a non-text column matched through a cast.
index("address_ip_trgm_idx").using("gin", sql`(${table.ip}::text) gin_trgm_ops`),
```

Editing the schema and generating migrations is the user's call: the agent proposes the extension migration and the index and stops, and the user runs `bun run db:generate`. The index's migration must sort after the extension's.

**Rules that decide whether the index is used:**

- **Identical expression.** An expression index is used only when the query writes exactly the same expression (`ip::text` in both). A different cast or a function around the column silently falls back to a scan.
- **One table per predicate.** Each `union` branch above filters one table, so each can use its own index. With an `OR` across a join, no index is used.
- **Three characters.** A pattern shorter than three characters has no complete trigram and is scanned. `searchQuery()` accepts two, which is acceptable at volumes where the scan is still cheap.
- **Write cost.** Every insert or update of an indexed column updates the GIN index. GIN's `fastupdate` pending list absorbs frequent writes, and indexed labels and addresses rarely change, but the cost is real on hot tables.

**Verifying.** Ask the user to run `EXPLAIN ANALYZE` on the `search` query with a text of three or more characters and check for a `Bitmap Index Scan` on each trigram index. Don't connect to the database yourself.
