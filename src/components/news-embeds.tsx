import { ExternalLink } from "lucide-react";

function embedSource(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id =
        url.searchParams.get("v") ||
        url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = url.pathname.match(/\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "instagram.com") {
      const match = url.pathname.match(/^\/(p|reel|tv)\/([^/]+)/);
      return match
        ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/`
        : null;
    }
    if (host === "tiktok.com") {
      const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
      return id ? `https://www.tiktok.com/player/v1/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function NewsEmbeds({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <section className="section border-t border-[#333]">
      <div className="shell">
        <p className="eyebrow">Related coverage</p>
        <h2 className="mt-4 text-3xl font-bold">Articles and social posts</h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {urls.map((value) => {
            let url: URL;
            try {
              url = new URL(value);
            } catch {
              return null;
            }
            const source = embedSource(value);
            return source ? (
              <div
                className="overflow-hidden border border-[#333] bg-black"
                key={value}
              >
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="aspect-video w-full"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={source}
                  title={`Embedded post from ${url.hostname}`}
                />
                <a
                  className="flex items-center justify-between gap-3 border-t border-[#333] p-4 text-sm hover:text-[#fd7803]"
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open original on {url.hostname.replace(/^www\./, "")}
                  <ExternalLink className="size-4" />
                </a>
              </div>
            ) : (
              <a
                className="group flex min-h-36 items-center justify-between gap-6 border border-[#333] bg-[#0d0d0d] p-6 transition hover:border-[#fd7803]"
                href={value}
                key={value}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  <span className="eyebrow">Linked article or post</span>
                  <strong className="mt-3 block break-words text-lg">
                    {url.hostname.replace(/^www\./, "")}
                  </strong>
                  <span className="mt-2 line-clamp-2 block break-all text-xs text-[#777]">
                    {value}
                  </span>
                </span>
                <ExternalLink className="size-5 shrink-0 text-[#fd7803]" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
