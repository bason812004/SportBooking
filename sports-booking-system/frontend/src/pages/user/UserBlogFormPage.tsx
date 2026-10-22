import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image, MessageCircle, MessageCircleOff, Upload, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { api } from "../../lib/axios";
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UploadResponse = {
  url: string;
  publicId: string;
  fileName: string;
};

export function UserBlogFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const detail = useMyBlog(id);
  const [form, setForm] = useState<BlogWriteInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [coverImagePreview, setCoverImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (detail.data.coverImageUrl) {
      setCoverImagePreview(detail.data.coverImageUrl);
    }
  }, [detail.data]);

  function update<K extends keyof BlogWriteInput>(key: K, value: BlogWriteInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Ảnh tối đa 5MB");
      return;
    }

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoverImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server - use same endpoint but without auth requirement check (auth is already handled)
    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      // For user role, we'll use a different approach - upload directly and get URL
      const { data } = await api.post<{ success: boolean; data: UploadResponse }>("/uploads/blogs/cover", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      update("coverImageUrl", data.data.url);
      toast.success("Tải ảnh thành công");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tải ảnh lên");
      setCoverImagePreview(form.coverImageUrl || "");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setForm((current) => ({ ...current, coverImageUrl: "" }));
    setCoverImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || isUploading) return;
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Vui lòng nhập tiêu đề và nội dung bài blog.");
      return;
    }
    if (!form.coverImageUrl) {
      toast.error("Vui lòng tải lên ảnh bìa.");
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

            {/* Cover Image Upload */}
            <div className="grid gap-5 md:grid-cols-[1fr_220px]">
              <div>
                <label className={labelClass}>
                  <span>Ảnh bìa</span>
                  {coverImagePreview ? (
                    <div className="relative overflow-hidden rounded-xl border border-slate-200">
                      <img src={coverImagePreview} alt="Cover preview" className="h-40 w-full object-cover" />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-emerald-500 hover:bg-emerald-50">
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <Image className="h-8 w-8" />
                        <span className="text-sm font-medium">Chọn ảnh từ máy tính</span>
                        <span className="text-xs">JPEG, PNG, WebP - Tối đa 5MB</span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isUploading}
                      />
                    </label>
                  )}
                  {isUploading && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600">
                      <Upload className="h-4 w-4 animate-pulse" />
                      <span>Đang tải ảnh...</span>
                    </div>
                  )}
                </label>
              </div>
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
              <button
                disabled={saving || isUploading}
                className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : isUploading ? "Đang tải ảnh..." : editing ? "Gửi duyệt bản cập nhật" : "Gửi duyệt bài blog"}
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
