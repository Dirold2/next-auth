import { runBasicTests } from "utils/adapter"
import { PrismaClient } from "@prisma/client"
import { PrismaAdapter } from "../src"
import { ObjectId } from "mongodb"
import { withAccelerate } from "@prisma/extension-accelerate"

const prisma = new PrismaClient().$extends(withAccelerate())

runBasicTests({
  adapter: PrismaAdapter(prisma),
  testWebAuthnMethods: true,
  db: {
    id(): string | void {
      if (process.env.CONTAINER_NAME !== "authjs-mongodb-test") return
      return new ObjectId().toHexString()
    },
    connect: async (): Promise<void> => {
      await prisma.$transaction([
        prisma.user.deleteMany({}),
        prisma.account.deleteMany({}),
        prisma.session.deleteMany({}),
        prisma.verificationToken.deleteMany({}),
        prisma.authenticator.deleteMany({}),
      ])
    },
    disconnect: async (): Promise<void> => {
      await prisma.$transaction([
        prisma.user.deleteMany({}),
        prisma.account.deleteMany({}),
        prisma.session.deleteMany({}),
        prisma.verificationToken.deleteMany({}),
        prisma.authenticator.deleteMany({}),
      ])
      await prisma.$disconnect()
    },
    user: (id: string) => prisma.user.findUnique({ where: { id } }),
    account: (provider_providerAccountId: {provider: string; providerAccountId: string}) =>
      prisma.account.findUnique({ where: { provider_providerAccountId } }),
    session: (sessionToken: string) =>
      prisma.session.findUnique({ where: { sessionToken } }),
    async verificationToken(identifier_token: {identifier: string; token: string}) {
      const result = await prisma.verificationToken.findUnique({
        where: { identifier_token },
      })
      if (!result) return null
      // @ts-ignore // MongoDB needs an ID, but we don't
      delete result.id
      return result
    },
    authenticator: (credentialID: string) =>
      prisma.authenticator.findUnique({ where: { credentialID } }),
  },
})