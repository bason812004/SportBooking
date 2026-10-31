import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/common/ConfirmModal";

/**
 * Asks before leaving a form with unsaved changes: closing or reloading the tab gets the browser's own prompt, and a
 * link inside the app (sidebar, header) gets a confirm dialog. The app uses BrowserRouter, which has no navigation
 * blocker, so in-app links are caught on their way to React Router. Render the returned element in the page.
 */
export function useUnsavedChangesGuard(dirty: boolean, message = "Các thay đổi chưa lưu sẽ bị mất. Vẫn rời trang?") {
  const navigate = useNavigate();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      // Captured before React Router's own handler sees the click.
      event.preventDefault();
      event.stopPropagation();
      setTarget(next);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return (
    <ConfirmModal
      open={Boolean(target)}
      title="Rời trang?"
      message={message}
      onCancel={() => setTarget(null)}
      onConfirm={() => {
        const next = target;
        setTarget(null);
        if (next) navigate(next);
      }}
    />
  );
}
