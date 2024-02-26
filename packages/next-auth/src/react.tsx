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
  SignInAuthorizationParams,
  SignInOptions,
  SignInResponse,
  SignOutParams,
  SignOutResponse,
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
 * React Hook that gives you access to the logged-in user's session data and lets you modify it.
 * You will likely not need `useSession` if you are using the Next.js App Router (`app/`).
 * @param options Options for the hook.
 * @returns An object containing session data and its status.
 */
export function useSession(options?: UseSessionOptions<any>): SessionContextValue {
  // Check if SessionContext is available
  if (!SessionContext) {
    throw new Error("React Context is unavailable in Server Components");
  }

  // Get the context value
  const value: SessionContextValue = React.useContext(SessionContext)!;

  // Throw an error if SessionContext is not provided
  if (!value && process.env.NODE_ENV !== "production") {
    throw new Error("[next-auth]: `useSession` must be wrapped in a <SessionProvider />");
  }

  // Destructure the options or set default values
  const { required, onUnauthenticated } = options ?? {};

  // Check if session is required and not loading
  const requiredAndNotLoading = required && value && value.status === "unauthenticated";

  // Redirect to sign-in page if session is required but not available
  React.useEffect(() => {
    if (requiredAndNotLoading) {
      const url = `${__NEXTAUTH.basePath}/signin?${new URLSearchParams({
        error: "SessionRequired",
        callbackUrl: window.location.href,
      })}`;
      if (onUnauthenticated) onUnauthenticated();
      else window.location.href = url;
    }
  }, [requiredAndNotLoading, onUnauthenticated]);

  // Return session data
  if (requiredAndNotLoading) {
    return {
      data: value.data,
      update: value.update,
      status: "loading",
    };
  }

  return value;
}

/**
 * Retrieves the current session data from the server.
 * @param params Parameters for the request.
 * @returns The session data.
 */
export async function getSession(params?: GetSessionParams): Promise<Session | null> {
  // Fetch session data from the server
  const session = await fetchData<Session>(
    "session",
    __NEXTAUTH,
    logger,
    params
  );

  // Broadcast session data to other tabs/windows
  if (params?.broadcast ?? true) {
    broadcast().postMessage({
      event: "session",
      data: { trigger: "getSession" },
    });
  }

  return session;
}

/**
 * Returns the current Cross-Site Request Forgery Token (CSRF Token)
 * required to make requests that changes state. (e.g. signing in or out, or updating the session).
 *
 * [CSRF Prevention: Double Submit Cookie](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
 */
export async function getCsrfToken(): Promise<string> {
  const response = await fetchData<{ csrfToken: string }>(
    "csrf",
    __NEXTAUTH,
    logger
  )
  return response?.csrfToken ?? ""
}

/**
 * Returns a client-safe configuration object of the currently
 * available providers.
 */
export async function getProviders(): Promise<ProvidersType | null> {
  return await fetchData<ProvidersType>("providers", __NEXTAUTH, logger)
}

/**
 * Initiate a signin flow or send the user to the signin page listing all possible providers.
 * Handles CSRF protection.
 */
export async function signIn(
  provider?: string,
  options?: SignInOptions,
  authorizationParams?: SignInAuthorizationParams
): Promise<SignInResponse | undefined> {
  const { callbackUrl = window.location.href, redirect = true } = options ?? {}

  const baseUrl = apiBaseUrl(__NEXTAUTH)
  const providers = await getProviders()

  if (!providers) {
    window.location.href = `${baseUrl}/error`
    return
  }

  if (!provider || !(provider in providers)) {
    window.location.href = `${baseUrl}/signin?${new URLSearchParams({
      callbackUrl,
    })}`
    return
  }

  const isCredentials = providers[provider].type === "credentials"
  const isEmail = providers[provider].type === "email"
  const isSupportingReturn = isCredentials || isEmail

  const signInUrl = `${baseUrl}/${
    isCredentials ? "callback" : "signin"
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
        ...options,
        csrfToken,
        callbackUrl,
        redirect: String(options?.redirect ?? 'false'),
      }).toString(),
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

  const error = typeof data.url === 'string' ? (() => {
    try {
      return new URL(data.url as string).searchParams.get("error");
    } catch (e) {
      if (e instanceof Error) {
        logger.error(e);
      } else {
        logger.error(new Error(String(e)));
      }
      return null;
    }
  })() : null;

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
 * Initiate a signout, by destroying the current session.
 * Handles CSRF protection.
 */
export async function signOut(options?: SignOutParams): Promise<SignOutResponse | undefined> {
  const { callbackUrl = window.location.href } = options ?? {}
  const baseUrl = apiBaseUrl(__NEXTAUTH)
  const csrfToken = await getCsrfToken()
  const res = await fetch(`${baseUrl}/signout`, {
    method: "post",
    headers: {
      "Content-Type": "application/x-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({ csrfToken, callbackUrl }),
  })
  const data = await res.json()

  broadcast().postMessage({ event: "session", data: { trigger: "signout" } })

  if (options?.redirect ?? true) {
    const url = data.url ?? callbackUrl
    window.location.href = url
    // If url contains a hash, the browser does not reload the page. We reload manually
    if (url.includes("#")) window.location.reload()
    return undefined;
  }

  await __NEXTAUTH._getSession({ event: "storage" })

  return data;
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
    __NEXTAUTH._getSession = async (...args: unknown[]) => {
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
    if (online) __NEXTAUTH._getSession()
  }, [online])

  React.useEffect(() => {
    if (refetchInterval && refetchInterval > 0 && !loading) {
      const interval = setInterval(__NEXTAUTH._getSession, refetchInterval)
      return () => { clearInterval(interval); }
    }
  }, [loading, refetchInterval])

  return (
    <SessionContext.Provider
      value={{
        data: session ?? null,
        status: loading ? "loading" : session ? "authenticated" : "unauthenticated",
        update: async (data) => {
          if (data === undefined) {
            await signOut()
            return null
          }
          const updatedSession = await getSession()
          setSession(updatedSession)
          return updatedSession
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}