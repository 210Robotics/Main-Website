import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Download,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { PageHero } from "@/components/ui";
import { getPublishedConstitution } from "@/lib/constitution";

export const metadata: Metadata = {
  title: "Constitution",
  description:
    "Read the current constitution governing 210 Robotics, a student-led robotics organization at UT San Antonio.",
};

export const dynamic = "force-dynamic";

export default async function ConstitutionPage() {
  const constitution = await getPublishedConstitution();
  return (
    <>
      <PageHero
        eyebrow="Organization governance"
        title="210 Robotics Constitution"
        body="Our constitution defines how the organization is governed, how members participate, and how student leaders remain accountable to the team."
      />
      <section className="section">
        <div className="shell">
          {constitution ? (
            <div className="grid gap-6">
              <div className="grid gap-4 border border-[#3a2b20] bg-[#100d0b] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="tag">
                      {constitution.version || "Current version"}
                    </span>
                    <span className="tag">
                      {constitution.document.mimeType === "application/pdf"
                        ? "PDF"
                        : "DOCX"}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-bold">
                    {constitution.document.title}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#999]">
                    {constitution.effectiveDate && (
                      <span className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-[#fd7803]" />
                        Effective{" "}
                        {constitution.effectiveDate.toLocaleDateString(
                          "en-US",
                          { dateStyle: "long" },
                        )}
                      </span>
                    )}
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-[#fd7803]" />
                      Approved public copy
                    </span>
                  </div>
                </div>
                <Link
                  className="button w-full justify-center sm:w-auto"
                  href="/api/constitution/file?download=1"
                >
                  <Download className="size-4" />
                  Download constitution
                </Link>
              </div>

              {constitution.document.mimeType === "application/pdf" ? (
                <iframe
                  className="h-[78vh] min-h-[620px] w-full border border-[#303030] bg-white"
                  src="/api/constitution/file"
                  title={`${constitution.version || "Current"} 210 Robotics Constitution`}
                />
              ) : (
                <article className="border border-[#303030] bg-[#f6f1e9] p-5 text-black sm:p-10 lg:p-14">
                  <div
                    className="prose-editor mx-auto max-w-4xl"
                    dangerouslySetInnerHTML={{
                      __html: constitution.document.contentHtml,
                    }}
                  />
                </article>
              )}
            </div>
          ) : (
            <div className="grid min-h-[360px] place-items-center border border-dashed border-[#3a3a3a] bg-[#0d0d0d] p-8 text-center">
              <div className="max-w-xl">
                <FileText className="mx-auto size-10 text-[#fd7803]" />
                <h2 className="mt-5 text-2xl font-bold">
                  The current constitution is being prepared.
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#888]">
                  An approved public copy will appear here as soon as an officer
                  publishes the latest version from the administration portal.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
