/**
 * _If you are looking to migrate from v4, visit the [Upgrade Guide (v5)](https://authjs.dev/guides/upgrade-to-v5)._
 *
 * ## Installation
 *
 * ```bash npm2yarn
 * npm install next-auth@beta
 * ```
 *
 * ## Environment variable inference
 *
 * `NEXTAUTH_URL` and `NEXTAUTH_SECRET` have been inferred since v4.
 *
 * Since NextAuth.js v5 can also automatically infer environment variables that are prefixed with `AUTH_`.
 *
 * For example `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` will be used as the `clientId` and `clientSecret` options for the GitHub provider.
 *
 * :::tip
 * The environment variable name inferring has the following format for OAuth providers: `AUTH_{PROVIDER}_{ID|SECRET}`.
 *
 * `PROVIDER` is the uppercase snake case version of the provider's id, followed by either `ID` or `SECRET` respectively.
 * :::
 *
 * `AUTH_SECRET` and `AUTH_URL` are also aliased for `NEXTAUTH_SECRET` and `NEXTAUTH_URL` for consistency.
 *
 * To add social login to your app, the configuration becomes:
 *
 * ```ts title="auth.ts"
 * import NextAuth from "next-auth"
 * import GitHub from "next-auth/providers/github"
 * export const { handlers, auth } = NextAuth({ providers: [ GitHub ] })
 * ```
 *
 * And the `.env.local` file:
 *
 * ```sh title=".env.local"
 * AUTH_GITHUB_ID=...
 * AUTH_GITHUB_SECRET=...
 * AUTH_SECRET=...
 * ```
 *
 * :::tip
 * In production, `AUTH_SECRET` is a required environment variable - if not set, NextAuth.js will throw an error. See [MissingSecretError](https://authjs.dev/reference/core/errors#missingsecret) for more details.
 * :::
 *
 * If you need to override the default values for a provider, you can still call it as a function `GitHub({...})` as before.
 *
 * ## Lazy initialization
 * You can also initialize NextAuth.js lazily (previously known as advanced intialization), which allows you to access the request context in the configuration in some cases, like Route Handlers, Middleware, API Routes or `getServerSideProps`.
 * The above example becomes:
 *
 * ```ts title="auth.ts"
 * import NextAuth from "next-auth"
 * import GitHub from "next-auth/providers/github"
 * export const { handlers, auth } = NextAuth(req => {
 *  if (req) {
 *   console.log(req) // do something with the request
 *  }
 *  return { providers: [ GitHub ] }
 * })
 * ```
 *
 * :::tip
 * This is useful if you want to customize the configuration based on the request, for example, to add a different provider in staging/dev environments.
 * :::
 *
 * @module next-auth
*/

import { Auth } from "@auth/core"
import { reqWithEnvURL, setEnvDefaults } from "./lib/env.js"
import { initAuth } from "./lib/index.js"
import { signin, signout, update } from "./lib/actions.js"

import type { Session } from "@auth/core/types"
import type { BuiltInProviderType } from "@auth/core/providers"
import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next"
import type { AppRouteHandlerFn } from "./lib/types.js"
import { NextRequest } from "next/server"
import type { NextAuthConfig, NextAuthRequest } from "./lib/index.js"
export { AuthError } from "@auth/core/errors"

export type {
  Session,
  Account,
  Profile,
  DefaultSession,
  User,
} from "@auth/core/types"

type AppRouteHandlers = Record<
  "GET" | "POST",
  (req: NextRequest) => Promise<Response>
>

export type { NextAuthConfig }

/**
 * The result of invoking {@link NextAuth|NextAuth}, initialized with the {@link NextAuthConfig}.
 * It contains methods to set up and interact with NextAuth.js in your Next.js app.
*/
export interface NextAuthResult {
  /**
   * The NextAuth.js [Route Handler](https://beta.nextjs.org/docs/routing/route-handlers) methods. These are used to expose an endpoint for OAuth/Email providers,
   * as well as REST API endpoints (such as `/api/auth/session`) that can be contacted from the client.
   *
   * After initializing NextAuth.js in `auth.ts`,
   * re-export these methods.
   *
   * In `app/api/auth/[...nextauth]/route.ts`:
   *
   * ```ts title="app/api/auth/[...nextauth]/route.ts"
   * export { GET, POST } from "../../../../auth"
   * export const runtime = "edge" // optional
   * ```
   * Then `auth.ts`:
   * ```ts title="auth.ts"
   * // ...
   * export const { handlers: { GET, POST }, auth } = NextAuth({...})
   * ```
  */
  handlers: AppRouteHandlers
  /**
   * A universal method to interact with NextAuth.js in your Next.js app.
   * After initializing NextAuth.js in `auth.ts`, use this method in Middleware, Server Components, Route Handlers (`app/`), and Edge or Node.js API Routes (`pages/`).
   *
   * #### In Middleware
   *
   * :::info
   * Adding `auth` to your Middleware is optional, but recommended to keep the user session alive.
   * :::
   *
   * Authentication is done by the {@link NextAuthConfig.callbacks|callbacks.authorized} callback.
   * @example
   * ```ts title="middleware.ts"
   * export { auth as middleware } from "./auth"
   * ```
   *
   * Alternatively you can wrap your own middleware with `auth`, where `req` is extended with `auth`:
   * @example
   * ```ts title="middleware.ts"
   * import { auth } from "./auth"
   * export default auth((req) => {
   *   // req.auth
   * })
   * ```
   *
   * ```ts
   * // Optionally, don't invoke Middleware on some paths
   * // Read more: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
   * export const config = {
   *   matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
   * }
   * ```
   *
   * #### In Server Components
   *
   * @example
   * ```ts title="app/page.ts"
   * import { auth } from "../auth"
   *
   * export default async function Page() {
   *   const { user } = await auth()
   *   return <p>Hello {user?.name}</p>
   * }
   * ```
   *
   * #### In Route Handlers
   * @example
   * ```ts title="app/api/route.ts"
   * import { auth } from "../../auth"
   *
   * export const POST = auth((req) => {
   *   // req.auth
   * })
   * ```
   *
   * #### In Edge API Routes
   *
   * @example
   * ```ts title="pages/api/protected.ts"
   * import { auth } from "../../auth"
   *
   * export default auth((req) => {
   *   // req.auth
   * })
   *
   * export const config = { runtime: "edge" }
   * ```
   *
   * #### In API Routes
   *
   * @example
   * ```ts title="pages/api/protected.ts"
   * import { auth } from "../auth"
   * import type { NextApiRequest, NextApiResponse } from "next"
   *
   * export default async (req: NextApiRequest, res: NextApiResponse) => {
   *   const session = await auth(req, res)
   *   if (session) {
   *     // Do something with the session
   *     return res.json("This is protected content.")
   *   }
   *   res.status(401).json("You must be signed in.")
   * }
   * ```
   *
   * #### In `getServerSideProps`
   *
   * @example
   * ```ts title="pages/protected-ssr.ts"
   * import { auth } from "../auth"
   * //...
   * export const getServerSideProps: GetServerSideProps = async (context) => {
   *   const session = await auth(context)
   *
   *   if (session) {
   *     // Do something with the session
   *     return { props: { session, content: (await res.json()).content } }
   *   }
   *
   *   return { props: {} }
   * }
   * ```
  */
  auth: ((
    ...args: [NextApiRequest, NextApiResponse]
  ) => Promise<Session | null>) &
    ((...args: []) => Promise<Session | null>) &
    ((...args: [GetServerSidePropsContext]) => Promise<Session | null>) &
    ((
      ...args: [(req: NextAuthRequest) => ReturnType<AppRouteHandlerFn>]
    ) => AppRouteHandlerFn)
  /**
   * Sign in with a provider. If no provider is specified, the user will be redirected to the sign in page.
   *
   * By default, the user is redirected to the current page after signing in. You can override this behavior by setting the `redirectTo` option.
   *
   * @example
   * ```ts title="app/layout.tsx"
   * import { signIn } from "../auth"
   *
   * export default function Layout() {
   *  return (
   *   <form action={async () => {
   *     "use server"
   *     await signIn("github")
   *   }}>
   *    <button>Sign in with GitHub</button>
   *   </form>
   * )
   * ```
   *
   * If an error occurs during signin, an instance of {@link AuthError} will be thrown. You can catch it like this:
   * ```ts title="app/layout.tsx"
   * import { AuthError } from "next-auth"
   * import { signIn } from "../auth"
   *
   * export default function Layout() {
   *  return (
   *    <form action={async (formData) => {
   *      "use server"
   *      try {
   *        await signIn("credentials", formData)
   *     } catch(error) {
   *       if (error instanceof AuthError) // Handle auth errors
   *       throw error // Rethrow all other errors
   *     }
   *    }}>
   *     <button>Sign in</button>
   *   </form>
   *  )
   * }
   * ```
   *
  */
  signin: <
    P extends BuiltInProviderType | string,
    R extends boolean = true,
  >(
    /** Provider to sign in to */
    provider?: P, // See: https://github.com/microsoft/TypeScript/issues/29729
    options?:
      | FormData
      | ({
          /** The URL to redirect to after signing in. By default, the user is redirected to the current page. */
          redirectTo?: string
          /** If set to `false`, the `signIn` method will return the URL to redirect to instead of redirecting automatically. */
          redirect?: R
        } & Record<string, any>),
    authorizationParams?:
      | string[][]
      | Record<string, string>
      | string
      | URLSearchParams
  ) => Promise<R extends false ? any : never>
  /**
   * Sign out the user. If the session was created using a database strategy, the session will be removed from the database and the related cookie is invalidated.
   * If the session was created using a JWT, the cookie is invalidated.
   *
   * By default the user is redirected to the current page after signing out. You can override this behavior by setting the `redirectTo` option.
   *
   * @example
   * ```ts title="app/layout.tsx"
   * import { logOut } from "../auth"
   *
   * export default function Layout() {
   *  return (
   *   <form action={async () => {
   *     "use server"
   *     await logOut()
   *   }}>
   *    <button>Sign out</button>
   *   </form>
   * )
   * ```
   *
   *
  */
  signout: <R extends boolean = true>(options?: {
    /** The URL to redirect to after signing out. By default, the user is redirected to the current page. */
    redirectTo?: string
    /** If set to `false`, the `logOut` method will return the URL to redirect to instead of redirecting automatically. */
    redirect?: R
  }) => Promise<R extends false ? any : never>

  /* The above code is defining a function called `unstable_update` that takes in a parameter `data` of
  type `Partial<Session | { user: Partial<Session["user"]> }>`. This function returns a `Promise` that
  resolves to either a `Session` object or `null`. The function is likely used to update a session
  object with partial data provided in the `data` parameter. */
  update: (
    data: Partial<Session | { user: Partial<Session["user"]> }>
  ) => Promise<Session | null>
}

/**
 *  Initialize NextAuth.js.
 *
 *  @example
 * ```ts title="auth.ts"
 * import NextAuth from "next-auth"
 * import GitHub from "@auth/core/providers/github"
 *
 * export const { handlers, auth } = NextAuth({ providers: [GitHub] })
 * ```
 *
 * Lazy initialization:
 * @example
 * ```ts title="auth.ts"
 * import NextAuth from "next-auth"
 * import GitHub from "@auth/core/providers/github"
 *
 * export const { handlers, auth } = NextAuth((req) => {
 *   console.log(req) // do something with the request
 *   return {
 *     providers: [GitHub],
 *   },
 * })
 * ```
*/
export default function NextAuth(
  config:
    | NextAuthConfig
    | ((request: NextRequest | undefined) => NextAuthConfig)
): NextAuthResult {
  // Common logic for handling config and calling Auth
  const handleConfigAndAuth = async (
    req: NextRequest | undefined, 
    providedConfig?: NextAuthConfig
  ) => {
    const _config = typeof config === "function" ? config(req) : providedConfig ?? config;
    setEnvDefaults(_config);
    return await Auth(req ? reqWithEnvURL(req) : new NextRequest(req ? (req as NextRequest).nextUrl.href : ''), _config);
  };

  // Common logic for handling config and calling logOut
  const handleConfigAndLogOut = async <R extends boolean = true>(
    options?: {
       redirectTo?: string;
       redirect?: R;
    },
    providedConfig?: NextAuthConfig
  ): Promise<R extends false ? any : never> => {
    const _config = typeof config === "function" ? config(undefined) : providedConfig ?? config;
    setEnvDefaults(_config);
    const result = await signout(options, _config);
    if (options?.redirect === false) {
       return result as any;
    } else {
       throw new Error("logOut should not return a value when redirect is not false");
    }
  };

  // Handling configuration and calling Auth for the case when config is a function
  if (typeof config === "function") {
    const httpHandler = async (req: NextRequest) => {
      return await handleConfigAndAuth(req);
    };

    return {
      // Defining handlers for GET and POST methods
      handlers: { GET: httpHandler, POST: httpHandler } as const,
      // Initializing authentication with the provided config and setting environment defaults
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      auth: initAuth(config),
      // Authorizing a user with the provided provider, options, and authorizationParams
      signin: async (provider, options, authorizationParams) => {
        return await signin(provider, options, authorizationParams, config(undefined));
      },
      // Logging out a user with optional redirection options
      signout: handleConfigAndLogOut,
      // Updating user data asynchronously
      update: async (data) => {
        return await update(data, config(undefined));
      },
    };
  }

  // Handling configuration and calling Auth for the case when config is an object
  setEnvDefaults(config);
  const httpHandler = async (req: NextRequest) => {
    return await handleConfigAndAuth(req);
  };

  return {
    // Defining handlers for GET and POST methods
    handlers: { GET: httpHandler, POST: httpHandler } as const,
    // Initializing authentication with the provided config and setting environment defaults
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    auth: initAuth(config),
    // Authorizing a user with the provided provider, options, and authorizationParams
    signin: async (provider, options, authorizationParams) => {
      return await signin(provider, options, authorizationParams, config);
    },
    // Logging out a user with optional redirection options
    signout: handleConfigAndLogOut,
    // Updating user data asynchronously
    update: async (data) => {
      return await update(data, config);
    },
  };
}
