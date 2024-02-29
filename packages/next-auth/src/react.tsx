/**
 * NextAuth.js methods and components that work in Client components and the Pages Router.
 * For use in Server Actions, check out these methods.
 * @module react
 */

"use client";

import * as React from "react";
import {
  ClientSessionError,
  apiBaseUrl,
  fetchData,
  now,
  parseUrl,
  useOnline,
} from "./lib/client.js";

import type {
  BuiltInProviderType,
  RedirectableProviderType,
} from "../../core/providers";
import type { LoggerInstance, Session } from "../../core/types";
import type {
  AuthClientConfig,
  ClientSafeProvider,
  LiteralUnion,
  SessionProviderProps,
  SiAuthorizedParams,
  AuthorizedOptions,
  AuthorizedResponse,
  LogOutParams,
  UseSessionOptions,
} from "./lib/client.js";

// Define the structure of the context value returned by useSession hook
export interface SessionContextValue {
  update: UpdateSession;
  data: Session | null;
  status: "authenticated" | "unauthenticated" | "loading";
}

// Create a context for session data
export const SessionContext = React.createContext<SessionContextValue | undefined>(undefined);

// Define the function signature for updating session data
export type UpdateSession = (data?: any) => Promise<Session | null>;

// Define the parameters for the getSession function
export interface GetSessionParams {
  event?: "storage" | "timer" | "hidden" | string;
  triggerEvent?: boolean;
  broadcast?: boolean;
}

// Define the structure of the providers object
type ProvidersType = Record<LiteralUnion<BuiltInProviderType>, ClientSafeProvider>;

// Define the configuration object for NextAuth.js
export const __NEXTAUTH: AuthClientConfig = {
  baseUrl: parseUrl(process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL).origin,
  basePath: parseUrl(process.env.NEXTAUTH_URL).path,
  baseUrlServer: parseUrl(
    process.env.NEXTAUTH_URL_INTERNAL ??
      process.env.NEXTAUTH_URL ??
      process.env.VERCEL_URL
  ).origin,
  basePathServer: parseUrl(
    process.env.NEXTAUTH_URL_INTERNAL ?? process.env.NEXTAUTH_URL
  ).path,
  _lastSync: 0,
  _session: undefined,
  _getSession: () => {},
};

// Function to create a broadcast channel
function broadcast() {
  if (typeof BroadcastChannel !== "undefined") {
    return new BroadcastChannel("next-auth");
  }
  return {
    postMessage: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// Logger instance for logging messages
const logger: LoggerInstance = {
  debug: console.debug,
  error: console.error,
  warn: console.warn,
};


/**
 * The function `useSession` in TypeScript React is used to manage session state and handle
 * authentication logic.
 * @param [options] - The `options` parameter in the `useSession` function is an optional object that
 * can contain the following properties:
 * @returns The `useSession` function returns the session context value. If the session is required and
 * not loading, it returns an object with the session data, update function, and status set to
 * "loading". Otherwise, it returns the actual session context value.
 */
export function useSession(options?: UseSessionOptions<any>): SessionContextValue {
  // Check if SessionContext is available
  const value: SessionContextValue | undefined = React.useContext(SessionContext);

  // Return loading state if context is not available
  if (!value) {
    return { data: null, update: async () => await Promise.resolve(null), status: "loading" };
  }

  const { required, onUnauthenticated } = options ?? {};

  // Check if session is required and not available
  const requiredAndNotLoading = required && value.status === "unauthenticated";

  React.useEffect(() => {
    if (requiredAndNotLoading && onUnauthenticated) {
      const url = `${__NEXTAUTH.basePath}/login?${new URLSearchParams({
        error: "SessionRequired",
        callbackUrl: window.location.href,
      })}`;
      onUnauthenticated(url);
    }
  }, [requiredAndNotLoading, onUnauthenticated]);

  // Return session data
  if (requiredAndNotLoading) {
    return { data: value.data, update: value.update, status: "loading" };
  }

  return value;
}



/**
 * The function `getSession` fetches a session data and broadcasts a message if specified.
 * @param {GetSessionParams} [params] - The `params` parameter in the `getSession` function is an
 * optional parameter of type `GetSessionParams`. It is used to pass additional parameters to customize
 * the behavior of the session retrieval process.
 * @returns The `getSession` function is returning a `Promise` that resolves to either a `Session`
 * object or `null`.
 */
export async function getSession(params?: GetSessionParams): Promise<Session | null> {
  try {
    const session = await fetchData<Session>(
      "session",
      __NEXTAUTH,
      logger,
      params
    );

    if (params?.broadcast ?? true) {
      broadcast().postMessage({
        event: "session",
        data: { trigger: "getSession" },
      });
    }

    return session;
  } catch (error) {
    console.error("[next-auth] Error fetching session:", error);
    return null;
  }
}

/**
 * Returns the current Cross-Site Request Forgery Token (CSRF Token)
 * required to make requests that changes state. (e.g. signing in or out, or updating the session).
 *
 * [CSRF Prevention: Double Submit Cookie](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
*/
export async function getCsrfToken() {
  const response = await fetchData<{ csrfToken: string }>(
    "csrf",
    __NEXTAUTH,
    logger
  )
  return response?.csrfToken ?? ""
}


/**
 * This function asynchronously fetches providers data using TypeScript in a React application.
 * @returns The `getProviders` function is returning a Promise that resolves to either a
 * `ProvidersType` object or `null`. The function is fetching data of type `ProvidersType` from the
 * "providers" endpoint using the `fetchData` function, `__NEXTAUTH`, and `logger`.
 */
export async function getProviders(): Promise<ProvidersType | null> {
  return await fetchData<ProvidersType>("providers", __NEXTAUTH, logger)
}


/**
 * The `logOut` function in TypeScript React handles user logout by sending a POST request to the
 * server and updating the session accordingly.
 * @param [options] - The `options` parameter in the `logOut` function is an object that contains
 * optional parameters for the logout operation. It has the following properties:
 * @returns The `logOut` function returns a Promise that resolves to either `undefined` or
 * `AuthorizedParams` based on the generic type `R`. If `R` is `true`, it returns `undefined`,
 * otherwise it returns `AuthorizedParams`.
 */
export async function logOut<R extends boolean = true>(
  options?: LogOutParams<R>
): Promise<R extends true ? undefined : LogOutParams> {
  try {
    const { callbackUrl = window.location.href } = options ?? {};
    const baseUrl = apiBaseUrl(__NEXTAUTH);
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${baseUrl}/logout`, {
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        "X-CSRF-Token": csrfToken,
      },
      body: new URLSearchParams({ csrfToken, callbackUrl }),
    });

    if (res.ok) {
      const data = await res.json();
      broadcast().postMessage({ event: "session", data: { trigger: "logout" } });
      
      if (options?.redirect !== false) {
        const url = data.url ?? callbackUrl;
        window.location.href = url;
        if (url.includes("#")) window.location.reload();
        return undefined as R extends true ? undefined : LogOutParams;
      }

      await __NEXTAUTH._getSession({ event: "storage" });
      return data;
    } else {
      throw new Error("Failed to log out");
    }
  } catch (error) {
    console.error("[next-auth] Error during logout:", error);
    return null as unknown as R extends true ? undefined : LogOutParams;
  }
}

/**
 * The function `authorized` in TypeScript React handles authorization with different providers and
 * options, including fetching providers, generating login URLs, and processing authorization
 * responses.
 * @param {string} [provider] - The `provider` parameter in the `authorized` function is used to
 * specify the authentication provider that the user wants to authorize with. It is a string that
 * represents the name of the provider. This could be a social provider like Google, Facebook, or a
 * custom provider like credentials or email.
 * @param {AuthorizedOptions} [options] - The `options` parameter in the `authorized` function is an
 * object that can contain the following properties:
 * @param {SiAuthorizedParams} [authorizationParams] - The `authorizationParams` parameter in the
 * `authorized` function is used to pass additional parameters for the authorization process. These
 * parameters are typically specific to the authentication provider being used and may include things
 * like client IDs, scopes, or any other necessary information for authentication.
 * @returns The `authorized` function returns a Promise that resolves to an `AuthorizedResponse` object
 * or `undefined`. The `AuthorizedResponse` object contains properties such as `error`, `status`, `ok`,
 * and `url`. If an error occurs during the authorization process, the function will catch the error,
 * log it, and return `undefined`.
 */
export async function authorized<
  P extends RedirectableProviderType | undefined = undefined,
>(
  provider?: LiteralUnion<
    P extends RedirectableProviderType
      ? P | BuiltInProviderType
      : BuiltInProviderType
  >,
  options?: AuthorizedOptions,
  authorizationParams?: SiAuthorizedParams
): Promise<
  P extends RedirectableProviderType ? AuthorizedResponse | undefined : undefined
> {
  const { callbackUrl = window.location.href, redirect = true } = options ?? {}

  const baseUrl = apiBaseUrl(__NEXTAUTH)
  const providers = await getProviders()

  if (!providers) {
    window.location.href = `${baseUrl}/error`
    return
  }

  if (!provider || !(provider in providers)) {
    window.location.href = `${baseUrl}/authorized?${new URLSearchParams({
      callbackUrl,
    })}`
    return
  }

  const isCredentials = providers[provider].type === "credentials"
  const isEmail = providers[provider].type === "email"
  const isSupportingReturn = isCredentials || isEmail

  const signInUrl = `${baseUrl}/${
    isCredentials ? "callback" : "authorized"
  }/${provider}`

  const csrfToken = await getCsrfToken()
  const res = await fetch(
    `${signInUrl}?${new URLSearchParams(authorizationParams)}`,
    {
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({
        ...Object.entries(options ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {}),
        csrfToken,
        callbackUrl,
      }),
    }
  )

  const data = await res.json()

  // TODO: Do not redirect for Credentials and Email providers by default in next major
  if (redirect || !isSupportingReturn) {
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

/**
 * The `SessionProvider` function in TypeScript React manages session state, including fetching and
 * updating session data based on various events and intervals.
 * @param {SessionProviderProps} props - - session: The current session data
 * @returns The `SessionProvider` component is returning the `SessionContext.Provider` component with a
 * `value` prop that contains the session data, loading status, and an `update` function. The children
 * of the `SessionProvider` component are rendered inside the `SessionContext.Provider`.
 */
export function SessionProvider(props: SessionProviderProps) {
  if (!SessionContext) {
    throw new Error("React Context is unavailable in Server Components")
  }

  const { children, basePath, refetchInterval, refetchWhenOffline } = props

  if (basePath) __NEXTAUTH.basePath = basePath

  /**
   * If session was `null`, there was an attempt to fetch it,
   * but it failed, but we still treat it as a valid initial value.
   */
  const hasInitialSession = props.session !== undefined

  /** If session was passed, initialize as already synced */
  __NEXTAUTH._lastSync = hasInitialSession ? now() : 0

  const [session, setSession] = React.useState(() => {
    if (hasInitialSession) __NEXTAUTH._session = props.session
    return props.session
  })

  /** If session was passed, initialize as not loading */
  const [loading, setLoading] = React.useState(!hasInitialSession)

  React.useEffect(() => {
    __NEXTAUTH._getSession = async ({ event } = {}) => {
      try {
        const storageEvent = event === "storage"
        // We should always update if we don't have a client session yet
        // or if there are events from other tabs/windows
        if (storageEvent || __NEXTAUTH._session === undefined) {
          __NEXTAUTH._lastSync = now()
          __NEXTAUTH._session = await getSession({
            broadcast: !storageEvent,
          })
          setSession(__NEXTAUTH._session)
          return
        }

        if (
          // If there is no time defined for when a session should be considered
          // stale, then it's okay to use the value we have until an event is
          // triggered which updates it
          !event ||
          // If the client doesn't have a session then we don't need to call
          // the server to check if it does (if they have signed in via another
          // tab or window that will come through as a "stroage" event
          // event anyway)
          __NEXTAUTH._session === null ||
          // Bail out early if the client session is not stale yet
          now() < __NEXTAUTH._lastSync
        ) {
          return
        }

        // An event or session staleness occurred, update the client session.
        __NEXTAUTH._lastSync = now()
        __NEXTAUTH._session = await getSession()
        setSession(__NEXTAUTH._session)
      } catch (error) {
        logger.error(
          new ClientSessionError((error as Error).message, { err: error })
        )
      } finally {
        setLoading(false)
      }
    }

    __NEXTAUTH._getSession()

    return () => {
      __NEXTAUTH._lastSync = 0
      __NEXTAUTH._session = undefined
      __NEXTAUTH._getSession = () => {}
    }
  }, [])

  React.useEffect(() => {
    const handle = () => __NEXTAUTH._getSession({ event: "storage" })
    // Listen for storage events and update session if event fired from
    // another window (but suppress firing another event to avoid a loop)
    // Fetch new session data but tell it to not to fire another event to
    // avoid an infinite loop.
    // Note: We could pass session data through and do something like
    // `setData(message.data)` but that can cause problems depending
    // on how the session object is being used in the client; it is
    // more robust to have each window/tab fetch it's own copy of the
    // session object rather than share it across instances.
    broadcast().addEventListener("message", handle)
    return () => { broadcast().removeEventListener("message", handle); }
  }, [])

  React.useEffect(() => {
    const { refetchOnWindowFocus = true } = props
    // Listen for when the page is visible, if the user switches tabs
    // and makes our tab visible again, re-fetch the session, but only if
    // this feature is not disabled.
    const visibilityHandler = () => {
      if (refetchOnWindowFocus && document.visibilityState === "visible")
        __NEXTAUTH._getSession({ event: "visibilitychange" })
    }
    document.addEventListener("visibilitychange", visibilityHandler, false)
    return () =>
      { document.removeEventListener("visibilitychange", visibilityHandler, false); }
  }, [props.refetchOnWindowFocus])

  const isOnline = useOnline()
  // TODO(done): Flip this behavior in next major version
  const shouldRefetch = refetchWhenOffline !== false || isOnline

  React.useEffect(() => {
    if (refetchInterval && shouldRefetch) {
      const refetchIntervalTimer = setInterval(() => {
        if (__NEXTAUTH._session) {
          __NEXTAUTH._getSession({ event: "poll" })
        }
      }, refetchInterval * 1000)
      return () => { clearInterval(refetchIntervalTimer); }
  }
    return () => {};
  }, [refetchInterval, shouldRefetch])

  const value: any = React.useMemo(
    () => ({
      data: session,
      status: loading
        ? "loading"
        : session
          ? "authenticated"
          : "unauthenticated",
      async update(data: any) {
        if (loading || !session) return
        setLoading(true)
        const newSession = await fetchData<Session>(
          "session",
          __NEXTAUTH,
          logger,
          typeof data === "undefined"
            ? undefined
            : { body: { csrfToken: await getCsrfToken(), data } }
        )
        setLoading(false)
        if (newSession) {
          setSession(newSession)
          broadcast().postMessage({
            event: "session",
            data: { trigger: "getSession" },
          })
        }
        return newSession
      },
    }),
    [session, loading]
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}