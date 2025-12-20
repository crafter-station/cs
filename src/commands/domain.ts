import { defineCommand } from "citty";
import { createSpaceshipClient } from "../lib/spaceship";
import { createVercelClient } from "../lib/vercel";
import { loadConfig } from "../lib/config";

async function getConfig() {
  const fileConfig = await loadConfig();

  const apiKey = process.env.SPACESHIP_API_KEY || fileConfig?.spaceship.apiKey;
  const apiSecret = process.env.SPACESHIP_API_SECRET || fileConfig?.spaceship.apiSecret;
  const baseDomain = process.env.BASE_DOMAIN || fileConfig?.baseDomain || "crafter.run";
  const vercelToken = process.env.VERCEL_TOKEN || fileConfig?.vercel.token;
  const vercelTeamId = process.env.VERCEL_TEAM_ID || fileConfig?.vercel.teamId;

  if (!apiKey || !apiSecret) {
    throw new Error("Missing credentials. Run `crafters login` or set SPACESHIP_API_KEY/SPACESHIP_API_SECRET");
  }
  if (!vercelToken) {
    throw new Error("Missing Vercel token. Run `crafters login` or set VERCEL_TOKEN");
  }

  return { apiKey, apiSecret, baseDomain, vercelToken, vercelTeamId };
}

export const domainAdd = defineCommand({
  meta: {
    name: "add",
    description: "Add a subdomain to a Vercel project",
  },
  args: {
    subdomain: {
      type: "positional",
      description: "Subdomain to add (e.g., 'myapp' for myapp.crafter.run)",
      required: true,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Vercel project slug",
      required: true,
    },
  },
  async run({ args }) {
    const config = await getConfig();
    const fullDomain = `${args.subdomain}.${config.baseDomain}`;

    console.log(`\n🚀 Adding domain: ${fullDomain}`);
    console.log(`   Project: ${args.project}\n`);

    const spaceship = createSpaceshipClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseDomain: config.baseDomain,
    });

    const vercel = createVercelClient({
      token: config.vercelToken,
      teamId: config.vercelTeamId,
    });

    console.log("1. Adding domain to Vercel project...");
    await vercel.addDomainToProject(args.project, fullDomain);
    console.log("   ✓ Domain added to Vercel");

    console.log("2. Getting recommended CNAME from Vercel...");
    const recommendedCNAME = await vercel.getRecommendedCNAME(fullDomain);
    console.log(`   ✓ Recommended: ${recommendedCNAME}`);

    console.log("3. Creating CNAME record in Spaceship...");
    await spaceship.addCNAME(args.subdomain, recommendedCNAME);
    console.log(`   ✓ CNAME record created → ${recommendedCNAME}`);

    console.log(`\n✅ Done! ${fullDomain} is now configured.`);
    console.log("   SSL certificate will be issued automatically.\n");
  },
});

export const domainRemove = defineCommand({
  meta: {
    name: "remove",
    description: "Remove a subdomain from a Vercel project",
  },
  args: {
    subdomain: {
      type: "positional",
      description: "Subdomain to remove",
      required: true,
    },
    project: {
      type: "string",
      alias: "p",
      description: "Vercel project slug",
      required: true,
    },
  },
  async run({ args }) {
    const config = await getConfig();
    const fullDomain = `${args.subdomain}.${config.baseDomain}`;

    console.log(`\n🗑️  Removing domain: ${fullDomain}`);
    console.log(`   Project: ${args.project}\n`);

    const spaceship = createSpaceshipClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseDomain: config.baseDomain,
    });

    const vercel = createVercelClient({
      token: config.vercelToken,
      teamId: config.vercelTeamId,
    });

    console.log("1. Removing domain from Vercel project...");
    await vercel.removeDomainFromProject(args.project, fullDomain);
    console.log("   ✓ Domain removed from Vercel");

    console.log("2. Removing CNAME record from Spaceship...");
    await spaceship.removeCNAME(args.subdomain);
    console.log("   ✓ CNAME record removed");

    console.log(`\n✅ Done! ${fullDomain} has been removed.\n`);
  },
});

export const domainList = defineCommand({
  meta: {
    name: "list",
    description: "List all configured subdomains",
  },
  async run() {
    const config = await getConfig();

    console.log(`\n📋 Listing DNS records for ${config.baseDomain}\n`);

    const spaceship = createSpaceshipClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseDomain: config.baseDomain,
    });

    const records = await spaceship.listRecords();
    const cnameRecords = records.items.filter((r) => r.type === "CNAME");

    if (cnameRecords.length === 0) {
      console.log("   No CNAME records found.\n");
      return;
    }

    console.log("CNAME Records:");
    for (const record of cnameRecords) {
      console.log(`   ${record.name}.${config.baseDomain} → ${record.cname}`);
    }
    console.log(`\nTotal: ${cnameRecords.length} record(s)\n`);
  },
});

export const domain = defineCommand({
  meta: {
    name: "domain",
    description: "Manage domains for Vercel projects",
  },
  subCommands: {
    add: domainAdd,
    remove: domainRemove,
    list: domainList,
  },
});
