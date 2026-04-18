/**
 * Azure OAuth app registration via Microsoft Graph API.
 *
 * Requires a Service Principal with Application.ReadWrite.OwnedBy or
 * Application.ReadWrite.All permission on the Microsoft Graph API.
 *
 * Steps:
 *   1. Get access token from AAD using client_credentials flow
 *   2. Create app registration (POST /applications)
 *   3. Add a client secret (POST /applications/{id}/addPassword)
 *   4. Optionally add redirect URIs (PATCH /applications/{id})
 */

import * as https from 'https';

export interface AzureServicePrincipal {
  tenantId: string;
  clientId: string;      // Service Principal's own client ID (not the app being created)
  clientSecret: string;  // Service Principal's secret
}

export interface AzureAppRegistrationResult {
  appId: string;          // The new OAuth client ID
  clientSecret: string;   // The newly generated client secret value
  objectId: string;       // The Graph object ID (needed for further mutations)
  tenantId: string;
}

function httpsRequest(options: https.RequestOptions, body?: string): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(sp: AzureServicePrincipal): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: sp.clientId,
    client_secret: sp.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  }).toString();

  const result = await httpsRequest({
    hostname: 'login.microsoftonline.com',
    path: `/${sp.tenantId}/oauth2/v2.0/token`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (result.status !== 200) {
    const err = JSON.parse(result.data);
    throw new Error(err.error_description ?? `Token request failed: ${result.status}`);
  }

  const parsed = JSON.parse(result.data);
  return parsed.access_token as string;
}

async function graphPost(token: string, path: string, payload: object): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = JSON.stringify(payload);
  const result = await httpsRequest({
    hostname: 'graph.microsoft.com',
    path,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  const parsed = JSON.parse(result.data) as Record<string, unknown>;
  return { status: result.status, body: parsed };
}

async function graphPatch(token: string, path: string, payload: object): Promise<{ status: number }> {
  const body = JSON.stringify(payload);
  const result = await httpsRequest({
    hostname: 'graph.microsoft.com',
    path,
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  return { status: result.status };
}

export async function createAzureOAuthApp(
  sp: AzureServicePrincipal,
  appDisplayName: string,
  redirectUris: string[],
): Promise<AzureAppRegistrationResult> {
  const token = await getAccessToken(sp);

  // Create app registration
  const createRes = await graphPost(token, '/v1.0/applications', {
    displayName: appDisplayName,
    signInAudience: 'AzureADandPersonalMicrosoftAccount',
    web: {
      redirectUris,
      implicitGrantSettings: { enableIdTokenIssuance: false, enableAccessTokenIssuance: false },
    },
    requiredResourceAccess: [],
  });

  if (createRes.status !== 201) {
    const errMsg = (createRes.body.error as Record<string, unknown>)?.message ?? `App creation failed: ${createRes.status}`;
    throw new Error(String(errMsg));
  }

  const objectId = createRes.body.id as string;
  const appId = createRes.body.appId as string;

  // Add client secret
  const secretRes = await graphPost(token, `/v1.0/applications/${objectId}/addPassword`, {
    passwordCredential: {
      displayName: 'VibeFlow auto-generated',
      endDateTime: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 2 years
    },
  });

  if (secretRes.status !== 200) {
    const errMsg = (secretRes.body.error as Record<string, unknown>)?.message ?? `Secret creation failed: ${secretRes.status}`;
    throw new Error(String(errMsg));
  }

  const clientSecret = (secretRes.body.secretText as string) ?? '';

  return { appId, clientSecret, objectId, tenantId: sp.tenantId };
}
