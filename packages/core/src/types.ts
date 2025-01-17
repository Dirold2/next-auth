/**
 *
 * This module contains public types and interfaces of the core package.
 *
 * ## Installation
 *
 * ```bash npm2yarn
 * npm install @auth/core
 * ```
 *
 * You can then import this submodule from `@auth/core/types`.
 *
 * ## Usage
 *
 * Even if you don't use TypeScript, IDEs like VSCode will pick up types to provide you with a better developer experience.
 * While you are typing, you will get suggestions about what certain objects/functions look like,
 * and sometimes links to documentation, examples, and other valuable resources.
 *
 * Generally, you will not need to import types from this module.
 * Mostly when using the `Auth` function and optionally the `AuthConfig` interface,
 * everything inside there will already be typed.
 *
 * :::tip
 * Inside the `Auth` function, you won't need to use a single type from this module.
 *
 * @example
 * ```ts title=index.ts
 * import { Auth } from "@auth/core"
 *
 * const request = new Request("https://example.com")
 * const response = await Auth(request, {
 *   callbacks: {
 *     jwt(): JWT { // <-- This is unnecessary!
 *       return { foo: "bar" }
 *     },
 *     session(
 *        { session, token }: { session: Session; token: JWT } // <-- This is unnecessary!
 *     ) {
 *       return session
 *     },
 *   }
 * })
 * ```
 * :::
 *
 * :::info
 * We are advocates of TypeScript, as it will help you catch errors at build-time, before your users do. 😉
 * :::
 *
 * ## Resources
 *
 * - [TypeScript - The Basics](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)
 * - [Extending built-in types](https://authjs.dev/getting-started/typescript#module-augmentation)
 *
 * @module types
 */

import type { CookieSerializeOptions } from "cookie"
import type {
  OAuth2TokenEndpointResponse,
  OpenIDTokenEndpointResponse,
} from "oauth4webapi"
import type { Adapter, AdapterSession, AdapterUser } from "./adapters.js"
import { type AuthConfig } from "./index.js"
import type { JWT, JWTOptions } from "./jwt.js"
import type { Cookie } from "./lib/utils/cookie.js"
import type { LoggerInstance } from "./lib/utils/logger.js"
import type {
  CredentialInput,
  CredentialsConfig,
  EmailConfig,
  OAuthConfigInternal,
  OIDCConfigInternal,
  ProviderType,
} from "./providers/index.js"
import type {
  WebAuthnConfig,
  WebAuthnProviderType,
} from "./providers/webauthn.js"

export type { AuthConfig } from "./index.js"
export type { LoggerInstance }
export type Awaitable<T> = T | PromiseLike<T>
export type Awaited<T> = T extends Promise<infer U> ? U : T

export type SemverString =
  | `v${number}`
  | `v${number}.${number}`
  | `v${number}.${number}.${number}`

/**
 * Change the theme of the built-in pages.
 *
 * [Documentation](https://authjs.dev/reference/core#authconfig#theme) |
 * [Pages](https://authjs.dev/guides/basics/pages)
 */
export interface Theme {
  colorScheme?: "auto" | "dark" | "light" | null
  logo?: string | null
  brandColor?: string | null
  buttonText?: string | null
}

/**
 * Different tokens returned by OAuth Providers.
 * Some of them are available with different casing,
 * but they refer to the same value.
 */
export type TokenSet = Partial<
  OAuth2TokenEndpointResponse | OpenIDTokenEndpointResponse
> & {
  /**
   * Date of when the `access_token` expires in seconds.
   * This value is calculated from the `expires_in` value.
   *
   * @see https://www.ietf.org/rfc/rfc6749.html#section-4.2.2
   */
  expires_at?: number | null
}

/**
 * Usually contains information about the provider being used
 * and also extends `TokenSet`, which is different tokens returned by OAuth Providers.
 */
export interface Account extends Partial<OpenIDTokenEndpointResponse> {
  provider: string | null
  providerAccountId: string | null
  type: ProviderType | null
  userId?: string | null
  expires_at?: number | null
}

/**
 * The user info returned from your OAuth provider.
 *
 * @see https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
 */
export interface Profile {
  id?: string | null
  sub?: string | null
  name?: string | null
  given_name?: string | null
  family_name?: string | null
  middle_name?: string | null
  nickname?: string | null
  preferred_username?: string | null
  profile?: string | null
  picture?: string | null | any
  website?: string | null
  email?: string | null
  email_verified?: boolean | null
  gender?: string | null
  birthdate?: string | null
  zoneinfo?: string | null
  locale?: string | null
  phone_number?: string | null
  updated_at?: Date | string | number | null
  address?: {
    formatted?: string | null
    street_address?: string | null
    locality?: string | null
    region?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
  [claim: string]: unknown
}

// TODO: rename `signin` to `authorized`
/** Override the default session creation flow of Auth.js */
export interface CallbacksOptions<P = Profile, A = Account> {
  signin: (params: {
    user: User | AdapterUser
    account: A | null
    profile?: P | null
    email?: {
      verificationRequest?: boolean
    } | null
    credentials?: Record<string, CredentialInput> | null
  }) => Awaitable<boolean | string>
  redirect: (params: {
    url: string
    baseUrl: string
  }) => Awaitable<string>
  session: (
    params: ({
      session: { user: AdapterUser } & AdapterSession
      user: AdapterUser
    } & {
      session: Session
      token: JWT
    }) & {
      newSession: any | null
      trigger?: "update" | null
    }
  ) => Awaitable<Session | DefaultSession>
  jwt: (params: {
    token: JWT | null
    user: User | AdapterUser
    account: A | null
    profile?: P | null
    trigger?: "signin" | "signUp" | "update" | null
    isNewUser?: boolean | null
    session?: any | null
  }) => Awaitable<JWT | null>
}

/** [Documentation](https://authjs.dev/reference/core#cookies) */
export interface CookieOption {
  name: string
  options: CookieSerializeOptions
}

/** [Documentation](https://authjs.dev/reference/core#cookies) */
export interface CookiesOptions {
  sessionToken: Partial<CookieOption> | null
  callbackUrl: Partial<CookieOption> | null
  csrfToken: Partial<CookieOption> | null
  pkceCodeVerifier: Partial<CookieOption> | null
  state: Partial<CookieOption> | null
  nonce: Partial<CookieOption> | null
  webauthnChallenge: Partial<CookieOption> | null
}

/**
 *  The various event callbacks you can register for from next-auth
 *
 * [Documentation](https://authjs.dev/guides/basics/events)
 */
export interface EventCallbacks {
  /**
   * If using a `credentials` type auth, the user is the raw response from your
   * credential provider.
   * For other providers, you'll get the User object from your adapter, the account,
   * and an indicator if the user was new to your Adapter.
   */
  signin: (message: {
    user: User
    account: Account | null
    profile?: Profile | null
    isNewUser?: boolean | null
  }) => Awaitable<void>
  /**
   * The message object will contain one of these depending on
   * if you use JWT or database persisted sessions:
   * - `token`: The JWT for this session.
   * - `session`: The session object from your adapter that is being ended.
   */
  signout: (
    message:
      | { session: Awaited<ReturnType<Required<Adapter>["deleteSession"]>> }
      | { token: Awaited<ReturnType<JWTOptions["decode"]>> }
  ) => Awaitable<void>
  createUser: (message: { user: User }) => Awaitable<void>
  updateUser: (message: { user: User }) => Awaitable<void>
  linkAccount: (message: {
    user: User | AdapterUser
    account: Account
    profile: User | AdapterUser
  }) => Awaitable<void>
  /**
   * The message object will contain one of these depending on
   * if you use JWT or database persisted sessions:
   * - `token`: The JWT for this session.
   * - `session`: The session object from your adapter.
   */
  session: (message: { session: Session; token: JWT }) => Awaitable<void>
}

export type EventType = keyof EventCallbacks

/** TODO: Check if all these are used/correct */
export type ErrorPageParam = "Configuration" | "AccessDenied" | "Verification"

/** TODO: Check if all these are used/correct */
export type AuthorizedPageErrorParam =
  | "Authorized"
  | "OAuthAuthorized"
  | "OAuthCallbackError"
  | "OAuthCreateAccount"
  | "EmailCreateAccount"
  | "Callback"
  | "OAuthAccountNotLinked"
  | "EmailAuthorized"
  | "CredentialsAuthorized"
  | "SessionRequired" | null

export interface PagesOptions {
  /**
   * The path to the signin page.
   *
   * The optional "error" query parameter is set to
   * one of the {@link SignInPageErrorParam available} values.
   *
   * @default "/signin"
   */
  signin: string
  signout: string
  /**
   * The path to the error page.
   *
   * The optional "error" query parameter is set to
   * one of the {@link ErrorPageParam available} values.
   *
   * @default "/error"
   */
  error: string
  verifyRequest: string
  /** If set, new users will be directed here on first signin */
  newUser: string | null
}

// type ISODateString = string

export interface DefaultSession {
  user?: User | null;
  expires: Date;
}

/** The active session of the logged in user. */
export interface Session {
  user?: User | null;
  expires: Date;
  // userId: string | null;
}

/**
 * The shape of the returned object in the OAuth providers' `profile` callback,
 * available in the `jwt` and `session` callbacks,
 * or the second parameter of the `session` callback, when using a database.
 */
export interface User {
  id?: string
  name?: string
  email?: string | null
  image?: string | null
}

// Below are types that are only supposed be used by next-auth internally

/** @internal */
export type InternalProvider<T = ProviderType> = (T extends "oauth"
  ? OAuthConfigInternal<any>
  : T extends "oidc"
    ? OIDCConfigInternal<any>
    : T extends "email"
      ? EmailConfig
      : T extends "credentials"
        ? CredentialsConfig
        : T extends WebAuthnProviderType
          ? WebAuthnConfig
          : never) & {
            signinUrl: string
  /** @example `"https://example.com/api/auth/callback/id"` */
  callbackUrl: string
}

export interface PublicProvider {
  id: string
  name: string
  type: string
  signinUrl: string
  callbackUrl: string
}

/**
 * Supported actions by Auth.js. Each action map to a REST API endpoint.
 * Some actions have a `GET` and `POST` variant, depending on if the action
 * changes the state of the server.
 *
 * - **`"callback"`**:
 *   - **`GET`**: Handles the callback from an [OAuth provider](https://authjs.dev/reference/core/providers/oauth).
 *   - **`POST`**: Handles the callback from a [Credentials provider](https://authjs.dev/reference/core/providers/credentials).
 * - **`"csrf"`**: Returns the raw CSRF token, which is saved in a cookie (encrypted).
 * It is used for CSRF protection, implementing the [double submit cookie](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie) technique.
 * :::note
 * Some frameworks have built-in CSRF protection and can therefore disable this action. In this case, the corresponding endpoint will return a 404 response. Read more at [`skipCSRFCheck`](https://authjs.dev/reference/core#skipcsrfcheck).
 * _⚠ We don't recommend manually disabling CSRF protection, unless you know what you're doing._
 * :::
 * - **`"error"`**: Renders the built-in error page.
 * - **`"providers"`**: Returns a client-safe list of all configured providers.
 * - **`"session"`**:
 *   - **`GET**`: Returns the user's session if it exists, otherwise `null`.
 *   - **`POST**`: Updates the user's session and returns the updated session.
 * - **`"signin"`**:
 *   - **`GET`**: Renders the built-in log-in page.
 *   - **`POST`**: Initiates the log-in flow.
 * - **`"signout"`**:
 *   - **`GET`**: Renders the built-in log-out page.
 *   - **`POST`**: Initiates the log-out flow. This will invalidate the user's session (deleting the cookie, and if there is a session in the database, it will be deleted as well).
 * - **`"verify-request"`**: Renders the built-in verification request page.
 * - **`"webauthn-options"`**:
 *   - **`GET`**: Returns the options for the WebAuthn authentication and registration flows.
 */
export type AuthAction =
  | "callback"
  | "csrf"
  | "error"
  | "providers"
  | "session"
  | "signin"
  | "signout"
  | "verify-request"
  | "webauthn-options"

/** @internal */
export interface RequestInternal {
  url: URL
  method: "GET" | "POST"
  cookies?: Partial<Record<string, string>>
  headers?: Record<string, any>
  query?: Record<string, any>
  body?: Record<string, any>
  action: AuthAction
  providerId?: string
  error?: string
}

// Should only be used by frameworks
export interface ResponseInternal<
  Body extends string | Record<string, any> | any[] | null = any,
> {
  status?: number
  headers?: Headers | HeadersInit
  body?: Body
  redirect?: string
  cookies?: Cookie[]
}

/**
 * A webauthn authenticator.
 * Represents an entity capable of authenticating the account it references,
 * and contains the auhtenticator's credentials and related information.
 *
 * @see https://www.w3.org/TR/webauthn/#authenticator
 */
export interface Authenticator {
  /**
   * ID of the user this authenticator belongs to.
   */
  userId?: string
  /**
   * The provider account ID connected to the authenticator.
   */
  providerAccountId: string
  /**
   * Number of times the authenticator has been used.
   */
  counter: number
  /**
   * Whether the client authenticator backed up the credential.
   */
  credentialBackedUp: boolean
  /**
   * Base64 encoded credential ID.
   */
  credentialID: string
  /**
   * Base64 encoded credential public key.
   */
  credentialPublicKey: string
  /**
   * Concatenated transport flags.
   */
  transports?: string
  /**
   * Device type of the authenticator.
   */
  credentialDeviceType: string
}

/** @internal */
export interface InternalOptions<TProviderType = ProviderType> {
  providers: InternalProvider[]
  url: URL
  action: AuthAction
  provider: InternalProvider<TProviderType>
  csrfToken?: string
  /**
   * `true` if the [Double-submit CSRF check](https://owasp.org/www-chapter-london/assets/slides/David_Johansson-Double_Defeat_of_Double-Submit_Cookie.pdf) was succesful
   * or [`skipCSRFCheck`](https://authjs.dev/reference/core#skipcsrfcheck) was enabled.
   */
  csrfTokenVerified?: boolean
  secret: string | string[]
  theme: Theme
  debug: boolean
  logger: LoggerInstance
  session: NonNullable<Required<AuthConfig["session"]>>
  pages: Partial<PagesOptions>
  jwt: JWTOptions
  events: Partial<EventCallbacks>
  adapter: Required<Adapter> | undefined
  callbacks: CallbacksOptions
  cookies: Record<keyof CookiesOptions, CookieOption>
  callbackUrl: string
  sessionMaxAge: number;
  /**
   * If true, the OAuth callback is being proxied by the server to the original URL.
   * See also {@link OAuthConfigInternal.redirectProxyUrl}.
   */
  isOnRedirectProxy: boolean
  experimental: NonNullable<AuthConfig["experimental"]>
  basePath: string
}