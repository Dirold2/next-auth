import { JWTSessionError, SessionTokenError } from "../../errors.js";
import { fromDate } from "../utils/date.js";

import type { AdapterUser } from "../../adapters.js";
import type { InternalOptions, ResponseInternal, Session } from "../../types.js";
import type { Cookie, SessionStore } from "../utils/cookie.js";

/** Return a session object filtered via `callbacks.session` */
export async function session(
  options: InternalOptions,
  sessionStore: SessionStore,
  cookies: Cookie[],
  isUpdate?: boolean,
  newSession?: any): Promise<ResponseInternal<Session | null>> {
  const {
    adapter,
    jwt,
    events,
    callbacks,
    logger,
    session: { strategy: sessionStrategy, maxAge: sessionMaxAge },
  } = options;

  const response: ResponseInternal<Session | null> = {
    body: null,
    headers: { "Content-Type": "application/json" },
    cookies,
  };

  const sessionToken = sessionStore.value;

  if (!sessionToken) return response;

  if (sessionStrategy === "jwt") {
    try {
      const salt = options.cookies.sessionToken.name
      const payload = await jwt.decode({ ...jwt, token: sessionToken, salt })
  
      if (!payload) throw new Error("Invalid JWT")

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const token = await callbacks.jwt({
        token: payload,
        ...(isUpdate && { trigger: "update" }),
        session: newSession,
      })
  
      const newExpires = fromDate(sessionMaxAge);
      if (token !== null) {
        const newToken = await jwt.encode({ ...jwt, token, salt });

        const validUserObject: AdapterUser = {
          id: 'some_id',
          name: 'John',
          email: 'john@example.com',
          emailVerified: new Date(), // Ensure this matches the expected type
          // Add any other required properties here
        };
        
        const session = {
          user: validUserObject,
          expires: new Date(),
          sessionToken: 'some_token',
          userId: 'some_id',
        };
        
        const newSession = await callbacks.session({
          session, token,
          user: validUserObject,
          newSession: undefined
        });

        
        if (!newSession.user?.id) {
          newSession.user = validUserObject;
        }

        response.body = newSession as Session;

        const sessionCookies = sessionStore.chunk(newToken, {
          expires: newExpires,
        });

        response.cookies?.push(...sessionCookies);    

        await events.session?.({ session: newSession, token });
      } else {
        response.cookies?.push(...sessionStore.clean());
      }
    } catch (e) {
      logger.error(new JWTSessionError(e as Error));
      response.cookies?.push(...sessionStore.clean());
    }

    return response;
  }

  try {
    const { getSessionAndUser, deleteSession, updateSession } = adapter!; // Use non-null assertion operator
    let userAndSession = await getSessionAndUser(sessionToken);

    const salt = options.cookies.sessionToken.name
    const payload = await jwt.decode({ ...jwt, token: sessionToken, salt })

    if (
      userAndSession &&
      userAndSession.session.expires.valueOf() < Date.now()
    ) {
      await deleteSession(sessionToken);
      userAndSession = null;
    }

    if (!payload?.user) {
      throw new Error("Payload or user is undefined");
    }
    
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const token = await callbacks.jwt({
      token: payload,
      ...(isUpdate && { trigger: "update" }),
      session: newSession,
    })

    if (userAndSession) {
      const { user, session } = userAndSession;

      const sessionUpdateAge = options.session.updateAge;
      const sessionIsDueToBeUpdatedDate =
        session.expires.valueOf() -
        sessionMaxAge * 1000 +
        sessionUpdateAge * 1000;

      const newExpires = fromDate(sessionMaxAge);
      if (sessionIsDueToBeUpdatedDate <= Date.now()) {
        await updateSession({
          sessionToken,
          expires: newExpires,
        });
      }
      
      if (token === null) {
        throw new Error("Decoded token is null");
      }
      
      const sessionPayload = await callbacks.session({
        session: { ...session, user },
        user,
        newSession,
        ...(isUpdate ? { trigger: "update" } : {}),
        token,
      });

      response.body = sessionPayload;

      response.cookies?.push({
        name: options.cookies.sessionToken.name,
        value: sessionToken,
        options: {
          ...options.cookies.sessionToken.options,
          expires: newExpires,
        },
      });

      await events.session?.({
        session: sessionPayload,
        token
      });
    } else if (sessionToken) {
      response.cookies?.push(...sessionStore.clean());
    }
  } catch (e) {
    logger.error(new SessionTokenError(e as Error));
  }

  return response;
}