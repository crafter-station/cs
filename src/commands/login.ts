import { defineCommand } from "citty";
import { saveConfig, loadConfig, getConfigPath } from "../lib/config";

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
    });

    console.log(`\n✅ Credentials saved to ${getConfigPath()}\n`);
  },
});

export const logout = defineCommand({
  meta: {
    name: "logout",
    description: "Remove stored credentials",
  },
  async run() {
    const fs = await import("fs/promises");
    const configPath = getConfigPath();

    try {
      await fs.unlink(configPath);
      console.log("\n✅ Credentials removed.\n");
    } catch {
      console.log("\n⚠️  No credentials found.\n");
    }
  },
});

export const whoami = defineCommand({
  meta: {
    name: "whoami",
    description: "Show current configuration",
  },
  async run() {
    const config = await loadConfig();

    if (!config) {
      console.log("\n⚠️  Not logged in. Run `crafters login` first.\n");
      return;
    }

    console.log("\n📋 Current Configuration\n");
    console.log(`   Base Domain: ${config.baseDomain}`);
    console.log(`   Spaceship API Key: ${config.spaceship.apiKey.slice(0, 8)}...`);
    console.log(`   Vercel Token: ${config.vercel.token.slice(0, 8)}...`);
    if (config.vercel.teamId) {
      console.log(`   Vercel Team ID: ${config.vercel.teamId}`);
    }
    console.log(`\n   Config file: ${getConfigPath()}\n`);
  },
});
