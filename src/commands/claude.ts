import { defineCommand } from "citty";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  readdir,
  copyFile,
  mkdir,
  readFile,
  writeFile,
  stat,
  cp,
} from "node:fs/promises";

const CLAUDE_DX_REPO = "crafter-station/claude-dx";
const CLAUDE_DX_PATH = join(homedir(), "Programming/crafter-station/claude-dx");
const CLAUDE_CONFIG_PATH = join(homedir(), ".claude");

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function cloneOrPullRepo(): Promise<void> {
  if (await exists(CLAUDE_DX_PATH)) {
    console.log("Updating claude-dx...");
    execSync("git pull", { cwd: CLAUDE_DX_PATH, stdio: "inherit" });
  } else {
    console.log("Cloning claude-dx...");
    execSync(`gh repo clone ${CLAUDE_DX_REPO} ${CLAUDE_DX_PATH}`, {
      stdio: "inherit",
    });
  }
}

async function copyCommands(
  force: boolean,
): Promise<{ copied: number; skipped: number }> {
  const srcDir = join(CLAUDE_DX_PATH, ".claude/commands");
  const destDir = join(CLAUDE_CONFIG_PATH, "commands");

  await mkdir(destDir, { recursive: true });

  const entries = await readdir(srcDir, { withFileTypes: true });
  let copied = 0;
  let skipped = 0;

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if ((await exists(destPath)) && !force) {
      console.log(`   Skip: ${entry.name} (exists)`);
      skipped++;
      continue;
    }

    if (entry.isDirectory()) {
      await cp(srcPath, destPath, { recursive: true });
    } else {
      await copyFile(srcPath, destPath);
    }
    console.log(`   Copy: ${entry.name}`);
    copied++;
  }

  return { copied, skipped };
}

async function copyAgents(): Promise<number> {
  const srcDir = join(CLAUDE_DX_PATH, ".claude/agents");
  const destDir = join(CLAUDE_CONFIG_PATH, "agents");

  if (!(await exists(srcDir))) return 0;

  await mkdir(destDir, { recursive: true });

  const files = await readdir(srcDir);
  for (const file of files) {
    await copyFile(join(srcDir, file), join(destDir, file));
    console.log(`   Copy: ${file}`);
  }
  return files.length;
}

async function mergeSettings(): Promise<void> {
  const srcPath = join(CLAUDE_DX_PATH, ".claude/settings.json");
  const destPath = join(CLAUDE_CONFIG_PATH, "settings.json");

  if (!(await exists(srcPath))) return;

  const srcSettings = JSON.parse(await readFile(srcPath, "utf-8"));
  let destSettings: Record<string, unknown> = {};

  if (await exists(destPath)) {
    destSettings = JSON.parse(await readFile(destPath, "utf-8"));
  }

  const merged: Record<string, unknown> = { ...destSettings };

  for (const [key, value] of Object.entries(srcSettings)) {
    if (key === "permissions" && typeof value === "object" && value !== null) {
      merged.permissions = merged.permissions || {};
      const srcPerms = value as Record<string, string[]>;
      const destPerms = (merged.permissions || {}) as Record<string, string[]>;

      for (const [permKey, permValue] of Object.entries(srcPerms)) {
        const existing = destPerms[permKey] || [];
        (merged.permissions as Record<string, string[]>)[permKey] = [
          ...new Set([...existing, ...permValue]),
        ];
      }
    } else if (!(key in merged)) {
      merged[key] = value;
    }
  }

  await writeFile(destPath, JSON.stringify(merged, null, 2));
  console.log("   Merged settings.json");
}

async function runInstall(force: boolean): Promise<void> {
  console.log("\n1. Syncing claude-dx repo...");
  await cloneOrPullRepo();

  console.log("\n2. Installing commands...");
  const { copied, skipped } = await copyCommands(force);

  console.log("\n3. Installing agents...");
  const agentCount = await copyAgents();

  console.log("\n4. Merging settings...");
  await mergeSettings();

  console.log(
    `\nDone! ${copied} commands installed, ${skipped} skipped, ${agentCount} agents installed.`,
  );
  if (skipped > 0 && !force) {
    console.log("Use 'crafters claude update' to overwrite existing commands.\n");
  }
}

export const claudeInstall = defineCommand({
  meta: {
    name: "install",
    description: "Install Claude Code commands and agents from claude-dx",
  },
  args: {
    force: {
      type: "boolean",
      alias: "f",
      description: "Overwrite existing commands",
      default: false,
    },
  },
  async run({ args }) {
    await runInstall(args.force);
  },
});

export const claudeUpdate = defineCommand({
  meta: {
    name: "update",
    description: "Update Claude Code commands and agents from claude-dx",
  },
  async run() {
    await runInstall(true);
  },
});

export const claude = defineCommand({
  meta: {
    name: "claude",
    description: "Manage Claude Code configuration",
  },
  subCommands: {
    install: claudeInstall,
    update: claudeUpdate,
  },
});
