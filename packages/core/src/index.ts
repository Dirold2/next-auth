import { assertConfig } from "./lib/utils/assert.js"
import { AuthError, ErrorPageLoop } from "./errors.js"
import { AuthInternal, raw, skipCSRFCheck } from "./lib/index.js"
import { setEnvDefaults, createActionURL } from "./lib/utils/env.js"
import renderPage from "./lib/pages/index.js"
import { logger, setLogger } from "./lib/utils/logger.js"
import { toInternalRequest, toResponse } from "./lib/utils/web.js"

import type { Adapter } from "./adapters.js"
import type { CallbacksOptions, CookiesOptions, EventCallbacks, LoggerInstance, PagesOptions, ResponseInternal, Theme } from "./types.js"
import type { Provider } from "./providers/index.js"
import { type JWTOptions } from "./jwt.js"
import { isAuthAction } from "./lib/utils/actions.js"

export { skipCSRFCheck, raw, setEnvDefaults, createActionURL, isAuthAction }

export async function Auth(request: Request, config: AuthConfig & { raw: typeof raw }): Promise<ResponseInternal>
export async function Auth(request: Request, config: Omit<AuthConfig, "raw">): Promise<Response>
export async function Auth(request: Request, config: AuthConfig): Promise<Response | ResponseInternal> {
  setLogger(config.logger, config.debug)
  const internalRequest = await toInternalRequest(request, config)
  if (internalRequest instanceof Error) {
    logger.error(internalRequest)
    return new Response(`Error: This action with HTTP ${request.method} is not supported.`, { status: 400 })
  }
  const assertionResult = assertConfig(internalRequest, config)
  if (Array.isArray(assertionResult)) assertionResult.forEach(logger.warn)
  else if (assertionResult instanceof Error) {
    logger.error(assertionResult)
    const htmlPages = ["signin", "signout", "error", "verify-request"]
    if (!htmlPages.includes(internalRequest.action) || internalRequest.method !== "GET") {
      return new Response("There was a problem with the server configuration. Check the server logs for more information.", { status: 500 })
    }
    const { pages, theme } = config
    const authOnErrorPage = pages?.error && internalRequest.url.searchParams.get("callbackUrl")?.startsWith(pages.error)
    if (!pages?.error || authOnErrorPage) {
      if (authOnErrorPage) logger.error(new ErrorPageLoop(`The error page ${pages?.error} should not require authentication`))
      const render = renderPage({ theme })
      return toResponse(render.error("Configuration"))
    }
    return Response.redirect(`${pages.error}?error=Configuration`)
  }
  const isRedirect = request.headers?.has("X-Auth-Return-Redirect")
  const isRaw = config.raw === raw
  let response: Response
  try {
    const rawResponse = await AuthInternal(internalRequest, config)
    if (isRaw) return rawResponse
    response = toResponse(rawResponse)
  } catch (e) {
    const error = e as Error
    logger.error(error)
    const isAuthError = error instanceof AuthError
    if (isAuthError && isRaw && !isRedirect) throw error
    if (request.method === "POST" && internalRequest.action === "session") return Response.json(null, { status: 400 })
    const type = isAuthError ? error.type : "Configuration"
    const page = (isAuthError && error.kind) ?? "error"
    const params = new URLSearchParams({ error: type })
    const path = (config.pages as Record<string, string>)?.[page as string] ?? `${config.basePath}/${typeof page === 'string' ? page.toLowerCase() : ''}`
    const url = `${internalRequest.url.origin}${path}?${params}`
    if (isRedirect) return Response.json({ url })
    return Response.redirect(url)
  }
  const redirect = response.headers.get("Location")
  if (!isRedirect || !redirect) return response
  return Response.json({ url: redirect }, { headers: response.headers })
}

export interface AuthConfig {
  providers: Provider[]
  secret?: string | string[]
  session?: {
    strategy?: "jwt" | "database"
    maxAge?: number
    updateAge?: number
    generateSessionToken?: () => string
  }
  jwt?: Partial<JWTOptions>
  pages?: Partial<PagesOptions>
  callbacks?: Partial<CallbacksOptions>
  events?: Partial<EventCallbacks>
  adapter?: Adapter
  debug?: boolean
  logger?: Partial<LoggerInstance>
  theme?: Theme
  useSecureCookies?: boolean
  cookies?: Partial<CookiesOptions>
  trustHost?: boolean
  skipCSRFCheck?: typeof skipCSRFCheck
  raw?: typeof raw
  redirectProxyUrl?: string
  experimental?: { enableWebAuthn?: boolean }
  basePath?: string
}
