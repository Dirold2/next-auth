import { SessionProvider, signin, signout, useSession } from "next-auth/react"
import "./styles.css"
import { Header } from "components/header"
import styles from "components/header.module.css"
import Footer from "components/footer"
import Head from "next/head.js"

export default function App({ Component, pageProps }) {
  return (<>
    <Head>
        <title>NextAuthJs</title>
    </Head>
    <SessionProvider session={pageProps.session} basePath="/auth">
      <PagesHeader />
      <Component {...pageProps} />
      <Footer />
    </SessionProvider>
  </>)
}

function PagesHeader() {
  const { data: session } = useSession()
  return (
    <Header
      session={session}
      logIn={
        <button onClick={() => signin()} className={styles.buttonPrimary}>
          Log in
        </button>
      }
      logOut={
        <button onClick={() => signout()} className={styles.button}>
          Log out
        </button>
      }
    />
  )
}