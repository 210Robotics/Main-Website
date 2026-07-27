import "server-only";

import { generateText } from "ai";

type TeamAiInput = {
  system: string;
  prompt: string;
  userId: string;
  feature: string;
  maxOutputTokens?: number;
  responseJsonSchema?: Record<string, unknown>;
  timeoutMs?: number;
};

type GeminiGenerateContent = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

export type GeminiMediaInput = {
  system: string;
  prompt: string;
  userId: string;
  feature: string;
  mimeType: string;
  buffer: Buffer;
  maxOutputTokens?: number;
  timeoutMs?: number;
};

export function teamAiIsConfigured() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.VERCEL,
  );
}

function logAiEvent(
  event: string,
  input: TeamAiInput,
  details: Record<string, unknown> = {},
) {
  console.info(
    JSON.stringify({
      event,
      feature: input.feature,
      promptLength: input.prompt.length,
      ...details,
    }),
  );
}

async function generateWithGoogle(input: TeamAiInput, apiKey: string) {
  const startedAt = Date.now();
  const models = [
    process.env.GEMINI_TEAM_MODEL || "gemini-flash-latest",
    process.env.GEMINI_TEAM_FALLBACK_MODEL || "gemini-3.5-flash-lite",
  ].filter((model, index, all) => all.indexOf(model) === index);
  let finalError = "Gemini was temporarily unavailable.";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: input.system }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: input.prompt }],
              },
            ],
            generationConfig: {
              maxOutputTokens: input.maxOutputTokens ?? 900,
              temperature: 0.15,
              ...(input.responseJsonSchema
                ? {
                    responseMimeType: "application/json",
                    responseJsonSchema: input.responseJsonSchema,
                  }
                : {}),
            },
          }),
          signal: AbortSignal.timeout(input.timeoutMs ?? 20_000),
        },
      );
      const payload = (await response.json()) as GeminiGenerateContent;
      if (response.ok) {
        const text = (payload.candidates || [])
          .flatMap((candidate) => candidate.content?.parts || [])
          .map((part) => part.text || "")
          .join("\n")
          .trim();
        logAiEvent("team_ai.google_succeeded", input, {
          durationMs: Date.now() - startedAt,
          model,
          attempt: attempt + 1,
          outputLength: text.length,
        });
        if (text) return text;
        finalError = "Gemini returned an empty response.";
        break;
      }
      finalError =
        payload.error?.message || `Gemini returned ${response.status}.`;
      const retryable =
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;
      logAiEvent("team_ai.google_attempt_failed", input, {
        durationMs: Date.now() - startedAt,
        model,
        attempt: attempt + 1,
        statusCode: response.status,
        errorCode: payload.error?.status || "UNKNOWN",
        retryable,
      });
      if (!retryable) break;
      await new Promise((resolve) =>
        setTimeout(resolve, 250 * (attempt + 1)),
      );
    }
  }
  throw new Error(finalError);
}

async function generateWithGateway(input: TeamAiInput) {
  const startedAt = Date.now();
  const model =
    process.env.GEMINI_GATEWAY_MODEL || "google/gemini-3.5-flash-lite";
  const result = await generateText({
    model,
    system: input.system,
    prompt: input.prompt,
    maxOutputTokens: input.maxOutputTokens ?? 900,
    abortSignal: AbortSignal.timeout(input.timeoutMs ?? 20_000),
    providerOptions: {
      gateway: {
        only: ["google"],
        user: input.userId,
        tags: ["210-robotics", input.feature],
      },
    },
  });
  const text = result.text.trim();
  logAiEvent("team_ai.gateway_succeeded", input, {
    durationMs: Date.now() - startedAt,
    model,
    outputLength: text.length,
  });
  return text || null;
}

export async function generateGeminiText(input: TeamAiInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const direct = await generateWithGoogle(input, apiKey);
      if (direct) return direct;
    } catch (error) {
      console.error(
        "Team Gemini direct request failed",
        error instanceof Error ? error.message : "Unknown Gemini error",
      );
    }
  }

  if (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL
  ) {
    try {
      return await generateWithGateway(input);
    } catch (error) {
      logAiEvent("team_ai.gateway_failed", input, {
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Unknown Gemini gateway error",
      });
    }
  }

  logAiEvent(apiKey ? "team_ai.unavailable" : "team_ai.not_configured", input);
  return null;
}

export async function generateGeminiMediaText(input: GeminiMediaInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini is not configured for meeting transcription.");
  }
  const model = process.env.GEMINI_TEAM_MODEL || "gemini-flash-latest";
  const startedAt = Date.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.system }],
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: input.prompt },
              {
                inlineData: {
                  mimeType: input.mimeType,
                  data: input.buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: input.maxOutputTokens ?? 8_192,
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 120_000),
    },
  );
  const payload = (await response.json()) as GeminiGenerateContent;
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Gemini returned ${response.status}.`,
    );
  }
  const text = (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
  logAiEvent("team_ai.media_succeeded", {
    system: input.system,
    prompt: input.prompt,
    userId: input.userId,
    feature: input.feature,
  }, {
    durationMs: Date.now() - startedAt,
    model,
    inputBytes: input.buffer.byteLength,
    outputLength: text.length,
  });
  if (!text) throw new Error("Gemini returned an empty transcript.");
  return text;
}
