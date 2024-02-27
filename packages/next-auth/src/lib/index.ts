import { Auth, type AuthConfig } from "@auth/core"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { reqWithEnvURL } from "./env.js"
import { createActionURL } from "./actions.js"

import type { AuthAction, Awaitable, Session } from "@auth/core/types"
import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next"
import type { AppRouteHandlerFn } from "./types.js"
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server"

/** Configure NextAuth.js. */
export interface NextAuthConfig extends Omit<AuthConfig, "raw"> {
  /**
   * Callbacks are asynchronous functions you can use to control what happens when an auth-related action is performed.
   * Callbacks **allow you to implement access controls without a database** or to **integrate with external databases or APIs**.
   */
  callbacks?: AuthConfig["callbacks"] & {
    /**
     * Invoked when a user needs authorization, using [Middleware](https://nextjs.org/docs/advanced-features/middleware).
     *
     * You can override this behavior by returning a {@link NextResponse}.
     *
     * @example
     * ```ts title="app/auth.ts"
     * ...
     * async authorized({ request, auth }) {
     *   const url = request.nextUrl
     *
     *   if(request.method === "POST") {
     *     const { authToken } = (await request.json()) ?? {}
     *     // If the request has a valid auth token, it is authorized
     *     const valid = await validateAuthToken(authToken)
     *     if(valid) return true
     *     return NextResponse.json("Invalid auth token", { status: 401 })
     *   }
     *
     *   // Logged in users are authenticated, otherwise redirect to login page
     *   return !!auth.user
     * }
     * ...
     * ```
     *
     * :::warning
     * If you are returning a redirect response, make sure that the page you are redirecting to is not protected by this callback,
     * otherwise you could end up in an infinite redirect loop.
     * :::
     */
    authorized?: (params: {
      /** The request to be authorized. */
      request: NextRequest
      /** The authenticated user or token, if any. */
      auth: Session | null
    }) => Awaitable<boolean | NextResponse | Response | undefined>
  }
}

async function getSession(headers: Headers, config: NextAuthConfig) {
  const url = createActionURL("session", headers, config.basePath)
  const request = new Request(url, {
    headers: { cookie: headers.get("cookie") ?? "" },
  })

  return await (Auth(request, {
    ...config,
    callbacks: {
      session: async ({ session, user }) => {
        if (user) {
          session.user = user;
        }
        return await Promise.resolve(session);
      },
    }
  }))
}

export interface NextAuthRequest extends NextRequest {
  auth: Session | null
}

export type NextAuthMiddleware = (
  request: NextAuthRequest,
  event: NextFetchEvent
) => ReturnType<NextMiddleware>

export type WithAuthArgs =
  | [NextAuthRequest, any]
  | [NextAuthMiddleware]
  | [AppRouteHandlerFn]
  | [NextApiRequest, NextApiResponse]
  | [GetServerSidePropsContext]
  | []

function isReqWrapper(arg: any): arg is NextAuthMiddleware | AppRouteHandlerFn {
  return typeof arg === "function"
}

export function initAuth(
  config:
    | NextAuthConfig
    | ((request: NextRequest | undefined) => NextAuthConfig),
  onLazyLoad?: (config: NextAuthConfig) => void
) {
  if (typeof config === "function") {
    return async (...args: WithAuthArgs) => {
      if (!args.length) {
        // React Server Components
        const _headers = headers()
        const _config = config(undefined) // Review: Should we pass headers() here instead?
        onLazyLoad?.(_config)

        return await getSession(_headers, _config).then(async (r) => await r.json())
      }

      if (args[0] instanceof Request) {
        // middleware.ts inline
        // export { auth as default } from "auth"
        const req = args[0]
        const ev = args[1]
        const _config = config(req)
        onLazyLoad?.(_config)

        // args[0] is supposed to be NextRequest but the instanceof check is failing.
        return await handleAuth([req, ev], _config)
      }

      if (isReqWrapper(args[0])) {
        // middleware.ts wrapper/route.ts
        // import { auth } from "auth"
        // export default auth((req) => { console.log(req.auth) }})
        const userMiddlewareOrRoute = args[0]
        return async (
          ...args: Parameters<NextAuthMiddleware | AppRouteHandlerFn>
        ) => {
          return await handleAuth(args, config(args[0]), userMiddlewareOrRoute)
        }
      }
      // API Routes, getServerSideProps
      const request = "req" in args[0] ? args[0].req : args[0]
      const response: any = "res" in args[0] ? args[0].res : args[1]
      // @ts-expect-error -- request is NextRequest
      const _config = config(request)
      onLazyLoad?.(_config)

      // @ts-expect-error -- request is NextRequest
      return await getSession(new Headers(request.headers), _config).then(
        async (authResponse) => {
          const auth = await authResponse.json()

          if (response.headers) {
            for (const cookie of authResponse.headers.getSetCookie()) {
              response.headers.append("set-cookie", cookie);
            }
          } else {
            console.error('response.headers is undefined');
          }

          return auth satisfies Session | null
        }
      )
    }
  }
  return async (...args: WithAuthArgs) => {
    if (!args.length) {
      // React Server Components
      return await getSession(headers(), config).then(async (r) => await r.json())
    }
    if (args[0] instanceof Request) {
      // middleware.ts inline
      // export { auth as default } from "auth"
      const req = args[0]
      const ev = args[1]
      return await handleAuth([req, ev], config)
    }

    if (isReqWrapper(args[0])) {
      // middleware.ts wrapper/route.ts
      // import { auth } from "auth"
      // export default auth((req) => { console.log(req.auth) }})
      const userMiddlewareOrRoute = args[0]
      return async (
        ...args: Parameters<NextAuthMiddleware | AppRouteHandlerFn>
      ) => {
        return await handleAuth(args, config, userMiddlewareOrRoute).then((res) => {
          return res
        })
      }
    }

    // API Routes, getServerSideProps
    const request = "req" in args[0] ? args[0].req : args[0]
    const response: any = "res" in args[0] ? args[0].res : args[1]

    return await getSession(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      new Headers(request.headers),
      config
    ).then(async (authResponse) => {
      const auth = await authResponse.json()

      if (response.headers) {
        for (const cookie of authResponse.headers.getSetCookie()) {
          response.headers.append("set-cookie", cookie);
        }
      } else {
        console.error('response.headers is undefined');
      }

      return auth satisfies Session | null
    })
  }
}

async function handleAuth(
  args: Parameters<NextMiddleware | AppRouteHandlerFn>,
  config: NextAuthConfig,
  userMiddlewareOrRoute?: NextAuthMiddleware | AppRouteHandlerFn
) {
  const request = reqWithEnvURL(args[0])
  const sessionResponse = await getSession(request.headers, config)
  const auth = await sessionResponse.json()

  let authorized: boolean | NextResponse | Response | undefined = true

  if (config.callbacks?.authorized) {
    authorized = await config.callbacks.authorized({ request, auth })
  }

  let response: any = NextResponse.next?.()

  if (authorized instanceof Response) {
    // User returned a custom response, like redirecting to a page or 401, respect it
    response = authorized

    const redirect = authorized.headers.get("Location")
    const { pathname } = request.nextUrl
    // If the user is redirecting to the same NextAuth.js action path as the current request,
    // don't allow the redirect to prevent an infinite loop
    if (
      redirect &&
      isSameAuthAction(pathname, new URL(redirect).pathname, config)
    ) {
      authorized = true
    }
  } else if (userMiddlewareOrRoute) {
    // Execute user's middleware/handler with the augmented request
    const augmentedReq = request as NextAuthRequest
    augmentedReq.auth = auth
    response =
    (await userMiddlewareOrRoute(augmentedReq, args[1] as NextFetchEvent & AppRouteHandlerFn)) ??
      NextResponse.next()
  } else if (!authorized) {
    const authorizedPage = config.pages?.authorized ?? `${config.basePath}/login`
    if (request.nextUrl.pathname !== authorizedPage) {
      // Redirect to authorized page by default if not authorized
      const authorizedUrl = request.nextUrl.clone()
      authorizedUrl.pathname = authorizedPage
      authorizedUrl.searchParams.set("callbackUrl", request.nextUrl.href)
      response = NextResponse.redirect(authorizedUrl)
    }
  }

  const finalResponse = new Response(response?.body as BodyInit | null | undefined, {
    status: response?.status,
    statusText: response?.statusText,
    headers: response?.headers,
  });
  
  // Preserve cookies from the session response
  if (response.headers) {
    for (const cookie of response.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
  } else {
    console.error('response.headers is undefined');
  }
  return finalResponse
}

function isSameAuthAction(
  requestPath: string,
  redirectPath: string,
  config: NextAuthConfig
) {
  const action = redirectPath.replace(`${requestPath}/`, "") as AuthAction
  const pages = Object.values(config.pages ?? {})

  return (
    (actions.has(action) || pages.includes(redirectPath)) &&
    redirectPath === requestPath
  )
}

const actions = new Set<AuthAction>([
  "providers",
  "session",
  "csrf",
  "authorized",
  "logout",
  "callback",
  "verify-request",
  "error",
])
