import { auth, signin, signout, update } from "auth"
import Footer from "components/footer"
import { Header } from "components/header"
import styles from "components/header.module.css"
import "./styles.css"
import AuthError from "next-auth"

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <title>AuthJS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <AppHeader />
        <main>{props.children}</main>
        <Footer />
      </body>
    </html>
  )
}

export async function AppHeader() {
  const session = await auth()
  return (
    <Header
      session={session}
      logIn={
        <form
          action={async () => {
            "use server"
            try {
              await signin()
            } catch (error) {
              if (error instanceof AuthError) {
                console.log(error)
              }
              throw error
            }
          }}
        >
          <button className={styles.buttonPrimary}>Log in</button>
        </form>
      }
      logOut={
        <form
          action={async () => {
            "use server"
            await signout()
          }}
        >
          <button className={styles.buttonPrimary}>Log out</button>
        </form>
      }
    />
  )
}
