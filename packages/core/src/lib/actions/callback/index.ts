import {
  AuthError,
  AuthorizedCallbackError,
  CallbackRouteError,
  CredentialsAuthorized,
  InvalidProvider,
  Verification,
} from "../../../errors.js";
import { handleLoginOrRegister } from "./handle-login.js";
import { handleOAuth } from "./oauth/callback.js";
import { handleState } from "./oauth/checks.js";
import { createHash } from "../../utils/web.js";

import type { AdapterSession } from "../../../adapters.js";
import type {
  Account,
  InternalOptions,
  InternalProvider,
  LoggerInstance,
  RequestInternal,
  ResponseInternal,
  User,
} from "../../../types.js";
import type { Cookie, SessionStore } from "../../utils/cookie.js";
import { assertInternalOptionsWebAuthn, verifyAuthenticate, verifyRegister } from "../../utils/webauthn-utils.js";
import { type OAuthConfigInternal } from "../../../providers/oauth.js";
import { type ProviderType } from "../../../providers/index.js";

/**
 * The function `callback` handles different types of provider callbacks asynchronously and returns a
 * `ResponseInternal` object.
 * @param {RequestInternal} request - The `request` parameter in the `callback` function is of type
 * `RequestInternal`, which likely contains information about the incoming request such as headers,
 * body, and other request details. It is used within the function to handle the callback logic based
 * on the request received.
 * @param {InternalOptions} options - The `options` parameter in the `callback` function contains
 * information such as the provider type, URL, and logger that are needed for processing the callback.
 * It is used to determine the type of provider and then call the corresponding handler function for
 * that provider type.
 * @param {SessionStore} sessionStore - The `sessionStore` parameter in the `callback` function is used
 * to store and manage session data for the user. This can include information such as user
 * authentication status, user preferences, and other relevant data that needs to be maintained across
 * multiple requests during a user's session. The session store allows the
 * @param {Cookie[]} cookies - The `cookies` parameter in the `callback` function is an array of Cookie
 * objects. These Cookie objects likely represent the cookies that are being passed in the request or
 * need to be set in the response. You can access and manipulate these cookies within the `callback`
 * function to handle authentication, session management
 * @returns A `ResponseInternal` object is being returned from the `callback` function. This object may
 * contain properties such as `redirect` and `cookies`, which are used to handle the response to the
 * callback request.
 */
export async function callback(
  request: RequestInternal,
  options: InternalOptions,
  sessionStore: SessionStore,
  cookies: Cookie[]
): Promise<ResponseInternal> {
  const { provider, url, logger } = options;

  try {
    switch (provider.type) {
      case "oauth":
      case "oidc":
        return await handleOAuthCallback(request, options, sessionStore, cookies);

      case "email":
        return await handleEmailCallback(request, options, sessionStore, cookies);

      case "credentials":
        return await handleCredentialsCallback(request, options, sessionStore, cookies);

      case "webauthn":
        return await handleWebAuthnCallback(request, options, sessionStore, cookies);

      default:
        throw new InvalidProvider(`Callback for provider type (${(provider as any).type}) is not supported`);
    }
  } catch (e) {
    handleCallbackError(e as Error, provider, logger);
    // Return a default ResponseInternal object or handle the error appropriately
    return { redirect: `${url}/error`, cookies };
  }
}

/**
 * The function `handleOAuthCallback` processes OAuth callback requests, handles authorization, user
 * login or registration, and session management based on the provided options and request data.
 * @param {RequestInternal} request - The `request` parameter in the `handleOAuthCallback` function
 * represents the incoming request object containing information about the HTTP request made to the
 * server. It includes details such as headers, body, method, URL, query parameters, and more. In this
 * context, `RequestInternal` likely refers to a
 * @param {InternalOptions} options - The `options` parameter in the `handleOAuthCallback` function
 * contains various configuration settings and data needed for handling OAuth callbacks. Here's a
 * breakdown of the properties within the `options` object:
 * @param {SessionStore} sessionStore - The `sessionStore` parameter in the `handleOAuthCallback`
 * function is used to store and manage session data for the OAuth callback process. It likely contains
 * information such as user sessions, session tokens, and expiration times. The function interacts with
 * the `sessionStore` to handle user authentication, authorization,
 * @param {Cookie[]} cookies - The `cookies` parameter in the `handleOAuthCallback` function is an
 * array that stores cookie objects. These cookie objects contain information such as the name, value,
 * and options of the cookie. The function uses this array to manage and update cookies during the
 * OAuth callback process.
 * @returns The function `handleOAuthCallback` returns an object with properties `redirect` and
 * `cookies`. The `redirect` property contains the URL to redirect to, and the `cookies` property
 * contains an array of cookies to set.
 */
async function handleOAuthCallback(
  request: RequestInternal,
  options: InternalOptions,
  sessionStore: SessionStore,
  cookies: Cookie[]
) {
  if (!options.provider)
    throw new InvalidProvider("Callback route called without provider")
  const { query } = request
  const {
    provider,
    adapter,
    url,
    callbackUrl,
    pages,
    jwt,
    events,
    callbacks,
    session: { maxAge: sessionMaxAge },
    logger,
  } = options

  const { proxyRedirect, randomState } = handleState(
    query,
    provider as OAuthConfigInternal<any>,
    options.isOnRedirectProxy
  );

  if (proxyRedirect) {
    logger.debug("proxy redirect", { proxyRedirect, randomState });
    return { redirect: proxyRedirect };
  }

  const authorizationResult = await handleOAuth(
    query,
    request.cookies,
    options,
    randomState
  );

  if (authorizationResult.cookies.length) {
    cookies.push(...authorizationResult.cookies);
  }

  logger.debug("authorization result", authorizationResult);

  const {
    user: userFromProvider,
    account,
    profile: OAuthProfile,
  } = authorizationResult;

  if (!userFromProvider || !account || !OAuthProfile) {
    return { redirect: `${url}/authorized`, cookies };
  }

  let userByAccount: User | null = null;
  if (adapter && typeof account === 'object' && account !== null && 'providerAccountId' in account) {
    const { getUserByAccount } = adapter;
    userByAccount = await getUserByAccount({
      providerAccountId: account.providerAccountId,
      provider: provider.id,
    });
  }

  const accountToUse: Account | null = userByAccount?.id ? {
    providerAccountId: userByAccount.id,
    provider: provider.id,
    type: "oauth",
  } : null;

  const redirect = await handleAuthorized(
    {
      user: userByAccount ?? userFromProvider,
      account: accountToUse,
      profile: OAuthProfile,
    },
    options
  );
  if (redirect) return { redirect, cookies };

  const { user, session, isNewUser } = await handleLoginOrRegister(
    sessionStore.value,
    userFromProvider,
    account ? accountToUse : null,
    options
  );

  const useJwtSession = options.session.strategy === "jwt";
  if (useJwtSession) {
    const defaultToken = {
      name: user.name,
      email: user.email,
      picture: user.image,
      sub: user.id?.toString(),
    };
    const token = await callbacks.jwt({
      token: defaultToken,
      user,
      account: accountToUse,
      profile: OAuthProfile,
      isNewUser,
      trigger: isNewUser ? "signUp" : "authorized",
    });

    if (token === null) {
      cookies.push(...sessionStore.clean());
    } else {
      const salt = options.cookies.sessionToken.name;
      const newToken = await jwt.encode({ ...jwt, token, salt });

      const cookieExpires = new Date();
      cookieExpires.setTime(cookieExpires.getTime() + sessionMaxAge * 1000);

      const sessionCookies = sessionStore.chunk(newToken, {
        expires: cookieExpires,
      });
      cookies.push(...sessionCookies);
    }
  } else {
    cookies.push({
      name: options.cookies.sessionToken.name,
      value: (session as AdapterSession).sessionToken,
      options: {
        ...options.cookies.sessionToken.options,
        expires: (session as AdapterSession).expires,
      },
    });
  }

  await events.authorized?.({
    user,
    account: accountToUse,
    profile: OAuthProfile,
    isNewUser,
  });

  if (isNewUser && pages.newUser) {
    return {
      redirect: `${pages.newUser}${pages.newUser.includes("?") ? "&" : "?"}${new URLSearchParams({ callbackUrl })}`,
      cookies,
    };
  }

  return { redirect: callbackUrl, cookies };
}

/**
 * The function `handleEmailCallback` processes email verification tokens, handles user authentication,
 * and manages session cookies based on the provided options and request data.
 * @param {RequestInternal} request - The `request` parameter in the `handleEmailCallback` function is
 * of type `RequestInternal`. It likely contains information about the incoming request, such as query
 * parameters, headers, and body data.
 * @param {InternalOptions} options - The `options` parameter in the `handleEmailCallback` function
 * contains various configuration settings and data needed for handling email callbacks. Here is a
 * breakdown of the properties within the `options` object:
 * @param {SessionStore} sessionStore - The `sessionStore` parameter in the `handleEmailCallback`
 * function is used to store and manage session data for the user authentication process. It likely
 * contains information such as the user's session token, expiration time, and any other relevant
 * session data needed for authentication and authorization. The function interacts with the
 * @param {Cookie[]} cookies - Cookies parameter in the function `handleEmailCallback` is an array that
 * stores cookie objects. Each cookie object contains properties like `name`, `value`, and `options`.
 * Cookies are used to store information on the client-side and are often used for session management
 * and tracking user behavior. In this function,
 * @returns The function `handleEmailCallback` returns an object with two properties: `redirect` and
 * `cookies`. The `redirect` property contains the URL to redirect to, and the `cookies` property
 * contains an array of cookies to set.
 */
async function handleEmailCallback(
  request: RequestInternal,
  options: InternalOptions,
  sessionStore: SessionStore,
  cookies: Cookie[]
) {
  const { query } = request;
  const { 
    provider, 
    adapter, 
    callbackUrl, 
    pages, 
    jwt, 
    events, 
    callbacks, 
    session: 
      {
        strategy: sessionStrategy, 
        maxAge: sessionMaxAge 
      } 
  } = options;
  
  const useJwtSession = sessionStrategy === "jwt";

  const token = query?.token as string | undefined;
  const identifier = query?.email as string | undefined;

  if (!token || !identifier) {
    const e = new TypeError(
      "Missing token or email. The sign-in URL was manually opened without token/identifier or the link was not sent correctly in the email.",
      { cause: { hasToken: !!token, hasEmail: !!identifier } }
    );
    e.name = "Configuration";
    throw e;
  }

  const secret = (provider as any).secret ?? options.secret;
  const invite = await adapter!.useVerificationToken({
    identifier,
    token: await createHash(`${token}${secret}`),
  });

  const hasInvite = !!invite;
  const expired = invite ? invite.expires.valueOf() < Date.now() : undefined;
  const invalidInvite = !hasInvite || expired;
  if (invalidInvite) throw new Verification({ hasInvite, expired });

  const user = (await adapter!.getUserByEmail(identifier)) ?? {
    id: crypto.randomUUID(),
    email: identifier,
    emailVerified: null,
  };

  const account: Account = {
    providerAccountId: user.email,
    userId: user.id,
    type: "email" as const,
    provider: provider.id,
  };

  const redirect = await handleAuthorized({ user, account }, options);
  if (redirect) return { redirect, cookies };

  const { user: loggedInUser, session: userSession, isNewUser } = await handleLoginOrRegister(
    sessionStore.value,
    user,
    account,
    options
  );

  if (useJwtSession) {
    const defaultToken = {
      name: loggedInUser.name,
      email: loggedInUser.email,
      picture: loggedInUser.image,
      sub: loggedInUser.id?.toString(),
    };
    const token = await callbacks.jwt({
      token: defaultToken,
      user: loggedInUser,
      account,
      isNewUser,
      trigger: isNewUser ? "signUp" : "authorized",
    });

    if (token === null) {
      cookies.push(...sessionStore.clean());
    } else {
      const salt = options.cookies.sessionToken.name;
      const newToken = await jwt.encode({ ...jwt, token, salt });

      const cookieExpires = new Date();
      cookieExpires.setTime(cookieExpires.getTime() + sessionMaxAge * 1000);

      const sessionCookies = sessionStore.chunk(newToken, {
        expires: cookieExpires,
      });
      cookies.push(...sessionCookies);
    }
  } else {
    cookies.push({
      name: options.cookies.sessionToken.name,
      value: (userSession as AdapterSession).sessionToken,
      options: {
        ...options.cookies.sessionToken.options,
        expires: (userSession as AdapterSession).expires,
      },
    });
  }

  await events.authorized?.({ user: loggedInUser, account, isNewUser });

  if (isNewUser && pages.newUser) {
    return {
      redirect: `${pages.newUser}${pages.newUser.includes("?") ? "&" : "?"}${new URLSearchParams({ callbackUrl })}`,
      cookies,
    };
  }

  return { redirect: callbackUrl, cookies };
}

/**
 * This TypeScript function handles authorized callbacks by executing the authorized function, handling
 * errors, and redirecting based on the result.
 * @param params - The `params` parameter in the `handleAuthorized` function is of type
 * `Parameters<InternalOptions["callbacks"]["authorized"]>[0]`. This means it is the first parameter
 * type of the `authorized` callback function defined in the `InternalOptions` configuration.
 * @param {InternalOptions} config - The `config` parameter in the `handleAuthorized` function is of
 * type `InternalOptions`, which likely contains various configuration options for the function to use.
 * It seems to have a property called `callbacks`, which in turn has properties `authorized` and
 * `redirect`.
 * @returns a Promise that resolves to a string or undefined.
 */
async function handleAuthorized(
  params: Parameters<InternalOptions["callbacks"]["authorized"]>[0],
  config: InternalOptions
): Promise<string | undefined> {
  const { authorized, redirect } = config.callbacks
  try {
    await authorized(params)
  } catch (e) {
    if (e instanceof AuthError) throw e
    throw new AuthorizedCallbackError(e as Error)
  }
  if (!authorized) throw new AuthorizedCallbackError("AccessDenied")
  if (typeof authorized !== "string") return
  return await redirect({ url: authorized, baseUrl: config.url.origin })
}

/**
 * The function `handleCredentialsCallback` processes credentials, authorizes a user, generates a
 * token, and handles the authorization flow.
 * @param {RequestInternal} request - The `request` parameter in the `handleCredentialsCallback`
 * function represents an internal request object that contains information such as query parameters,
 * request body, HTTP method, headers, and URL. It is of type `RequestInternal`.
 * @param {InternalOptions} options - The `options` parameter in the `handleCredentialsCallback`
 * function contains various configuration settings and data needed for handling user credentials. It
 * includes properties such as `provider`, `callbackUrl`, `jwt`, `events`, `callbacks`, and `session`.
 * These properties are used to customize the authentication process,
 * @param {SessionStore} sessionStore - The `sessionStore` parameter in the `handleCredentialsCallback`
 * function is used to store and manage session data for the user. It likely contains methods for
 * creating, updating, and deleting session information, as well as handling session cookies. The
 * function interacts with the `sessionStore` to manage user sessions
 * @param {Cookie[]} cookies - Cookies parameter in the function `handleCredentialsCallback` is an
 * array that stores cookie objects. Cookies are small pieces of data that websites store on a user's
 * computer. In this function, the cookies parameter is used to store and manage cookies related to the
 * user's session and authentication.
 * @returns The function `handleCredentialsCallback` returns an object with properties `redirect` and
 * `cookies`.
 */
async function handleCredentialsCallback(
  request: RequestInternal,
  options: InternalOptions,
  sessionStore: SessionStore,
  cookies: Cookie[]
) {
  const { query, body, method, headers, url } = request;
  const { 
    provider, 
    callbackUrl, 
    jwt, 
    events, 
    callbacks, 
    session: 
      { maxAge: sessionMaxAge 
      } 
  } = options;

  const credentials = body ?? {};

  Object.entries(query ?? {}).forEach(([k, v]) =>
    { url.searchParams.set(k , v as string); }
  );

  const userFromAuthorize = await (provider as any).authorize(
    credentials,
    new Request(url, { headers, method, body: JSON.stringify(body) })
  );
  const user = userFromAuthorize && {
    ...userFromAuthorize,
    id: userFromAuthorize?.id?.toString() ?? crypto.randomUUID(),
  };

  if (!user) throw new CredentialsAuthorized();

  const account: Account = {
    providerAccountId: user.id,
    type: "credentials",
    provider: provider.id,
  };

  const redirect = await handleAuthorized(
    { user, account, credentials },
    options
  );
  if (redirect) return { redirect, cookies };

  const defaultToken = {
    name: user.name,
    email: user.email,
    picture: user.image,
    sub: user.id,
  };

  const token = await callbacks.jwt({
    token: defaultToken,
    user,
    account,
    isNewUser: false,
    trigger: "authorized",
  });

  if (token === null) {
    cookies.push(...sessionStore.clean());
  } else {
    const salt = options.cookies.sessionToken.name;
    const newToken = await jwt.encode({ ...jwt, token, salt });

    const cookieExpires = new Date();
    cookieExpires.setTime(cookieExpires.getTime() + sessionMaxAge * 1000);

    const sessionCookies = sessionStore.chunk(newToken, {
      expires: cookieExpires,
    });

    cookies.push(...sessionCookies);
  }

  await events.authorized?.({ user, account });

  return { redirect: callbackUrl, cookies };
}

/**
 * The function `handleWebAuthnCallback` processes web authentication callbacks, handling actions such
 * as authentication and registration, and managing user sessions and cookies.
 * @param {RequestInternal} request - The `request` parameter in the `handleWebAuthnCallback` function
 * is of type `RequestInternal`, which likely contains information about the incoming request such as
 * headers, body, and other request details. It is used to extract the request body in the function
 * using `const { body } = request
 * @param {InternalOptions} options - The `options` parameter in the `handleWebAuthnCallback` function
 * contains various configuration settings and data needed for handling web authentication callbacks.
 * It includes properties such as `callbacks`, `events`, `session`, `strategy`, and `maxAge`.
 * @param {SessionStore} sessionStore - The `sessionStore` parameter in the `handleWebAuthnCallback`
 * function is used to store and manage session-related data such as user authentication tokens,
 * session expiration times, and other session information. It is typically used to persist user
 * sessions across multiple requests and maintain user authentication state.
 * @param {Cookie[]} cookies - Cookies parameter in the function `handleWebAuthnCallback` is an array
 * that contains cookie objects. These cookie objects typically have properties like `name`, `value`,
 * and `options`. Cookies are used to store information on the client-side browser for various purposes
 * such as session management, user authentication, and
 * @returns The function `handleWebAuthnCallback` returns an object with two properties:
 * 1. `redirect`: The value is `options.callbackUrl`, which is the URL to redirect to after the
 * function completes.
 * 2. `cookies`: An array of cookies that have been modified or added during the execution of the
 * function.
 */
async function handleWebAuthnCallback(
  request: RequestInternal,
  options: InternalOptions,
  sessionStore: SessionStore,
  cookies: Cookie[],
) {
  const { body } = request;
  const { callbacks, events, session: { strategy: sessionStrategy, maxAge: sessionMaxAge } } = options;
  const useJwtSession = sessionStrategy === "jwt";

  // Get callback action from request. It should be either "authenticate" or "register"
  const action = body?.action;

  if (typeof action !== "string" || (action !== "authenticate" && action !== "register")) {
    throw new AuthError("Invalid action parameter");
  }

  const localOptions = assertInternalOptionsWebAuthn(options);

  let user, account, authenticator;

  switch (action) {
    case "authenticate": {
      const verified = await verifyAuthenticate(localOptions, request, cookies);

      user = verified.user;
      account = verified.account;

      break;
    }
    case "register": {
      const verified = await verifyRegister(options, request, cookies);

      user = verified.user;
      account = verified.account;
      authenticator = verified.authenticator;

      break;
    }
  }

  await handleAuthorized(
    { user, account },
    options,
  );

  const { user: loggedInUser, isNewUser, session, account: currentAccount } = await handleLoginOrRegister(
    sessionStore.value,
    user,
    account,
    options
  );

  if (!currentAccount) {
    throw new AuthError("Error creating or finding account");
  }

  if (authenticator && loggedInUser.id) {
    await localOptions.adapter.createAuthenticator({ ...authenticator, userId: loggedInUser.id });
  }

  if (useJwtSession) {
    const defaultToken = {
      name: loggedInUser.name,
      email: loggedInUser.email,
      picture: loggedInUser.image,
      sub: loggedInUser.id?.toString(),
    };
    const token = await callbacks.jwt({
      token: defaultToken,
      user: loggedInUser,
      account: currentAccount,
      isNewUser,
      trigger: isNewUser ? "signUp" : "authorized",
    });

    if (token === null) {
      cookies.push(...sessionStore.clean());
    } else {
      const salt = options.cookies.sessionToken.name;
      const newToken = await options.jwt.encode({ ...options.jwt, token, salt });

      const cookieExpires = new Date();
      cookieExpires.setTime(cookieExpires.getTime() + sessionMaxAge * 1000);

      const sessionCookies = sessionStore.chunk(newToken, {
        expires: cookieExpires,
      });
      cookies.push(...sessionCookies);
    }
  } else {
    cookies.push({
      name: options.cookies.sessionToken.name,
      value: session?.sessionToken as string,
      options: {
        ...options.cookies.sessionToken.options,
        expires: session?.expires as Date | undefined,
      },
    });
  }

  await events.authorized?.({ user: loggedInUser, account: currentAccount, isNewUser });

  return { redirect: options.callbackUrl, cookies };
}

/**
 * The function `handleCallbackError` throws a `CallbackRouteError` with error details if the provided
 * error is not an `AuthError`.
 * @param {Error} error - The `error` parameter is an instance of the `Error` class, which represents
 * an error object that contains information about an error that occurred during the execution of code.
 * @param provider - The `provider` parameter is an object of type `InternalProvider<ProviderType>`. It
 * likely contains information about the provider being used in the callback route, such as its ID or
 * configuration details.
 * @param {LoggerInstance} logger - The `logger` parameter in the `handleCallbackError` function is of
 * type `LoggerInstance`. It is used for logging debug information and error details within the
 * function.
 */
function handleCallbackError(error: Error, provider: InternalProvider<ProviderType>, logger: LoggerInstance) {
  if (error instanceof AuthError) {
    throw error;
  }
  const errorDetails = { provider: provider.id, error };
  logger.debug("callback route error details", errorDetails);
  throw new CallbackRouteError(error, errorDetails);
}