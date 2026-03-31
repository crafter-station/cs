import { defineCommand } from "citty"
import pc from "picocolors"
import { installClaudeDx } from "../lib/claude-ops"
import { globalArgs } from "../lib/common-args"
import { createOutput } from "../lib/output"

export const claudeInstall = defineCommand({
  meta: {
    name: "install",
    description:
      "Install Claude Code commands, agents, and skills from claude-dx",
  },
  args: {
    json: globalArgs.json,
    force: {
      type: "boolean",
      alias: "f",
      description: "Overwrite existing commands",
      default: false,
    },
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })

    out.intro(pc.bgMagenta(pc.black(" Claude Code Configuration ")))

    const s = out.spinner()
    s.start("Syncing claude-dx repo")
    const result = await installClaudeDx(args.force)
    s.stop(
      `Repo ${result.repoAction === "cloned" ? "cloned" : "updated"}`
    )

    if (result.commands.copied.length > 0) {
      out.success(
        `Commands installed: ${pc.cyan(result.commands.copied.join(", "))}`
      )
    }
    if (result.commands.skipped.length > 0) {
      out.warn(
        `Commands skipped: ${pc.dim(result.commands.skipped.join(", "))}`
      )
    }
    if (result.agents.length > 0) {
      out.success(
        `Agents installed: ${pc.cyan(result.agents.join(", "))}`
      )
    }
    if (result.skills.length > 0) {
      out.success(
        `Skills installed: ${pc.cyan(result.skills.join(", "))}`
      )
    }

    const summary = [
      `${result.commands.copied.length} commands`,
      `${result.agents.length} agents`,
      `${result.skills.length} skills`,
    ].join(", ")

    out.result({
      repoAction: result.repoAction,
      commands: result.commands,
      agents: result.agents,
      skills: result.skills,
    })

    out.outro(
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
  args: {
    json: globalArgs.json,
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })

    out.intro(pc.bgMagenta(pc.black(" Claude Code Update ")))

    const s = out.spinner()
    s.start("Syncing and updating all configs")
    const result = await installClaudeDx(true)
    s.stop("All configs updated")

    out.success(
      `${result.commands.copied.length} commands, ${result.agents.length} agents, ${result.skills.length} skills`
    )

    out.result({
      commands: result.commands,
      agents: result.agents,
      skills: result.skills,
    })

    out.outro("Claude Code configuration updated.")
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
