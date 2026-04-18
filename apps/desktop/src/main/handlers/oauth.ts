/**
 * OAuth automation IPC handlers: oauth:*
 *
 * oauth:createAzureApp — uses MS Graph API via a Service Principal to create
 *   an Azure AD app registration and return the client ID + client secret.
 */

import { ipcMain } from 'electron';
import { createAzureOAuthApp, type AzureServicePrincipal } from '../../lib/oauth-automation/azure-oauth-creator';

export function registerOAuthHandlers(): void {
  ipcMain.handle(
    'oauth:createAzureApp',
    async (
      _event,
      args: {
        sp: AzureServicePrincipal;
        appDisplayName: string;
        redirectUris: string[];
      },
    ): Promise<{ success: boolean; appId?: string; clientSecret?: string; tenantId?: string; error?: string }> => {
      try {
        const result = await createAzureOAuthApp(args.sp, args.appDisplayName, args.redirectUris);
        return {
          success: true,
          appId: result.appId,
          clientSecret: result.clientSecret,
          tenantId: result.tenantId,
        };
      } catch (err) {
        return { success: false, error: String(err instanceof Error ? err.message : err) };
      }
    },
  );
}
