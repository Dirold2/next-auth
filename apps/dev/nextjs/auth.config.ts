import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Facebook from "next-auth/providers/facebook"
// import Auth0 from "next-auth/providers/auth0"
import Twitter from "next-auth/providers/twitter"
import Keycloak from "next-auth/providers/keycloak"

declare module "next-auth" {
  interface Session {
    user?: User | null;
  }
  interface User {
    foo?: string;
    address?: string;
  }
}

export default {
  providers: [
    Credentials({
      credentials: { password: { label: "Password", type: "password" } },
      authorize(c) {
        if (c.password !== "password") return null
        return {
          id: "test",
          name: "Test User",
          email: "test@example.com",
        }
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),,
    Google,
    // Keycloak({
    //   clientId: process.env.KEYCLOAK_CLIENT_ID,
    //   clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    //   issuer: process.env.KEYCLOAK_ISSUER_URL,
    // }),
    // Facebook,
    // Auth0,
    // Twitter,
  ].filter(Boolean) as NextAuthConfig["providers"],
  callbacks: {
    jwt({ token, trigger, session }) {
      if (trigger === "update" && token) {
        token.name = session.user.name;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...token,
          name: token.name ?? undefined,
        },
      }
    },
  },
  basePath: "/auth",
} satisfies NextAuthConfig
