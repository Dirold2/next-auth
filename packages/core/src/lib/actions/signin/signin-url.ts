import * as checks from "../callback/oauth/checks.js"
import * as o from "oauth4webapi"

import type { InternalOptions, RequestInternal } from "../../../types.js"
import type { Cookie } from "../../utils/cookie.js"

interface Provider {
  authorization?: {
    url?: URL;
    params?: Record<string, string>;
  };
  issuer?: string;
  callbackUrl?: string;
  clientId?: string;
  redirectProxyUrl?: string;
  checks?: string[];
  type?: string;
}

async function normalizeOAuth(provider: Provider) {
  let url = provider.authorization?.url
  let as;
 
  if (!url || url.host === "authjs.dev") {
    const issuer = new URL(provider.issuer!)
    const discoveryResponse = await o.discoveryRequest(issuer)
    as = await o.processDiscoveryResponse(issuer, discoveryResponse)
 
    if (!as.authorization_endpoint) {
      throw new TypeError(
        "Authorization server did not provide an authorization endpoint."
      )
    }
 
    url = new URL(as.authorization_endpoint)
  }
 
  return { url, as } // Return both url and as
}

/**
 * Generates an authorization/request token URL.
 *
 * [OAuth 2](https://www.oauth.com/oauth2-servers/authorization/the-authorization-request/)
 */
export async function getAuthorizationUrl(
  query: RequestInternal["query"],
  options: InternalOptions<"oauth" | "oidc">
) {
  const { logger, provider } = options

  const { url, as } = await normalizeOAuth(provider)

  const authParams = url.searchParams

  let redirect_uri: string = provider.callbackUrl
  let data: object | undefined
  if (!options.isOnRedirectProxy && provider.redirectProxyUrl) {
    redirect_uri = provider.redirectProxyUrl
    data = { origin: provider.callbackUrl }
    logger.debug("using redirect proxy", { redirect_uri, data })
  }
  
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const authorizationParams = provider.authorization?.params ?? {};
  const params = Object.assign(
    {
      response_type: "code",
      client_id: provider.clientId,
      redirect_uri,
      ...authorizationParams,
  },
    Object.fromEntries(provider.authorization?.url.searchParams ?? []),
    query
  )
  
  for (const k in params) authParams.set(k, params[k] as string)

  const cookies: Cookie[] = []

  const state = await checks.state.create(options, data)
  if (state) {
    authParams.set("state", state.value)
    cookies.push(state.cookie)
  }

  if (provider.checks?.includes("pkce")) {
    if (as && !as.code_challenge_methods_supported?.includes("S256")) {
      if (provider.type === "oidc") provider.checks = ["nonce"] as any
    } else {
      const { value, cookie } = await checks.pkce.create(options)
      authParams.set("code_challenge", value)
      authParams.set("code_challenge_method", "S256")
      cookies.push(cookie)
    }
  }

  const nonce = await checks.nonce.create(options)
  if (nonce) {
    authParams.set("nonce", nonce.value)
    cookies.push(nonce.cookie)
  }

  if (provider.type === "oidc" && !url.searchParams.has("scope")) {
    url.searchParams.set("scope", "openid profile email")
  }

  logger.debug("authorization url is ready", { url, cookies, provider })
  return { redirect: url.toString(), cookies }
}