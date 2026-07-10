import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { partnerApi } from "../../features/partner/api/partnerApi";

type PriceForm = { dayType: string; startTime: string; endTime: string; price: number; note?: string };
type ServiceForm = { name: string; description?: string; price: number; status: string };
type BlockForm = { courtSurfaceId: string; blockDate: string; startTime: string; endTime: string; reason?: string };
type RemoveTarget = { type: "price" | "service" | "image"; resourceId: string };

const removeConfirmCopy: Record<RemoveTarget["type"], { title: string; message: string }> = {
  price: { title: "Xác nhận xoá bảng giá", message: "Mức giá này sẽ bị xoá vĩnh viễn và không thể hoàn tác." },
  service: { title: "Xác nhận ẩn dịch vụ", message: "Dịch vụ sẽ bị ẩn khỏi trang đặt sân, khách hàng sẽ không còn thấy dịch vụ này." },
  image: { title: "Xác nhận xoá ảnh", message: "Ảnh này sẽ bị xoá vĩnh viễn khỏi sân và không thể hoàn tác." }
};

export function PartnerCourtResourcesPage({ mode }: { mode: "prices" | "services" | "images" | "blocks" }) {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const court = useQuery({ queryKey: ["partner-court", id], queryFn: () => partnerApi.courtDetail(id) });
  const blocks = useQuery({ queryKey: ["partner-court-blocks", id], queryFn: () => partnerApi.courtBlocks(id), enabled: mode === "blocks" });
  const priceForm = useForm<PriceForm>({ defaultValues: { dayType: "WEEKDAY", startTime: "06:00", endTime: "07:00", price: 0 } });
  const serviceForm = useForm<ServiceForm>({ defaultValues: { price: 0, status: "ACTIVE" } });
  const blockForm = useForm<BlockForm>({ defaultValues: { courtSurfaceId: "", blockDate: "", startTime: "06:00", endTime: "07:00", reason: "" } });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [cancelBlockId, setCancelBlockId] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["partner-court", id] });
    await queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
  };

  const refreshBlocks = async () => {
    await queryClient.invalidateQueries({ queryKey: ["partner-court-blocks", id] });
  };

  const createBlock = useMutation({
    mutationFn: (values: BlockForm) => partnerApi.createCourtBlock(id, { ...values, courtSurfaceId: values.courtSurfaceId || null }),
    onSuccess: async () => {
      toast.success("Đã tạo lịch nghỉ");
      blockForm.reset({ courtSurfaceId: "", blockDate: "", startTime: "06:00", endTime: "07:00", reason: "" });
      await refreshBlocks();
    },
    onError: (error: any) => toast.error(error.message || "Không thể tạo lịch nghỉ")
  });
  const cancelBlock = useMutation({
    mutationFn: (blockId: string) => partnerApi.cancelCourtBlock(id, blockId),
    onSuccess: async () => {
      toast.success("Đã hủy lịch nghỉ");
      setCancelBlockId(null);
      await refreshBlocks();
    },
    onError: (error: any) => toast.error(error.message || "Không thể hủy lịch nghỉ")
  });

  const savePrice = useMutation({
    mutationFn: (values: PriceForm) => editingId ? partnerApi.updatePrice(editingId, values) : partnerApi.addPrice(id, values),
    onSuccess: async () => { toast.success("Đã lưu bảng giá"); setEditingId(null); priceForm.reset(); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const saveService = useMutation({
    mutationFn: (values: ServiceForm) => editingId ? partnerApi.updateService(editingId, values) : partnerApi.addService(id, values),
    onSuccess: async () => { toast.success("Đã lưu dịch vụ"); setEditingId(null); serviceForm.reset(); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const remove = useMutation({
    mutationFn: ({ type, resourceId }: RemoveTarget) =>
      type === "price" ? partnerApi.deletePrice(resourceId) : type === "service" ? partnerApi.deleteService(resourceId) : partnerApi.deleteCourtImage(resourceId),
    onSuccess: async () => {
      setRemoveTarget(null);
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });
  const reorder = useMutation({
    mutationFn: partnerApi.reorderCourtImages.bind(null, id),
    onSuccess: refresh
  });

  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} />;
  const data = court.data!;

  const moveImage = (index: number, offset: number) => {
    const ids = data.images.map((image) => image.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold">{mode === "prices" ? "Bảng giá" : mode === "services" ? "Dịch vụ đi kèm" : mode === "images" ? "Hình ảnh sân" : "Lịch nghỉ / bảo trì"}</h1><p className="text-slate-600">{data.name}</p></div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/partner/courts/${id}/prices`}><Button variant={mode === "prices" ? "primary" : "secondary"}>Bảng giá</Button></Link>
          <Link to={`/partner/courts/${id}/services`}><Button variant={mode === "services" ? "primary" : "secondary"}>Dịch vụ</Button></Link>
          <Link to={`/partner/courts/${id}/images`}><Button variant={mode === "images" ? "primary" : "secondary"}>Ảnh</Button></Link>
          <Link to={`/partner/courts/${id}/blocks`}><Button variant={mode === "blocks" ? "primary" : "secondary"}>Lịch nghỉ</Button></Link>
        </div>
      </div>

      {mode === "prices" && (
        <>
          <form className="grid gap-3 rounded-2xl border border-line bg-white p-5 md:grid-cols-5" onSubmit={priceForm.handleSubmit((v) => savePrice.mutate(v))}>
            <Select label="Loại ngày" options={[{ value: "WEEKDAY", label: "Ngày thường" }, { value: "WEEKEND", label: "Cuối tuần" }, { value: "HOLIDAY", label: "Ngày lễ" }]} {...priceForm.register("dayType")} />
            <Input label="Từ giờ" type="time" {...priceForm.register("startTime", { required: true })} />
            <Input label="Đến giờ" type="time" {...priceForm.register("endTime", { required: true })} />
            <Input label="Giá (đ)" type="number" {...priceForm.register("price", { valueAsNumber: true, min: 0 })} />
            <div className="flex items-end"><Button className="w-full">{editingId ? "Cập nhật" : "Thêm giá"}</Button></div>
          </form>
          <div className="rounded-2xl border border-line bg-white">
            {data.prices.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><span>{item.dayType} · {item.startTime.slice(11,16)}-{item.endTime.slice(11,16)} · <b>{Number(item.price).toLocaleString("vi-VN")} đ</b></span><div className="flex gap-2"><Button variant="secondary" onClick={() => { setEditingId(item.id); priceForm.reset({ dayType: item.dayType, startTime: item.startTime.slice(11,16), endTime: item.endTime.slice(11,16), price: Number(item.price), note: item.note }); }}>Sửa</Button><Button variant="danger" onClick={() => setRemoveTarget({ type: "price", resourceId: item.id })}>Xóa</Button></div></div>)}
          </div>
        </>
      )}

      {mode === "services" && (
        <>
          <form className="grid gap-3 rounded-2xl border border-line bg-white p-5 md:grid-cols-4" onSubmit={serviceForm.handleSubmit((v) => saveService.mutate(v))}>
            <Input label="Tên dịch vụ" {...serviceForm.register("name", { required: true })} />
            <Input label="Giá (đ)" type="number" {...serviceForm.register("price", { valueAsNumber: true, min: 0 })} />
            <Select label="Trạng thái" options={[{ value: "ACTIVE", label: "Hoạt động" }, { value: "INACTIVE", label: "Tạm ẩn" }]} {...serviceForm.register("status")} />
            <div className="flex items-end"><Button className="w-full">{editingId ? "Cập nhật" : "Thêm dịch vụ"}</Button></div>
          </form>
          <div className="rounded-2xl border border-line bg-white">
            {data.services.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><span><b>{item.name}</b> · {Number(item.price).toLocaleString("vi-VN")} đ · {item.status}</span><div className="flex gap-2"><Button variant="secondary" onClick={() => { setEditingId(item.id); serviceForm.reset({ name: item.name, description: item.description, price: Number(item.price), status: item.status }); }}>Sửa</Button><Button variant="danger" onClick={() => setRemoveTarget({ type: "service", resourceId: item.id })}>Ẩn</Button></div></div>)}
          </div>
        </>
      )}

      {mode === "images" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.images.sort((a,b) => a.sortOrder-b.sortOrder).map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-2xl border border-line bg-white">
              <img className="h-48 w-full object-cover" src={image.imageUrl} alt={data.name} />
              <div className="flex justify-between p-3">
                <div className="flex gap-2"><Button variant="secondary" disabled={index === 0} onClick={() => moveImage(index, -1)}><ArrowUp className="h-4 w-4" /></Button><Button variant="secondary" disabled={index === data.images.length - 1} onClick={() => moveImage(index, 1)}><ArrowDown className="h-4 w-4" /></Button></div>
                <Button variant="danger" onClick={() => setRemoveTarget({ type: "image", resourceId: image.id })}><Trash2 className="h-4 w-4" /> Xóa</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "blocks" && (
        <>
          <form className="grid gap-3 rounded-2xl border border-line bg-white p-5 md:grid-cols-5" onSubmit={blockForm.handleSubmit((v) => createBlock.mutate(v))}>
            <Select
              label="Sân con"
              options={[{ value: "", label: "Cả cụm sân" }, ...(data.surfaces ?? []).map((s) => ({ value: s.id, label: s.name }))]}
              {...blockForm.register("courtSurfaceId")}
            />
            <Input label="Ngày nghỉ" type="date" {...blockForm.register("blockDate", { required: true })} />
            <Input label="Từ giờ" type="time" {...blockForm.register("startTime", { required: true })} />
            <Input label="Đến giờ" type="time" {...blockForm.register("endTime", { required: true })} />
            <Input label="Lý do" {...blockForm.register("reason")} />
            <div className="flex items-end md:col-span-5"><Button disabled={createBlock.isPending}>{createBlock.isPending ? "Đang tạo..." : "Tạo lịch nghỉ"}</Button></div>
          </form>

          {blocks.isLoading ? (
            <LoadingState />
          ) : blocks.isError ? (
            <ErrorState message={blocks.error.message} />
          ) : !blocks.data?.length ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Chưa có lịch nghỉ/bảo trì nào.</p>
          ) : (
            <div className="rounded-2xl border border-line bg-white">
              {blocks.data.map((block) => (
                <div key={block.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0">
                  <span>
                    {new Date(block.blockDate).toLocaleDateString("vi-VN")} · {block.startTime.slice(11, 16)}-{block.endTime.slice(11, 16)} ·{" "}
                    <b>{block.courtSurface ? block.courtSurface.name : "Cả cụm sân"}</b>
                    {block.reason ? <span className="text-slate-500"> · {block.reason}</span> : null}
                  </span>
                  <Button variant="danger" onClick={() => setCancelBlockId(block.id)}>Hủy</Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(removeTarget)}
        title={removeTarget ? removeConfirmCopy[removeTarget.type].title : ""}
        message={removeTarget ? removeConfirmCopy[removeTarget.type].message : ""}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && remove.mutate(removeTarget)}
      />

      <ConfirmModal
        open={Boolean(cancelBlockId)}
        title="Xác nhận hủy lịch nghỉ"
        message="Khung giờ này sẽ mở lại cho khách đặt sân bình thường."
        onCancel={() => setCancelBlockId(null)}
        onConfirm={() => cancelBlockId && cancelBlock.mutate(cancelBlockId)}
      />
    </div>
  );
}
