// @ts-nocheck
import { beforeAll } from "vitest"

import {
  D1Adapter,
  up,
  getRecord,
  GET_USER_BY_ID_SQL,
  GET_SESSION_BY_TOKEN_SQL,
  GET_ACCOUNT_BY_PROVIDER_AND_PROVIDER_ACCOUNT_ID_SQL,
  GET_VERIFICATION_TOKEN_BY_IDENTIFIER_AND_TOKEN_SQL,
} from "../src"
import {
  AdapterSession,
  AdapterUser,
  AdapterAccount,
} from "@auth/core/adapters"
import { runBasicTests } from "../../utils/adapter"
import { Database as SQLiteDatabase } from "better-sqlite3";
import { D1Database, D1DatabaseAPI } from "@miniflare/d1";

class ExtendedD1Database extends D1Database {
 constructor(api: D1DatabaseAPI) {
    super(api);
 }

 async query(statement: string): Promise<any> {
    // Implement the query method here
    // This is just a placeholder implementation
    return db.query(statement);
 }
}

const sqliteDB = new SQLiteDatabase(":memory:");
let db = new ExtendedD1Database(new D1DatabaseAPI(sqliteDB));
let adapter = D1Adapter(db);
 
// put stuff here if we need some async init
beforeAll(async () => await up(db))
runBasicTests({
  adapter,
  db: {
    user: async (id) =>
      await getRecord<AdapterUser>(db, GET_USER_BY_ID_SQL, [id]),
    session: async (sessionToken) =>
      await getRecord<AdapterSession>(db, GET_SESSION_BY_TOKEN_SQL, [
        sessionToken,
      ]),
    account: async ({ provider, providerAccountId }) =>
      await getRecord<AdapterAccount>(
        db,
        GET_ACCOUNT_BY_PROVIDER_AND_PROVIDER_ACCOUNT_ID_SQL,
        [provider, providerAccountId]
      ),
    verificationToken: async ({ identifier, token }) =>
      await getRecord(db, GET_VERIFICATION_TOKEN_BY_IDENTIFIER_AND_TOKEN_SQL, [
        identifier,
        token,
      ]),
  },
})
