export type CustomPageStatus = "DRAFT" | "PUBLISHED";

export type CustomPageSectionLayout =
  | "image-right"
  | "image-left"
  | "wide-image"
  | "text-only";

export type CustomPageSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  layout: CustomPageSectionLayout;
  buttonLabel: string;
  buttonHref: string;
};

export type CustomPage = {
  id: string;
  slug: string;
  navLabel: string;
  seoTitle: string;
  seoDescription: string;
  status: CustomPageStatus;
  showInNavigation: boolean;
  navigationOrder: number;
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  heroImage: string;
  showJoinCta: boolean;
  sections: CustomPageSection[];
  updatedAt: string;
};

export const customPageSectionLayouts: {
  value: CustomPageSectionLayout;
  label: string;
}[] = [
  { value: "image-right", label: "Text left, image right" },
  { value: "image-left", label: "Image left, text right" },
  { value: "wide-image", label: "Wide image feature" },
  { value: "text-only", label: "Text only" },
];

export const reservedCustomPageSlugs = new Set([
  "about",
  "admin",
  "api",
  "attendance",
  "contact",
  "docs",
  "doxygen",
  "events",
  "f",
  "icon.png",
  "join",
  "manifest.webmanifest",
  "media",
  "members",
  "news",
  "p",
  "pending",
  "portal",
  "programs",
  "projects",
  "register",
  "resources",
  "robots.txt",
  "sign-in",
  "sitemap.xml",
  "sponsors",
  "team",
]);

export function normalizeCustomPageSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isAvailableCustomPageSlug(
  slug: string,
  pages: readonly CustomPage[],
  currentPageId?: string,
) {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    !reservedCustomPageSlugs.has(slug) &&
    !pages.some((page) => page.id !== currentPageId && page.slug === slug)
  );
}

export function sortCustomPages(pages: readonly CustomPage[]) {
  return [...pages].sort(
    (a, b) =>
      a.navigationOrder - b.navigationOrder ||
      a.navLabel.localeCompare(b.navLabel),
  );
}

export function createCustomPageDraft({
  id,
  label,
  slug,
  now,
}: {
  id: string;
  label: string;
  slug: string;
  now: string;
}): CustomPage {
  return {
    id,
    slug,
    navLabel: label,
    seoTitle: label,
    seoDescription: `Learn more about ${label} at 210 Robotics.`,
    status: "DRAFT",
    showInNavigation: false,
    navigationOrder: 100,
    heroEyebrow: "210 Robotics",
    heroTitle: label,
    heroBody: "Add an introduction for this page in the Website Pages editor.",
    heroImage: "",
    showJoinCta: false,
    sections: [],
    updatedAt: now,
  };
}

export function customPageRoute(page: Pick<CustomPage, "slug">) {
  return `/${page.slug}`;
}
