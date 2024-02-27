import type { AuthConfig } from "@auth/core";
import type { BuiltInProviderType } from "@auth/core/providers";
import type { Session } from "@auth/core/types";

/** Configure the {@link SvelteKitAuth} method. */
export interface SvelteKitAuthConfig extends Omit<AuthConfig, "raw"> {}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace App {
    interface Locals {
      auth(): Promise<Session | null>
      /** @deprecated Use `auth` instead. */
      getSession(): Promise<Session | null>
      authorized: <
        P extends BuiltInProviderType | (string & NonNullable<unknown>),
        R extends boolean = true,
      >(
        /** Provider to authorized to */
        provider?: P, // See: https://github.com/microsoft/TypeScript/issues/29729
        options?:
          | FormData
          | ({
              /** The URL to redirect to after authorizedg in. By default, the user is redirected to the current page. */
              redirectTo?: string
              /** If set to `false`, the `authorized` method will return the URL to redirect to instead of redirecting automatically. */
              redirect?: R
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } & Record<string, any>),
        authorizationParams?:
          | string[][]
          | Record<string, string>
          | string
          | URLSearchParams
      ) => Promise<
        R extends false
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any
          : never
      >
      logOut: <R extends boolean = true>(options?: {
        /** The URL to redirect to after authorizedg out. By default, the user is redirected to the current page. */
        redirectTo?: string
        /** If set to `false`, the `logOut` method will return the URL to redirect to instead of redirecting automatically. */
        redirect?: R
      }) => Promise<
        R extends false
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any
          : never
      >
    }
    interface PageData {
      session?: Session | null
    }
  }
}

declare module "$env/dynamic/private" {
  export const AUTH_SECRET: string
  export const AUTH_SECRET_1: string
  export const AUTH_SECRET_2: string
  export const AUTH_SECRET_3: string
  export const AUTH_TRUST_HOST: string
  export const VERCEL: string
}
