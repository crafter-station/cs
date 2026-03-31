export const globalArgs = {
  json: {
    type: "boolean" as const,
    description: "Output as JSON (auto-enabled when stdout is not a TTY)",
    default: false,
  },
  domain: {
    type: "string" as const,
    description: "Base domain override (e.g., crafter.ing). Default: from config",
  },
}
