import type { Session } from "@better/auth";
import type { Database } from "@better/db";

export type Context = {
  session: Session | null;
  db: Database;
};
