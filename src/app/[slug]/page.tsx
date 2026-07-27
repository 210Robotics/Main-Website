import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomPageRenderer } from "@/components/custom-page-renderer";
import { getCustomPageBySlug } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCustomPageBySlug(slug);
  if (!page) return {};
  return {
    title: page.seoTitle || page.navLabel,
    description: page.seoDescription,
  };
}

export default async function CustomPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getCustomPageBySlug(slug);
  if (!page) notFound();
  return <CustomPageRenderer page={page} />;
}
