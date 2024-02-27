import type { AuthAction } from "../../types.js"

const actions: AuthAction[] = [
  "providers",
  "session",
  "csrf",
  "authorized",
  "logout",
  "callback",
  "verify-request",
  "error",
  "webauthn-options",
]

export function isAuthAction(action: string): action is AuthAction {
  return actions.includes(action as AuthAction)
}
