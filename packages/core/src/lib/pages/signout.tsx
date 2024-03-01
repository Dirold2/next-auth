import type { Theme } from "../../types.js"

export interface SignOutProps {
  url?: URL
  csrfToken?: string
  theme?: Theme
}

export default function SignOutPage(props: SignOutProps) {
  const { url, csrfToken, theme } = props

  return (
    <div className="signout">
      {theme?.brandColor && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
        :root {
          --brand-color: ${theme.brandColor}
        }
      `,
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
        {theme?.logo && <img src={theme.logo} alt="Logo" className="logo" />}
        <h1>logout</h1>
        <p>Are you sure you want to sign out?</p>
        <form action={url?.toString()} method="POST">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <button id="submitButton" type="submit">
            Log out
          </button>
        </form>
      </div>
    </div>
  )
}
