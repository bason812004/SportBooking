import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, MessageCircleOff } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { contentApi, type BlogWriteInput } from "../../features/content/api/contentApi";
import { useMyBlog } from "../../features/content/hooks/useContent";

const initialForm: BlogWriteInput = {
  title: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  visibility: "PUBLIC",
  allowComments: true
};

export function UserBlogFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const detail = useMyBlog(id);
  const [form, setForm] = useState<BlogWriteInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!detail.data) return;
    setForm({
      title: detail.data.title,
      excerpt: detail.data.excerpt ?? "",
      content: detail.data.content,
      coverImageUrl: detail.data.coverImageUrl ?? "",
      visibility: detail.data.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      allowComments: detail.data.allowComments !== false
    });
  }, [detail.data]);

  function update<K extends keyof BlogWriteInput>(key: K, value: BlogWriteInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Vui lòng nhập tiêu đề và nội dung bài blog.");
      return;
    }
    setSaving(true);
    try {
      const payload: BlogWriteInput = {
        ...form,
        title: form.title.trim(),
        excerpt: form.excerpt?.trim() || null,
        coverImageUrl: form.coverImageUrl?.trim() || null,
        content: form.content.trim(),
        allowComments: form.allowComments
      };
      if (editing && id) {
        await contentApi.updateBlog(id, payload);
        toast.success("Đã gửi bài cập nhật để admin duyệt.");
      } else {
        await contentApi.createBlog(payload);
        toast.success("Đã gửi bài blog để admin duyệt.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blogs"] })
      ]);
      navigate("/user/blogs", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu bài blog.");
    } finally {
      setSaving(false);
    }
  }

  if (editing && detail.isLoading) return <div className="px-4 py-16"><LoadingState /></div>;
  if (editing && detail.isError) return <div className="px-4 py-16"><ErrorState message={detail.error.message} /></div>;

  return (
    <main className="bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Blog</p>
          <h1 className="mt-2 text-4xl font-black">{editing ? "Chỉnh sửa bài blog" : "Viết bài blog"}</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold text-slate-600">
            Bài viết công khai chỉ xuất hiện sau khi admin duyệt. Nếu chỉnh sửa nội dung bài đã đăng, bài sẽ quay lại trạng thái chờ duyệt.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
            <label className={labelClass}>
              <span>Tiêu đề</span>
              <input value={form.title} onChange={(event) => update("title", event.target.value)} className={inputClass} />
            </label>

            <div className="grid gap-5 md:grid-cols-[1fr_220px]">
              <label className={labelClass}>
                <span>Ảnh bìa</span>
                <input value={form.coverImageUrl ?? ""} onChange={(event) => update("coverImageUrl", event.target.value)} className={inputClass} placeholder="URL ảnh bìa" />
              </label>
              <label className={labelClass}>
                <span>Hiển thị</span>
                <select value={form.visibility} onChange={(event) => update("visibility", event.target.value as BlogWriteInput["visibility"])} className={inputClass}>
                  <option value="PUBLIC">Công khai sau khi duyệt</option>
                  <option value="PRIVATE">Riêng tư</option>
                </select>
              </label>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
              <span className="flex min-w-0 items-center gap-3">
                {form.allowComments ? <MessageCircle className="h-5 w-5 shrink-0 text-emerald-700" /> : <MessageCircleOff className="h-5 w-5 shrink-0 text-amber-700" />}
                <span>
                  <span className="block">Cho phép bình luận</span>
                  <span className="block text-xs font-semibold text-slate-500">Có thể tắt khi đăng bài hoặc đổi lại trong trang Blog của tôi.</span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.allowComments}
                onChange={(event) => update("allowComments", event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
              />
            </label>

            <label className={labelClass}>
              <span>Tóm tắt</span>
              <textarea value={form.excerpt ?? ""} onChange={(event) => update("excerpt", event.target.value)} className={`${inputClass} min-h-24 py-3`} />
            </label>

            <label className={labelClass}>
              <span>Nội dung</span>
              <textarea value={form.content} onChange={(event) => update("content", event.target.value)} className={`${inputClass} min-h-80 py-3 leading-7`} />
            </label>

            <div>
              <button disabled={saving} className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Đang lưu..." : editing ? "Gửi duyệt bản cập nhật" : "Gửi duyệt bài blog"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

const labelClass = "grid gap-2 text-sm font-bold text-slate-700";
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
