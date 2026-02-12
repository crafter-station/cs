import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  listAgents,
  getAgentInfo,
  saveExecutorConfig,
  ensureWorkspacesDir,
  isExecutorInstalled,
  getExecutorConfig,
  installLaunchdAgent,
  getLaunchdPlistPath,
  isLaunchdInstalled,
} from "../lib/agent-ops";

const PILLAR_COLORS: Record<string, (s: string) => string> = {
  engineering: pc.blue,
  quality: pc.yellow,
  research: pc.magenta,
  product: pc.cyan,
  "design-engineering": pc.green,
  growth: pc.red,
  "ai-research": pc.magenta,
  operations: pc.gray,
  press: pc.white,
};

export const agentList = defineCommand({
  meta: {
    name: "list",
    description: "List all installed agents",
  },
  async run() {
    const agents = listAgents();

    if (agents.length === 0) {
      p.log.warning('No agents found. Run "crafters claude update" to sync agents.');
      return;
    }

    p.intro(pc.bgCyan(pc.black(" Kai Agent Team ")));

    const maxName = Math.max(...agents.map((a) => a.name.length));
    const maxPillar = Math.max(...agents.map((a) => a.pillar.length));

    for (const agent of agents) {
      const colorFn = PILLAR_COLORS[agent.pillar] || pc.white;
      const name = agent.name.padEnd(maxName);
      const pillar = agent.pillar.padEnd(maxPillar);
      const model = agent.model;
      const gh = agent.github ? pc.green("GH") : pc.dim("--");

      p.log.info(
        `${pc.bold(name)}  ${colorFn(pillar)}  ${pc.dim(model)}  ${gh}  ${pc.dim(agent.description.slice(0, 60))}`
      );
    }

    p.outro(`${agents.length} agents installed`);
  },
});

export const agentInfo = defineCommand({
  meta: {
    name: "info",
    description: "Show detailed info about an agent",
  },
  args: {
    name: {
      type: "positional",
      description: "Agent name",
      required: true,
    },
  },
  async run({ args }) {
    const agent = getAgentInfo(args.name);

    if (!agent) {
      p.log.error(`Agent "${args.name}" not found`);
      return;
    }

    p.intro(pc.bgCyan(pc.black(` ${agent.displayName} `)));

    p.log.info(`${pc.bold("Name:")}       ${agent.name}`);
    p.log.info(`${pc.bold("Pillar:")}     ${agent.pillar}`);
    p.log.info(`${pc.bold("Model:")}      ${agent.model}`);
    p.log.info(`${pc.bold("GitHub:")}     ${agent.github ? "Yes" : "No"}`);
    p.log.info(`${pc.bold("Description:")} ${agent.description}`);

    if (agent.keywords.length > 0) {
      p.log.info(`${pc.bold("Keywords:")}   ${agent.keywords.join(", ")}`);
    }

    p.outro("");
  },
});

export const agentSetup = defineCommand({
  meta: {
    name: "setup",
    description: "Configure the Kai executor daemon",
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(" Kai Executor Setup ")));

    const existing = getExecutorConfig();
    if (existing) {
      const overwrite = await p.confirm({
        message: `Executor already configured (member: ${existing.memberId}). Overwrite?`,
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.outro("Setup cancelled");
        return;
      }
    }

    const memberId = await p.text({
      message: "Your team member ID (provided by Hunter):",
      placeholder: "e.g. anthony",
      validate(value) {
        if (!value) return "Required";
      },
    });
    if (p.isCancel(memberId)) return;

    const secret = await p.text({
      message: "Team secret (provided by Hunter):",
      placeholder: "paste secret here",
      validate(value) {
        if (!value) return "Required";
      },
    });
    if (p.isCancel(secret)) return;

    const centralUrl = await p.text({
      message: "Central server WebSocket URL:",
      initialValue: "wss://kai-central.onrender.com/ws/executor",
    });
    if (p.isCancel(centralUrl)) return;

    const s = p.spinner();

    s.start("Saving configuration");
    saveExecutorConfig({
      memberId: memberId as string,
      secret: secret as string,
      centralUrl: centralUrl as string,
      workspacesRoot: `${process.env.HOME}/kai-workspaces`,
    });
    s.stop("Configuration saved");

    s.start("Creating workspaces directory");
    ensureWorkspacesDir();
    s.stop("~/kai-workspaces/ created");

    p.log.info(pc.dim("To start the executor daemon:"));
    p.log.info(pc.bold("  bun run ~/Programming/crafter-station/kai/packages/executor/daemon.ts"));
    p.log.info("");
    p.log.info(pc.dim("Or install as launchd agent (auto-start on login):"));
    p.log.info(pc.bold("  crafters agent install-daemon"));

    p.outro(pc.green("Setup complete"));
  },
});

export const agentInstallDaemon = defineCommand({
  meta: {
    name: "install-daemon",
    description: "Install the executor as a launchd agent (auto-start)",
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(" Install Daemon ")));

    if (!isExecutorInstalled()) {
      p.log.error('Run "crafters agent setup" first');
      return;
    }

    const s = p.spinner();

    s.start("Installing launchd agent");
    const binaryPath = `${process.env.HOME}/.local/bin/bun`;
    const scriptPath = `${process.env.HOME}/Programming/crafter-station/kai/packages/executor/daemon.ts`;
    installLaunchdAgent(`${binaryPath} run ${scriptPath}`);
    s.stop("Launchd plist installed");

    const plistPath = getLaunchdPlistPath();
    p.log.info(`Plist: ${pc.dim(plistPath)}`);
    p.log.info(`Start: ${pc.bold(`launchctl load ${plistPath}`)}`);
    p.log.info(`Stop:  ${pc.bold(`launchctl unload ${plistPath}`)}`);

    p.outro(pc.green("Daemon installed"));
  },
});

export const agentStatus = defineCommand({
  meta: {
    name: "status",
    description: "Show executor daemon status",
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(" Executor Status ")));

    const config = getExecutorConfig();
    if (!config) {
      p.log.warning('Executor not configured. Run "crafters agent setup" first.');
      p.outro("");
      return;
    }

    p.log.info(`${pc.bold("Member:")}  ${config.memberId}`);
    p.log.info(`${pc.bold("Central:")} ${config.centralUrl}`);
    p.log.info(`${pc.bold("Workdir:")} ${config.workspacesRoot}`);

    const daemonInstalled = isLaunchdInstalled();
    p.log.info(`${pc.bold("Daemon:")}  ${daemonInstalled ? pc.green("installed") : pc.dim("not installed")}`);

    const agents = listAgents();
    p.log.info(`${pc.bold("Agents:")}  ${agents.length} loaded`);

    p.outro("");
  },
});

export const agent = defineCommand({
  meta: {
    name: "agent",
    description: "Manage Kai agents and executor daemon",
  },
  subCommands: {
    list: agentList,
    info: agentInfo,
    setup: agentSetup,
    status: agentStatus,
    "install-daemon": agentInstallDaemon,
  },
});
