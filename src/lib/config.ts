import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".crafters");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface CraftersConfig {
  spaceship: {
    apiKey: string;
    apiSecret: string;
  };
  vercel: {
    token: string;
    teamId?: string;
  };
  baseDomain: string;
  sites?: {
    [domain: string]: {
      repo: string;
      dataPath?: string;
    };
  };
}

export async function saveConfig(config: CraftersConfig): Promise<void> {
  const fs = await import("fs/promises");

  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  await fs.chmod(CONFIG_FILE, 0o600);
}

export async function loadConfig(): Promise<CraftersConfig | null> {
  const fs = await import("fs/promises");

  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(data) as CraftersConfig;
  } catch {
    return null;
  }
}

export async function configExists(): Promise<boolean> {
  const fs = await import("fs/promises");

  try {
    await fs.access(CONFIG_FILE);
    return true;
  } catch {
    return false;
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
