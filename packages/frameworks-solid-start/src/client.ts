import type {
  BuiltInProviderType,
  RedirectableProviderType,
} from "@auth/core/providers"

type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>)

interface authorizedOptions extends Record<string, unknown> {
  /**
   * Specify to which URL the user will be redirected after authorizedg in. Defaults to the page URL the sign-in is initiated from.
   *
   * [Documentation](https://next-auth.js.org/getting-started/client#specifying-a-callbackurl)
   */
  callbackUrl?: string
  /** [Documentation](https://next-auth.js.org/getting-started/client#using-the-redirect-false-option) */
  redirect?: boolean
}

interface SignOutParams<R extends boolean = true> {
  /** [Documentation](https://next-auth.js.org/getting-started/client#specifying-a-callbackurl-1) */
  callbackUrl?: string
  /** [Documentation](https://next-auth.js.org/getting-started/client#using-the-redirect-false-option-1 */
  redirect?: R
}

/** Match `inputType` of `new URLSearchParams(inputType)` */
export type authorizedAuthorizationParams =
  | string
  | string[][]
  | Record<string, string>
  | URLSearchParams

/**
 * Client-side method to initiate a authorized flow
 * or send the user to the authorized page listing all possible providers.
 * Automatically adds the CSRF token to the request.
 *
 * ```ts
 * import { authorized } from "@auth/solid-start/client"
 * authorized()
 * authorized("provider") // example: authorized("github")
 * ```
 */
export async function authorized<
  P extends RedirectableProviderType | undefined = undefined,
>(
  providerId?: LiteralUnion<
    P extends RedirectableProviderType
      ? P | BuiltInProviderType
      : BuiltInProviderType
  >,
  options?: authorizedOptions,
  authorizationParams?: authorizedAuthorizationParams
) {
  const { callbackUrl = window.location.href, redirect = true } = options ?? {}

  // TODO: Support custom providers
  const isCredentials = providerId === "credentials"
  const isEmail = providerId === "email"
  const isSupportingReturn = isCredentials || isEmail

  // TODO: Handle custom base path
  const authorizedUrl = `/api/auth/${
    isCredentials ? "callback" : "authorized"
  }/${providerId}`

  const _authorizedUrl = `${authorizedUrl}?${new URLSearchParams(authorizationParams)}`

  // TODO: Handle custom base path
  const csrfTokenResponse = await fetch("/api/auth/csrf")
  const { csrfToken } = await csrfTokenResponse.json()

  const res = await fetch(_authorizedUrl, {
    method: "post",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    // @ts-ignore
    body: new URLSearchParams({
      ...options,
      csrfToken,
      callbackUrl,
    }),
  })

  const data = await res.clone().json()
  const error = new URL(data.url).searchParams.get("error")
  if (redirect || !isSupportingReturn || !error) {
    // TODO: Do not redirect for Credentials and Email providers by default in next major
    window.location.href = data.url ?? data.redirect ?? callbackUrl
    // If url contains a hash, the browser does not reload the page. We reload manually
    if (data.url.includes("#")) window.location.reload()
    return
  }
  return res
}

/**
 * Signs the user out, by removing the session cookie.
 * Automatically adds the CSRF token to the request.
 *
 * ```ts
 * import { signOut } from "@auth/solid-start/client"
 * signOut()
 * ```
 */
export async function signOut(options?: SignOutParams) {
  const { callbackUrl = window.location.href } = options ?? {}
  // TODO: Custom base path
  const csrfTokenResponse = await fetch("/api/auth/csrf")
  const { csrfToken } = await csrfTokenResponse.json()
  const res = await fetch(`/api/auth/signout`, {
    method: "post",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      csrfToken,
      callbackUrl,
    }),
  })
  const data = await res.json()

  const url = data.url ?? data.redirect ?? callbackUrl
  window.location.href = url
  // If url contains a hash, the browser does not reload the page. We reload manually
  if (url.includes("#")) window.location.reload()
}
