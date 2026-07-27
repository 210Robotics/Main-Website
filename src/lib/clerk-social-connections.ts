import "server-only";

type ClerkEnvironment = {
  auth_config?: {
    identification_strategies?: unknown;
    social?: unknown;
  };
};

function clerkFrontendHost() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const encoded = publishableKey?.match(/^pk_(?:test|live)_(.+)$/)?.[1];
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  } catch {
    return null;
  }
}

function includesGitHub(value: unknown): boolean {
  if (typeof value === "string")
    return value.toLowerCase().includes("github");
  if (Array.isArray(value)) return value.some(includesGitHub);
  if (value && typeof value === "object")
    return Object.entries(value).some(
      ([key, nested]) =>
        key.toLowerCase().includes("github") || includesGitHub(nested),
    );
  return false;
}

export async function isGitHubOauthEnabled() {
  const host = clerkFrontendHost();
  if (!host) return false;
  try {
    const response = await fetch(`https://${host}/v1/environment`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return false;
    const environment = (await response.json()) as ClerkEnvironment;
    return (
      includesGitHub(environment.auth_config?.identification_strategies) ||
      includesGitHub(environment.auth_config?.social)
    );
  } catch {
    return false;
  }
}
