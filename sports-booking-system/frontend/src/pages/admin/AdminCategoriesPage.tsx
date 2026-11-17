import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { adminApi } from "../../features/admin/api/adminApi";
import type { AdminCategory } from "../../types/api";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { LoadingState, ErrorState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

// Same limits as the backend schema, so mistakes show next to the field before any request.
const categorySchema = z.object({
  name: z.string().trim().min(2, "Tên danh mục cần ít nhất 2 ký tự").max(100, "Tên danh mục tối đa 100 ký tự"),
  description: z.string().trim().max(500, "Mô tả tối đa 500 ký tự")
});

type CategoryForm = z.infer<typeof categorySchema>;

const emptyForm: CategoryForm = { name: "", description: "" };
const statusLabels = { ACTIVE: "Đang dùng", INACTIVE: "Đã ẩn" };
const statusTones = { ACTIVE: "bg-emerald-100 text-emerald-800", INACTIVE: "bg-slate-200 text-slate-700" };

function hideWarning(category: AdminCategory) {
  const courts = category._count.courts;
  return courts
    ? `${courts} sân thuộc danh mục này sẽ không còn hiển thị để khách tìm và đặt cho tới khi danh mục được hiện lại. Đối tác sửa các sân này sẽ phải chọn danh mục khác.`
    : "Danh mục chưa có sân nào. Sau khi ẩn, đối tác sẽ không chọn được danh mục này khi tạo sân.";
}

export function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [hiding, setHiding] = useState<AdminCategory | null>(null);
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: adminApi.categories });
  const form = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: emptyForm });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] });

  const startEdit = (category: AdminCategory) => {
    setEditing(category);
    form.reset({ name: category.name, description: category.description ?? "" });
  };
  const stopEdit = () => {
    setEditing(null);
    form.reset(emptyForm);
  };

  const save = useMutation({
    mutationFn: (values: CategoryForm) => (editing ? adminApi.updateCategory(editing.id, values) : adminApi.createCategory(values)),
    onSuccess: async () => {
      toast.success(editing ? "Đã cập nhật danh mục" : "Đã thêm danh mục");
      stopEdit();
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });

  const setStatus = useMutation({
    mutationFn: ({ category, status }: { category: AdminCategory; status: AdminCategory["status"] }) =>
      status === "INACTIVE" ? adminApi.disableCategory(category.id) : adminApi.updateCategory(category.id, { status }),
    onSuccess: async (_result, { category, status }) => {
      toast.success(status === "INACTIVE" ? `Đã ẩn danh mục ${category.name}` : `Đã hiện lại danh mục ${category.name}`);
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });

  if (categories.isLoading) return <LoadingState />;
  if (categories.isError) return <ErrorState message={categories.error.message} />;

  const { errors } = form.formState;

  return (
    <div className="space-y-5">
      <PageHero eyebrow="Nội dung" title="Danh mục sân" subtitle="Quản lý danh mục thể thao dùng để phân loại sân trên hệ thống." />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form className="h-max rounded-2xl border bg-white p-5" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <h2 className="text-xl font-bold">{editing ? "Sửa danh mục" : "Thêm danh mục"}</h2>
          <div className="mt-4 space-y-3">
            <Input label="Tên" error={errors.name?.message} {...form.register("name")} />
            <Input label="Mô tả" error={errors.description?.message} {...form.register("description")} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
            {editing && (
              <Button type="button" variant="secondary" onClick={stopEdit}>
                Hủy
              </Button>
            )}
          </div>
        </form>

        <div className="rounded-2xl border bg-white">
          {categories.data?.map((category) => (
            <div key={category.id} className="flex items-start justify-between gap-3 border-b p-4 last:border-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{category.name}</b>
                  <StatusBadge value={category.status} tones={statusTones} labels={statusLabels} />
                  <span className="text-xs text-slate-500">{category._count.courts} sân</span>
                </div>
                {category.description && <p className="mt-1 text-sm text-slate-600">{category.description}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => startEdit(category)}>
                  Sửa
                </Button>
                {category.status === "ACTIVE" ? (
                  <Button variant="danger" onClick={() => setHiding(category)}>
                    Ẩn
                  </Button>
                ) : (
                  <Button variant="secondary" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ category, status: "ACTIVE" })}>
                    Hiện lại
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(hiding)}
        title={`Ẩn danh mục ${hiding?.name ?? ""}?`}
        message={hiding ? hideWarning(hiding) : ""}
        onCancel={() => setHiding(null)}
        onConfirm={() => {
          if (hiding) setStatus.mutate({ category: hiding, status: "INACTIVE" });
          setHiding(null);
        }}
      />
    </div>
  );
}
