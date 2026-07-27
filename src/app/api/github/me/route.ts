import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { operationsHubRecords } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";
import { isGitHubOauthEnabled } from "@/lib/clerk-social-connections";

export const runtime = "nodejs";

type GitHubUser = {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
  public_repos: number;
  followers: number;
  following: number;
};

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  private: boolean;
};

export async function GET() {
  const member = await requireActiveMember();
  const { userId } = await auth();
  if (!userId) return Response.json({ message: "Sign in first." }, { status: 401 });
  const client = await clerkClient();
  const oauthEnabled = await isGitHubOauthEnabled();
  const access = await client.users.getUserOauthAccessToken(userId, "github").catch(() => null);
  const token = access?.data[0]?.token;
  const [linked] = token ? [] : await getDb()
    .select({ data: operationsHubRecords.data })
    .from(operationsHubRecords)
    .where(and(
      eq(operationsHubRecords.kind, "GITHUB_ACCOUNT"),
      eq(operationsHubRecords.subjectMemberId, member.id),
      isNull(operationsHubRecords.archivedAt),
    ))
    .limit(1);
  const linkedUsername = typeof linked?.data.githubUsername === "string" ? linked.data.githubUsername : "";
  if (!token && !linkedUsername)
    return Response.json({
      connected: false,
      oauthEnabled,
      message: oauthEnabled
        ? "Connect GitHub or link a public username to load account analytics."
        : "GitHub OAuth is not enabled for this Clerk application yet. You can still link a validated public username.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "210-Robotics-Member-Portal",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  const userPath = token ? "user" : `users/${encodeURIComponent(linkedUsername)}`;
  const reposPath = token
    ? "user/repos?affiliation=owner,collaborator&sort=pushed&per_page=30"
    : `users/${encodeURIComponent(linkedUsername)}/repos?type=owner&sort=pushed&per_page=30`;
  const eventsPath = token
    ? "user/events/public?per_page=100"
    : `users/${encodeURIComponent(linkedUsername)}/events/public?per_page=100`;
  const [userResponse, reposResponse, eventsResponse] = await Promise.all([
    fetch(`https://api.github.com/${userPath}`, { headers, cache: "no-store" }),
    fetch(`https://api.github.com/${reposPath}`, { headers, cache: "no-store" }),
    fetch(`https://api.github.com/${eventsPath}`, { headers, cache: "no-store" }),
  ]);
  if (!userResponse.ok)
    return Response.json({ connected: true, message: "GitHub authorization needs to be refreshed." }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  const user = (await userResponse.json()) as GitHubUser;
  const repos = reposResponse.ok ? ((await reposResponse.json()) as GitHubRepo[]) : [];
  const events = eventsResponse.ok ? ((await eventsResponse.json()) as Array<{ type?: string; created_at?: string }>) : [];
  const cutoff = Date.now() - 30 * 86400000;
  const recentEvents = events.filter((event) => event.created_at && new Date(event.created_at).getTime() >= cutoff);
  return Response.json({
    connected: true,
    oauthEnabled,
    connectionMode: token ? "OAUTH" : "PUBLIC_PROFILE",
    profile: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      url: user.html_url,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
    },
    metrics: {
      accessibleRepos: repos.length,
      recentEvents: recentEvents.length,
      recentPushes: recentEvents.filter((event) => event.type === "PushEvent").length,
      recentPullRequests: recentEvents.filter((event) => event.type === "PullRequestEvent").length,
    },
    repositories: repos.slice(0, 12).map((repo) => ({
      id: repo.id,
      name: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      pushedAt: repo.pushed_at,
      private: repo.private,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
