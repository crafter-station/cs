import { defineCommand } from "citty";
import { createSpaceshipClient } from "../lib/spaceship";
import { createVercelClient } from "../lib/vercel";
import { loadConfig } from "../lib/config";

async function getConfig() {
  const fileConfig = await loadConfig();

  const apiKey = process.env.SPACESHIP_API_KEY || fileConfig?.spaceship.apiKey;
  const apiSecret =
    process.env.SPACESHIP_API_SECRET || fileConfig?.spaceship.apiSecret;
  const baseDomain =
    process.env.BASE_DOMAIN || fileConfig?.baseDomain || "crafter.run";
  const vercelToken = process.env.VERCEL_TOKEN || fileConfig?.vercel.token;
  const vercelTeamId = process.env.VERCEL_TEAM_ID || fileConfig?.vercel.teamId;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing credentials. Run `crafters login` or set SPACESHIP_API_KEY/SPACESHIP_API_SECRET"
    );
  }
  if (!vercelToken) {
    throw new Error(
      "Missing Vercel token. Run `crafters login` or set VERCEL_TOKEN"
    );
  }

  return { apiKey, apiSecret, baseDomain, vercelToken, vercelTeamId };
}

async function ghRepoView(
  fullRepo: string
): Promise<{
  url: string;
  description: string | null;
  stargazerCount: number;
  repositoryTopics: Array<{ name: string }>;
  primaryLanguage: { name: string } | null;
  isArchived: boolean;
  updatedAt: string;
} | null> {
  const proc = Bun.spawn(
    [
      "gh",
      "repo",
      "view",
      fullRepo,
      "--json",
      "url,description,stargazerCount,repositoryTopics,primaryLanguage,isArchived,updatedAt",
    ],
    { stdout: "pipe", stderr: "pipe" }
  );
  const text = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function ghCheckFile(
  fullRepo: string,
  path: string
): Promise<boolean> {
  const proc = Bun.spawn(
    ["gh", "api", `repos/${fullRepo}/contents/${path}`, "--silent"],
    { stdout: "pipe", stderr: "pipe" }
  );
  await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return exitCode === 0;
}

interface ProjectEntry {
  subdomain: string;
  domain: string;
  dnsTarget: string;
  vercel: {
    projectId: string;
    projectName: string;
    framework: string | null;
    repo: string | null;
  } | null;
  github: {
    url: string;
    description: string | null;
    stars: number;
    topics: string[];
    language: string | null;
    hasClaudeMd: boolean;
    isArchived: boolean;
    updatedAt: string;
  } | null;
}

interface ProjectsData {
  lastSync: string;
  baseDomain: string;
  projects: ProjectEntry[];
  stats: {
    totalSubdomains: number;
    totalWithVercel: number;
    totalWithGithub: number;
    totalStars: number;
  };
}

export const projectsSync = defineCommand({
  meta: {
    name: "sync",
    description:
      "Sync crafter.run subdomains with Vercel projects and GitHub repos",
  },
  args: {
    output: {
      type: "string",
      alias: "o",
      description: "Output file path for projects.json",
      default: "./projects.json",
    },
  },
  async run({ args }) {
    const config = await getConfig();

    console.log(`\nSyncing projects for ${config.baseDomain}...\n`);

    const spaceship = createSpaceshipClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseDomain: config.baseDomain,
    });

    const vercel = createVercelClient({
      token: config.vercelToken,
      teamId: config.vercelTeamId,
    });

    console.log("1. Fetching DNS records from Spaceship...");
    const dnsRecords = await spaceship.listRecords();
    const cnameRecords = dnsRecords.items.filter(
      (r) => r.type === "CNAME" && r.cname?.includes("vercel")
    );
    console.log(`   Found ${cnameRecords.length} Vercel CNAME records`);

    console.log("2. Fetching Vercel projects...");
    const vercelData = await vercel.listAllProjects();
    const vercelProjects = vercelData.projects;
    console.log(`   Found ${vercelProjects.length} projects`);

    const domainToProject = new Map<
      string,
      {
        id: string;
        name: string;
        framework: string | null;
        repo: string | null;
      }
    >();

    for (const project of vercelProjects) {
      const link = project.link as
        | { type: string; org?: string; repo?: string }
        | undefined;
      const repo =
        link?.org && link?.repo ? `${link.org}/${link.repo}` : null;
      const framework =
        typeof project.framework === "string" ? project.framework : null;

      const targets = project.targets || {};
      for (const target of Object.values(targets)) {
        if (!target) continue;
        const aliases = target.alias || [];
        for (const alias of aliases) {
          if (alias.endsWith(`.${config.baseDomain}`)) {
            const subdomain = alias.replace(`.${config.baseDomain}`, "");
            domainToProject.set(subdomain, {
              id: project.id,
              name: project.name,
              framework,
              repo,
            });
          }
        }
      }

      const projectAliases: string[] = [];
      if (project.latestDeployments) {
        for (const deploy of project.latestDeployments) {
          if (deploy.alias) {
            projectAliases.push(...deploy.alias);
          }
        }
      }
      for (const alias of projectAliases) {
        if (alias.endsWith(`.${config.baseDomain}`)) {
          const subdomain = alias.replace(`.${config.baseDomain}`, "");
          if (!domainToProject.has(subdomain)) {
            domainToProject.set(subdomain, {
              id: project.id,
              name: project.name,
              framework,
              repo,
            });
          }
        }
      }
    }

    console.log("3. Matching subdomains to Vercel projects...");
    const entries: ProjectEntry[] = [];

    for (const record of cnameRecords) {
      const subdomain = record.name;
      const vercelProject = domainToProject.get(subdomain) || null;

      if (!vercelProject) {
        for (const project of vercelProjects) {
          const link = project.link as
            | { type: string; org?: string; repo?: string }
            | undefined;
          const repo =
            link?.org && link?.repo ? `${link.org}/${link.repo}` : null;
          const framework =
            typeof project.framework === "string" ? project.framework : null;

          if (
            project.name === subdomain ||
            project.name === subdomain.replace(/-/g, "")
          ) {
            domainToProject.set(subdomain, {
              id: project.id,
              name: project.name,
              framework,
              repo,
            });
            break;
          }
        }
      }

      entries.push({
        subdomain,
        domain: `${subdomain}.${config.baseDomain}`,
        dnsTarget: record.cname || "cname.vercel-dns.com",
        vercel: domainToProject.get(subdomain) || null,
        github: null,
      });
    }

    console.log(
      `   Matched ${entries.filter((e) => e.vercel).length}/${entries.length} subdomains`
    );

    console.log("4. Fetching GitHub metadata...");
    const reposToFetch = new Set<string>();
    for (const entry of entries) {
      if (entry.vercel?.repo) {
        reposToFetch.add(entry.vercel.repo);
      }
    }

    const repoCache = new Map<string, ProjectEntry["github"]>();

    const repoPromises = [...reposToFetch].map(async (fullRepo) => {
      const [repoData, hasClaudeMd] = await Promise.all([
        ghRepoView(fullRepo),
        ghCheckFile(fullRepo, "CLAUDE.md"),
      ]);

      if (repoData) {
        repoCache.set(fullRepo, {
          url: repoData.url,
          description: repoData.description,
          stars: repoData.stargazerCount ?? 0,
          topics: (repoData.repositoryTopics || []).map((t) =>
            typeof t === "string" ? t : t.name
          ),
          language: repoData.primaryLanguage?.name || null,
          hasClaudeMd,
          isArchived: repoData.isArchived ?? false,
          updatedAt: repoData.updatedAt ?? "",
        });
      }
    });

    await Promise.all(repoPromises);
    console.log(`   Fetched metadata for ${repoCache.size} repos`);

    for (const entry of entries) {
      if (entry.vercel?.repo) {
        entry.github = repoCache.get(entry.vercel.repo) || null;
      }
    }

    entries.sort((a, b) => {
      const starsA = a.github?.stars || 0;
      const starsB = b.github?.stars || 0;
      return starsB - starsA;
    });

    const totalStars = entries.reduce(
      (sum, e) => sum + (e.github?.stars || 0),
      0
    );

    const output: ProjectsData = {
      lastSync: new Date().toISOString(),
      baseDomain: config.baseDomain,
      projects: entries,
      stats: {
        totalSubdomains: entries.length,
        totalWithVercel: entries.filter((e) => e.vercel).length,
        totalWithGithub: entries.filter((e) => e.github).length,
        totalStars,
      },
    };

    const fs = await import("fs/promises");
    const path = await import("path");

    const outputPath = path.resolve(args.output);
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

    console.log(`\nOutput: ${outputPath}`);
    console.log(`\nStats:`);
    console.log(`  Subdomains: ${output.stats.totalSubdomains}`);
    console.log(`  With Vercel: ${output.stats.totalWithVercel}`);
    console.log(`  With GitHub: ${output.stats.totalWithGithub}`);
    console.log(`  Total stars: ${output.stats.totalStars}`);
    console.log("");
  },
});

export const projects = defineCommand({
  meta: {
    name: "projects",
    description: "Manage Crafter Station projects metadata",
  },
  subCommands: {
    sync: projectsSync,
  },
});
