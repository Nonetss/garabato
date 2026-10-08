import { createAuth } from "@better/auth";
import { createDb } from "@better/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
