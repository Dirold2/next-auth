import { Auth, createActionURL, type AuthConfig } from "@auth/core";
import { headers } from "next/headers";
import type { GetServerSidePropsContext } from "next";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server"
import type { AppRouteHandlerFn } from "./types";
import { type Awaitable, type AuthAction, type Session } from "@auth/core/types.js";
import { NextResponse } from "next/server.js";
import { reqWithEnvURL } from "./env.js";

/** Configure NextAuth.js. */
export interface NextAuthConfig extends Omit<AuthConfig, "raw"> {
  callbacks?: AuthConfig["callbacks"] & {
    authorized?: (params: {
      request: NextRequest;
      auth: Session | null;
    }) => Awaitable<boolean | NextResponse | Response | undefined>;
  };
}

async function getSession(headers: Headers, config: NextAuthConfig) {
  const envObject = {
    AUTH_URL: process.env.AUTH_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };
  const url = createActionURL("session", "http", headers, envObject, config.basePath);
  const request = new Request(url, {
    headers: { cookie: headers.get("cookie") ?? "" },
  });

  return await Auth(request, {
    ...config,
    callbacks: {
      session: async ({ session, user }) => {
        if (user) {
          session.user = user;
        }
        return await Promise.resolve(session);
      },
    },
  });
}

export interface NextAuthRequest extends NextRequest {
  auth: Session | null;
}

export type NextAuthMiddleware = (
  request: NextAuthRequest,
  event: NextFetchEvent
) => ReturnType<NextMiddleware>;

export type WithAuthArgs =
  | [NextAuthRequest, any]
  | [NextAuthMiddleware]
  | [AppRouteHandlerFn]
  | [GetServerSidePropsContext]
  | [];

function isReqWrapper(arg: any): arg is NextAuthMiddleware | AppRouteHandlerFn {
  return typeof arg === "function";
}

export function initAuth(
  config: NextAuthConfig | ((request: NextRequest | undefined) => NextAuthConfig),
  onLazyLoad?: (config: NextAuthConfig) => void
) {
  if (typeof config === "function") {
    return async (...args: WithAuthArgs) => {
      if (!args.length) {
        const _headers = headers();
        const _config = config(undefined);
        onLazyLoad?.(_config);
        return await getSession(_headers, _config).then(async (r) => await r.json());
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

          for (const cookie of authResponse.headers.getSetCookie())
            if ("headers" in response)
              response.headers.append("set-cookie", cookie)
            else response.appendHeader("set-cookie", cookie)

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

      for (const cookie of authResponse.headers.getSetCookie())
        response.headers.append("set-cookie", cookie)

      return auth satisfies Session | null
    })
  }
}

export async function handleAuth(
  args: Parameters<NextMiddleware | AppRouteHandlerFn>,
  config: NextAuthConfig,
  userMiddlewareOrRoute?: NextAuthMiddleware | AppRouteHandlerFn
) {
  const request = reqWithEnvURL(args[0]);
  const sessionResponse = await getSession(request.headers, config);
  const auth = await sessionResponse.json();

  const authorized = await authorize(request, auth as Session, config);
  const response = await handleAuthorizationResult(authorized, request, args, config, userMiddlewareOrRoute);

  return createFinalResponse(response as Response | NextResponse<unknown>);
}

/**
 * The `authorize` function in TypeScript checks if a specific callback is defined in the configuration
 * and executes it if present.
 * @param {NextRequest} request - The `request` parameter is an object representing the incoming
 * request in a Next.js application. It contains information such as headers, query parameters, body
 * content, and other request details.
 * @param {Session} auth - The `auth` parameter in the `authorize` function represents the session
 * object containing the user's authentication information, such as user ID, roles, and permissions. It
 * is used to determine if the user is authorized to access a particular resource or perform a specific
 * action.
 * @param {NextAuthConfig} config - The `config` parameter in the `authorize` function is of type
 * `NextAuthConfig`. It likely contains configuration settings and options for the authentication
 * process in a Next.js application.
 * @returns The `authorize` function is returning a Promise that resolves to either a boolean value, a
 * `NextResponse` object, a `Response` object, or `undefined`. The function first checks if the
 * `authorized` callback function is defined in the `config.callbacks` object. If it is defined, the
 * function calls the `authorized` callback function with the `request` and `auth` parameters and
 */
async function authorize(
  request: NextRequest,
  auth: Session,
  config: NextAuthConfig
): Promise<boolean | NextResponse | Response | undefined> {
  if (config.callbacks?.authorized) {
    return await config.callbacks.authorized({ request, auth });
  }
  return true;
}

/**
 * The function `handleAuthorizationResult` checks authorization status and handles the result
 * accordingly, including redirecting to a login page if not authorized.
 * @param {boolean | NextResponse | Response | undefined} authorized - The `authorized` parameter in
 * the `handleAuthorizationResult` function can have one of the following types:
 * @param {NextRequest} request - The `request` parameter in the `handleAuthorizationResult` function
 * is of type `NextRequest`. It likely contains information about the incoming HTTP request, such as
 * headers, body, query parameters, and other request details.
 * @param args - The `args` parameter in the `handleAuthorizationResult` function represents the
 * arguments passed to the middleware or route handler function. It is of type
 * `Parameters<NextMiddleware | AppRouteHandlerFn>`, which means it is an array of parameters that the
 * middleware or route handler function expects.
 * @param {NextAuthConfig} config - The `config` parameter in the `handleAuthorizationResult` function
 * likely refers to the configuration object for NextAuth. This object would contain various settings
 * and options related to authentication and authorization within your Next.js application. It could
 * include things like authentication providers, secret keys, session settings, callback URLs, and
 * @param {NextAuthMiddleware | AppRouteHandlerFn} [userMiddlewareOrRoute] - The
 * `userMiddlewareOrRoute` parameter in the `handleAuthorizationResult` function is an optional
 * parameter that can be either a `NextAuthMiddleware` or an `AppRouteHandlerFn`. It is used to provide
 * additional middleware or route handling logic based on the authorization result. If this parameter
 * is provided
 * @returns The function `handleAuthorizationResult` returns either a `Response` object, the result of
 * calling a user-defined middleware or route handler function, a redirection to the login page, or a
 * `NextResponse.next()` if none of the previous conditions are met.
 */
async function handleAuthorizationResult(
  authorized: boolean | NextResponse | Response | undefined,
  request: NextRequest,
  args: Parameters<NextMiddleware | AppRouteHandlerFn>,
  config: NextAuthConfig,
  userMiddlewareOrRoute?: NextAuthMiddleware | AppRouteHandlerFn
): Promise<any> {
  if (authorized instanceof Response) {
    return authorized;
  } else if (userMiddlewareOrRoute) {
    const augmentedReq = request as NextAuthRequest;
    const authResponse = await Auth(request, config);
    const session = await authResponse.json();
    session.expires = new Date(session.expires as string | number);
    augmentedReq.auth = session;
    return (await userMiddlewareOrRoute(augmentedReq, args[1] as NextFetchEvent & AppRouteHandlerFn)) ?? NextResponse.next();
  } else if (!authorized) {
    return redirectToLoginPage(request, config);
  }
  return NextResponse.next();
}

/**
 * The function `redirectToLoginPage` redirects users to the login page if they are not already on the
 * authorized page.
 * @param {NextRequest} request - The `request` parameter is an object representing the incoming
 * request in a Next.js application. It typically contains information about the request, such as the
 * URL, headers, query parameters, and more.
 * @param {NextAuthConfig} config - The `config` parameter in the `redirectToLoginPage` function is of
 * type `NextAuthConfig`. It likely contains configuration settings for the NextAuth module, such as
 * pages configuration, base path, etc.
 * @returns A `NextResponse` object is being returned. If the `request.nextUrl.pathname` is not the
 * authorized page, a redirect response is returned to the authorized page with a callback URL
 * parameter set. Otherwise, a `NextResponse.next()` is returned.
 */
function redirectToLoginPage(request: NextRequest, config: NextAuthConfig): NextResponse {
  const authorizedPage = config.pages?.authorized ?? `${config.basePath}/login`;
  if (request.nextUrl.pathname !== authorizedPage) {
    const authorizedUrl = new URL(authorizedPage, request.nextUrl.origin);
    authorizedUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(authorizedUrl);
  }
  return NextResponse.next();
}

/**
 * The function `createFinalResponse` in TypeScript creates a final response by combining properties
 * from the input `response` object and handling cookies.
 * @param {NextResponse | Response} response - The `response` parameter in the `createFinalResponse`
 * function can be of type `NextResponse` or `Response`.
 * @returns The function `createFinalResponse` returns a `Response` object.
 */
function createFinalResponse(response: NextResponse | Response): Response {
  const finalResponse = new Response(response?.body as BodyInit | null | undefined, {
    status: response?.status,
    statusText: response?.statusText,
    headers: response?.headers,
  });

  if (response.headers) {
    for (const cookie of response.headers.getSetCookie()) {
      finalResponse.headers.append("set-cookie", cookie);
    }
  } else {
    console.error('response.headers is undefined');
  }

  return finalResponse;
}


/**
 * The function `isSameAuthAction` checks if a given redirect path is a valid authentication action and
 * if it is the same as the request path.
 * @param {string} requestPath - The `requestPath` parameter represents the path of the original
 * request made by the user.
 * @param {string} redirectPath - The `redirectPath` parameter represents the path to which the user is
 * being redirected. It is typically the path the user is trying to access after authentication.
 * @param {NextAuthConfig} config - NextAuthConfig is a configuration object used in NextAuth.js, a
 * library for authentication in Next.js applications. It contains various settings and options related
 * to authentication, such as authentication providers, callbacks, pages, and other configurations.
 * @returns The function `isSameAuthAction` returns a boolean value, which is determined by whether the
 * `action` is valid and whether the `redirectPath` is the same as the `requestPath`.
 */
export function isSameAuthAction(
  requestPath: string,
  redirectPath: string,
  config: NextAuthConfig
): boolean {
  const action = redirectPath.replace(`${requestPath}/`, "") as AuthAction;
  const pages = Object.values(config.pages ?? {});
  const isActionValid = actions.has(action) || pages.includes(redirectPath);
  const isSamePath = redirectPath === requestPath;
  return isActionValid && isSamePath;
}


/* The `const actions = new Set<AuthAction>([ ... ])` statement is creating a new Set data structure
named `actions` that contains a list of predefined `AuthAction` values. The `AuthAction` type likely
represents different actions or routes related to authentication and authorization within the
application. By using a Set, it ensures that each action value is unique within the set, preventing
duplicates. This set can be used to check if a specific action or route is valid and allowed within
the authentication flow of the application. */
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
