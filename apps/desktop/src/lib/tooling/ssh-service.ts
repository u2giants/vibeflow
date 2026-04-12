/** SSH operations: discover hosts from ~/.ssh/config, discover keys, test connections. */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

export interface SshHost {
  name: string;
  hostname: string;
  user: string;
  port: number;
  identityFile: string | null;
}

export interface SshConnectionTestResult {
  host: string;
  success: boolean;
  latencyMs: number | null;
  error: string | null;
}

export class SshService {
  discoverHosts(): SshHost[] {
    const configPath = path.join(os.homedir(), '.ssh', 'config');
    if (!fs.existsSync(configPath)) return [];

    const content = fs.readFileSync(configPath, 'utf-8');
    const hosts: SshHost[] = [];
    let currentHost: Partial<SshHost> | null = null;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) continue;

      const [key, ...valueParts] = trimmed.split(/\s+/);
      const value = valueParts.join(' ');

      if (key.toLowerCase() === 'host') {
        if (currentHost?.name && currentHost.name !== '*') {
          hosts.push(this.finalizeHost(currentHost));
        }
        currentHost = { name: value };
      } else if (currentHost) {
        switch (key.toLowerCase()) {
          case 'hostname': currentHost.hostname = value; break;
          case 'user': currentHost.user = value; break;
          case 'port': currentHost.port = parseInt(value, 10); break;
          case 'identityfile': currentHost.identityFile = value.replace('~', os.homedir()); break;
        }
      }
    }

    if (currentHost?.name && currentHost.name !== '*') {
      hosts.push(this.finalizeHost(currentHost));
    }

    return hosts;
  }

  private finalizeHost(host: Partial<SshHost>): SshHost {
    return {
      name: host.name!,
      hostname: host.hostname ?? host.name!,
      user: host.user ?? os.userInfo().username,
      port: host.port ?? 22,
      identityFile: host.identityFile ?? null,
    };
  }

  discoverKeys(): string[] {
    const sshDir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(sshDir)) return [];

    return fs.readdirSync(sshDir)
      .filter(f => {
        const fullPath = path.join(sshDir, f);
        return !f.endsWith('.pub') && !f.endsWith('.known_hosts') &&
               f !== 'config' && f !== 'authorized_keys' &&
               fs.statSync(fullPath).isFile();
      })
      .map(f => path.join(sshDir, f));
  }

  testConnection(host: SshHost, timeoutSeconds: number = 10): Promise<SshConnectionTestResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const args = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'BatchMode=yes',
        '-o', `ConnectTimeout=${timeoutSeconds}`,
        '-p', String(host.port),
      ];

      if (host.identityFile) {
        args.push('-i', host.identityFile);
      }

      args.push(`${host.user}@${host.hostname}`, 'echo', 'vibeflow-test');

      const proc = spawn('ssh', args);
      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

      proc.on('close', (code) => {
        const latencyMs = Date.now() - startTime;
        if (code === 0 && output.includes('vibeflow-test')) {
          resolve({ host: host.name, success: true, latencyMs, error: null });
        } else {
          resolve({ host: host.name, success: false, latencyMs: null, error: errorOutput || `Exit code ${code}` });
        }
      });

      proc.on('error', (err) => {
        resolve({ host: host.name, success: false, latencyMs: null, error: err.message });
      });

      setTimeout(() => {
        proc.kill();
        resolve({ host: host.name, success: false, latencyMs: null, error: 'Connection timed out' });
      }, timeoutSeconds * 1000 + 1000);
    });
  }
}
