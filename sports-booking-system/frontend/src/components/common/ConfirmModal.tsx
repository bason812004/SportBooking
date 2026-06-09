import { Button } from "../ui/Button";
import { useLanguage } from "../../lib/i18n";

type Props = {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({ open, title, message, onConfirm, onCancel }: Props) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-md bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {t("Hủy")}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t("Xác nhận")}
          </Button>
        </div>
      </div>
    </div>
  );
}
