import "server-only";

export type GitHubRepoAnalytics = {
  url: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  contributors: number;
  recentCommits: number;
  pushedAt: string | null;
  error?: string;
};

function repositoryName(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname !== "github.com") return null;
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    return owner && repo ? `${owner}/${repo.replace(/\.git$/, "")}` : null;
  } catch {
    return /^[\w.-]+\/[\w.-]+$/.test(value) ? value : null;
  }
}

export async function getGitHubRepoAnalytics(urls: string[]) {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "210-Robotics-Team-OS",
  };
  if (process.env.GITHUB_TOKEN)
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return Promise.all(
    [...new Set(urls)].slice(0, 12).map(async (url) => {
      const fullName = repositoryName(url);
      if (!fullName)
        return {
          url,
          fullName: url,
          description: "",
          language: "",
          stars: 0,
          forks: 0,
          openIssues: 0,
          watchers: 0,
          contributors: 0,
          recentCommits: 0,
          pushedAt: null,
          error: "Enter a valid github.com owner/repository URL.",
        } satisfies GitHubRepoAnalytics;
      try {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const [repoResponse, contributorsResponse, commitsResponse] =
          await Promise.all([
            fetch(`https://api.github.com/repos/${fullName}`, {
              headers,
              next: { revalidate: 900 },
            }),
            fetch(
              `https://api.github.com/repos/${fullName}/contributors?per_page=100&anon=1`,
              { headers, next: { revalidate: 900 } },
            ),
            fetch(
              `https://api.github.com/repos/${fullName}/commits?since=${encodeURIComponent(since)}&per_page=100`,
              { headers, next: { revalidate: 900 } },
            ),
          ]);
        if (!repoResponse.ok)
          throw new Error(
            repoResponse.status === 404
              ? "Repository not found or private."
              : `GitHub returned ${repoResponse.status}.`,
          );
        const repo = (await repoResponse.json()) as {
          html_url: string;
          full_name: string;
          description: string | null;
          language: string | null;
          stargazers_count: number;
          forks_count: number;
          open_issues_count: number;
          subscribers_count: number;
          pushed_at: string | null;
        };
        const contributors = contributorsResponse.ok
          ? ((await contributorsResponse.json()) as unknown[]).length
          : 0;
        const recentCommits = commitsResponse.ok
          ? ((await commitsResponse.json()) as unknown[]).length
          : 0;
        return {
          url: repo.html_url,
          fullName: repo.full_name,
          description: repo.description || "",
          language: repo.language || "",
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          openIssues: repo.open_issues_count,
          watchers: repo.subscribers_count,
          contributors,
          recentCommits,
          pushedAt: repo.pushed_at,
        } satisfies GitHubRepoAnalytics;
      } catch (error) {
        return {
          url,
          fullName,
          description: "",
          language: "",
          stars: 0,
          forks: 0,
          openIssues: 0,
          watchers: 0,
          contributors: 0,
          recentCommits: 0,
          pushedAt: null,
          error: error instanceof Error ? error.message : "GitHub data unavailable.",
        } satisfies GitHubRepoAnalytics;
      }
    }),
  );
}
