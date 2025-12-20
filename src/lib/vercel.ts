import { Vercel } from "@vercel/sdk";

interface VercelConfig {
  token: string;
  teamId?: string;
}

export function createVercelClient(config: VercelConfig) {
  const client = new Vercel({
    bearerToken: config.token,
  });

  async function addDomainToProject(projectSlug: string, domain: string) {
    const result = await client.projects.addProjectDomain({
      idOrName: projectSlug,
      teamId: config.teamId,
      requestBody: {
        name: domain,
      },
    });

    return result;
  }

  async function removeDomainFromProject(projectSlug: string, domain: string) {
    const result = await client.projects.removeProjectDomain({
      idOrName: projectSlug,
      domain,
      teamId: config.teamId,
    });

    return result;
  }

  async function getDomainConfig(projectSlug: string, domain: string) {
    const result = await client.projects.getProjectDomain({
      idOrName: projectSlug,
      domain,
      teamId: config.teamId,
    });

    return result;
  }

  async function getRecommendedCNAME(domain: string): Promise<string> {
    const result = await client.domains.getDomainConfig({
      domain,
      teamId: config.teamId,
    });

    const recommended = result.recommendedCNAME?.find((c) => c.rank === 1);
    return recommended?.value?.replace(/\.$/, "") || "cname.vercel-dns.com";
  }

  async function verifyDomain(projectSlug: string, domain: string) {
    const result = await client.projects.verifyProjectDomain({
      idOrName: projectSlug,
      domain,
      teamId: config.teamId,
    });

    return result;
  }

  async function listProjectDomains(projectSlug: string) {
    const project = await client.projects.getProject({
      idOrName: projectSlug,
      teamId: config.teamId,
    });

    return project;
  }

  return {
    addDomainToProject,
    removeDomainFromProject,
    getDomainConfig,
    getRecommendedCNAME,
    verifyDomain,
    listProjectDomains,
    client,
  };
}

export type VercelClient = ReturnType<typeof createVercelClient>;
