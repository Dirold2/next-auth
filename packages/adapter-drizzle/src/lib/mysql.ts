import { and, eq } from "drizzle-orm"
import {
  int,
  timestamp,
  mysqlTable as defaultMySqlTableFn,
  primaryKey,
  varchar,
  type MySqlTableFn,
  type MySqlDatabase,
} from "drizzle-orm/mysql-core"

import type { Adapter, AdapterAccount, AdapterUser } from "@auth/core/adapters"

export function createTables(mySqlTable: MySqlTableFn) {
  const users = mySqlTable("user", {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: timestamp("emailVerified", {
      mode: "date",
      fsp: 3,
    }).defaultNow(),
    image: varchar("image", { length: 255 }),
  })

  const accounts = mySqlTable(
    "account",
    {
      userId: varchar("userId", { length: 255 })
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
      type: varchar("type", { length: 255 })
        .$type<AdapterAccount["type"]>()
        .notNull(),
      provider: varchar("provider", { length: 255 }).notNull(),
      providerAccountId: varchar("providerAccountId", {
        length: 255,
      }).notNull(),
      refresh_token: varchar("refresh_token", { length: 255 }),
      access_token: varchar("access_token", { length: 255 }),
      expires_at: int("expires_at"),
      token_type: varchar("token_type", { length: 255 }),
      scope: varchar("scope", { length: 255 }),
      id_token: varchar("id_token", { length: 255 }),
      session_state: varchar("session_state", { length: 255 }),
    },
    (account) => ({
      compoundKey: primaryKey(account.provider, account.providerAccountId),
    })
  )

  const sessions = mySqlTable("session", {
    sessionToken: varchar("sessionToken", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  })

  const verificationTokens = mySqlTable(
    "verificationToken",
    {
      identifier: varchar("identifier", { length: 255 }).notNull(),
      token: varchar("token", { length: 255 }).notNull(),
      expires: timestamp("expires", { mode: "date" }).notNull(),
    },
    (vt) => ({
      compoundKey: primaryKey(vt.identifier, vt.token),
    })
  )

  return { users, accounts, sessions, verificationTokens }
}

export type DefaultSchema = ReturnType<typeof createTables>

export function mySqlDrizzleAdapter(
  client: InstanceType<typeof MySqlDatabase>,
  tableFn = defaultMySqlTableFn
): Adapter {
  const { users, accounts, sessions, verificationTokens } =
    createTables(tableFn)

  return {
    async createUser(data) {
      const id = crypto.randomUUID()
    
      await client.insert(users).values({ ...data, id })
    
      return await client
        .select()
        .from(users)
        .where(eq(users.id, id))
        .then((res) => ({ ...res[0], name: res[0].name ?? undefined }))
    },
    async getUser(data) {
      const user =
        (await client
          .select()
          .from(users)
          .where(eq(users.id, data))
          .then((res) => res[0])) ?? null
    
      return user ? { ...user, name: user.name ?? undefined } : null;
    },
    async getUserByEmail(data) {
      const user =
        (await client
          .select()
          .from(users)
          .where(eq(users.email, data))
          .then((res) => res[0])) ?? null
    
      return user ? { ...user, name: user.name ?? undefined } : null;
    },
    async createSession(data) {
      await client.insert(sessions).values(data)

      return await client
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, data.sessionToken))
        .then((res) => res[0])
    },
    async getSessionAndUser(data: string) {
      const sessionAndUser =
        (await client
          .select({
            session: sessions,
            user: users,
          })
          .from(sessions)
          .where(eq(sessions.sessionToken, data))
          .innerJoin(users, eq(users.id, sessions.userId))
          .then((res) => res[0])) ?? null

      if (sessionAndUser) {
        sessionAndUser.user.name = (sessionAndUser.user.name ?? undefined) as string | null;
      }

      return sessionAndUser;
    },
    async updateUser(data: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      if (!data.id) {
        throw new Error("No user id.");
      }
    
      await client.update(users).set(data).where(eq(users.id, data.id));
    
      const updatedUser = await client
        .select()
        .from(users)
        .where(eq(users.id, data.id))
        .then((res) => res[0]);
    
      // Ensure all properties of AdapterUser are present, even if they are null or undefined
      return {
        id: updatedUser.id,
        name: updatedUser.name ?? undefined,
        email: updatedUser.email ?? null,
        emailVerified: updatedUser.emailVerified ?? null,
        image: updatedUser.image ?? null,
      };
    },
    async updateSession(data) {
      await client
        .update(sessions)
        .set(data)
        .where(eq(sessions.sessionToken, data.sessionToken))

      return await client
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, data.sessionToken))
        .then((res) => res[0])
    },
    async linkAccount(rawAccount: AdapterAccount) {
      const accountValues = { ...rawAccount, provider: rawAccount.provider! };
      if (accountValues.providerAccountId === null) {
        // Handle the case where providerAccountId is null, e.g., by setting it to an empty string or some default value
        accountValues.providerAccountId = '';
      }
      await client.insert(accounts).values(accountValues);
    },
    async getUserByAccount(account: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<AdapterUser | null> {
      const dbAccount =
        (await client
          .select()
          .from(accounts)
          .where(
            and(
              account.providerAccountId !== null ? eq(accounts.providerAccountId, account.providerAccountId) : undefined,
              account.provider !== null ? eq(accounts.provider, account.provider) : undefined
            )
          )
          .leftJoin(users, eq(accounts.userId, users.id))
          .then((res) => res[0])) ?? null

      if (!dbAccount?.user) {
        return null;
      }
      return {
        id: dbAccount.user.id,
        name: dbAccount.user.name ?? undefined,
        email: dbAccount.user.email ?? null,
        emailVerified: dbAccount.user.emailVerified ?? null,
        image: dbAccount.user.image ?? null,
      };
    },
    async deleteSession(sessionToken) {
      const session =
        (await client
          .select()
          .from(sessions)
          .where(eq(sessions.sessionToken, sessionToken))
          .then((res) => res[0])) ?? null

      await client
        .delete(sessions)
        .where(eq(sessions.sessionToken, sessionToken))

      return session
    },
    async createVerificationToken(token) {
      await client.insert(verificationTokens).values(token)

      return await client
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.identifier, token.identifier))
        .then((res) => res[0])
    },
    async useVerificationToken(token) {
      try {
        const deletedToken =
          (await client
            .select()
            .from(verificationTokens)
            .where(
              and(
                eq(verificationTokens.identifier, token.identifier),
                eq(verificationTokens.token, token.token)
              )
            )
            .then((res) => res[0])) ?? null

        await client
          .delete(verificationTokens)
          .where(
            and(
              eq(verificationTokens.identifier, token.identifier),
              eq(verificationTokens.token, token.token)
            )
          )

        return deletedToken
      } catch (err) {
        throw new Error("No verification token found.")
      }
    },
    async deleteUser(id) {
      const user = await client
        .select()
        .from(users)
        .where(eq(users.id, id))
        .then((res) => res[0] ?? null)

      await client.delete(users).where(eq(users.id, id))

      return user
    },
    async unlinkAccount(account) {
      await client
        .delete(accounts)
        .where(
          and(
            eq(accounts.providerAccountId, account.providerAccountId),
            eq(accounts.provider, account.provider)
          )
        )

      return undefined
    },
  }
}
