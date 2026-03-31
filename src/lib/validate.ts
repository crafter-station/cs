interface ValidationResult {
  valid: boolean
  normalized?: string
  error?: string
}

export function validateSubdomain(input: string): ValidationResult {
  if (!input || input.trim().length === 0) {
    return { valid: false, error: "Subdomain is required" }
  }

  if (input.includes("..") || input.includes("/") || input.includes("\\")) {
    return { valid: false, error: "Path traversal detected" }
  }

  if (input.includes("%")) {
    return { valid: false, error: "Pre-encoded characters detected (%). Pass raw subdomain name." }
  }

  if (input.includes("?") || input.includes("#")) {
    return { valid: false, error: "Query params or fragments detected in subdomain" }
  }

  // biome-ignore lint: regex is readable
  if (/[\x00-\x1f\x7f]/.test(input)) {
    return { valid: false, error: "Control characters detected" }
  }

  const normalized = input.toLowerCase().trim()

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    return { valid: false, error: "Subdomain must be lowercase alphanumeric with hyphens, cannot start or end with hyphen" }
  }

  if (normalized.length > 63) {
    return { valid: false, error: "Subdomain must be 63 characters or fewer" }
  }

  return { valid: true, normalized }
}

export function validateDomain(input: string, allowed: string[]): ValidationResult {
  if (!input || input.trim().length === 0) {
    return { valid: false, error: "Domain is required" }
  }

  const normalized = input.toLowerCase().trim()

  if (allowed.length > 0 && !allowed.includes(normalized)) {
    return { valid: false, error: `Domain "${normalized}" not in configured domains: ${allowed.join(", ")}` }
  }

  return { valid: true, normalized }
}

export function validateProjectSlug(input: string): ValidationResult {
  if (!input || input.trim().length === 0) {
    return { valid: false, error: "Project slug is required" }
  }

  if (input.includes("..") || input.includes("/")) {
    return { valid: false, error: "Path traversal detected in project slug" }
  }

  const normalized = input.toLowerCase().trim()

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    return { valid: false, error: "Project slug must be lowercase alphanumeric with hyphens" }
  }

  return { valid: true, normalized }
}
