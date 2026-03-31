import { defineCommand } from "citty"
import pc from "picocolors"
import { saveConfig, loadConfig, getConfigPath } from "../lib/config"
import { globalArgs } from "../lib/common-args"
import { createOutput, outputError } from "../lib/output"

export const login = defineCommand({
  meta: {
    name: "login",
    description: "Configure credentials for Spaceship and Vercel",
  },
  args: {
    ...globalArgs,
    spaceshipKey: {
      type: "string",
      description: "Spaceship API Key",
      required: true,
    },
    spaceshipSecret: {
      type: "string",
      description: "Spaceship API Secret",
      required: true,
    },
    vercelToken: {
      type: "string",
      description: "Vercel Token",
      required: true,
    },
    vercelTeamId: {
      type: "string",
      description: "Vercel Team ID",
    },
    baseDomain: {
      type: "string",
      description: "Default base domain (default: crafter.run)",
      default: "crafter.run",
    },
    clerkPlatformToken: {
      type: "string",
      description: "Clerk Platform API token",
    },
    domains: {
      type: "string",
      description: "Comma-separated list of all managed domains (e.g., crafter.run,crafter.ing)",
    },
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })
    const existing = await loadConfig()

    const domainsList = args.domains
      ? args.domains.split(",").map((d: string) => d.trim())
      : existing?.domains

    await saveConfig({
      spaceship: {
        apiKey: args.spaceshipKey,
        apiSecret: args.spaceshipSecret,
      },
      vercel: {
        token: args.vercelToken,
        teamId: args.vercelTeamId,
      },
      baseDomain: args.baseDomain,
      domains: domainsList,
      sites: existing?.sites,
      clerk: args.clerkPlatformToken
        ? { platformToken: args.clerkPlatformToken }
        : existing?.clerk,
    })

    out.result({ configPath: getConfigPath(), baseDomain: args.baseDomain, domains: domainsList })
    out.success(`Credentials saved to ${pc.dim(getConfigPath())}`)
  },
})

export const logout = defineCommand({
  meta: {
    name: "logout",
    description: "Remove stored credentials",
  },
  args: {
    json: globalArgs.json,
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })
    const fs = await import("fs/promises")
    const configPath = getConfigPath()

    try {
      await fs.unlink(configPath)
      out.result({ removed: true })
      out.success("Credentials removed.")
    } catch {
      out.result({ removed: false })
      out.warn("No credentials found.")
    }
  },
})

export const whoami = defineCommand({
  meta: {
    name: "whoami",
    description: "Show current configuration",
  },
  args: {
    json: globalArgs.json,
  },
  async run({ args }) {
    const out = createOutput({ json: args.json })
    const config = await loadConfig()

    if (!config) {
      outputError(!!args.json, "NOT_LOGGED_IN", "Not logged in. Run crafters login first.")
      return
    }

    out.intro(pc.bgCyan(pc.black(" Current Configuration ")))

    out.info(`Base Domain:     ${pc.cyan(config.baseDomain)}`)
    if (config.domains?.length) {
      out.info(`All Domains:     ${pc.cyan(config.domains.join(", "))}`)
    }
    out.info(
      `Spaceship Key:   ${pc.dim(config.spaceship.apiKey.slice(0, 8) + "...")}`
    )
    out.info(
      `Vercel Token:    ${pc.dim(config.vercel.token.slice(0, 8) + "...")}`
    )
    if (config.vercel.teamId) {
      out.info(`Vercel Team ID:  ${pc.dim(config.vercel.teamId)}`)
    }
    if (config.clerk?.platformToken) {
      out.info(
        `Clerk Platform:  ${pc.dim(config.clerk.platformToken.slice(0, 8) + "...")}`
      )
    }

    out.result({
      baseDomain: config.baseDomain,
      domains: config.domains,
      spaceship: { apiKey: config.spaceship.apiKey.slice(0, 8) + "..." },
      vercel: {
        token: config.vercel.token.slice(0, 8) + "...",
        teamId: config.vercel.teamId,
      },
      clerk: config.clerk ? { platformToken: config.clerk.platformToken.slice(0, 8) + "..." } : undefined,
      configPath: getConfigPath(),
    })

    out.outro(`Config: ${pc.dim(getConfigPath())}`)
  },
})
