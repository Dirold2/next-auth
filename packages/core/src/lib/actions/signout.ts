import { SignOutError } from "../../errors.js"

import type { InternalOptions, ResponseInternal } from "../../types.js"
import type { Cookie, SessionStore } from "../utils/cookie.js"

/**
 * Destroys the session.
 * If the session strategy is database,
 * The session is also deleted from the database.
 * In any case, the session cookie is cleared and
 * {@link EventCallbacks.signout} is emitted.
 */
export async function signout(
  cookies: Cookie[],
  sessionStore: SessionStore,
  options: InternalOptions
): Promise<ResponseInternal> {
  const { jwt, events, callbackUrl: redirect, logger, session } = options

  const sessionToken = sessionStore.value
  if (!sessionToken) return { redirect, cookies }

  try {
    if (session.strategy === "jwt") {
      const salt = options.cookies.sessionToken.name
      const token = await jwt.decode({ ...jwt, token: sessionToken, salt })
      await events.signout?.({ token })
    } else {
      const session = await options.adapter?.deleteSession(sessionToken)
      await events.signout?.({ session })
    }
  } catch (e) {
    logger.error(new SignOutError(e as Error))
  }

  cookies.push(...sessionStore.clean())

  return { redirect, cookies }
}
