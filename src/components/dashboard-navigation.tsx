"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export type DashboardNavItem = {
  value: string;
  label: string;
  href: string;
  external?: boolean;
};

export function DashboardNavigation({
  current,
  items,
  label,
}: {
  current: string;
  items: DashboardNavItem[];
  label: string;
}) {
  const router = useRouter();
  const activeItem = items.find((item) => item.value === current) ?? items[0];

  function navigate(value: string) {
    const item = items.find((candidate) => candidate.value === value);
    if (!item) return;
    if (item.external) {
      window.location.assign(item.href);
      return;
    }
    router.push(item.href);
  }

  return (
    <div className="my-7">
      <div className="dashboard-mobile-nav xl:hidden">
        <label className="dashboard-mobile-picker">
          <span>
            <small>{label}</small>
            <strong>{activeItem?.label ?? "Choose a section"}</strong>
          </span>
          <select
            aria-label={label}
            onChange={(event) => navigate(event.target.value)}
            value={activeItem?.value ?? ""}
          >
            {items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav
        className="dashboard-desktop-nav mt-3 hidden xl:grid"
        aria-label={label}
      >
        {items.map((item) =>
          item.external ? (
            <a className="dashboard-desktop-tab" href={item.href} key={item.value}>
              {item.label}
            </a>
          ) : (
            <Link
              className="dashboard-desktop-tab"
              aria-current={current === item.value ? "page" : undefined}
              href={item.href}
              key={item.value}
            >
              {item.label}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
