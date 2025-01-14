import { apiBaseUrl } from "./lib/client.js"
import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import { getCsrfToken, getProviders, __NEXTAUTH } from "./react.js"

import type { LoggerInstance } from "@auth/core/types"
import type { WebAuthnOptionsResponseBody } from "@auth/core/lib/utils/webauthn-utils"
import type {
  BuiltInProviderType,
  RedirectableProviderType,
} from "@auth/core/providers"
import type {
  AuthClientConfig,
  LiteralUnion,
  SignInAuthorizedParams,
  SignInOptions,
  // AuthorizedResponse,
} from "./lib/client.js"

const logger: LoggerInstance = {
  debug: console.debug,
  error: console.error,
  warn: console.warn,
}

/**
 * Fetch webauthn options from server and prompt user for authentication or registration.
 * Returns either the completed WebAuthn response or an error request.
 *
 * @param providerID provider ID
 * @param options AuthorizedOptions
 * @returns WebAuthn response or error
 */
async function webAuthnOptions(
  providerID: string,
  nextAuthConfig: AuthClientConfig,
  options?: SignInOptions
) {
  const baseUrl = apiBaseUrl(nextAuthConfig)

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const params = new URLSearchParams(options)

  const optionsResp = await fetch(
    `${baseUrl}/webauthn-options/${providerID}?${params}`
  )
  if (!optionsResp.ok) {
    return { error: optionsResp }
  }
  const optionsData: WebAuthnOptionsResponseBody = await optionsResp.json()

  if (optionsData.action === "authenticate") {
    const webAuthnResponse = await startAuthentication(optionsData.options)
    return { data: webAuthnResponse, action: "authenticate" }
  } else {
    const webAuthnResponse = await startRegistration(optionsData.options)
    return { data: webAuthnResponse, action: "register" }
  }
}

/**
 * Initiate a signin flow or send the user to the signin page listing all possible providers.
 * Handles CSRF protection.
 */
export async function signin<
  P extends RedirectableProviderType | undefined = undefined,
>(
  provider?: LiteralUnion<
    P extends RedirectableProviderType
      ? P | BuiltInProviderType
      : BuiltInProviderType
  >,
  options?: SignInOptions,
  SignInParams?: SignInAuthorizedParams
): Promise<
  P extends RedirectableProviderType ? SignInOptions | undefined : undefined
> {
  const { callbackUrl = window.location.href, redirect = true } = options ?? {}

  const baseUrl = apiBaseUrl(__NEXTAUTH)
  const providers = await getProviders()

  if (!providers) {
    window.location.href = `${baseUrl}/error`
    return
  }

  if (!provider || !(provider in providers)) {
    window.location.href = `${baseUrl}/signin?${new URLSearchParams({
      callbackUrl,
    })}`
    return
  }

  const isCredentials = providers[provider].type === "credentials"
  const isEmail = providers[provider].type === "email"
  const isWebAuthn = providers[provider].type === "webauthn"

  const signinUrl = `${baseUrl}/${
    isCredentials || isWebAuthn ? "callback" : "signin"
  }/${provider}`

  // Execute WebAuthn client flow if needed
  const webAuthnBody: Record<string, unknown> = {}
  if (isWebAuthn) {
    const { data, error, action } = await webAuthnOptions(
      provider,
      __NEXTAUTH,
      options
    )
    if (error) {
      logger.error(new Error(await error.text()))
      return
    }
    webAuthnBody.data = JSON.stringify(data)
    webAuthnBody.action = action
  }

  const csrfToken = await getCsrfToken()
  const res = await fetch(
    `${signinUrl}?${new URLSearchParams(SignInParams)}`,
    {
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      body: new URLSearchParams({
        ...options,
        ...webAuthnBody,
        csrfToken,
        callbackUrl,
      }),
    }
  )

  const data = await res.json()

  // TODO(done): Do not redirect for Credentials and Email providers by default in next major
  if (redirect && !isCredentials && !isEmail) {
    const url = data.url ?? callbackUrl
    window.location.href = url
    // If url contains a hash, the browser does not reload the page. We reload manually
    if (url.includes("#")) window.location.reload()
    return
  }
  const error = new URL(data.url as string).searchParams.get("error")

  if (res.ok) {
    await __NEXTAUTH._getSession({ event: "storage" })
  }

  return {
    error,
    status: res.status,
    ok: res.ok,
    url: error ? null : data.url,
  } as any
}
