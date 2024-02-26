import { SessionProvider, logIn, logOut, useSession } from "next-auth/react"
import "./styles.css"
import { Header } from "components/header"
import styles from "components/header.module.css"
import Footer from "components/footer"

export default function App({ Component, pageProps }) {
  return (
    <SessionProvider session={pageProps.session} basePath="/auth">
      <PagesHeader />
      <Component {...pageProps} />
      <Footer />
    </SessionProvider>
  )
}

function PagesHeader() {
  const { data: session } = useSession()
  return (
    <Header
      session={session}
      signIn={
        <button onClick={() => logIn()} className={styles.buttonPrimary}>
          log in
        </button>
      }
      signOut={
        <button onClick={() => logOut()} className={styles.button}>
          log out
        </button>
      }
    />
  )
}
