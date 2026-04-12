/** Health check utility for monitoring deployed app status. */

export interface HealthCheckResult {
  url: string;
  status: 'healthy' | 'unhealthy' | 'unreachable';
  httpStatus: number | null;
  responseTimeMs: number | null;
  checkedAt: string;
  error: string | null;
}

export async function runHealthCheck(url: string, timeoutMs: number = 10000): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;

    return {
      url,
      status: response.ok ? 'healthy' : 'unhealthy',
      httpStatus: response.status,
      responseTimeMs,
      checkedAt,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      url,
      status: 'unreachable',
      httpStatus: null,
      responseTimeMs: null,
      checkedAt,
      error: String(err),
    };
  }
}
