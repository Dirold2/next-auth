"use client"

import { logIn, logOut, useSession } from "next-auth/react"

export default function Client() {
  const { data: session, update, status } = useSession()
  return (
    <div className="card">
      <div className="card-header">
        <h3>Client Component</h3>
      </div>
      <div className="card-body">
        <h4>Session</h4>
        <pre>
          {status === "loading"
            ? "Loading..."
            : JSON.stringify(session, null, 2)}
        </pre>
        <div className="btn-wrapper">
          {session ? (
            <>
              <button
                onClick={() => update({ user: { name: "Client Fill Murray" } })}
              >
                Update Session - New Name
              </button>
              <button onClick={() => logOut()}>Sign out</button>
            </>
          ) : (
            <>
              <button onClick={() => logIn("github")}>Sign in Github</button>
              <button onClick={() => logIn("credentials", {})}>
                Sign in Credentials
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
