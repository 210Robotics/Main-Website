import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  getRedirectUrl,
  getRewrittenUrl,
} from "next/experimental/testing/server";
import { docsDomainResponse } from "@/proxy";

describe("documentation domain routing", () => {
  it("rewrites the documentation-domain root to the docs reader", () => {
    const response = docsDomainResponse(
      new NextRequest("https://docs.210robotics.com/", {
        headers: { host: "docs.210robotics.com" },
      }),
    );
    expect(response).not.toBeNull();
    expect(getRewrittenUrl(response!)).toBe(
      "https://docs.210robotics.com/docs",
    );
  });

  it("redirects public-site paths back to the main domain", () => {
    const response = docsDomainResponse(
      new NextRequest("https://docs.210robotics.com/programs/sidc?from=docs", {
        headers: { host: "docs.210robotics.com" },
      }),
    );
    expect(response).not.toBeNull();
    expect(getRedirectUrl(response!)).toBe(
      "https://210robotics.com/programs/sidc?from=docs",
    );
  });

  it("keeps the Doxygen reference on the docs hostname", () => {
    const response = docsDomainResponse(
      new NextRequest("https://docs.210robotics.com/doxygen/index.html", {
        headers: { host: "docs.210robotics.com" },
      }),
    );
    expect(response).toBeNull();
  });
});
