const SPACESHIP_API_URL = "https://spaceship.dev/api/v1";

interface SpaceshipConfig {
  apiKey: string;
  apiSecret: string;
  baseDomain: string;
}

export function createSpaceshipClient(config: SpaceshipConfig) {
  const headers = {
    "X-Api-Key": config.apiKey,
    "X-Api-Secret": config.apiSecret,
    "Content-Type": "application/json",
  };

  async function addCNAME(subdomain: string, target = "cname.vercel-dns.com") {
    const response = await fetch(
      `${SPACESHIP_API_URL}/dns/records/${config.baseDomain}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          force: true,
          items: [
            {
              type: "CNAME",
              name: subdomain,
              cname: target,
              ttl: 3600,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Spaceship API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return { success: true, subdomain, target };
  }

  async function removeCNAME(subdomain: string, target = "cname.vercel-dns.com") {
    const response = await fetch(
      `${SPACESHIP_API_URL}/dns/records/${config.baseDomain}`,
      {
        method: "DELETE",
        headers,
        body: JSON.stringify([
          {
            type: "CNAME",
            name: subdomain,
            cname: target,
          },
        ]),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Spaceship API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return { success: true, subdomain };
  }

  async function listRecords() {
    const response = await fetch(
      `${SPACESHIP_API_URL}/dns/records/${config.baseDomain}?take=100&skip=0`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Spaceship API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return response.json() as Promise<{
      items: Array<{ type: string; name: string; cname?: string; ttl: number }>;
      total: number;
    }>;
  }

  return {
    addCNAME,
    removeCNAME,
    listRecords,
  };
}

export type SpaceshipClient = ReturnType<typeof createSpaceshipClient>;
