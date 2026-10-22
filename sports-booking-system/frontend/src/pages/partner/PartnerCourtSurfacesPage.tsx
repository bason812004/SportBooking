import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Lock, Unlock, Trash2, ArrowLeft, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { partnerApi, type PartnerCourtSurface, type PartnerSurfaceInput } from "../../features/partner/api/partnerApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { timeText } from "../../lib/format";

const blankForm = { code: "", name: "", capacity: "", surface: "", size: "", openingTime: "", closingTime: "" };
type FormValues = typeof blankForm;

export function PartnerCourtSurfacesPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation("partner");
  const client = useQueryClient();
  const [editor, setEditor] = useState<{ id: string | null; values: FormValues } | null>(null);
  const [action, setAction] = useState<{ type: "delete" | "pause"; surface: PartnerCourtSurface } | null>(null);
  const court = useQuery({ queryKey: ["partner-court", id], queryFn: () => partnerApi.courtDetail(id), staleTime: 0, refetchOnMount: "always" });
  const surfaces = useQuery({ queryKey: ["partner-court-surfaces", id], queryFn: () => partnerApi.courtSurfaces(id), staleTime: 0, refetchOnMount: "always" });
  const refresh = () => Promise.all([
    ["partner-court", id], ["partner-court-surfaces", id], ["partner-courts"],
    ["partner-court-grid", id], ["court"], ["courts"], ["court-availability"], ["weekly-schedule"]
  ].map((queryKey) => client.invalidateQueries({ queryKey })));
  const onError = (error: Error) => toast.error(error.message || t("surfaces.error"));
  const save = useMutation({
    mutationFn: ({ surfaceId, payload }: { surfaceId: string | null; payload: PartnerSurfaceInput }) => surfaceId
      ? partnerApi.updateCourtSurface(id, surfaceId, payload)
      : partnerApi.createCourtSurface(id, payload),
    onSuccess: async () => { setEditor(null); toast.success(t("surfaces.saved")); await refresh(); },
    onError
  });
  const toggle = useMutation({
    mutationFn: (row: PartnerCourtSurface) => partnerApi.updateCourtSurfaceStatus(id, row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
    onSuccess: async () => { setAction(null); toast.success(t("surfaces.saved")); await refresh(); },
    onError
  });
  const remove = useMutation({
    mutationFn: (surfaceId: string) => partnerApi.deleteCourtSurface(id, surfaceId),
    onSuccess: async () => { setAction(null); toast.success(t("surfaces.deleted")); await refresh(); },
    onError
  });
  const pending = save.isPending || toggle.isPending || remove.isPending;
  const add = () => {
    const used = new Set((surfaces.data ?? []).map((row) => {
      const match = /^s?(\d+)$/i.exec(row.code.trim());
      return match ? Number(match[1]) : null;
    }));
    let number = 1;
    while (used.has(number)) number++;
    const digits = String(number).padStart(2, "0");
    const suffix = ` - Sân ${digits}`;
    setEditor({ id: null, values: { ...blankForm, code: `S${digits}`, name: `${(court.data?.name ?? "").slice(0, 160 - suffix.length)}${suffix}` } });
  };
  const edit = (row: PartnerCourtSurface) => {
    setEditor({ id: row.id, values: {
      code: row.code, name: row.name, capacity: row.capacity ?? "", surface: row.surface ?? "", size: row.size ?? "",
      openingTime: row.openingTime ? timeText(row.openingTime) : "", closingTime: row.closingTime ? timeText(row.closingTime) : ""
    } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!editor || pending) return;
    const values = editor.values;
    const opening = values.openingTime || timeText(court.data!.openingTime);
    const closing = values.closingTime || timeText(court.data!.closingTime);
    if (opening >= closing) { toast.error(t("surfaces.invalidHours")); return; }
    save.mutate({ surfaceId: editor.id, payload: {
      code: values.code.trim(), name: values.name.trim(), capacity: values.capacity.trim() || null,
      surface: values.surface.trim() || null, size: values.size.trim() || null,
      openingTime: values.openingTime || null, closingTime: values.closingTime || null
    } });
  };
  if (court.isPending || surfaces.isPending) return <LoadingState />;
  if (court.isError || surfaces.isError) return <ErrorState message={t("surfaces.loadError")} onRetry={() => { void court.refetch(); void surfaces.refetch(); }} />;

  return (
    <div className="space-y-6">
      <Link to="/partner/courts" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16} />{t("surfaces.back")}</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">{t("surfaces.title")}</h1><p className="mt-1 text-slate-600">{court.data.name} · {t("surfaces.count", { count: surfaces.data.length })}</p></div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/partner/courts/${id}/blocks`}><Button variant="secondary"><CalendarDays size={16} />{t("surfaces.schedule")}</Button></Link>
          <Button disabled={pending || !!editor} onClick={add}><Plus size={16} />{t("surfaces.add")}</Button>
        </div>
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">{t("surfaces.help")}</p>
      {editor && (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold">{t(editor.id ? "surfaces.edit" : "surfaces.add")}</h2>
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            {(["code", "name", "capacity", "surface", "size", "openingTime", "closingTime"] as const).map((field) => (
              <Input key={field} label={t(`surfaces.${field}`)} required={field === "code" || field === "name"}
                autoFocus={field === "code"} type={field.endsWith("Time") ? "time" : "text"}
                maxLength={field === "code" ? 40 : field === "name" ? 160 : field === "capacity" ? 80 : 120}
                value={editor.values[field]} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, [field]: event.target.value } })} />
            ))}
          </fieldset>
          <p className="text-sm text-slate-500">{t("surfaces.hoursHelp", { opening: timeText(court.data.openingTime), closing: timeText(court.data.closingTime) })}</p>
          <div className="flex gap-2"><Button type="submit" disabled={pending}>{t(pending ? "surfaces.saving" : "surfaces.save")}</Button><Button type="button" variant="secondary" disabled={pending} onClick={() => setEditor(null)}>{t("surfaces.cancel")}</Button></div>
        </form>
      )}
      {!surfaces.data.length ? <EmptyState title={t("surfaces.empty")} description={t("surfaces.emptyHelp")} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {surfaces.data.map((row) => (
            <article key={row.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{t("surfaces.code")}: {row.code}</p><h2 className="mt-1 break-words text-lg font-bold">{row.name}</h2></div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${row.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{t(`surfaces.${row.status}`)}</span>
              </div>
              <dl className="space-y-2 text-sm">
                {(["capacity", "surface", "size"] as const).map((key) => <div key={key} className="flex justify-between gap-4"><dt className="text-slate-500">{t(`surfaces.${key}`)}</dt><dd className="break-words text-right">{row[key] || t("surfaces.unspecified")}</dd></div>)}
                <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("surfaces.hours")}</dt><dd>{timeText(row.openingTime || court.data.openingTime)} – {timeText(row.closingTime || court.data.closingTime)}</dd></div>
              </dl>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="secondary" disabled={pending || !!editor} onClick={() => edit(row)}><Pencil size={14} />{t("surfaces.edit")}</Button>
                <Button variant="secondary" disabled={pending || !!editor} onClick={() => row.status === "ACTIVE" ? setAction({ type: "pause", surface: row }) : toggle.mutate(row)}>{row.status === "ACTIVE" ? <Lock size={14} /> : <Unlock size={14} />}{t(row.status === "ACTIVE" ? "surfaces.pause" : "surfaces.activate")}</Button>
                <Button variant="danger" disabled={pending || !!editor} onClick={() => setAction({ type: "delete", surface: row })}><Trash2 size={14} />{t("surfaces.delete")}</Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmModal open={!!action} title={t(action?.type === "delete" ? "surfaces.deleteTitle" : "surfaces.pauseTitle")}
        message={t(action?.type === "delete" ? "surfaces.deleteHelp" : "surfaces.pauseHelp", { name: action?.surface.name })}
        onCancel={() => { if (!pending) setAction(null); }}
        onConfirm={() => { if (!action || pending) return; if (action.type === "delete") remove.mutate(action.surface.id); else toggle.mutate(action.surface); }} />
    </div>
  );
}
