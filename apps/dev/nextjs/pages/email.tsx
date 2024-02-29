// eslint-disable-next-line no-use-before-define
import * as React from "react"
import { authorized, logOut, useSession } from "next-auth/react"
import { AuthorizedOptions, AuthorizedResponse } from "next-auth/lib/client.js"
import { AuthorizedParams } from "next-auth/lib/client.js"

export default function Page() {
  const [response, setResponse] = React.useState<AuthorizedResponse | undefined>();
  const [email, setEmail] = React.useState("")

  const handleChange = (event: { target: { value: React.SetStateAction<string> } }) => {
    setEmail(event.target.value)
  }

  const handleLogin = (options: AuthorizedOptions | undefined) => async (event: { preventDefault: () => void }) => {
    event.preventDefault()

    if (options && options.redirect) {
      return authorized("email", options)
    }
    const response = await authorized("email", options)
    setResponse(response)
  }

  const handleLogout = (options: AuthorizedParams<boolean> | undefined) => async (event: any) => {
    if (options && options.redirect) {
      return logOut(options)
    }
    const response = await logOut(options)
    // @ts-expect-error
    setResponse(response)
  }

  const { data: session } = useSession()

  if (session) {
    return (
      <>
        <h1>Test different flows for Email logout</h1>
        <span className="spacing">Default:</span>
        <button onClick={handleLogout({ redirect: true })}>Logout</button>
        <br />
        <span className="spacing">No redirect:</span>
        <button onClick={handleLogout({ redirect: false })}>Logout</button>
        <br />
        <p>Response:</p>
        <pre style={{ background: "#eee", padding: 16 }}>
          {JSON.stringify(response, null, 2)}
        </pre>
      </>
    )
  }

  return (
    <>
      <h1>Test different flows for Email login</h1>
      <label className="spacing">
        Email address:{" "}
        <input
          type="text"
          id="email"
          name="email"
          value={email}
          onChange={handleChange}
        />
      </label>
      <br />
      <form onSubmit={handleLogin({ redirect: true, email })}>
        <span className="spacing">Default:</span>
        <button type="submit">Sign in with Email</button>
      </form>
      <form onSubmit={handleLogin({ redirect: false, email })}>
        <span className="spacing">No redirect:</span>
        <button type="submit">Sign in with Email</button>
      </form>
      <p>Response:</p>
      <pre style={{ background: "#eee", padding: 16 }}>
        {JSON.stringify(response, null, 2)}
      </pre>
    </>
  )
}
