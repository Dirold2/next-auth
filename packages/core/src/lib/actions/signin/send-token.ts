import { createHash, randomString, toRequest } from "../../utils/web.js"
import { SignInCallbackError } from "../../../errors.js"

import type { InternalOptions, RequestInternal , Account } from "../../../types.js"


/**
 * Starts an e-mail signin flow, by generating a token,
 * and sending it to the user's e-mail (with the help of a DB adapter).
 * At the end, it returns a redirect to the `verify-request` page.
 */
export async function sendToken(
  request: RequestInternal,
  options: InternalOptions<"email">
) {
  const { body } = request
  const { provider, callbacks, adapter } = options
  const normalizer = provider.normalizeIdentifier ?? defaultNormalizer
  const email = normalizer(String(body?.email ?? ''))

  const defaultUser = { id: crypto.randomUUID(), email, emailVerified: null }
  const user = (await adapter!.getUserByEmail(email)) ?? defaultUser

  const account = {
    providerAccountId: email,
    userId: user.id,
    type: "email",
    provider: provider.id,
  } satisfies Account

  let signin
  try {
    signin = await callbacks.signin({
      user,
      account,
      email: { verificationRequest: true },
    })
  } catch (e) {
    throw new SignInCallbackError(e as Error)
  }
  if (!signin) throw new SignInCallbackError("AccessDenied")
  if (typeof signin === "string") {
    return {
      redirect: await callbacks.redirect({
        url: signin,
        baseUrl: options.url.origin,
      }),
    }
  }

  const { callbackUrl, theme } = options
  const token =
    (await provider.generateVerificationToken?.()) ?? randomString(32)

  const ONE_DAY_IN_SECONDS = 86400
  const expires = new Date(
    Date.now() + (provider.maxAge ?? ONE_DAY_IN_SECONDS) * 1000
  )

  const secret = provider.secret ?? options.secret

  const baseUrl = new URL(options.basePath, options.url.origin)

  const sendRequest = provider.sendVerificationRequest({
    identifier: email,
    token,
    expires,
    url: `${baseUrl}/callback/${provider.id}?${new URLSearchParams({
      callbackUrl,
      token,
      email,
    })}`,
    provider,
    theme,
    request: toRequest(request),
  })

  const createToken = adapter!.createVerificationToken?.({
    identifier: email,
    token: await createHash(`${token}${secret}`),
    expires,
  })

  await Promise.all([sendRequest, createToken])

  return {
    redirect: `${baseUrl}/verify-request?${new URLSearchParams({
      provider: provider.id,
      type: provider.type,
    })}`,
  }
}

function defaultNormalizer(email?: string) {
  if (!email) throw new Error("Missing email from request body.")
  // Get the first two elements only,
  // separated by `@` from user input.
  let [local, domain] = email.toLowerCase().trim().split("@")
  // The part before "@" can contain a ","
  // but we remove it on the domain part
  domain = domain.split(",")[0]
  return `${local}@${domain}`
}
