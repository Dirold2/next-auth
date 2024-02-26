import { describe, expect, it } from "vitest"

import { parseActionAndProviderId } from "../src/lib/utils/web"
import { UnknownAction } from "../src/errors"

describe("parse the action and provider id", () => {
  it.each([
    {
      path: "/auuth/authorized",
      error: "Cannot parse action at /auuth/authorized",
      basePath: "/auth",
    },
    {
      path: "/api/auth/authorized",
      error: "Cannot parse action at /api/auth/authorized",
      basePath: "/auth",
    },
    {
      path: "/auth/auth/authorized/github",
      error: "Cannot parse action at /auth/auth/authorized/github",
      basePath: "/auth",
    },
    {
      path: "/api/auth/authorizedn",
      error: "Cannot parse action at /api/auth/authorizedn",
      basePath: "/api/auth",
    },
    {
      path: "/api/auth/authorizedn/github",
      error: "Cannot parse action at /api/auth/authorizedn/github",
      basePath: "/api/auth",
    },
    {
      path: "/api/auth/authorized/github",
      action: "authorized",
      providerId: "github",
      basePath: "/api/auth",
    },
    {
      path: "/api/auth/authorized/github/github",
      error: "Cannot parse action at /api/auth/authorized/github/github",
      basePath: "/api/auth",
    },
    {
      path: "/api/auth/authorized/api/auth/authorized/github",
      error: "Cannot parse action at /api/auth/authorized/api/auth/authorized/github",
      basePath: "/api/auth",
    },
    {
      path: "/auth/authorized/auth0",
      action: "authorized",
      providerId: "auth0",
      basePath: "/auth",
    },
  ])("$path", ({ path, error, basePath, action, providerId }) => {
    if (action || providerId) {
      const parsed = parseActionAndProviderId(path, basePath)
      expect(parsed.action).toBe(action)
      expect(parsed.providerId).toBe(providerId)
    } else {
      expect(() => parseActionAndProviderId(path, basePath)).toThrow(
        new UnknownAction(error)
      )
    }
  })
})
