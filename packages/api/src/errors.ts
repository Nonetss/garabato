import { createORPCErrorConstructorMap } from "@orpc/contract"
import type { ErrorMap } from "@orpc/server"

/**
 * Default messages for the standard error codes. The HTTP status of each code
 * is not declared here: the `/rpc` and `/api` handlers map it with their
 * default `COMMON_ERROR_STATUS_MAP`.
 */
export const errorMap = {
  BAD_REQUEST: {
    message: "Bad Request",
  },
  UNAUTHORIZED: {
    message: "Unauthorized",
  },
  FORBIDDEN: {
    message: "Forbidden",
  },
  NOT_FOUND: {
    message: "Not Found",
  },
  METHOD_NOT_SUPPORTED: {
    message: "Method Not Supported",
  },
  NOT_ACCEPTABLE: {
    message: "Not Acceptable",
  },
  TIMEOUT: {
    message: "Request Timeout",
  },
  CONFLICT: {
    message: "Conflict",
  },
  PRECONDITION_FAILED: {
    message: "Precondition Failed",
  },
  PAYLOAD_TOO_LARGE: {
    message: "Payload Too Large",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    message: "Unsupported Media Type",
  },
  UNPROCESSABLE_CONTENT: {
    message: "Unprocessable Content",
  },
  TOO_MANY_REQUESTS: {
    message: "Too Many Requests",
  },
  CLIENT_CLOSED_REQUEST: {
    message: "Client Closed Request",
  },
  INTERNAL_SERVER_ERROR: {
    message: "Internal Server Error",
  },
  NOT_IMPLEMENTED: {
    message: "Not Implemented",
  },
  BAD_GATEWAY: {
    message: "Bad Gateway",
  },
  SERVICE_UNAVAILABLE: {
    message: "Service Unavailable",
  },
  GATEWAY_TIMEOUT: {
    message: "Gateway Timeout",
  },
} as const satisfies ErrorMap

export const errors = createORPCErrorConstructorMap(errorMap)
