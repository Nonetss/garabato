import { createFakeDb } from "@nonete/db/testing"

/**
 * The one fake database of the run. `tests/setup.ts` installs it as
 * `@nonete/db`, so every module that imports `db` gets it; handler tests
 * queue results on it and call `fakeDb.reset()` in `beforeEach`.
 */
export const fakeDb = createFakeDb()
