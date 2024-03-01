"use client"

import { signin, signout, useSession } from "next-auth/react"

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
              <button onClick={() => signout()}>Log out</button>
            </>
          ) : (
            <>
              <button onClick={() => signin("github")}>
                Sign in Github
              </button>
              <button onClick={() => signin("credentials", { password: "password"})}>
                Sign in Credentials
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
