import * as checks from "./checks.js"
import * as o from "oauth4webapi"
import {
  OAuthCallbackError,
  OAuthProfileParseError,
} from "../../../../errors.js"

import type {
  Account,
  InternalOptions,
  LoggerInstance,
  Profile,
  RequestInternal,
  TokenSet,
  User,
} from "../../../../types.js"
import type { OAuthConfigInternal } from "../../../../providers/index.js"
import type { Cookie } from "../../../utils/cookie.js"
import { type OAuth2Error } from "oauth4webapi"

/**
 * Handles OAuth callback.
*/
export async function handleOAuth(
  query: RequestInternal["query"],
  cookies: RequestInternal["cookies"],
  options: InternalOptions<"oauth" | "oidc">,
  randomState?: string
) {
  const { logger, provider } = options
  let as: o.AuthorizationServer

  const { token, userinfo } = provider
  if (
    (!token?.url || token.url.host === "authjs.dev") &&
    (!userinfo?.url || userinfo.url.host === "authjs.dev")
  ) {
    // Perform dynamic discovery if provider URLs are not set or if they point to a development environment
    const issuer = new URL(provider.issuer!)
    const discoveryResponse = await o.discoveryRequest(issuer)
    as = await o.processDiscoveryResponse(issuer, discoveryResponse)
  } else {
    // Use configured provider URLs
    as = {
      issuer: provider.issuer ?? "https://authjs.dev",
      token_endpoint: token?.url.toString(),
      userinfo_endpoint: userinfo?.url.toString(),
    }
  }

  // Configure OAuth client
  const client: o.Client = {
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    ...provider.client,
  }

  // Initialize array for response cookies
  const resCookies: Cookie[] = []

  // Generate or validate state
  const state = await checks.state.use(
    cookies,
    resCookies,
    options,
    randomState
  )

  // Validate OAuth response and extract authorization code
  const codeGrantParams = o.validateAuthResponse(
    as,
    client,
    new URLSearchParams(query),
    provider.checks.includes("state") ? state : o.skipStateCheck
  )

  if (o.isOAuth2Error(codeGrantParams)) {
    const cause = { providerId: provider.id, ...codeGrantParams }
    logger.debug("OAuthCallbackError", cause)
    throw new OAuthCallbackError("OAuth Provider returned an error", cause)
  }

  // Generate PKCE code verifier if required
  const codeVerifier = await checks.pkce.use(cookies, resCookies, options)

  // Determine redirect URL
  let redirect_uri = provider.callbackUrl
  if (!options.isOnRedirectProxy && provider.redirectProxyUrl) {
    redirect_uri = provider.redirectProxyUrl
  }

  // Request authorization code grant
  let codeGrantResponse = await o.authorizationCodeGrantRequest(
    as,
    client,
    codeGrantParams,
    redirect_uri,
    codeVerifier ?? "auth"
  )

  // Conform token response if required by provider
  if (provider.token?.conform) {
    codeGrantResponse = (await provider.token.conform(
      codeGrantResponse.clone()
    )) ?? codeGrantResponse
  }

  // Handle www-authenticate challenges if present
  let challenges: o.WWWAuthenticateChallenge[] | undefined
  if ((challenges = o.parseWwwAuthenticateChallenges(codeGrantResponse))) {
    for (const challenge of challenges) {
      console.log("challenge", challenge)
    }
    throw new Error("Handle www-authenticate challenges as needed")
  }

  // Process tokens and user profile based on provider type
  let profile: Profile = {}
  let tokens: TokenSet & Pick<Account, "expires_at">

  if (provider.type === "oidc") {
    // OIDC provider - process OIDC response
    const nonce = await checks.nonce.use(cookies, resCookies, options)
    const result = await o.processAuthorizationCodeOpenIDResponse(
      as,
      client,
      codeGrantResponse,
      nonce ?? o.expectNoNonce
    )

    if (o.isOAuth2Error(result)) {
      console.log("error", result)
      throw new Error("Handle OIDC response body error")
    }

    profile = o.getValidatedIdTokenClaims(result)
    tokens = result
  } else {
    // OAuth 2.0 provider - process OAuth 2.0 response
    tokens = await o.processAuthorizationCodeOAuth2Response(
      as,
      client,
      codeGrantResponse
    )

    if (o.isOAuth2Error(tokens as o.OAuth2TokenEndpointResponse | OAuth2Error)) {
      console.log("error", tokens);
      throw new Error("Handle OAuth 2.0 response body error");
    }

    // Fetch user profile
    if (userinfo?.request) {
      const providerWithauthorizedUrl = {
        ...provider,
        authorizedUrl: provider.authorizedUrl, // Ensure authorizedUrl is included
      };
      const _profile = await userinfo.request({ tokens, provider: providerWithauthorizedUrl });
      if (_profile instanceof Object) profile = _profile;
    } else if (userinfo?.url) {
      const userinfoResponse = await o.userInfoRequest(
        as,
        client,
        (tokens as { access_token: string }).access_token
      )
      profile = await userinfoResponse.json()
    } else {
      throw new TypeError("No userinfo endpoint configured")
    }
  }

  // Normalize token expiry time if present
  if (tokens.expires_in) {
    tokens.expires_at = Math.floor(Date.now() / 1000) + Number(tokens.expires_in)
  }

  // Fetch user and account details from profile and tokens
  const profileResult = await getUserAndAccount(
    profile,
    provider,
    tokens,
    logger
  )

  return { ...profileResult, profile, cookies: resCookies }
}

/**
 * Returns the user and account that is going to be created in the database.
 * @internal
 */
export async function getUserAndAccount(
  OAuthProfile: Profile,
  provider: OAuthConfigInternal<any>,
  tokens: TokenSet,
  logger: LoggerInstance
) {
  try {
    // Fetch user details from the profile
    const userFromProfile = await provider.profile(OAuthProfile, tokens)
    const user = {
      ...userFromProfile,
      id: crypto.randomUUID(),
      email: userFromProfile.email?.toLowerCase(),
    } satisfies User // Ensure user satisfies User interface

    // Construct account object
    const account: Account = {
      ...tokens,
      provider: provider.id,
      type: provider.type,
      providerAccountId: userFromProfile.id ?? crypto.randomUUID(),
    }

    return { user, account }
  } catch (e) {
    logger.debug("getProfile error details", OAuthProfile)
    logger.error(
      new OAuthProfileParseError(e as Error, { provider: provider.id })
    )
    // Handle error gracefully
    // Possibly return default or empty user and account objects
    return { user: {}, account: {} }
  }
}