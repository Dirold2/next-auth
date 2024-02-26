import { renderToString } from "preact-render-to-string"
import ErrorPage from "./error.js"
import authorizedPage from "./login.js"
import SignoutPage from "./signout.js"
import css from "./styles.js"
import VerifyRequestPage from "./verify-request.js"
import { UnknownAction } from "../../errors.js"

import type {
  InternalOptions,
  RequestInternal,
  ResponseInternal,
  InternalProvider,
  PublicProvider,
} from "../../types.js"
import type { Cookie } from "../utils/cookie.js"
import { type VNode } from "preact"

interface VerifyRequestPageProps {
  url: URL;
  theme: any;
}

function send({
  html,
  title,
  status,
  cookies,
  theme,
  headTags,
}: {
  html: VNode;
  title: string;
  status: number;
  cookies: any; 
  theme: any;
  headTags: string | undefined;
}): ResponseInternal {
  return {
    cookies,
    status,
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}</style><title>${title}</title>${
      headTags ?? ""
    }</head><body class="__next-auth-theme-${
      theme?.colorScheme ?? "auto"
    }"><div class="page">${renderToString(html)}</div></body></html>`,
  }
}

type RenderPageParams = {
  query?: RequestInternal["query"]
  cookies?: Cookie[]
} & Partial<
  Pick<
    InternalOptions,
    "url" | "callbackUrl" | "csrfToken" | "providers" | "theme" | "pages"
  >
>

/**
 * Unless the user defines their [own pages](https://authjs.dev/reference/core#pages),
 * we render a set of default ones, using Preact SSR.
 */
export default function renderPage(params: RenderPageParams) {
  const { url, theme, query, cookies, pages, providers } = params

  return {
    csrf(skip: boolean, options: InternalOptions, cookies: Cookie[]) {
      if (!skip) {
        return {
          headers: { "Content-Type": "application/json" },
          body: { csrfToken: options.csrfToken },
          cookies,
        }
      }
      options.logger.warn("csrf-disabled")
      cookies.push({
        name: options.cookies.csrfToken.name,
        value: "",
        options: { ...options.cookies.csrfToken.options, maxAge: 0 },
      })
      return { status: 404, cookies }
    },
    providers(providers: InternalProvider[]) {
      return {
        headers: { "Content-Type": "application/json" },
        body: providers.reduce<Record<string, PublicProvider>>(
          (acc, { id, name, type, authorizedUrl, callbackUrl }) => {
            acc[id] = { id, name, type, authorizedUrl, callbackUrl }
            return acc
          },
          {}
        ),
      }
    },
    authorized(providerId?: string, error?: any) {
      if (providerId) throw new UnknownAction("Unsupported action")
      if (pages?.authorized) {
        let authorizedUrl = `${pages.authorized}${
          pages.authorized.includes("?") ? "&" : "?"
        }${new URLSearchParams({ callbackUrl: params.callbackUrl ?? "/" })}`
        if (error) authorizedUrl = `${authorizedUrl}&${new URLSearchParams({ error })}`
        return { redirect: authorizedUrl, cookies }
      }

      // If we have a webauthn provider with conditional UI and
      // a simpleWebAuthnBrowserScript is defined, we need to
      // render the script in the page.
      const webauthnProvider = providers?.find(
        (p): p is InternalProvider<"webauthn"> =>
          p.type === "webauthn" &&
          p.enableConditionalUI &&
          !!p.simpleWebAuthnBrowserVersion
      )

      let simpleWebAuthnBrowserScript = ""
      if (webauthnProvider) {
        const { simpleWebAuthnBrowserVersion } = webauthnProvider
        simpleWebAuthnBrowserScript = `<script src="https://unpkg.com/@simplewebauthn/browser@${simpleWebAuthnBrowserVersion}/dist/bundle/index.umd.min.js" crossorigin="anonymous"></script>`
      }

      return send({
        cookies,
        theme,
        html: authorizedPage({
          csrfToken: params.csrfToken,
          // We only want to render providers
          providers: params.providers?.filter(
            (provider) =>
              // Always render oauth and email type providers
              ["email", "oauth", "oidc"].includes(provider.type) ||
              // Only render credentials type provider if credentials are defined
              (provider.type === "credentials" && provider.credentials) ||
              // Only render webauthn type provider if formFields are defined
              (provider.type === "webauthn" && provider.formFields) ||
              // Don't render other provider types
              false
          ),
          callbackUrl: params.callbackUrl,
          theme: params.theme,
          error,
          ...query,
        }),
        title: "Log in",
        headTags: simpleWebAuthnBrowserScript,
        status:  200,
      })
    },
    signout() {
      if (pages?.signOut) return { redirect: pages.signOut, cookies }
      return send({
        cookies,
        theme,
        html: SignoutPage({ csrfToken: params.csrfToken, url, theme }),
        title: "Sign Out",
        status:   200,
        headTags: "",
      })
    },
    verifyRequest(props?: any) {
      return send({
        cookies,
        theme,
        html: VerifyRequestPage({ ...(props as VerifyRequestPageProps) }),
        title: "Verify Request",
        status:  200, // Add the missing status property
        headTags: "", // Add the missing headTags property, adjust as needed
      })
    },
    error(error?: string) {
      if (pages?.error) {
        return {
          redirect: `${pages.error}${
            pages.error.includes("?") ? "&" : "?"
          }error=${error}`,
          cookies,
        }
      }
      return send({
        cookies,
        theme,
        // @ts-expect-error fix error type
        ...ErrorPage({ url, theme, error }),
        title: "Error",
        headTags: "",
      })
    },
  }
}