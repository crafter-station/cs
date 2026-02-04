import { defineCommand } from "citty"
import * as p from "@clack/prompts"
import pc from "picocolors"
import { installClaudeDx } from "../lib/claude-ops"

export const claudeInstall = defineCommand({
  meta: {
    name: "install",
    description:
      "Install Claude Code commands, agents, and skills from claude-dx",
  },
  args: {
    force: {
      type: "boolean",
      alias: "f",
      description: "Overwrite existing commands",
      default: false,
    },
  },
  async run({ args }) {
    p.intro(pc.bgMagenta(pc.black(" Claude Code Configuration ")))

    const s = p.spinner()

    s.start("Syncing claude-dx repo")
    const result = await installClaudeDx(args.force)
    s.stop(
      `Repo ${result.repoAction === "cloned" ? "cloned" : "updated"}`
    )

    if (result.commands.copied.length > 0) {
      p.log.success(
        `Commands installed: ${pc.cyan(result.commands.copied.join(", "))}`
      )
    }
    if (result.commands.skipped.length > 0) {
      p.log.warning(
        `Commands skipped: ${pc.dim(result.commands.skipped.join(", "))}`
      )
    }
    if (result.agents.length > 0) {
      p.log.success(
        `Agents installed: ${pc.cyan(result.agents.join(", "))}`
      )
    }
    if (result.skills.length > 0) {
      p.log.success(
        `Skills installed: ${pc.cyan(result.skills.join(", "))}`
      )
    }

    const summary = [
      `${result.commands.copied.length} commands`,
      `${result.agents.length} agents`,
      `${result.skills.length} skills`,
    ].join(", ")

    p.outro(
      result.commands.skipped.length > 0 && !args.force
        ? `${summary} installed. Use ${pc.cyan("crafters claude update")} to overwrite skipped.`
        : `${summary} installed.`
    )
  },
})

export const claudeUpdate = defineCommand({
  meta: {
    name: "update",
    description:
      "Update Claude Code commands, agents, and skills from claude-dx",
  },
  async run() {
    p.intro(pc.bgMagenta(pc.black(" Claude Code Update ")))

    const s = p.spinner()
    s.start("Syncing and updating all configs")
    const result = await installClaudeDx(true)
    s.stop("All configs updated")

    p.log.success(
      `${result.commands.copied.length} commands, ${result.agents.length} agents, ${result.skills.length} skills`
    )

    p.outro("Claude Code configuration updated.")
  },
})

export const claude = defineCommand({
  meta: {
    name: "claude",
    description: "Manage Claude Code configuration",
  },
  subCommands: {
    install: claudeInstall,
    update: claudeUpdate,
  },
})
