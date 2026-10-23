import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/ui/Modal";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import { reviewApi } from "../../../features/reviews/api/reviewApi";

const REASONS = ["wrongInfo", "notOperating", "scam", "badService", "other"] as const;
type Reason = (typeof REASONS)[number];

export function ReportCourtButton({ courtId }: { courtId: string }) {
  const { t, i18n } = useTranslation("courts");
  const navigate = useNavigate();
  const { isAuthenticated, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("wrongInfo");
  const [description, setDescription] = useState("");

  const needsDescription = reason === "other" && !description.trim();

  function close() {
    setOpen(false);
    setReason("wrongInfo");
    setDescription("");
  }

  const report = useMutation({
    mutationFn: () =>
      reviewApi.report({
        courtId,
        // Admins review reports in Vietnamese, so the reason is stored in vi whatever the viewer's language.
        reason: i18n.getFixedT("vi", "courts")(`detail.report.reasons.${reason}`),
        description: description.trim() || undefined
      }),
    onSuccess: () => {
      toast.success(t("detail.report.success"));
      close();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("detail.report.failed"))
  });

  // Only customer accounts can report (POST /reports requires role USER).
  if (isAuthenticated && !hasRole(["USER"])) return null;

  function handleOpen() {
    if (!isAuthenticated) {
      toast.info(t("detail.report.loginRequired"));
      navigate("/login");
      return;
    }
    setOpen(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (needsDescription || report.isPending) return;
    report.mutate();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <Flag className="h-3.5 w-3.5" /> {t("detail.report.button")}
      </button>

      <Modal isOpen={open} onClose={close} title={t("detail.report.title")}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500">{t("detail.report.intro")}</p>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-black text-slate-800">{t("detail.report.reasonLabel")}</legend>
            {REASONS.map((key) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                  reason === key ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={key}
                  checked={reason === key}
                  onChange={() => setReason(key)}
                  className="accent-red-600"
                />
                {t(`detail.report.reasons.${key}`)}
              </label>
            ))}
          </fieldset>

          <label className="block">
            <span className="text-sm font-black text-slate-800">{t("detail.report.descriptionLabel")}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              placeholder={t("detail.report.descriptionPlaceholder")}
              maxLength={1000}
            />
            {needsDescription && <span className="mt-1 block text-xs font-semibold text-red-600">{t("detail.report.descriptionRequired")}</span>}
          </label>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50">
              {t("detail.report.cancel")}
            </button>
            <button
              type="submit"
              disabled={needsDescription || report.isPending}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {report.isPending ? t("detail.report.submitting") : t("detail.report.submit")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
