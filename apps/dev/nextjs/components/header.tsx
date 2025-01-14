import type { Session } from "next-auth"
import Link from "next/link"
import styles from "./header.module.css"

export function Header({
  session,
  logIn,
  logOut,
}: {
  session: Session | null
  logIn: any
  logOut: any
}) {
  return (
    <header className={styles.header}>
      <div className={styles.signedInStatus}>
        <img
          src={
            session?.user?.image ?? "https://source.boringavatars.com/beam/120"
          }
          className={styles.avatar}
        />
        {session?.user ? (
          <>
            <span className={styles.signedInText}>
              <small>Loged in as</small>
              <br />
              <strong>{session.user?.email} </strong>
              {session.user?.name ? `(${session.user.name})` : null}
            </span>
            {logOut}
          </>
        ) : (
          <>
            <span className={styles.notSignedInText}>
              You are not signed in
            </span>
            {logIn}
          </>
        )}
      </div>
      <nav>
        <ul className={styles.navItems}>
          <Link href="/" className={styles.navItem}>
            Home (app)
          </Link>
          <Link className={styles.navItem} href="/dashboard">
            Dashboard (app)
          </Link>
          <Link className={styles.navItem} href="/policy">
            Policy (pages)
          </Link>
          <Link className={styles.navItem} href="/credentials">
            Credentials (pages)
          </Link>
          <Link className={styles.navItem} href="/protected-ssr">
            getServerSideProps (pages)
          </Link>
          <Link className={styles.navItem} href="/api/examples/protected">
            API Route (pages)
          </Link>
        </ul>
      </nav>
    </header>
  )
}
