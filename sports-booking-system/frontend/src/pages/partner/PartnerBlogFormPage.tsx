import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, MessageCircleOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { partnerApi } from "../../features/partner/api/partnerApi";

type Values = {
  title: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  visibility: "PUBLIC" | "PRIVATE";
  allowComments: boolean;
};

export function PartnerBlogFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ defaultValues: { visibility: "PUBLIC", allowComments: true } });
  const allowComments = form.watch("allowComments");
  const detail = useQuery({ queryKey: ["partner-blog", id], queryFn: () => partnerApi.blogDetail(id!), enabled: Boolean(id) });

  useEffect(() => {
    if (!detail.data) return;
    form.reset({
      title: detail.data.title,
      excerpt: detail.data.excerpt ?? "",
      content: detail.data.content,
      coverImageUrl: detail.data.coverImageUrl ?? "",
      visibility: detail.data.visibility,
      allowComments: detail.data.allowComments !== false
    });
  }, [detail.data, form]);

  const save = useMutation({
    mutationFn: (values: Values) => id ? partnerApi.updateBlog(id, values) : partnerApi.createBlog(values),
    onSuccess: async () => {
      toast.success("Đã lưu bản nháp");
      await queryClient.invalidateQueries({ queryKey: ["partner-blogs"] });
      navigate("/partner/blogs");
    },
    onError: (error) => toast.error(error.message)
  });

  if (id && detail.isLoading) return <LoadingState />;
  if (id && detail.isError) return <ErrorState message={detail.error.message} />;

  return (
    <form className="space-y-5 rounded-2xl border bg-white p-6" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <div>
        <h1 className="text-3xl font-bold">{id ? "Sửa bài viết" : "Viết bài mới"}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">Lưu bản nháp trước, sau đó gửi admin duyệt để xuất bản.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tiêu đề" {...form.register("title", { required: true })} />
        <Select
          label="Hiển thị"
          options={[
            { value: "PUBLIC", label: "Công khai sau khi duyệt" },
            { value: "PRIVATE", label: "Riêng tư" }
          ]}
          {...form.register("visibility")}
        />
        <Input className="md:col-span-2" label="Ảnh bìa (URL)" type="url" {...form.register("coverImageUrl")} />
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 md:col-span-2">
          <span className="flex items-center gap-3">
            {allowComments ? <MessageCircle className="h-5 w-5 text-emerald-700" /> : <MessageCircleOff className="h-5 w-5 text-amber-700" />}
            Cho phép bình luận
          </span>
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-emerald-700" {...form.register("allowComments")} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          Tóm tắt
          <textarea className="min-h-20 rounded-md border p-3" {...form.register("excerpt")} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          Nội dung
          <textarea className="min-h-80 rounded-md border p-3" {...form.register("content", { required: true, minLength: 20 })} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button disabled={save.isPending}>Lưu bản nháp</Button>
        <Button type="button" variant="secondary" onClick={() => navigate("/partner/blogs")}>Hủy</Button>
      </div>
    </form>
  );
}
