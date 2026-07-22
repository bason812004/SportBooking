import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, MessageCircle, MessageCircleOff, Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { api } from "../../lib/axios";

type Values = {
  title: string;
  excerpt?: string;
  content: string;
  visibility: "PUBLIC" | "PRIVATE";
  allowComments: boolean;
};

type UploadResponse = {
  url: string;
  publicId: string;
  fileName: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PartnerBlogFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string>("");
  const [coverImagePreview, setCoverImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<Values>({ defaultValues: { visibility: "PUBLIC", allowComments: true } });
  const allowComments = form.watch("allowComments");
  const detail = useQuery({ queryKey: ["partner-blog", id], queryFn: () => partnerApi.blogDetail(id!), enabled: Boolean(id) });

  useEffect(() => {
    if (!detail.data) return;
    form.reset({
      title: detail.data.title,
      excerpt: detail.data.excerpt ?? "",
      content: detail.data.content,
      visibility: detail.data.visibility,
      allowComments: detail.data.allowComments !== false
    });
    if (detail.data.coverImageUrl) {
      setCoverImageUrl(detail.data.coverImageUrl);
      setCoverImagePreview(detail.data.coverImageUrl);
    }
  }, [detail.data, form]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Chi chap nhan anh JPEG, PNG hoac WebP");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Anh toi da 5MB");
      return;
    }

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoverImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const { data } = await api.post<{ success: boolean; data: UploadResponse }>("/uploads/blogs/cover", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setCoverImageUrl(data.data.url);
      toast.success("Tai anh thanh cong");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Khong the tai anh len");
      setCoverImagePreview("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setCoverImageUrl("");
    setCoverImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const save = useMutation({
    mutationFn: (values: Values) => {
      if (!coverImageUrl) {
        throw new Error("Vui long tai len anh bia");
      }

      const payload = {
        ...values,
        coverImageUrl,
        allowComments: typeof values.allowComments === "string"
          ? values.allowComments === "on" || values.allowComments === "true"
          : Boolean(values.allowComments)
      };
      return id ? partnerApi.updateBlog(id, payload) : partnerApi.createBlog(payload);
    },
    onSuccess: async () => {
      toast.success("Da luu bai viet");
      await queryClient.invalidateQueries({ queryKey: ["partner-blogs"] });
      navigate("/partner/blogs");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <form className="space-y-5 rounded-2xl border bg-white p-6" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <div>
        <h1 className="text-3xl font-bold">{id ? "Sua bai viet" : "Viet bai moi"}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">Luu ban nhap truoc, sau do gui admin duyet de xuat ban.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tieu de" {...form.register("title", { required: true })} />
        <Select
          label="Hien thi"
          options={[
            { value: "PUBLIC", label: "Cong khai sau khi duyet" },
            { value: "PRIVATE", label: "Rieng tu" }
          ]}
          {...form.register("visibility")}
        />

        {/* Cover Image Upload */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-bold text-slate-700">Anh bia</label>
          <div className="flex flex-col gap-3">
            {coverImagePreview ? (
              <div className="relative w-full overflow-hidden rounded-lg border border-slate-200">
                <img
                  src={coverImagePreview}
                  alt="Cover preview"
                  className="h-48 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-emerald-500 hover:bg-emerald-50">
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <Image className="h-10 w-10" />
                  <span className="text-sm font-medium">Chon anh tu may tinh</span>
                  <span className="text-xs">JPEG, PNG, WebP - Toi da 5MB</span>
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
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Upload className="h-4 w-4 animate-pulse" />
                <span>Dang tai anh...</span>
              </div>
            )}
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 md:col-span-2">
          <span className="flex items-center gap-3">
            {allowComments ? <MessageCircle className="h-5 w-5 text-emerald-700" /> : <MessageCircleOff className="h-5 w-5 text-amber-700" />}
            Cho phep binh luan
          </span>
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-emerald-700" {...form.register("allowComments")} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          Tom tat
          <textarea className="min-h-20 rounded-md border p-3" {...form.register("excerpt")} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          Noi dung
          <textarea className="min-h-80 rounded-md border p-3" {...form.register("content", { required: true, minLength: 20 })} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button disabled={save.isPending || isUploading}>
          {save.isPending ? "Dang luu..." : "Luu ban nhap"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate("/partner/blogs")}>Huy</Button>
      </div>
    </form>
  );
}
