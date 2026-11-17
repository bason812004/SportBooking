import type { ReactNode } from "react";

type ServiceImageProps = {
  src?: string | null;
  alt: string;
  /** Box size and shape, e.g. "h-28 w-full rounded-xl" or "h-9 w-9 shrink-0 rounded-lg". */
  className?: string;
  /** Rendered instead of the image when there is none — a letter tile, a placeholder, or nothing. */
  fallback?: ReactNode;
};

/**
 * Product pictures come in every aspect ratio their partner happened to photograph, so the image
 * is fitted inside the box (`object-contain`) rather than cropped to fill it: a baguette shot wide
 * would otherwise lose both ends. The tinted background fills whatever the picture doesn't cover.
 *
 * Every service image in the app goes through here, so switching the whole system back to cropping
 * is a one-line change rather than seven.
 */
export function ServiceImage({ src, alt, className = "", fallback = null }: ServiceImageProps) {
  if (!src) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`border border-slate-200 bg-slate-50 object-contain p-1 ${className}`}
    />
  );
}
