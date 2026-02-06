#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { claude } from "./commands/claude";
import { domain } from "./commands/domain";
import { login, logout, whoami } from "./commands/login";

const subCommands = {
  claude,
  domain,
  login,
  logout,
  whoami,
};

const hasSubCommand = process.argv
  .slice(2)
  .some((arg) => !arg.startsWith("-") && arg in subCommands);

const main = defineCommand({
  meta: {
    name: "crafters",
    version: "0.3.1",
    description:
      "Crafter Station CLI - Domain management and Claude Code configuration",
  },
  subCommands,
  ...(!hasSubCommand && {
    async run() {
      const { launchTUI } = await import("./tui/app");
      await launchTUI();
    },
  }),
});

runMain(main);
