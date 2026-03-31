#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { agent } from "./commands/agent";
import { claude } from "./commands/claude";
import { clerk } from "./commands/clerk";
import { domain } from "./commands/domain";
import { login, logout, whoami } from "./commands/login";
import { projects } from "./commands/projects";
import { schema } from "./commands/schema";

const mcp = defineCommand({
  meta: {
    name: "mcp",
    description: "Start MCP server over stdio (for AI agents)",
  },
  async run() {
    const { startMcpServer } = await import("./mcp/server");
    await startMcpServer();
  },
});

const tui = defineCommand({
  meta: {
    name: "tui",
    description: "Launch interactive terminal UI",
  },
  async run() {
    const { launchTUI } = await import("./tui/app");
    await launchTUI();
  },
});

const main = defineCommand({
  meta: {
    name: "crafters",
    version: "0.4.0",
    description:
      "Crafter Station CLI - Domain management, agent infrastructure, and Claude Code configuration",
  },
  subCommands: {
    agent,
    claude,
    clerk,
    domain,
    projects,
    login,
    logout,
    whoami,
    schema,
    mcp,
    tui,
  },
});

runMain(main);
