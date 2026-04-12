/** GitHub Actions API client for fetching workflow runs. */

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  headSha: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export class GitHubActionsClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async listWorkflowRuns(owner: string, repo: string, limit: number = 10): Promise<WorkflowRun[]> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { workflow_runs: any[] };
    return data.workflow_runs.map(run => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      headSha: run.head_sha?.slice(0, 7) ?? '',
      headBranch: run.head_branch,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      htmlUrl: run.html_url,
    }));
  }

  async getWorkflowRunLogs(owner: string, repo: string, runId: number): Promise<string> {
    return `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
  }
}
