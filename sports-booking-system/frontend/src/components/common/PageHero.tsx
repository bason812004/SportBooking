import type { ReactNode } from "react";

/**
 * Formerly the green page banner. Pages show no banner any more: the dashboard top bar already names the page, so
 * title, eyebrow and subtitle are accepted but not rendered. What a page put in the banner still shows, as one row
 * above its content: filters and other children on the left, buttons (actions) on the right.
 */
export function PageHero({
  actions,
  children
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  if (!actions && !children) return null;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      {children && <div className="flex flex-wrap justify-start">{children}</div>}
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
