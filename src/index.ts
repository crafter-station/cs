#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { claude } from "./commands/claude";
import { domain } from "./commands/domain";
import { login, logout, whoami } from "./commands/login";

const main = defineCommand({
  meta: {
    name: "crafters",
    version: "0.2.0",
    description: "Crafter Station CLI - Domain management and Claude Code configuration",
  },
  subCommands: {
    claude,
    domain,
    login,
    logout,
    whoami,
  },
});

runMain(main);
