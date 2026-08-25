import { config } from "dotenv";
import { discordApplicationCommands } from "../src/lib/discord-commands";

config({ path: ".env.local", quiet: true });

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com"
).replace(/\/$/, "");

async function discordRequest(path: string, init: RequestInit) {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Discord setup failed (${response.status}): ${detail}`);
  }
  return response;
}

async function verifyGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error(
        "GEMINI_API_KEY is missing from the production environment.",
      );
    }
    console.log(
      "Gemini production health check skipped because its key is not available locally.",
    );
    return;
  }
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Reply with the single word READY.",
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 128,
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    error?: { message?: string };
  };
  const answer = (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
  if (!response.ok || !answer) {
    throw new Error(
      payload.error?.message ||
        `Gemini production health check failed (${response.status}).`,
    );
  }
  console.log("Gemini production health check succeeded.");
}

async function main() {
  await verifyGemini().catch((error: unknown) => {
    console.warn(
      `Gemini health check warning: ${
        error instanceof Error ? error.message : "Gemini is unavailable."
      }`,
    );
  });
  if (!token || !applicationId || !guildId) {
    console.log(
      "Discord command registration skipped because deployment credentials are not available.",
    );
    return;
  }
  await discordRequest("/applications/@me", {
    method: "PATCH",
    body: JSON.stringify({
      interactions_endpoint_url: `${siteUrl}/api/discord/interactions`,
    }),
  });
  const response = await discordRequest(
    `/applications/${applicationId}/guilds/${guildId}/commands`,
    {
      method: "PUT",
      body: JSON.stringify(discordApplicationCommands),
    },
  );
  const commands = (await response.json()) as Array<{ name: string }>;
  console.log(
    `Discord interaction endpoint verified and ${commands.length} guild commands registered.`,
  );
}

main().catch((error) => {
  console.warn(
    `Deployment integration check warning: ${
      error instanceof Error ? error.message : "Discord setup failed."
    }`,
  );
});
