import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useLanguage } from "../../lib/i18n";

export function AdminCategoriesPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: adminApi.categories });
  const form = useForm<{ name: string; description?: string }>();
  const create = useMutation({
    mutationFn: adminApi.createCategory,
    onSuccess: () => {
      toast.success(t("Đã tạo danh mục"));
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    }
  });
  if (categories.isLoading) return <LoadingState />;
  if (categories.isError) return <ErrorState message={categories.error.message} />;
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <form className="h-max rounded-md border border-line bg-white p-5" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
        <h1 className="text-xl font-semibold">{t("Thêm danh mục")}</h1>
        <div className="mt-4 space-y-3"><Input label={t("Tên")} {...form.register("name", { required: true })} /><Input label={t("Mô tả")} {...form.register("description")} /></div>
        <Button className="mt-4">{t("Lưu")}</Button>
      </form>
      <div className="rounded-md border border-line bg-white">
        {categories.data?.map((category) => <div key={category.id} className="border-b border-line p-4 last:border-0"><b>{category.name}</b><p className="text-sm text-slate-600">{category.description}</p></div>)}
      </div>
    </div>
  );
}
