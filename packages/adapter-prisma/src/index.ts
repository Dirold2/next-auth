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
    createUser: (data: AdapterUser) => p.user.create({ data }),
    getUser: (id: string) => p.user.findUnique({ where: { id } }),
    getUserByEmail: (email: string) => p.user.findUnique({ where: { email } }),
    getUserByAccount: async (provider_providerAccountId: {provider: string, providerAccountId: string}) => {
      const account = await p.account.findUnique({
        where: { provider_providerAccountId },
        select: { user: true },
      })
      return account?.user ?? null
    },
    updateUser: (data: Partial<AdapterUser> & { id: string }) => p.user.update({ where: { id: data.id }, data }),
    deleteUser: (id: string) => p.user.delete({ where: { id } }),
    linkAccount: (data: AdapterAccount) => p.account.create({ data }),
    unlinkAccount: (provider_providerAccountId: {provider: string, providerAccountId: string}) =>
      p.account.delete({
        where: { provider_providerAccountId },
      }),
    getSessionAndUser: async (sessionToken: string) => {
      const userAndSession = await p.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      })
      if (!userAndSession) return null
      const { user, ...session } = userAndSession
      return { user, session: session as AdapterSession }
    },
    createSession: (data: AdapterSession) => p.session.create({ data }),
    updateSession: (data: Partial<AdapterSession> & { sessionToken: string }) =>
      p.session.update({ where: { sessionToken: data.sessionToken }, data }),
    deleteSession: (sessionToken: string) =>
      p.session.delete({ where: { sessionToken } }),
    createVerificationToken: async (data: {identifier: string, token: string, expires: Date}) => {
      const verificationToken = await p.verificationToken.create({ data });
      verificationToken.id && delete verificationToken.id;
      return verificationToken;
    },
    useVerificationToken: async (identifier_token: {identifier: string, token: string}) => {
      try {
        const verificationToken = await p.verificationToken.delete({
          where: { identifier_token },
        });
        verificationToken.id && delete verificationToken.id;
        return verificationToken;
      } catch (error) {
        if ((error as Prisma.PrismaClientKnownRequestError).code === "P2025") {
          return null;
        }
        throw new Error('An error occurred while using the verification token.');
      }
    },
    getAccount: (providerAccountId: string, provider: string) =>
      p.account.findFirst({
        where: { providerAccountId, provider },
      }),
    createAuthenticator: async (authenticator: PrismaAuthenticator) => {
      return p.authenticator
        .create({
          data: authenticator,
        })
        .then(fromDBAuthenticator)
    },
    getAuthenticator: async (credentialID: string) => {
      const authenticator = await p.authenticator.findUnique({
        where: { credentialID },
      })
      return authenticator ? fromDBAuthenticator(authenticator) : null
    },
    listAuthenticatorsByUserId: async (userId: string) => {
      const authenticators = await p.authenticator.findMany({
        where: { userId },
      })
      return authenticators.map(fromDBAuthenticator)
    },
    updateAuthenticatorCounter: async (credentialID: string, counter: number) => {
      return p.authenticator
        .update({
          where: { credentialID },
          data: { counter },
        })
        .then(fromDBAuthenticator)
    },
  }
}

type PrismaAuthenticatorData = Parameters<PrismaClient['authenticator']['create']>[0]['data'];
type PrismaAuthenticator = PrismaAuthenticatorData & { userId: string };

function fromDBAuthenticator(
  authenticator: PrismaAuthenticator
): AdapterAuthenticator {
  const { transports, id, user, ...other } = authenticator
  return {
    ...other,
    transports: transports || undefined,
  }
}