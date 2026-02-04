import { defineCommand } from "citty"
import * as p from "@clack/prompts"
import pc from "picocolors"
import { saveConfig, loadConfig, getConfigPath } from "../lib/config"

export const login = defineCommand({
  meta: {
    name: "login",
    description: "Configure credentials for Spaceship and Vercel",
  },
  args: {
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
      description: "Base domain (default: crafter.run)",
      default: "crafter.run",
    },
  },
  async run({ args }) {
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
    })

    p.log.success(`Credentials saved to ${pc.dim(getConfigPath())}`)
  },
})

export const logout = defineCommand({
  meta: {
    name: "logout",
    description: "Remove stored credentials",
  },
  async run() {
    const fs = await import("fs/promises")
    const configPath = getConfigPath()

    try {
      await fs.unlink(configPath)
      p.log.success("Credentials removed.")
    } catch {
      p.log.warning("No credentials found.")
    }
  },
})

export const whoami = defineCommand({
  meta: {
    name: "whoami",
    description: "Show current configuration",
  },
  async run() {
    const config = await loadConfig()

    if (!config) {
      p.log.warning(`Not logged in. Run ${pc.cyan("crafters login")} first.`)
      return
    }

    p.intro(pc.bgCyan(pc.black(" Current Configuration ")))

    p.log.info(`Base Domain:     ${pc.cyan(config.baseDomain)}`)
    p.log.info(
      `Spaceship Key:   ${pc.dim(config.spaceship.apiKey.slice(0, 8) + "...")}`
    )
    p.log.info(
      `Vercel Token:    ${pc.dim(config.vercel.token.slice(0, 8) + "...")}`
    )
    if (config.vercel.teamId) {
      p.log.info(`Vercel Team ID:  ${pc.dim(config.vercel.teamId)}`)
    }

    p.outro(`Config: ${pc.dim(getConfigPath())}`)
  },
})
