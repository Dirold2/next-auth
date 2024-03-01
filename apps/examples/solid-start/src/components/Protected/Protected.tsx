// TODO
// @ts-nocheck
import { type Session } from "@auth/core"
import { getSession } from "@solid-auth/next"
import { Component, Show } from "solid-js"
import { useRouteData } from "solid-start"
import { createServerData$, redirect } from "solid-start/server"
import { authOpts } from "~/routes/api/auth/[...solidauth]"

interface FetchEvent {
  request: Request;
  // Add other properties as needed
}

const Protected = (Comp: IProtectedComponent) => {
  const routeData = () => {
    return createServerData$(
      
      async (_: any, event: FetchEvent) => {
        const session = await getSession(event.request, authOpts)
        if (!session || !session.user) {
          throw redirect("/")
        }
        return session
      },
      { key: () => ["auth_user"] }
    )
  }

  return {
    routeData,
    Page: () => {
      const session = useRouteData<typeof routeData>()
      return (
        <Show when={session()} keyed>
          {(sess: Session) => <Comp {...sess} />}
        </Show>
      )
    },
  }
}

type IProtectedComponent = Component<Session>

export default Protected
