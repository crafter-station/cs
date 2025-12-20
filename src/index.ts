#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { domain } from "./commands/domain";
import { login, logout, whoami } from "./commands/login";

const main = defineCommand({
  meta: {
    name: "crafters",
    version: "0.0.1",
    description: "Crafter Station CLI - Domain management for Vercel projects",
  },
  subCommands: {
    domain,
    login,
    logout,
    whoami,
  },
});

runMain(main);
