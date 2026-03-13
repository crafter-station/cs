const CLERK_PLATFORM_API_URL = "https://api.clerk.com/v1/platform"

interface ClerkPlatformConfig {
  token: string
}

export interface PlatformInstance {
  instance_id: string
  environment_type: string
  publishable_key?: string
  secret_key?: string
}

export interface PlatformApplication {
  application_id: string
  name: string
  instances: PlatformInstance[]
}

export interface CnameTarget {
  host: string
  value: string
}

export interface PlatformDomain {
  id: string
  name: string
  cname_targets: CnameTarget[]
}

export interface PlatformDomainStatus {
  id: string
  name: string
  dns_status: string
  ssl_status: string
}

export function createClerkPlatformClient(config: ClerkPlatformConfig) {
  const headers = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${CLERK_PLATFORM_API_URL}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `Clerk Platform API error: ${response.status} - ${JSON.stringify(error)}`
      )
    }

    return response.json() as Promise<T>
  }

  async function listApplications(includeSecretKeys = false) {
    const params = includeSecretKeys ? "?include_secret_keys=true" : ""
    const result = await request<PlatformApplication[] | { data: PlatformApplication[] }>(`/applications${params}`)
    return Array.isArray(result) ? result : result.data
  }

  async function createApplication(opts: {
    name: string
    template?: string
    domain?: string
    environment_types?: string[]
  }) {
    return request<PlatformApplication>("/applications", {
      method: "POST",
      body: JSON.stringify(opts),
    })
  }

  async function getApplication(appId: string, includeSecretKeys = false) {
    const params = includeSecretKeys ? "?include_secret_keys=true" : ""
    return request<PlatformApplication>(`/applications/${appId}${params}`)
  }

  async function updateProductionDomain(
    appId: string,
    opts: { name: string; proxy_path?: string }
  ) {
    return request<unknown>(`/applications/${appId}/domain`, {
      method: "PATCH",
      body: JSON.stringify(opts),
    })
  }

  async function listDomains(appId: string) {
    const result = await request<PlatformDomain[] | { data: PlatformDomain[] }>(`/applications/${appId}/domains`)
    return Array.isArray(result) ? result : result.data
  }

  async function triggerDnsCheck(appId: string, domainIdOrName: string) {
    return request<unknown>(
      `/applications/${appId}/domains/${domainIdOrName}/dns_check`,
      { method: "POST" }
    )
  }

  async function getDomainStatus(appId: string, domainIdOrName: string) {
    return request<PlatformDomainStatus>(
      `/applications/${appId}/domains/${domainIdOrName}/status`
    )
  }

  return {
    listApplications,
    createApplication,
    getApplication,
    updateProductionDomain,
    listDomains,
    triggerDnsCheck,
    getDomainStatus,
  }
}

export type ClerkPlatformClient = ReturnType<typeof createClerkPlatformClient>
