export enum ErrorCode {
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  AUTH_REQUIRED = "AUTH_REQUIRED",
  INVALID_SUBDOMAIN = "INVALID_SUBDOMAIN",
  INVALID_DOMAIN = "INVALID_DOMAIN",
  INVALID_PROJECT = "INVALID_PROJECT",
  SPACESHIP_API_ERROR = "SPACESHIP_API_ERROR",
  VERCEL_API_ERROR = "VERCEL_API_ERROR",
  CLERK_API_ERROR = "CLERK_API_ERROR",
  DOMAIN_ADD_FAILED = "DOMAIN_ADD_FAILED",
  DOMAIN_REMOVE_FAILED = "DOMAIN_REMOVE_FAILED",
  DOMAIN_LIST_FAILED = "DOMAIN_LIST_FAILED",
  SYNC_FAILED = "SYNC_FAILED",
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  NOT_CONFIGURED = "NOT_CONFIGURED",
}

export class CraftersError extends Error {
  code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = "CraftersError"
  }
}

export function exitCodeForError(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.INVALID_SUBDOMAIN:
    case ErrorCode.INVALID_DOMAIN:
    case ErrorCode.INVALID_PROJECT:
      return 2
    case ErrorCode.CONFIG_NOT_FOUND:
    case ErrorCode.AUTH_REQUIRED:
    case ErrorCode.NOT_CONFIGURED:
      return 3
    default:
      return 1
  }
}
