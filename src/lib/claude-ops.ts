import { execSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import {
  readdir,
  copyFile,
  mkdir,
  readFile,
  writeFile,
  stat,
  cp,
} from "node:fs/promises"

const CLAUDE_DX_REPO = "crafter-station/claude-dx"
const CRAFTERS_DIR = join(homedir(), ".crafters")
const CLAUDE_DX_PATH = join(CRAFTERS_DIR, "claude-dx")
const CLAUDE_CONFIG_PATH = join(homedir(), ".claude")

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function cloneOrPullRepo(): Promise<"cloned" | "updated"> {
  await mkdir(CRAFTERS_DIR, { recursive: true })

  if (await exists(CLAUDE_DX_PATH)) {
    execSync("git pull", { cwd: CLAUDE_DX_PATH, stdio: "pipe" })
    return "updated"
  } else {
    execSync(`gh repo clone ${CLAUDE_DX_REPO} ${CLAUDE_DX_PATH}`, {
      stdio: "pipe",
    })
    return "cloned"
  }
}

export async function copyCommands(
  force: boolean
): Promise<{ copied: string[]; skipped: string[] }> {
  const srcDir = join(CLAUDE_DX_PATH, ".claude/commands")
  const destDir = join(CLAUDE_CONFIG_PATH, "commands")

  await mkdir(destDir, { recursive: true })

  const entries = await readdir(srcDir, { withFileTypes: true })
  const copied: string[] = []
  const skipped: string[] = []

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)

    if ((await exists(destPath)) && !force) {
      skipped.push(entry.name)
      continue
    }

    if (entry.isDirectory()) {
      await cp(srcPath, destPath, { recursive: true })
    } else {
      await copyFile(srcPath, destPath)
    }
    copied.push(entry.name)
  }

  return { copied, skipped }
}

export async function copyAgents(): Promise<string[]> {
  const srcDir = join(CLAUDE_DX_PATH, ".claude/agents")
  const destDir = join(CLAUDE_CONFIG_PATH, "agents")

  if (!(await exists(srcDir))) return []

  await mkdir(destDir, { recursive: true })

  const files = await readdir(srcDir)
  for (const file of files) {
    await copyFile(join(srcDir, file), join(destDir, file))
  }
  return files
}

export async function copySkills(): Promise<string[]> {
  const srcDir = join(CLAUDE_DX_PATH, ".claude/skills")
  const destDir = join(CLAUDE_CONFIG_PATH, "skills")

  if (!(await exists(srcDir))) return []

  await mkdir(destDir, { recursive: true })

  const entries = await readdir(srcDir, { withFileTypes: true })
  const skills: string[] = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const srcPath = join(srcDir, entry.name)
      const destPath = join(destDir, entry.name)
      await cp(srcPath, destPath, { recursive: true })
      skills.push(entry.name)
    }
  }
  return skills
}

export async function mergeSettings(): Promise<void> {
  const srcPath = join(CLAUDE_DX_PATH, ".claude/settings.json")
  const destPath = join(CLAUDE_CONFIG_PATH, "settings.json")

  if (!(await exists(srcPath))) return

  const srcSettings = JSON.parse(await readFile(srcPath, "utf-8"))
  let destSettings: Record<string, unknown> = {}

  if (await exists(destPath)) {
    destSettings = JSON.parse(await readFile(destPath, "utf-8"))
  }

  const merged: Record<string, unknown> = { ...destSettings }

  for (const [key, value] of Object.entries(srcSettings)) {
    if (key === "permissions" && typeof value === "object" && value !== null) {
      merged.permissions = merged.permissions || {}
      const srcPerms = value as Record<string, string[]>
      const destPerms = (merged.permissions || {}) as Record<string, string[]>

      for (const [permKey, permValue] of Object.entries(srcPerms)) {
        const existing = destPerms[permKey] || []
        ;(merged.permissions as Record<string, string[]>)[permKey] = [
          ...new Set([...existing, ...permValue]),
        ]
      }
    } else if (!(key in merged)) {
      merged[key] = value
    }
  }

  await writeFile(destPath, JSON.stringify(merged, null, 2))
}

export interface InstallResult {
  repoAction: "cloned" | "updated"
  commands: { copied: string[]; skipped: string[] }
  agents: string[]
  skills: string[]
}

export async function installClaudeDx(
  force: boolean
): Promise<InstallResult> {
  const repoAction = await cloneOrPullRepo()
  const commands = await copyCommands(force)
  const agents = await copyAgents()
  const skills = await copySkills()
  await mergeSettings()

  return { repoAction, commands, agents, skills }
}

export function getClaudeDxPath(): string {
  return CLAUDE_DX_PATH
}
