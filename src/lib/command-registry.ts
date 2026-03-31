import { agent } from "../commands/agent"
import { claude } from "../commands/claude"
import { domain } from "../commands/domain"
import { login, logout, whoami } from "../commands/login"
import { projects } from "../commands/projects"

export const commands = {
  agent,
  claude,
  domain,
  projects,
  login,
  logout,
  whoami,
}

interface CommandSchema {
  name: string
  description: string
  args: Record<string, {
    type: string
    description?: string
    required?: boolean
    default?: unknown
    alias?: string
  }>
  subCommands?: string[]
}

function extractSchema(cmd: any, prefix: string): CommandSchema[] {
  const results: CommandSchema[] = []
  const name = prefix || cmd.meta?.name || "unknown"
  const description = cmd.meta?.description || ""

  const args: CommandSchema["args"] = {}
  if (cmd.args) {
    for (const [key, def] of Object.entries(cmd.args)) {
      const d = def as any
      args[key] = {
        type: d.type || "string",
        description: d.description,
        required: d.required,
        default: d.default,
        alias: d.alias,
      }
    }
  }

  const subCommandNames = cmd.subCommands ? Object.keys(cmd.subCommands) : undefined

  results.push({ name, description, args, subCommands: subCommandNames })

  if (cmd.subCommands) {
    for (const [subName, subCmd] of Object.entries(cmd.subCommands)) {
      results.push(...extractSchema(subCmd, `${name}.${subName}`))
    }
  }

  return results
}

export function getCommandSchemas(): CommandSchema[] {
  const all: CommandSchema[] = []
  for (const [name, cmd] of Object.entries(commands)) {
    all.push(...extractSchema(cmd, name))
  }
  return all
}

export function getCommandSchema(path: string): CommandSchema | null {
  const schemas = getCommandSchemas()
  return schemas.find((s) => s.name === path) || null
}
