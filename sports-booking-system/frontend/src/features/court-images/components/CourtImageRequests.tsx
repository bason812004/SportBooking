import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "../../../components/ui/Button";
import { ErrorState, LoadingState } from "../../../components/common/States";
import { courtImageApi, type CourtImageRequest } from "../api/courtImageApi";

export function CourtImageRequests({ courtId }: { courtId?: string }) {
  const { t } = useTranslation("partner");
  const client = useQueryClient();
  const requests = useQuery({
    queryKey: ["court-image-requests", courtId ?? "admin"],
    queryFn: () => courtId ? courtImageApi.list(courtId) : courtImageApi.pending(),
    refetchInterval: 15000
  });
  const reviewStatuses = requests.data?.map((request) => `${request.id}:${request.status}`).join(",");
  useEffect(() => {
    if (courtId && reviewStatuses !== undefined) {
      void client.invalidateQueries({ queryKey: ["partner-court", courtId] });
    }
  }, [client, courtId, reviewStatuses]);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["court-image-requests"] }),
      client.invalidateQueries({ queryKey: ["admin-courts"] }),
      client.invalidateQueries({ queryKey: ["admin-court"] }),
      client.invalidateQueries({ queryKey: ["partner-court"] }),
      client.invalidateQueries({ queryKey: ["courts"] }),
      client.invalidateQueries({ queryKey: ["court"] })
    ]);
  };
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-lg font-bold">{t(courtId ? "images.requests" : "images.reviewTitle")}</h2>
      <p className="text-sm text-slate-500">{t("images.help")}</p>
      {requests.isLoading ? <LoadingState /> : requests.isError ? <ErrorState message={requests.error.message} /> :
        requests.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {requests.data.map((request) => <RequestCard key={request.id} request={request} admin={!courtId} onUpdated={refresh} />)}
        </div> : <p className="text-sm text-slate-500">{t("images.empty")}</p>}
    </section>
  );
}

function RequestCard({ request, admin, onUpdated }: { request: CourtImageRequest; admin: boolean; onUpdated: () => Promise<void> }) {
  const { t } = useTranslation("partner");
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: (action: "APPROVED" | "REJECTED" | "CANCELLED") => action === "CANCELLED"
      ? courtImageApi.cancel(request.id) : courtImageApi.review(request.id, action, reason.trim() || undefined),
    onSuccess: async () => { toast.success(t("images.updated")); await onUpdated(); },
    onError: (error: Error) => toast.error(error.message)
  });
  return (
    <article className="space-y-3 rounded-xl border p-3">
      {admin && <h3 className="font-bold">{request.court.name}</h3>}
      <p className="text-sm font-semibold">{t(request.replaceImageId ? "images.replacement" : "images.addition")} · {t(`images.${request.status}`)}</p>
      <div className="grid grid-cols-2 gap-2">
        {request.previousImageUrl && <figure><img className="aspect-[4/3] w-full rounded-lg object-cover" src={request.previousImageUrl} alt={t("images.previous")} /><figcaption className="text-xs">{t("images.previous")}</figcaption></figure>}
        <figure><img className="aspect-[4/3] w-full rounded-lg object-cover" src={request.imageUrl} alt={t("images.proposed")} /><figcaption className="text-xs">{t("images.proposed")}</figcaption></figure>
      </div>
      {request.reason && <p className="text-sm text-rose-700">{request.reason}</p>}
      {request.status === "PENDING" && (admin ? <>
        <label className="block text-sm">{t("images.reason")}<textarea maxLength={1000} className="mt-1 w-full rounded-lg border p-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <div className="flex gap-2">
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate("APPROVED")}>{t("images.approve")}</Button>
          <Button variant="secondary" disabled={mutation.isPending || !reason.trim()} onClick={() => mutation.mutate("REJECTED")}>{t("images.reject")}</Button>
        </div>
      </> : <Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate("CANCELLED")}>{t("images.cancel")}</Button>)}
    </article>
  );
}
