import { getAuthorizationUrl } from "./signin-url.js"
import { sendToken } from "./send-token.js"

import type { Cookie } from "../../utils/cookie.js"
import type {
  InternalOptions,
  RequestInternal,
  ResponseInternal,
} from "../../../types.js"

export async function signin(
  request: RequestInternal,
  cookies: Cookie[],
  options: InternalOptions
): Promise<ResponseInternal> {
  const signinUrl = `${options.url.origin}${options.basePath}/signin`

  if (!options.provider) return { redirect: signinUrl, cookies }

  switch (options.provider.type) {
    case "oauth":
    case "oidc": {
      const { redirect, cookies: authCookies } = await getAuthorizationUrl(
        request.query,
        options
      )
      if (authCookies) cookies.push(...authCookies)
      return { redirect, cookies }
    }
    case "email": {
      const response = await sendToken(request, options)
      return { ...response, cookies }
    }
    default:
      return { redirect: signinUrl, cookies }
  }
}
