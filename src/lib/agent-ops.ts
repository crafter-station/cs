import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const AGENTS_DIR = join(homedir(), ".claude", "agents");
const EXECUTOR_DIR = join(homedir(), ".kai-executor");
const WORKSPACES_DIR = join(homedir(), "kai-workspaces");

export interface AgentInfo {
  name: string;
  displayName: string;
  pillar: string;
  model: string;
  keywords: string[];
  github: boolean;
  description: string;
}

function parseYamlValue(raw: string): string {
  return raw.replace(/^["']|["']$/g, "").trim();
}

function parseAgentMd(filePath: string): AgentInfo | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const fm = fmMatch[1];

    const get = (key: string): string => {
      const multiline = fm.match(new RegExp(`^${key}:\\s*>\\s*\\n([\\s\\S]*?)(?=\\n\\w|$)`, "m"));
      if (multiline) return multiline[1].replace(/\n\s+/g, " ").trim();
      const single = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return single ? parseYamlValue(single[1]) : "";
    };

    const name = get("name");
    if (!name || name === "ts-coder") return null;

    const kaiMatch = fm.match(/^kai:\s*\n((?:\s+\S.*\n?)*)/m);
    const kaiBlock = kaiMatch ? kaiMatch[1] : "";

    const getKai = (key: string): string => {
      const match = kaiBlock.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, "m"));
      return match ? parseYamlValue(match[1]) : "";
    };

    const keywordsMatch = kaiBlock.match(/^\s+keywords:\s*\n((?:\s+-\s+.+\n?)*)/m);
    const keywords = keywordsMatch
      ? keywordsMatch[1].split("\n").map((l) => l.replace(/^\s+-\s+/, "").trim()).filter(Boolean).map((v) => parseYamlValue(v))
      : [];

    return {
      name,
      displayName: getKai("displayName") || `[${name}]`,
      pillar: getKai("pillar") || "",
      model: get("model") || "sonnet",
      keywords,
      github: getKai("github") === "true",
      description: get("description"),
    };
  } catch {
    return null;
  }
}

export function listAgents(): AgentInfo[] {
  if (!existsSync(AGENTS_DIR)) return [];

  return readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseAgentMd(join(AGENTS_DIR, f)))
    .filter((a): a is AgentInfo => a !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getAgentInfo(name: string): AgentInfo | null {
  const path = join(AGENTS_DIR, `${name}.md`);
  if (!existsSync(path)) return null;
  return parseAgentMd(path);
}

export interface ExecutorConfig {
  memberId: string;
  secret: string;
  centralUrl: string;
  workspacesRoot: string;
}

export function getExecutorConfig(): ExecutorConfig | null {
  const configPath = join(EXECUTOR_DIR, "config.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

export function saveExecutorConfig(config: ExecutorConfig) {
  if (!existsSync(EXECUTOR_DIR)) {
    mkdirSync(EXECUTOR_DIR, { recursive: true });
  }
  writeFileSync(join(EXECUTOR_DIR, "config.json"), JSON.stringify(config, null, 2));
}

export function ensureWorkspacesDir() {
  if (!existsSync(WORKSPACES_DIR)) {
    mkdirSync(WORKSPACES_DIR, { recursive: true });
  }
}

export function isExecutorInstalled(): boolean {
  return existsSync(join(EXECUTOR_DIR, "config.json"));
}

const PLIST_NAME = "com.crafter.kai-executor";
const PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${PLIST_NAME}.plist`);

export function generateLaunchdPlist(binaryPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${binaryPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(EXECUTOR_DIR, "stdout.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(EXECUTOR_DIR, "stderr.log")}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${join(homedir(), ".local/bin")}</string>
  </dict>
</dict>
</plist>`;
}

export function installLaunchdAgent(binaryPath: string) {
  const plist = generateLaunchdPlist(binaryPath);
  writeFileSync(PLIST_PATH, plist);
}

export function getLaunchdPlistPath(): string {
  return PLIST_PATH;
}

export function isLaunchdInstalled(): boolean {
  return existsSync(PLIST_PATH);
}
