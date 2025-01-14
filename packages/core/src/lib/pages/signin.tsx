import { type InternalProvider , type AuthorizedPageErrorParam , type Theme } from "../../types.js";
import { webauthnScript } from "../utils/webauthn-client.js";



const loginErrors: Record<string, string> = {
  default: "Unable to login.",
  Authorized: "Try signing in with a different account.",
  OAuthCallbackError: "Try signing in with a different account.",
  OAuthCreateAccount: "Try signing in with a different account.",
  EmailCreateAccount: "Try signing in with a different account.",
  Callback: "Try signing in with a different account.",
  OAuthAccountNotLinked: "To confirm your identity, login with the same account you used originally.",
  EmailAuthorized: "The e-mail could not be sent.",
  CredentialsAuthorized: "login failed. Check the details you provided are correct.",
  SessionRequired: "Please login to access this page.",
};

function hexToRgba(hex?: string, alpha = 1) {
  if (!hex) {
    return
  }
  hex = hex.replace(/^#/, "")
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  alpha = Math.min(Math.max(alpha, 0), 1)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function ConditionalUIScript(providerID: string) {
  const startConditionalUIScript = `
const currentURL = window.location.href;
const authURL = currentURL.substring(0, currentURL.lastIndexOf('/'));
(${webauthnScript})(authURL, "${providerID}");
`
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: startConditionalUIScript }} />
    </>
  )
}

export default function SignInPage(props: {
  csrfToken?: string
  providers?: InternalProvider[]
  callbackUrl?: string
  email?: string
  error?: AuthorizedPageErrorParam
  theme?: Theme
}) {
  const {
    csrfToken,
    providers = [],
    callbackUrl,
    theme,
    email,
    error: errorType,
  } = props

  if (typeof document !== "undefined" && theme?.brandColor) {
    document.documentElement.style.setProperty(
      "--brand-color",
      theme.brandColor
    )
  }

  if (typeof document !== "undefined" && theme?.buttonText) {
    document.documentElement.style.setProperty(
      "--button-text-color",
      theme.buttonText
    )
  }

  const error = errorType && (loginErrors[errorType] ?? loginErrors.default)

  const providerLogoPath = "https://authjs.dev/img/providers"

  const conditionalUIProviderID = providers.find(
    (provider) => provider.type === "webauthn" && provider.enableConditionalUI
  )?.id

  return (
    <div className="signin">
      {theme?.brandColor && (
        <style
          dangerouslySetInnerHTML={{
            __html: `:root {--brand-color: ${theme.brandColor}}`,
          }}
        />
      )}
      {theme?.buttonText && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
        :root {
          --button-text-color: ${theme.buttonText}
        }
      `,
          }}
        />
      )}
      <div className="card">
        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}
        {theme?.logo && <img src={theme.logo} alt="Logo" className="logo" />}
        {providers.map((provider, i) => {
          let bg = ""; let text = ""; let logo = ""; let logoDark = ""; let bgDark = ""; let textDark = "";
          if (provider.type === "oauth" || provider.type === "oidc") {
            ({ bg = "", text = "", logo = "", bgDark = "", textDark = "", logoDark = "" } = provider.style ?? {});
            logo = logo.startsWith("/") ? providerLogoPath + logo : logo;
            logoDark = logoDark?.startsWith("/") ? providerLogoPath + logoDark : logoDark || logo;
          }
          return (
            <div key={provider.id} className="provider">
              {provider.type === "oauth" || provider.type === "oidc" ? (
                <form action={provider.signinUrl} method="POST">
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  {callbackUrl && (
                    <input
                      type="hidden"
                      name="callbackUrl"
                      value={callbackUrl}
                    />
                  )}
                  <button
                    type="submit"
                    className="button"
                    style={{
                      "--provider-bg": bg,
                      "--provider-dark-bg": bgDark,
                      "--provider-color": text,
                      "--provider-dark-color": textDark,
                      "--provider-bg-hover": hexToRgba(bg, 0.8),
                      "--provider-dark-bg-hover": hexToRgba(bgDark, 0.8),
                    }}
                    tabIndex={0}
                  >
                    {logo && (
                      <img
                        loading="lazy"
                        height={24}
                        width={24}
                        id="provider-logo"
                        src={logo}
                      />
                    )}
                    {logoDark && (
                      <img
                        loading="lazy"
                        height={24}
                        width={24}
                        id="provider-logo-dark"
                        src={logoDark}
                      />
                    )}
                    <span>Log in with {provider.name}</span>
                  </button>
                </form>
              ) : null}
              {(provider.type === "email" || provider.type === "credentials" || provider.type === "webauthn") &&
                i > 0 &&
                providers[i - 1].type !== "email" &&
                providers[i - 1].type !== "credentials" &&
                providers[i - 1].type !== "webauthn" && <hr />}
              {provider.type === "email" && (
                <form action={provider.signinUrl} method="POST">
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  <label
                    className="section-header"
                    htmlFor={`input-email-for-${provider.id}-provider`}
                  >
                    Email
                  </label>
                  <input
                    id={`input-email-for-${provider.id}-provider`}
                    autoFocus
                    type="email"
                    name="email"
                    value={email}
                    placeholder="email@example.com"
                    required
                  />
                  <button id="submitButton" type="submit" tabIndex={0}>
                    Log in with {provider.name}
                  </button>
                </form>
              )}
              {provider.type === "credentials" && (
                <form action={provider.callbackUrl} method="POST">
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  {Object.keys(provider.credentials).map((credential) => {
                    return (
                      <div key={`input-group-${provider.id}`}>
                        <label
                          className="section-header"
                          htmlFor={`input-${credential}-for-${provider.id}-provider`}
                        >
                          {provider.credentials[credential].label ?? credential}
                        </label>
                        <input
                          name={credential}
                          id={`input-${credential}-for-${provider.id}-provider`}
                          type={provider.credentials[credential].type ?? "text"}
                          placeholder={
                            provider.credentials[credential].placeholder ?? ""
                          }
                          {...provider.credentials[credential]}
                        />
                      </div>
                    )
                  })}
                  <button id="submitButton" type="submit" tabIndex={0}>
                    Log in with {provider.name}
                  </button>
                </form>
              )}
              {provider.type === "webauthn" && (
                <form action={provider.callbackUrl} method="POST" id={`${provider.id}-form`}>
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  {Object.keys(provider.formFields).map((field) => {
                    return (
                      <div key={`input-group-${provider.id}`}>
                        <label
                          className="section-header"
                          htmlFor={`input-${field}-for-${provider.id}-provider`}
                        >
                          {provider.formFields[field].label ?? field}
                        </label>
                        <input
                          name={field}
                          data-form-field
                          id={`input-${field}-for-${provider.id}-provider`}
                          type={provider.formFields[field].type ?? "text"}
                          placeholder={
                            provider.formFields[field].placeholder ?? ""
                          }
                          {...provider.formFields[field]}
                        />
                      </div>
                    )
                  })}
                  <button id={`submitButton-${provider.id}`} type="submit" tabIndex={0}>
                    Log in with {provider.name}
                  </button>
                </form>
              )}
              {(provider.type === "email" || provider.type === "credentials" || provider.type === "webauthn") &&
                i + 1 < providers.length && <hr />}
            </div>
          )
        })}
      </div>
      {conditionalUIProviderID && ConditionalUIScript(conditionalUIProviderID)}
    </div>
  )
}