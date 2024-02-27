import { AuthError } from "../../errors.js";

export type WarningCode = "debug-enabled" | "csrf-disabled" | "experimental-webauthn";

/**
 * Override any of the methods, and the rest will use the default logger.
 *
 * [Documentation](https://authjs.dev/reference/core#authconfig#logger)
 */
export interface LoggerInstance extends Record<string, (...args: any[]) => any> {
  warn: (code: WarningCode) => void;
  error: (error: Error) => void;
  debug: (message: string, metadata?: unknown) => void;
}

interface ErrorCause {
  err?: Error;
  [key: string]: any;
}

export interface CustomError extends Error {
  cause?: ErrorCause;
}

const colorReset = "\x1b[0m";
const colors = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  grey: "\x1b[90m"
};

export const logger: LoggerInstance = {
  error(error) {
    const name = error instanceof AuthError ? error.type : error.name;
    console.error(`${colors.red}[auth][error]${colorReset} ${name} \n${error.message} \n`);
    if ((error as CustomError).cause && (error as CustomError).cause!.err instanceof Error) {
      const { err, ...data } = (error as CustomError).cause!;
      if (err) {
        console.error(`${colors.red}[auth][cause]${colorReset} \n`, err.stack);
      }
      if (data) {
        console.error(
          `${colors.red}[auth][details]${colorReset} \n`,
          JSON.stringify(data, null,  2)
        );
      }
    } else if (error.stack) {
      console.error(error.stack.replace(/.*/, "").substring(1));
    }
  },
  warn(code) {
    const url = `https://warnings.authjs.dev#${code}`;
    console.warn(`${colors.yellow}[auth][warn][${code}]${colorReset} \n`, `Read more: ${url}`);
  },
  debug(message, metadata) {
    console.log(
      `${colors.grey}[auth][debug] \n${colorReset} ${message}`,
      JSON.stringify(metadata, null, 2)
    );
  }
};

/**
 * Override the built-in logger with user's implementation.
 * Any `undefined` level will use the default logger.
 */
export function setLogger(newLogger: Partial<LoggerInstance> = {}, debug?: boolean) {
  // Turn off debug logging if `debug` isn't set to `true`
  if (!debug) logger.debug = () => {};

  if (newLogger.error) logger.error = newLogger.error;
  if (newLogger.warn) logger.warn = newLogger.warn;
  if (newLogger.debug) logger.debug = newLogger.debug;
}
