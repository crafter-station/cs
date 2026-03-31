import { defineCommand } from "citty"
import pc from "picocolors"
import { getCommandSchemas, getCommandSchema } from "../lib/command-registry"
import { globalArgs } from "../lib/common-args"
import { createOutput } from "../lib/output"

export const schema = defineCommand({
  meta: {
    name: "schema",
    description: "Introspect command signatures (for agents and automation)",
  },
  args: {
    json: globalArgs.json,
    command: {
      type: "positional",
      description: "Command path to inspect (e.g., domain.add). Omit to list all.",
      required: false,
    },
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })

    if (args.command) {
      const cmd = getCommandSchema(args.command)
      if (!cmd) {
        out.error(`Command "${args.command}" not found`)
        out.result({ ok: false, error: `Command "${args.command}" not found` })
        return
      }

      out.intro(pc.bgCyan(pc.black(` schema: ${cmd.name} `)))
      out.info(`${pc.bold("Name:")}        ${cmd.name}`)
      out.info(`${pc.bold("Description:")} ${cmd.description}`)

      if (Object.keys(cmd.args).length > 0) {
        out.info("")
        out.info(pc.bold("Arguments:"))
        for (const [key, def] of Object.entries(cmd.args)) {
          const parts = [pc.cyan(key)]
          parts.push(pc.dim(`(${def.type})`))
          if (def.required) parts.push(pc.yellow("required"))
          if (def.default !== undefined) parts.push(pc.dim(`default: ${def.default}`))
          if (def.alias) parts.push(pc.dim(`-${def.alias}`))
          out.info(`  ${parts.join(" ")} ${def.description ? `-- ${def.description}` : ""}`)
        }
      }

      if (cmd.subCommands?.length) {
        out.info("")
        out.info(`${pc.bold("Subcommands:")} ${cmd.subCommands.join(", ")}`)
      }

      out.result(cmd)
      out.outro("")
    } else {
      const schemas = getCommandSchemas()

      out.intro(pc.bgCyan(pc.black(" All Commands ")))

      for (const cmd of schemas) {
        const argCount = Object.keys(cmd.args).length
        const sub = cmd.subCommands?.length ? pc.dim(` [${cmd.subCommands.join(", ")}]`) : ""
        out.info(
          `${pc.cyan(cmd.name.padEnd(24))} ${pc.dim(cmd.description.slice(0, 50))} ${argCount > 0 ? pc.dim(`(${argCount} args)`) : ""}${sub}`
        )
      }

      out.result(schemas)
      out.outro(`${schemas.length} commands`)
    }
  },
})
