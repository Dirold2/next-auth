/**
 * <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16}}>
 *  Official <a href="https://www.prisma.io/docs">Prisma</a> adapter for Auth.js / NextAuth.js.
 *  <a href="https://www.prisma.io/">
 *   <img style={{display: "block"}} src="https://authjs.dev/img/adapters/prisma.svg" width="38" />
 *  </a>
 * </div>
 *
 * ## Installation
 *
 * ```bash npm2yarn
 * npm install @prisma/client @auth/prisma-adapter
 * npm install prisma --save-dev
 * ```
 *
 * @module @auth/prisma-adapter
 */
import type { PrismaClient, Prisma } from "@prisma/client"
import type {
  Adapter,
  AdapterAccount,
  AdapterAuthenticator,
  AdapterSession,
  AdapterUser,
} from "@auth/core/adapters"

/**
 * ## Setup
 *
 * Add this adapter to your `auth.ts` Auth.js configuration object:
 *
 * ```js title="auth.ts"
 * import NextAuth from "next-auth"
 * import Google from "next-auth/providers/google"
 * import { PrismaAdapter } from "@auth/prisma-adapter"
 * import { PrismaClient } from "@prisma/client"
 *
 * const prisma = new PrismaClient()
 *
 * export { handlers, auth, signIn, signOut } = NextAuth({
 *   adapter: PrismaAdapter(prisma),
 *   providers: [
 *     Google,
 *   ],
 * })
 * ```
 **/
export function PrismaAdapter(
  prisma: PrismaClient | ReturnType<PrismaClient["$extends"]>
): Adapter {
  const p = prisma as PrismaClient
  return {
    // We need to let Prisma generate the ID because our default UUID is incompatible with MongoDB
    createUser: ({ id: _id, ...data }) => {
      return p.user.create({ data })
    },
    getUser: (id) => p.user.findUnique({ where: { id } }),
    getUserByEmail: (email) => p.user.findUnique({ where: { email } }),
    async getUserByAccount(provider_providerAccountId) {
      const account = await p.account.findUnique({
        where: { provider_providerAccountId },
        select: { user: true },
      })
      return (account?.user as AdapterUser) ?? null
    },
    updateUser: ({ id, ...data }) =>
      p.user.update({ where: { id }, data }) as Promise<AdapterUser>,
    deleteUser: (id) =>
      p.user.delete({ where: { id } }) as Promise<AdapterUser>,
    linkAccount: (data) =>
      p.account.create({ data }) as unknown as AdapterAccount,
    unlinkAccount: (provider_providerAccountId) =>
      p.account.delete({
        where: { provider_providerAccountId },
      }) as unknown as AdapterAccount,
    async getSessionAndUser(sessionToken) {
      const userAndSession = await p.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      })
      if (!userAndSession) return null
      const { user, ...session } = userAndSession
      return { user, session } as { user: AdapterUser; session: AdapterSession }
    },
    createSession: (data) => p.session.create({ data }),
    updateSession: (data) =>
      p.session.update({ where: { sessionToken: data.sessionToken }, data }),
    deleteSession: (sessionToken) =>
      p.session.delete({ where: { sessionToken } }),
    async createVerificationToken(data) {
      const verificationToken = await p.verificationToken.create({ data })
      // MongoDB needs an ID, but we don't
      if (verificationToken.id) delete verificationToken.id
      return verificationToken
    },
    async useVerificationToken(identifier_token) {
      try {
        const verificationToken = await p.verificationToken.delete({
          where: { identifier_token },
        })
        // MongoDB needs an ID, but we don't
        if (verificationToken.id) delete verificationToken.id
        return verificationToken
      } catch (error) {
        // If token already used/deleted, just return null
        // https://www.prisma.io/docs/reference/api-reference/error-reference#p2025
        if ((error as Prisma.PrismaClientKnownRequestError).code === "P2025")
          return null
        throw error
      }
    },
    async getAccount(providerAccountId, provider) {
      return p.account.findFirst({
        where: { providerAccountId, provider },
      }) as Promise<AdapterAccount | null>
    },
    async createAuthenticator(authenticator) {
      return p.authenticator
        .create({
          data: authenticator,
        })
        .then(fromDBAuthenticator)
    },
    async getAuthenticator(credentialID) {
      const authenticator = await p.authenticator.findUnique({
        where: { credentialID },
      })
      return authenticator ? fromDBAuthenticator(authenticator) : null
    },
    async listAuthenticatorsByUserId(userId) {
      const authenticators = await p.authenticator.findMany({
        where: { userId },
      })

      return authenticators.map(fromDBAuthenticator)
    },
    async updateAuthenticatorCounter(credentialID, counter) {
      return p.authenticator
        .update({
          where: { credentialID: credentialID },
          data: { counter },
        })
        .then(fromDBAuthenticator)
    },
  }
}

type BasePrismaAuthenticator = Parameters<
  PrismaClient["authenticator"]["create"]
>[0]["data"]
type PrismaAuthenticator = BasePrismaAuthenticator &
  Required<Pick<BasePrismaAuthenticator, "userId">>

function fromDBAuthenticator(
  authenticator: PrismaAuthenticator
): AdapterAuthenticator {
  const { transports, id, user, ...other } = authenticator

  return {
    ...other,
    transports: transports || undefined,
  }
}
