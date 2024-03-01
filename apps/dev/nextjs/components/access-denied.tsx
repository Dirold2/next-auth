import { authorized } from "next-auth/react"

export default function AccessDenied() {
  return (
    <>
      <h1>Access Denied</h1>
      <p>
        <a
          href="/api/auth/authorized"
          onClick={(e) => {
            e.preventDefault()
            authorized()
          }}
        >
          You must be signed in to view this page
        </a>
      </p>
    </>
  )
}
