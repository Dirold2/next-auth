import * as React from "react"
import { signin, signout, useSession } from "next-auth/react"
import { SignInResponse, SignOutResponse } from "next-auth/lib/client.js"

export default function Page() {
  const [response, setResponse] = React.useState<
    SignInResponse | SignOutResponse
  >()

  const { data: session } = useSession()

  if (session) {
    return (
      <>
        <h1>Test different flows for Credentials logout</h1>
        <span className="spacing">Default: </span>
        <button onClick={() => signout()}>Logout</button>
        <br />
        <span className="spacing">No redirect: </span>
        <button onClick={() => signout({ redirect: false }).then(response => setResponse(response as SignInResponse | SignOutResponse | undefined))}>
          Logout
        </button>
        <br />
        <p>{response ? "Response:" : "Session:"}</p>
        <pre style={{ background: "#333", padding: 16, borderRadius: 8 }}>
          {JSON.stringify(response ?? session, null, 2)}
        </pre>
      </>
    )
  }

  return (
    <>
      <h1>Test different flows for Credentials login</h1>
      <span className="spacing">Default: </span>
      <button onClick={() => signin("credentials", { password: "password" })}>
        Login
      </button>
      <br />
      <span className="spacing">No redirect: </span>
      <button
        onClick={() =>
          signin("credentials", { redirect: false, password: "password" }).then(
            setResponse
          )
        }
      >
        Login
      </button>
      <br />
      <span className="spacing">No redirect, wrong password: </span>
      <button
        onClick={() =>
          signin("credentials", { redirect: false, password: "wrong" }).then(
            setResponse
          )
        }
      >
        Login
      </button>
      <p>Response:</p>
      <pre style={{ background: "#333", padding: 16, borderRadius: 8 }}>
        {JSON.stringify(response, null, 2)}
      </pre>
    </>
  )
}
