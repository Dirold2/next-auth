import { describe, expect, it, vi, beforeEach } from "vitest"
import { Auth, AuthConfig, skipCSRFCheck } from "../src"
import { Adapter } from "../src/adapters"
import SendGrid from "../src/providers/sendgrid"
import { getUserAndAccount } from "../src/lib/actions/callback/oauth/callback"
import { getUserAndAccountArgs } from "./fixtures/oauth-callback.ts"
import { OAuthConfigInternal } from "../src/providers/oauth.ts"

const mockAdapter: Adapter = {
  createVerificationToken: vi.fn(),
  useVerificationToken: vi.fn(),
  getUserByEmail: vi.fn(),
}
const logger = { error: vi.fn() }

async function signin(config: Partial<AuthConfig> = {}) {
  return (await Auth(
    new Request("http://a/auth/signin/sendgrid", {
      method: "POST",
      body: new URLSearchParams({ email: "a@b.c" }),
    }),
    {
      secret: "secret",
      trustHost: true,
      logger,
      adapter: mockAdapter,
      skipCSRFCheck,
      providers: [SendGrid],
      ...config,
    }
  )) as Response
}

describe("auth via callbacks.signin", () => {
  beforeEach(() => {
    logger.error.mockReset()
  })
  describe("redirect before sending an email", () => {
    it("return false", async () => {
      const res = await signin({ callbacks: { signin: () => false } })
      expect(res.headers.get("Location")).toBe(
        "http://a/auth/error?error=AuthorizedCallbackError"
      )
    })
    it("return redirect relative URL", async () => {
      const res = await signin({ callbacks: { signin: () => "/wrong" } })
      expect(res.headers.get("Location")).toBe("http://a/wrong")
    })

    it("return redirect absolute URL, different domain", async () => {
      const res = await signin({ callbacks: { signin: () => "/wrong" } })
      const redirect = res.headers.get("Location")
      // Not allowed by our default redirect callback
      expect(redirect).not.toBe("http://b/wrong")
      expect(redirect).toBe("http://a/wrong")
    })

    it("throw error", async () => {
      const e = new Error("my error")
      const res = await signin({
        callbacks: {
          signin() {
            throw e
          },
        },
      })
      expect(res.headers.get("Location")).toBe(
        "http://a/auth/error?error=AuthorizedCallbackError"
      )
    })
  })

  describe("oauth callback", () => {
    it("should build the correct user object", async () => {
      const { profile, provider, tokens, logger } = getUserAndAccountArgs;
      const profileWithStringId = {
        ...profile,
        id: profile.id.toString(),
      };
      const profileResult = await getUserAndAccount(
        profileWithStringId,
        provider as OAuthConfigInternal<any>,
        tokens,
        logger
       );
      return { user: {}, account: {} }
    })
  })

  // TODO: We need an OAuth provider to test against
  describe.todo("redirect in oauth", () => {})
})
