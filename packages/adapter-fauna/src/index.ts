/**
 * <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16}}>
 *  <p style={{fontWeight: "normal"}}>Official <a href="https://docs.fauna.com/fauna/current/">Fauna</a> adapter for Auth.js / NextAuth.js.</p>
 *  <a href="https://fauna.com/features">
 *   <img style={{display: "block"}} src="https://authjs.dev/img/adapters/fauna.svg" height="30"/>
 *  </a>
 * </div>
 *
 * ## Installation
 *
 * ```bash npm2yarn
 * npm install @auth/fauna-adapter fauna
 * ```
 *
 * @module @auth/fauna-adapter
 */
import { Client, TimeStub, fql, NullDocument, QueryValue, QueryValueObject } from "fauna"

import {
  Adapter,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "@auth/core/adapters"

export const collections = {
  Users: Collection("users"),
  Accounts: Collection("accounts"),
  Sessions: Collection("sessions"),
  VerificationTokens: Collection("verification_tokens"),
} as const

export const indexes = {
  AccountByProviderAndProviderAccountId: Index(
    "account_by_provider_and_provider_account_id"
  ),
  UserByEmail: Index("user_by_email"),
  SessionByToken: Index("session_by_session_token"),
  VerificationTokenByIdentifierAndToken: Index(
    "verification_token_by_identifier_and_token"
  ),
  SessionsByUser: Index("sessions_by_user_id"),
  AccountsByUser: Index("accounts_by_user_id"),
} as const

export const format = {
  /** Takes a plain old JavaScript object and turns it into a Fauna object */
  to(object: Record<string, any>) {
    const newObject: Record<string, unknown> = {}
    for (const key in object) {
      const value = object[key]
      if (value instanceof Date) {
        newObject[key] = Time(value.toISOString())
      } else {
        newObject[key] = value
      }
    }
    return newObject
  },
  /** Takes a Fauna object and returns a plain old JavaScript object */
  from<T = Record<string, unknown>>(object: Record<string, any>): T {
    const newObject: Record<string, unknown> = {}
    for (const key in object) {
      const value = object[key]
      if (value?.value && typeof value.value === "string") {
        newObject[key] = new Date(value.value)
      } else {
        newObject[key] = value
      }
    }
    return newObject as T
  },
}

/**
 * Fauna throws an error when something is not found in the db,
 * `next-auth` expects `null` to be returned
 */
export function query(f: FaunaClient, format: (...args: any) => any) {
  return async function <T>(expr: ExprArg): Promise<T | null> {
    try {
      const result = await f.query<{
        data: T
        ref: { id: string }
      } | null>(expr)
      if (!result) return null
      return format({ ...result.data, id: result.ref.id })
    } catch (error) {
      if ((error as errors.FaunaError).name === "NotFound") return null
      if (
        (error as errors.FaunaError).description?.includes(
          "Number or numeric String expected"
        )
      )
        return null

      if (process.env.NODE_ENV === "test") console.error(error)

      throw error
    }
  }
}

/**
 *
 * ## Setup
 *
 * This is the Fauna Adapter for [Auth.js](https://authjs.dev). This package can only be used in conjunction with the primary `next-auth` and other framework packages. It is not a standalone package.
 *
 * You can find the Fauna schema and seed information in the docs at [authjs.dev/reference/adapter/fauna](https://authjs.dev/reference/adapter/fauna).
 *
 * ### Configure Auth.js
 *
 * ```javascript title="pages/api/auth/[...nextauth].js"
 * import NextAuth from "next-auth"
 * import { Client } from "fauna"
 * import { FaunaAdapter } from "@auth/fauna-adapter"
 *
 * const client = new Client({
 *   secret: "secret",
 *   endpoint: new URL('http://localhost:8443')
 * })
 *
 * // For more information on each option (and a full list of options) go to
 * // https://authjs.dev/reference/configuration/auth-options
 * export default NextAuth({
 *   // https://authjs.dev/reference/providers/
 *   providers: [],
 *   adapter: FaunaAdapter(client)
 *   ...
 * })
 * ```
 *
 * ### Schema
 *
 * Run the following FQL code inside the `Shell` tab in the Fauna dashboard to set up the appropriate collections and indexes.
 *
 * ```javascript
 * Collection.create({
 *   name: "Account",
 *   indexes: {
 *     byUserId: {
 *       terms: [
 *         { field: "userId" }
 *       ]
 *     },
 *     byProviderAndProviderAccountId: {
 *       terms [
 *         { field: "provider" },
 *         { field: "providerAccountId" }
 *       ]
 *     },
 *   }
 * })
 * Collection.create({
 *   name: "Session",
 *   constraints: [
 *     {
 *       unique: ["sessionToken"],
 *       status: "active",
 *     }
 *   ],
 *   indexes: {
 *     bySessionToken: {
 *       terms: [
 *         { field: "sessionToken" }
 *       ]
 *     },
 *     byUserId: {
 *       terms [
 *         { field: "userId" }
 *       ]
 *     },
 *   }
 * })
 * Collection.create({
 *   name: "User",
 *   constraints: [
 *     {
 *       unique: ["email"],
 *       status: "active",
 *     }
 *   ],
 *   indexes: {
 *     byEmail: {
 *       terms [
 *         { field: "email" }
 *       ]
 *     },
 *   }
 * })
 * Collection.create({
 *   name: "VerificationToken",
 *   indexes: {
 *     byIdentifierAndToken: {
 *       terms [
 *         { field: "identifier" },
 *         { field: "token" }
 *       ]
 *     },
 *   }
 * })
 * ```
 *
 * > This schema is adapted for use in Fauna and based upon our main [schema](https://authjs.dev/reference/core/adapters#models)
 *
 * ### Migrating from v1
 * In v2, we've renamed the collections to use uppercase naming, in accordance with Fauna best practices. If you're migrating from v1, you'll need to rename your collections to match the new naming scheme.
 * Additionally, we've renamed the indexes to match the new method-like index names.
 *
 * #### Migration script
 * Run this FQL script inside a Fauna shell for the database you're migrating from v1 to v2 (it will rename your collections and indexes to match):
 *
 * ```javascript
 * Collection.byName("accounts")!.update({
 *   name: "Account"
 *   indexes: {
 *     byUserId: {
 *         terms: [{ field: "userId" }]
 *     },
 *     byProviderAndProviderAccountId: {
 *         terms: [{ field: "provider" }, { field: "providerAccountId" }]
 *     },
 *     account_by_provider_and_provider_account_id: null,
 *     accounts_by_user_id: null
 *   }
 * })
 * Collection.byName("sessions")!.update({
 *   name: "Session",
 *   indexes: {
 *     bySessionToken: {
 *         terms: [{ field: "sessionToken" }]
 *     },
 *     byUserId: {
 *         terms: [{ field: "userId" }]
 *     },
 *     session_by_session_token: null,
 *     sessions_by_user_id: null
 *   }
 * })
 * Collection.byName("users")!.update({
 *   name: "User",
 *   indexes: {
 *     byEmail: {
 *         terms: [{ field: "email" }]
 *     },
 *     user_by_email: null
 *   }
 * })
 * Collection.byName("verification_tokens")!.update({
 *   name: "VerificationToken",
 *   indexes: {
 *     byIdentifierAndToken: {
 *         terms: [{ field: "identifier" }, { field: "token" }]
 *     },
 *     verification_token_by_identifier_and_token: null
 *   }
 * })
 * ```
 *
 * > This schema is adapted for use in Fauna and based upon our main [schema](https://authjs.dev/reference/core/adapters#models)
 **/
export function FaunaAdapter(f: FaunaClient): Adapter {
  const { Users, Accounts, Sessions, VerificationTokens } = collections
  const {
    AccountByProviderAndProviderAccountId,
    AccountsByUser,
    SessionByToken,
    SessionsByUser,
    UserByEmail,
    VerificationTokenByIdentifierAndToken,
  } = indexes
  const { to, from } = format
  const q = query(f, from)
  return {
    createUser: async (data) => (await q(Create(Users, { data: to(data) })))!,
    getUser: async (id) => await q(Get(Ref(Users, id))),
    getUserByEmail: async (email) => await q(Get(Match(UserByEmail, email))),
    async getUserByAccount({ provider, providerAccountId }) {
      const key = [provider, providerAccountId]
      const ref = Match(AccountByProviderAndProviderAccountId, key)
      const user = await q<AdapterUser>(
        Let(
          { ref },
          If(
            Exists(Var("ref")),
            Get(Ref(Users, Select(["data", "userId"], Get(Var("ref"))))),
            null
          )
        )
      )
      return user
    },
    updateUser: async (data) =>
      (await q(Update(Ref(Users, data.id), { data: to(data) })))!,
    async deleteUser(userId) {
      await client.query(fql`
        // Delete the user's sessions
        Session.byUserId(${userId}).forEach(session => session.delete())
        
        // Delete the user's accounts
        Account.byUserId(${userId}).forEach(account => account.delete())
        
        // Delete the user
        User.byId(${userId}).delete()
      `)
    },
    linkAccount: async (data) =>
      (await q(Create(Accounts, { data: to(data) })))!,
    async unlinkAccount({ provider, providerAccountId }) {
      const id = [provider, providerAccountId]
      await q(
        Delete(
          Select("ref", Get(Match(AccountByProviderAndProviderAccountId, id)))
        )
      )
    },
    createSession: async (data) =>
      (await q<AdapterSession>(Create(Sessions, { data: to(data) })))!,
    async getSessionAndUser(sessionToken) {
      const response = await client.query<[FaunaUser, FaunaSession]>(fql`
        let session = Session.bySessionToken(${sessionToken}).first()
        if (session != null) {
          let user = User.byId(session.userId)
          if (user != null) {
            [user, session]
          } else {
            null
          }
        } else {
          null
        }
      `)
      if (response.data === null) return null
      const [user, session] = response.data ?? []
      return { session: format.from(session), user: format.from(user) }
    },
    async createSession(session) {
      await client.query<FaunaSession>(
        fql`Session.create(${format.to(session)})`,
      )
      return session
    },
    async updateSession(data) {
      const ref = Select("ref", Get(Match(SessionByToken, data.sessionToken)))
      return await q(Update(ref, { data: to(data) }))
    },
    async deleteSession(sessionToken) {
      await client.query(
        fql`Session.bySessionToken(${sessionToken}).first().delete()`,
      )
    },
    async createVerificationToken(data) {
      // @ts-expect-error
      const { id: _id, ...verificationToken } = await q<VerificationToken>(
        Create(VerificationTokens, { data: to(data) })
      )
      if (!result) {
        throw new Error('Verification token creation failed');
      }
      const { ...verificationToken } = result;
      return verificationToken;
    },
    async useVerificationToken({ identifier, token }) {
      const key = [identifier, token]
      const object = Get(Match(VerificationTokenByIdentifierAndToken, key))

      const verificationToken = await q<VerificationToken>(object)
      if (!verificationToken) return null

      // Verification tokens can be used only once
      await q(Delete(Select("ref", object)))

      // @ts-expect-error
      delete verificationToken.id
      return verificationToken
    },
  }
}
