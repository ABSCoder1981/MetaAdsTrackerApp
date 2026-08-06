"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "▦" },
      { href: "/dashboard/campaigns", label: "Campaigns", icon: "▤" },
      { href: "/dashboard/leads", label: "Leads", icon: "◎" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/alerts", label: "Alerts", icon: "▲" },
      { href: "/dashboard/ad-accounts", label: "Ad Accounts", icon: "⇄" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
      { href: "/dashboard/audit-log", label: "Audit Log", icon: "▤" },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-x-visible"
    >
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-row gap-1 md:block">
          <div className="hidden px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-faint first:pt-0 md:block">
            {section.label}
          </div>
          {section.items.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex flex-shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm ${
                  isActive
                    ? "bg-accent-tint font-medium text-accent"
                    : "text-muted hover:bg-row-hover hover:text-foreground"
                }`}
              >
                <span className="w-4 flex-shrink-0 text-center text-[13px]">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
