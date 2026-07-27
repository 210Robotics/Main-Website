import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

export function isMissingClerkUserError(error: unknown) {
  return isClerkAPIResponseError(error) && error.status === 404;
}
