import { JWTSessionError, SessionTokenError } from "../../errors.js";
import { fromDate } from "../utils/date.js";

import type { Adapter } from "../../adapters.js";
import type { InternalOptions, ResponseInternal, Session } from "../../types.js";
import type { Cookie, SessionStore } from "../utils/cookie.js";
import { logger } from "../utils/logger.js";

/** Обработка сессии */
export async function session(
  options: InternalOptions,
  sessionStore: SessionStore,
  cookies: Cookie[],
  isUpdate?: boolean,
  newSession?: any
): Promise<ResponseInternal<Session | null>> {
  try {
    const { adapter, jwt, events, callbacks, logger, session: { strategy: sessionStrategy, maxAge: sessionMaxAge } } = options;

    const response: ResponseInternal<Session | null> = {
      body: null,
      headers: { "Content-Type": "application/json" },
      cookies,
    };

    const sessionToken = sessionStore.value;

    if (!sessionToken) return response;

    if (sessionStrategy === "jwt") {
      return await handleJWTSession(
        options, 
        sessionStore, 
        response, 
        sessionToken, 
        jwt, 
        callbacks, 
        isUpdate, 
        newSession, 
        events, 
        logger, 
        sessionMaxAge
      );
    } else {
      if (!adapter) {
        throw new Error("Adapter is not defined");
      }
      return await handleDatabaseSession(
        options, 
        sessionStore, 
        response, 
        sessionToken, 
        adapter, 
        callbacks, 
        isUpdate, 
        newSession, 
        events, 
        logger, 
        sessionMaxAge
      );
    }
  } catch (error) {
    logger.error(new SessionTokenError(error as Error));
    // Обработка других ошибок, если необходимо
    return {
      body: null,
      headers: { "Content-Type": "application/json" },
      cookies: [],
    };
  }
}

/** Обработка сессии с использованием JWT */
async function handleJWTSession(
  options: InternalOptions,
  sessionStore: SessionStore,
  response: ResponseInternal<Session | null>,
  sessionToken: string,
  jwt: any,
  callbacks: any,
  isUpdate?: boolean,
  newSession?: any,
  events?: any,
  logger?: any,
  sessionMaxAge?: number
): Promise<ResponseInternal<Session | null>> {
  try {
    const salt = options.cookies.sessionToken.name;
    const payload = await jwt.decode({ ...jwt, token: sessionToken, salt });

    if (!payload) throw new Error("Invalid JWT");

    const token = await callbacks.jwt({
      token: payload,
      ...(isUpdate && { trigger: "update" }),
      session: newSession,
    });

    const newExpires = fromDate(sessionMaxAge ?? 0);

    if (token !== null) {
      const session = {
        user: {
          name: token.name,
          email: token.email,
          sub: token.sub,
          iat: token.iat,
          exp: token.exp,
          jti: token.jti
        },
        expires: newExpires.toISOString(),
      };

      const newSessionPayload = await callbacks.session({ session, token });
      response.body = newSessionPayload;

      const newToken = await jwt.encode({ ...jwt, token, salt }) as string;
      const sessionCookies = sessionStore.chunk(newToken, { expires: newExpires });
      response.cookies?.push(...sessionCookies);

      await events.session?.({ session: newSessionPayload, token });
    } else {
      response.cookies?.push(...sessionStore.clean());
    }
  } catch (error) {
    logger.error(new JWTSessionError(error as Error));
    response.cookies?.push(...sessionStore.clean());
  }

  return response;
}

/** Обработка сессии с использованием базы данных */
async function handleDatabaseSession(
  options: InternalOptions,
  sessionStore: SessionStore,
  response: ResponseInternal<Session | null>,
  sessionToken: string,
  adapter: Adapter,
  callbacks: any,
  isUpdate?: boolean,
  newSession?: any,
  events?: any,
  logger?: any,
  sessionMaxAge?: number
): Promise<ResponseInternal<Session | null>> {
  try {
    const { getSessionAndUser, deleteSession, updateSession } = adapter as Required<Adapter>;
    let userAndSession = await getSessionAndUser(sessionToken);

    if (userAndSession && userAndSession.session.expires.valueOf() < Date.now()) {
      await deleteSession(sessionToken);
      userAndSession = null;
    }

    if (userAndSession) {
      const { user, session } = userAndSession;
      const sessionUpdateAge = options.session.updateAge;
      const sessionIsDueToBeUpdatedDate = session.expires.valueOf() - (sessionMaxAge ?? 0) * 1000 + sessionUpdateAge * 1000;
      const newExpires = fromDate(sessionMaxAge ?? 0);

      if (sessionIsDueToBeUpdatedDate <= Date.now()) {
        await updateSession({ sessionToken, expires: newExpires });
      }

      const sessionPayload = await callbacks.session({ session: { ...session, user }, user, newSession, ...(isUpdate ? { trigger: "update" } : {}) });
      response.body = sessionPayload;

      response.cookies?.push({
        name: options.cookies.sessionToken.name,
        value: sessionToken,
        options: { ...options.cookies.sessionToken.options, expires: newExpires },
      });

      await events.session?.({ session: sessionPayload });
    } else if (sessionToken) {
      response.cookies?.push(...sessionStore.clean());
    }
  } catch (error) {
    logger.error(new SessionTokenError(error as Error));
  }

  return response;
}