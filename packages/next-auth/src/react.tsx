/**
 * NextAuth.js methods and components that work in Client components and the Pages Router.
 * For use in Server Actions, check out these methods.
 * @module react
 */

"use client";

import * as React from "react";
import {
  apiBaseUrl,
  fetchData,
  now,
  parseUrl,
  useOnline,
} from "./lib/client.js";

import type {
  BuiltInProviderType,
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
  AuthorizedParams,
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
  options?: AuthorizedParams<R>
): Promise<R extends true ? undefined : AuthorizedParams> {
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
        return undefined as R extends true ? undefined : AuthorizedParams;
      }

      await __NEXTAUTH._getSession({ event: "storage" });
      return data;
    } else {
      throw new Error("Failed to log out");
    }
  } catch (error) {
    console.error("[next-auth] Error during logout:", error);
    return null as unknown as R extends true ? undefined : AuthorizedParams;
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
export async function authorized(
  provider?: string,
  options?: AuthorizedOptions,
  authorizationParams?: SiAuthorizedParams
): Promise<AuthorizedResponse | undefined> {
  try {
    const { callbackUrl = window.location.href, redirect = true } = options ?? {}

    const baseUrl = apiBaseUrl(__NEXTAUTH)
    const providers = await getProviders()

    if (!providers) {
      throw new Error('Failed to fetch providers');
    }

    if (!provider || !(provider in providers)) {
      throw new Error('Invalid or missing provider');
    }

    const isCredentials = providers[provider].type === "credentials"
    const isEmail = providers[provider].type === "email"
    const isSupportingReturn = isCredentials || isEmail

    const logInUrl = `${baseUrl}/${isCredentials ? "callback" : "signin"}/${provider}`

    console.log(provider)

    const csrfToken = await getCsrfToken()
    const res = await fetch(
      `${logInUrl}?${new URLSearchParams(authorizationParams as Record<string, string>)}`,
      {
        method: "post",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Auth-Return-Redirect": "1",
        },
        body: new URLSearchParams({
          ...options,
          csrfToken,
          callbackUrl,
          redirect: String(options?.redirect ?? false),
        }).toString(),
      }
    )

    const data = await res.json()

    if ((redirect || !isSupportingReturn) && options?.redirect !== false) {
      const url = data.url ?? callbackUrl;
      if (isCredentials && !isEmail) {
        if (url.includes("#")) window.location.reload();
        window.location.href = url;
      }
      return;
    }

    const error = typeof data.url === 'string' ? new URL(data.url as string).searchParams.get("error") : null;

    if (res.ok) {
      await __NEXTAUTH._getSession({ event: "storage" })
    }

    return {
      error,
      status: res.status,
      ok: res.ok,
      url: error ? null : data.url,
    } as any

  } catch (error) {
    console.error("[next-auth] Error during authorization:", error);
    logger.error(error as Error);
    return undefined;
  }
}


/**
 * [React Context](https://react.dev/learn/passing-data-deeply-with-context) provider to wrap the app (`pages/`) to make session data available anywhere.
 *
 * When used, the session state is automatically synchronized across all open tabs/windows and they are all updated whenever they gain or lose focus
 * or the state changes (e.g. a user signs in or out) when {@link SessionProviderProps.refetchOnWindowFocus} is `true`.
 *
 * :::info
 * You will likely not need `SessionProvider` if you are using the [Next.js App Router (`app/`)](https://nextjs.org/blog/next-13-4#nextjs-app-router).
 * :::
*/
export function SessionProvider(props: SessionProviderProps) {
  if (!SessionContext) {
    throw new Error("React Context is unavailable in Server Components")
  }

  const { children, basePath, refetchInterval } = props

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
  const [loading] = React.useState(!hasInitialSession)

  React.useEffect(() => {
    __NEXTAUTH._getSession = async (...args: [any?]) => {
      if (args[0] && typeof args[0] === 'object') {
        const { event } = args[0] as { event?: any };
        try {
          const storageEvent = event === "storage";
          // We should always update if we don't have a client session yet
          // or if there are events from other tabs/windows
          if (storageEvent || __NEXTAUTH._session === undefined) {
            __NEXTAUTH._lastSync = now();
            __NEXTAUTH._session = await getSession({
              broadcast: !storageEvent,
            });
            setSession(__NEXTAUTH._session);
            return;
          }

          if (
            // If there is no time defined for when a session should be considered
            // stale, then it's okay to use the value we have until an event is
            // triggered which updates it
            !refetchInterval ||
            // If the session is new, it's okay to use it until a refresh happens
            (__NEXTAUTH._session?.user as any)?.created &&
            // If we're within the window to revalidate, then do nothing
            now() - __NEXTAUTH._lastSync < refetchInterval
          ) {
            return;
          }

          __NEXTAUTH._lastSync = now();
          const updatedSession = await getSession();
          setSession(updatedSession);
        } catch (error) {
          if (
            process.env.NODE_ENV !== "production" &&
            process.env.NODE_ENV !== "test"
          ) {
            console.error("[next-auth][error]", error);
          }
        }
      }
    };
  }, [])

  const online = useOnline();

  React.useEffect(() => {
    if (online && !loading) {
      __NEXTAUTH._getSession();
    }
  }, [online, loading]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (refetchInterval && refetchInterval > 0 && !loading) {
      interval = setInterval(() => {
        __NEXTAUTH._getSession();
      }, refetchInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, refetchInterval]);

  return (
    <SessionContext.Provider
      value={{
        data: session ?? null,
        status: loading ? "loading" : session ? "authenticated" : "unauthenticated",
        update: async (data: Partial<Session> | undefined): Promise<Session | null> => {
          try {
            if (data === undefined) {
              await logOut();
              return null;
            }
            const updatedSession = await getSession();
            setSession(updatedSession);
            return updatedSession;
          } catch (error) {
            console.error("[next-auth] Error updating session:", error);
            return null;
          }
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}