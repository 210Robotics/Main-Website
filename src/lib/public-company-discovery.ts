import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const blockedHosts = new Set([
  "localhost",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "wikipedia.org",
  "yelp.com",
]);

function privateAddress(address: string) {
  return (
    /^127\./.test(address) ||
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^169\.254\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
    address === "::1" ||
    /^f[cd]/i.test(address) ||
    /^fe80:/i.test(address)
  );
}

async function safeUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Only public HTTP or HTTPS company pages can be researched.",
    );
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    blockedHosts.has(hostname) ||
    [...blockedHosts].some((item) => hostname.endsWith(`.${item}`))
  )
    throw new Error("Use the company’s own public website.");
  if (isIP(hostname) && privateAddress(hostname))
    throw new Error("Private network addresses are not allowed.");
  const addresses = await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((item) => privateAddress(item.address))
  )
    throw new Error("The company site did not resolve to a public address.");
  return url;
}

async function readHtml(value: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let url = await safeUrl(value);
    let response: Response | null = null;
    for (let redirects = 0; redirects < 5; redirects += 1) {
      response = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent":
            "210RoboticsSponsorResearch/1.0 (+https://210robotics.com)",
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location)
        throw new Error("The company website returned an invalid redirect.");
      url = await safeUrl(new URL(location, url).toString());
      response = null;
    }
    if (!response)
      throw new Error("The company website redirected too many times.");
    if (!response.ok)
      throw new Error(`Company website returned ${response.status}.`);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html"))
      throw new Error("The company page is not HTML.");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 1_500_000)
      throw new Error("The company page is too large to inspect safely.");
    return {
      html: (await response.text()).slice(0, 1_500_000),
      url: url.toString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function extractPublicContacts(html: string) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/&#64;|\s+\[at\]\s+/gi, "@");
  const emails = [
    ...text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi),
  ]
    .map((match) => match[0].toLowerCase())
    .filter((email) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(email));
  const phones = [
    ...text.matchAll(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g),
  ].map((match) => match[0].trim());
  return {
    emails: [...new Set(emails)].slice(0, 20),
    phones: [...new Set(phones)].slice(0, 20),
  };
}

function contactLinks(html: string, base: string) {
  const baseUrl = new URL(base);
  const links: string[] = [];
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (
        url.hostname === baseUrl.hostname &&
        /contact|about|sponsor|community|giving|foundation/i.test(
          `${url.pathname} ${match[1]}`,
        )
      )
        links.push(url.toString());
    } catch {}
  }
  return [...new Set(links)].slice(0, 3);
}

async function findOfficialWebsite(company: string) {
  const response = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${company} official website`)}`,
    {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 210RoboticsSponsorResearch/1.0" },
    },
  );
  if (!response.ok)
    throw new Error("Company web search is temporarily unavailable.");
  const html = await response.text();
  for (const match of html.matchAll(/uddg=([^&"']+)/g)) {
    try {
      const value = decodeURIComponent(match[1]);
      await safeUrl(value);
      return value;
    } catch {}
  }
  throw new Error(
    "No likely official company website was found. Enter its website directly.",
  );
}

export async function discoverPublicCompanyContacts(
  company: string,
  website?: string,
) {
  const initial = website?.trim() || (await findOfficialWebsite(company));
  const home = await readHtml(initial);
  const sources = [home.url];
  const pages = [home.html];
  for (const link of contactLinks(home.html, home.url)) {
    try {
      const page = await readHtml(link);
      pages.push(page.html);
      sources.push(page.url);
    } catch {}
  }
  const found = extractPublicContacts(pages.join("\n"));
  return {
    company,
    website: home.url,
    emails: found.emails,
    phones: found.phones,
    sources: [...new Set(sources)],
    researchedAt: new Date().toISOString(),
  };
}
