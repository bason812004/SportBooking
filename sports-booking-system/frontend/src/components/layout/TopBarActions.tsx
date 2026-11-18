import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The spot in the dashboard's top bar, left of the notification bell, where a page can put its own buttons. */
export const TopBarSlotContext = createContext<HTMLElement | null>(null);

/**
 * Renders a page's buttons in the dashboard's top bar, next to the bell, instead of in a row of their own. Outside
 * the dashboard (no top bar) they render where they are.
 */
export function TopBarActions({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarSlotContext);
  return slot ? createPortal(children, slot) : <>{children}</>;
}
