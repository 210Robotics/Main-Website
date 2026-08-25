"use client";

import { useUser } from "@clerk/nextjs";
import { Bot, GitFork, MessageCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { linkGitHubUsername } from "@/app/portal/github-actions";

type GitHubData = {
  connected: boolean;
  oauthEnabled?: boolean;
  connectionMode?: "OAUTH" | "PUBLIC_PROFILE";
  message?: string;
  profile?: { login: string; name: string | null; avatarUrl: string; url: string; publicRepos: number; followers: number; following: number };
  metrics?: { accessibleRepos: number; recentEvents: number; recentPushes: number; recentPullRequests: number };
  repositories?: Array<{ id: number; name: string; url: string; description: string | null; language: string | null; stars: number; forks: number; openIssues: number; pushedAt: string | null; private: boolean }>;
};

export function AccountConnections({ teamAiAvailable }: { teamAiAvailable: boolean }) {
  const { isLoaded, user } = useUser();
  const [github, setGithub] = useState<GitHubData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const githubAccount = useMemo(
    () =>
      user?.externalAccounts.find((account) => account.provider === "github"),
    [user],
  );

  async function loadGitHub() {
    setBusy(true);
    try {
      const response = await fetch("/api/github/me", { cache: "no-store" });
      setGithub((await response.json()) as GitHubData);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    const controller = new AbortController();
    void fetch("/api/github/me", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((result: GitHubData) => setGithub(result))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setGithub({ connected: false, message: "GitHub analytics could not be loaded." });
      });
    return () => controller.abort();
  }, [isLoaded]);

  async function connectGitHub() {
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const redirectUrl = `${window.location.origin}/sso-callback?redirect_url=${encodeURIComponent("/portal?tab=connections")}`;
      const account = githubAccount
        ? await githubAccount.reauthorize({ redirectUrl })
        : await user.createExternalAccount({ strategy: "oauth_github", redirectUrl });
      const verificationUrl = account.verification?.externalVerificationRedirectURL;
      if (verificationUrl) window.location.assign(verificationUrl.href);
      else {
        await user.reload();
        await loadGitHub();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GitHub could not be connected. Ask an administrator to enable GitHub in Clerk.");
      setBusy(false);
    }
  }

  async function linkPublicProfile() {
    setBusy(true);
    setMessage("");
    try {
      const result = await linkGitHubUsername(githubUsername);
      setMessage(result.message);
      if (result.status === "success") await loadGitHub();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">Your integrations</p>
        <h2 className="mt-2 text-3xl font-bold">Connected accounts</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#999]">Connections belong to your signed-in 210 Robotics account. Tokens stay server-side and are never shown in the browser.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><GitFork className="size-7 text-[#fd7803]" /><div><h3 className="text-xl font-bold">GitHub</h3><p className="mt-1 text-xs text-[#777]">Account linking and contribution analytics</p></div></div><span className="tag">{githubAccount || github?.connected ? "Connected" : "Not connected"}</span></div>
          {github?.profile ? <div className="mt-6"><a className="font-bold text-[#fd7803] hover:underline" href={github.profile.url} target="_blank" rel="noreferrer">@{github.profile.login}</a><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Repos" value={github.metrics?.accessibleRepos || 0} /><Mini label="30d activity" value={github.metrics?.recentEvents || 0} /><Mini label="Pushes" value={github.metrics?.recentPushes || 0} /><Mini label="Pull requests" value={github.metrics?.recentPullRequests || 0} /></div></div> : <p className="mt-5 text-sm leading-6 text-[#999]">Sign in with GitHub once to connect the account automatically and see activity from repositories you can access.</p>}
          <div className="mt-5 flex flex-wrap gap-3">{!githubAccount && !github?.connected ? <button className="button" type="button" disabled={busy || !isLoaded || github?.oauthEnabled === false} onClick={connectGitHub}>{busy ? "Connecting…" : github?.oauthEnabled === false ? "GitHub OAuth unavailable" : "Connect GitHub"}</button> : <><button className="button secondary" type="button" disabled={busy} onClick={() => void loadGitHub()}><RefreshCw className="mr-2 inline size-4" />Refresh analytics</button>{github?.message?.toLowerCase().includes("refreshed") && github?.oauthEnabled !== false && <button className="button" type="button" disabled={busy} onClick={connectGitHub}>Reauthorize GitHub</button>}</>}</div>
          {!githubAccount && github?.connectionMode !== "OAUTH" && <div className="mt-5 border-t border-[#333] pt-5"><p className="text-xs leading-5 text-[#777]">If GitHub OAuth is unavailable, link a validated public profile. Public repositories and activity will still appear here.</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input className="input" value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} placeholder="GitHub username" aria-label="GitHub username" /><button className="button secondary shrink-0" type="button" disabled={busy || !githubUsername.trim()} onClick={() => void linkPublicProfile()}>Link public profile</button></div></div>}
          {(message || github?.message) && <p className="mt-4 text-xs leading-5 text-[#d9a67d]" aria-live="polite">{message || github?.message}</p>}
        </section>
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><MessageCircle className="size-7 text-[#fd7803]" /><div><h3 className="text-xl font-bold">Discord</h3><p className="mt-1 text-xs text-[#777]">Verified identity, nickname, and team access</p></div></div></div>
          <p className="mt-5 text-sm leading-7 text-[#999]">Connect through Discord OAuth using your signed-in member account. The portal uses your stable Discord ID—never your changeable username—and shows every remaining verification step before private channels unlock.</p>
          <div className="mt-5"><Link className="button" href="/verify">Open verification checklist</Link></div>
        </section>
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><Bot className="size-7 text-[#fd7803]" /><div><h3 className="text-xl font-bold">210 AI Assistant</h3><p className="mt-1 text-xs text-[#777]">Team knowledge, entries, and BOM help</p></div></div><span className="tag">{teamAiAvailable ? "Gemini ready" : "Gemini unavailable"}</span></div>
          <p className="mt-5 text-sm leading-7 text-[#999]">The assistant is linked to your 210 Robotics login for access control, source permissions, and activity attribution. Gemini is the only AI model used. Straightforward commands can still be recognized instantly before Gemini is needed, and every write remains permission-checked and audited.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link className="button" href="/admin?tab=assistant">Open assistant</Link></div>
        </section>
      </div>
      {!!github?.repositories?.length && <section className="card p-6"><div className="flex items-end justify-between gap-4"><div><h3 className="text-xl font-bold">Your repository activity</h3><p className="mt-2 text-sm text-[#888]">Recently updated repositories visible through your GitHub connection.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{github.repositories.map((repo) => <a className="border border-[#333] p-4 transition hover:border-[#fd7803]" href={repo.url} target="_blank" rel="noreferrer" key={repo.id}><div className="flex items-start justify-between gap-3"><strong className="text-[#fd7803]">{repo.name}</strong>{repo.private && <span className="tag">Private</span>}</div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#888]">{repo.description || "No description."}</p><p className="mt-3 text-[.68rem] text-[#666]">{repo.language || "Repository"} · {repo.stars} stars · {repo.openIssues} open issues</p></a>)}</div></section>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div className="border border-[#333] p-3 text-center"><strong className="block text-lg text-[#fd7803]">{value}</strong><span className="mt-1 block text-[.65rem] uppercase tracking-wider text-[#777]">{label}</span></div>;
}
