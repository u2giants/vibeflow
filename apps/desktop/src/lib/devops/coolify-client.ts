/** Coolify API client for deploy, restart, and stop operations. */

export interface CoolifyApp {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  url: string | null;
}

export interface CoolifyDeployResult {
  success: boolean;
  deploymentId: string | null;
  error: string | null;
}

export class CoolifyClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getApp(appId: string): Promise<CoolifyApp> {
    const response = await fetch(`${this.baseUrl}/api/v1/applications/${appId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Coolify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return {
      id: data.uuid ?? appId,
      name: data.name ?? 'Unknown',
      status: data.status ?? 'unknown',
      url: data.fqdn ?? null,
    };
  }

  async deploy(appId: string): Promise<CoolifyDeployResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/applications/${appId}/deploy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, deploymentId: null, error: `${response.status}: ${text}` };
      }

      const data = await response.json() as any;
      return { success: true, deploymentId: data.deployment_uuid ?? null, error: null };
    } catch (err) {
      return { success: false, deploymentId: null, error: String(err) };
    }
  }

  async restart(appId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/applications/${appId}/restart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return { success: response.ok, error: response.ok ? null : `${response.status}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async stop(appId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/applications/${appId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return { success: response.ok, error: response.ok ? null : `${response.status}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
