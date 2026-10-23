import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Building2, Clock3, ImagePlus, Layers, MapPin, type LucideIcon } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { useCategories } from "../../features/courts/hooks/useCourts";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { CourtSportsSection, newSport, type SportValues } from "../../features/partner/components/CourtSportsSection";
import { VIETNAM_PROVINCES } from "../../lib/constants";
import { courtAddress } from "../../lib/format";
import type { Court } from "../../types/api";

// Since the 2025 administrative reform an address is street address + ward/commune + province/city.
// Registration uses `sports` (one court per sport); editing one court uses `categoryId`.
type FormValues = {
  name: string;
  categoryId: string;
  sports: SportValues[];
  description?: string;
  address: string;
  ward: string;
  city: string;
  openingTime: string;
  closingTime: string;
  depositPercent?: number | null;
  images?: FileList;
};

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGES = 10;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const timeValue = (value?: string) => value?.slice(11, 16) ?? "";
const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

function Section({ icon: Icon, step, title, description, children }: { icon: LucideIcon; step: number; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Bước {step}</p>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs text-red-600">{message}</span> : null;
}

export function PartnerCourtFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const categories = useCategories();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const form = useForm<FormValues>({
    defaultValues: { openingTime: "06:00", closingTime: "22:00", city: "", categoryId: "", sports: [newSport()] }
  });
  const { errors } = form.formState;
  const court = useQuery({
    queryKey: ["partner-court", id],
    queryFn: () => partnerApi.courtDetail(id!),
    enabled: editing
  });

  useEffect(() => {
    if (!court.data) return;
    form.reset({
      name: court.data.name,
      categoryId: court.data.category.id,
      description: court.data.description ?? "",
      address: court.data.address,
      ward: court.data.ward ?? "",
      city: court.data.city,
      openingTime: timeValue(court.data.openingTime),
      closingTime: timeValue(court.data.closingTime),
      depositPercent: court.data.depositPercent ?? null
    });
  }, [court.data, form]);

  // A court registered before the 2025 merger may carry an old or differently spelled city: keep it
  // selectable so editing does not silently change it, but invite the partner to pick the new name.
  const savedCity = court.data?.city;
  const cityOptions = useMemo(() => {
    const options = [{ value: "", label: "Chọn tỉnh/thành phố" }, ...VIETNAM_PROVINCES];
    if (!savedCity || VIETNAM_PROVINCES.some((province) => province.value === savedCity)) return options;
    return [...options, { value: savedCity, label: `${savedCity} (tên cũ — nên chọn lại)` }];
  }, [savedCity]);

  const [address, ward, city, images, sports] = form.watch(["address", "ward", "city", "images", "sports"]);
  const cityLabel = VIETNAM_PROVINCES.find((province) => province.value === city)?.label ?? city;
  const addressPreview = courtAddress({ address, ward, city: cityLabel });
  const previews = useMemo(() => Array.from(images ?? []).map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [images]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  const courtCount = editing ? 1 : sports?.length ?? 1;

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const venue = {
        name: values.name.trim(),
        description: values.description,
        address: values.address,
        ward: values.ward,
        city: values.city,
        openingTime: values.openingTime,
        closingTime: values.closingTime,
        depositPercent: values.depositPercent ?? null
      };
      const courts: Court[] = editing
        ? [await partnerApi.updateCourt(id!, { ...venue, categoryId: values.categoryId })]
        : await partnerApi.registerCourts({
            ...venue,
            sports: values.sports.map((sport) => ({
              categoryId: sport.categoryId,
              surfaces: sport.surfaces.map((surface) => ({
                name: surface.name.trim(),
                surface: surface.surface.trim() || null
              }))
            }))
          });

      // The courts already exist at this point: a failed image must not fail the save, or retrying would
      // register the venue twice. Each court gets its own uploads because deleting a court's image also
      // deletes the stored file, so one file must never back images of two courts.
      const files = Array.from(values.images ?? []);
      let failedImages = 0;
      if (files.length) for (const [position, saved] of courts.entries()) {
        setUploadStatus(courts.length > 1 ? `Đang tải ảnh cho sân ${position + 1}/${courts.length}...` : "Đang tải ảnh...");
        const results = await Promise.allSettled(
          files.map((image, index) => partnerApi.addCourtImage(saved.id, image, (saved.images?.length ?? 0) + index))
        );
        failedImages += results.filter((result) => result.status === "rejected").length;
      }
      return { courts, failedImages, totalImages: files.length * courts.length };
    },
    onSuccess: ({ courts, failedImages, totalImages }) => {
      if (editing) toast.success("Đã cập nhật sân và gửi admin duyệt lại");
      else toast.success(courts.length > 1 ? `Đã gửi đăng ký ${courts.length} sân, chờ admin duyệt` : "Đã gửi đăng ký sân, chờ admin duyệt");
      if (failedImages) toast.warning(`${failedImages}/${totalImages} ảnh chưa tải lên được. Hãy thêm lại ở trang Hình ảnh của sân.`);
      queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
      if (editing) queryClient.invalidateQueries({ queryKey: ["partner-court", id] });
      navigate("/partner/courts");
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setUploadStatus(null)
  });

  if (editing && court.isLoading) return <LoadingState />;
  if (editing && court.isError) return <ErrorState message={court.error.message} />;

  const fullHour = (value: string) => value.endsWith(":00") || "Chọn giờ chẵn, ví dụ 06:00";
  const step = (base: number) => base + (editing ? 0 : 1);

  return (
    <FormProvider {...form}>
      <form className="mx-auto max-w-6xl space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <Link to="/partner/courts" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-emerald-700">
            <ArrowLeft className="h-4 w-4" />
            Danh sách sân
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{editing ? "Chỉnh sửa sân" : "Đăng ký sân mới"}</h1>
          <p className="mt-1 text-slate-600">
            {editing
              ? "Lưu thay đổi thông tin hoặc ảnh sẽ đưa sân về trạng thái chờ admin duyệt lại."
              : "Điền thông tin cơ sở, các môn và sân con. Admin sẽ duyệt trước khi sân hiển thị cho khách đặt."}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            {editing ? (
              <Section icon={Building2} step={1} title="Thông tin sân" description="Tên và loại sân khách sẽ thấy khi tìm kiếm.">
                <Input
                  label="Tên sân"
                  placeholder="VD: Sân cầu lông Hoàng Gia"
                  {...form.register("name", {
                    required: "Vui lòng nhập tên sân",
                    minLength: { value: 2, message: "Tên sân quá ngắn" },
                    maxLength: { value: 180, message: "Tên sân tối đa 180 ký tự" }
                  })}
                  error={errors.name?.message}
                />
                <div className="grid gap-1.5">
                  <Select
                    label="Loại sân"
                    options={[{ value: "", label: "Chọn loại sân" }, ...(categories.data?.map((item) => ({ value: item.id, label: item.name })) ?? [])]}
                    {...form.register("categoryId", { required: "Vui lòng chọn loại sân" })}
                  />
                  <FieldError message={errors.categoryId?.message} />
                </div>
                <label className="grid gap-1.5 text-sm font-medium text-ink md:col-span-2">
                  Mô tả
                  <textarea
                    className="min-h-28 rounded-md border border-line p-3 text-sm outline-none focus:border-action"
                    placeholder="Mặt sân, tiện ích (bãi giữ xe, phòng thay đồ, căng tin...), lưu ý cho khách"
                    {...form.register("description")}
                  />
                </label>
                <Link to={`/partner/courts/${id}/surfaces`} className="text-sm font-semibold text-emerald-700 hover:underline md:col-span-2">
                  Quản lý sân con →
                </Link>
              </Section>
            ) : (
              <>
                <Section icon={Building2} step={1} title="Thông tin cơ sở" description="Tên cơ sở và mô tả khách sẽ thấy khi tìm kiếm.">
                  <div className="grid gap-1.5 md:col-span-2">
                    <Input
                      label="Tên cơ sở"
                      placeholder="VD: Sân Hoàng Gia"
                      {...form.register("name", {
                        required: "Vui lòng nhập tên cơ sở",
                        minLength: { value: 2, message: "Tên cơ sở quá ngắn" },
                        maxLength: { value: 150, message: "Tên cơ sở tối đa 150 ký tự" }
                      })}
                      error={errors.name?.message}
                    />
                    <p className="text-xs text-slate-500">Đăng ký nhiều môn thì mỗi sân được đặt tên "Tên cơ sở - Tên môn", ví dụ "Sân Hoàng Gia - Pickleball".</p>
                  </div>
                  <label className="grid gap-1.5 text-sm font-medium text-ink md:col-span-2">
                    Mô tả
                    <textarea
                      className="min-h-28 rounded-md border border-line p-3 text-sm outline-none focus:border-action"
                      placeholder="Tiện ích (bãi giữ xe, phòng thay đồ, căng tin...), lưu ý cho khách"
                      {...form.register("description")}
                    />
                  </label>
                </Section>

                <Section
                  icon={Layers}
                  step={2}
                  title="Môn thể thao và sân con"
                  description="Mỗi môn sẽ thành một sân riêng. Khai số sân con và đặt tên để nhân viên và khách dễ nhận biết."
                >
                  <CourtSportsSection categories={categories.data ?? []} />
                </Section>
              </>
            )}

            <Section icon={MapPin} step={step(2)} title="Địa chỉ" description="Theo đơn vị hành chính mới: địa chỉ, phường/xã và tỉnh/thành phố.">
              <div className="md:col-span-2">
                <Input
                  label="Địa chỉ"
                  placeholder="Số nhà, tên đường"
                  {...form.register("address", { required: "Vui lòng nhập địa chỉ", minLength: { value: 5, message: "Địa chỉ quá ngắn" } })}
                  error={errors.address?.message}
                />
              </div>
              <Input
                label="Phường/Xã"
                placeholder="VD: Phường Bến Thành"
                {...form.register("ward", { required: "Vui lòng nhập phường/xã", minLength: { value: 2, message: "Tên phường/xã quá ngắn" } })}
                error={errors.ward?.message}
              />
              <div className="grid gap-1.5">
                <Select label="Tỉnh/Thành phố" options={cityOptions} {...form.register("city", { required: "Vui lòng chọn tỉnh/thành phố" })} />
                <FieldError message={errors.city?.message} />
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm md:col-span-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>
                  <span className="font-semibold text-slate-700">Địa chỉ hiển thị: </span>
                  <span className={addressPreview ? "text-slate-700" : "text-slate-400"}>{addressPreview || "Chưa nhập địa chỉ"}</span>
                </p>
              </div>
            </Section>

            <Section icon={Clock3} step={step(3)} title="Giờ hoạt động và đặt cọc" description="Khách chỉ đặt được trong giờ mở cửa, theo từng giờ chẵn.">
              <Input
                label="Giờ mở cửa"
                type="time"
                step={3600}
                {...form.register("openingTime", { required: "Vui lòng chọn giờ mở cửa", validate: fullHour })}
                error={errors.openingTime?.message}
              />
              <Input
                label="Giờ đóng cửa"
                type="time"
                step={3600}
                {...form.register("closingTime", {
                  required: "Vui lòng chọn giờ đóng cửa",
                  validate: (value, values) =>
                    fullHour(value) === true ? minutesOf(value) > minutesOf(values.openingTime) || "Giờ đóng cửa phải sau giờ mở cửa" : fullHour(value)
                })}
                error={errors.closingTime?.message}
              />
              <Input
                label="% cọc giữ sân"
                type="number"
                min={0}
                max={49.99}
                step={0.01}
                placeholder="Bỏ trống nếu không cần cọc"
                {...form.register("depositPercent", {
                  setValueAs: (value) => (value === "" || value == null ? null : Number(value)),
                  min: { value: 0, message: "Cọc không được âm" },
                  max: { value: 49.99, message: "Cọc phải dưới 50%" }
                })}
                error={errors.depositPercent?.message}
              />
              <div className="self-end rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                Nhập từ 1 đến dưới 50% nếu sân cần cọc. Bỏ trống hoặc nhập 0 thì khách được chọn thanh toán tại sân.
              </div>
            </Section>

            <Section
              icon={ImagePlus}
              step={step(4)}
              title={editing ? "Thêm ảnh mới" : "Hình ảnh sân"}
              description={
                editing
                  ? "Ảnh hiện có được sắp xếp và thay thế ở trang Hình ảnh của sân."
                  : "Ảnh đầu tiên sẽ là ảnh đại diện. Ảnh rõ, đủ sáng giúp sân được duyệt nhanh hơn."
              }
            >
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 md:col-span-2">
                <ImagePlus className="h-8 w-8 text-emerald-600" />
                <span className="font-semibold text-slate-700">Bấm để chọn ảnh sân</span>
                <span className="text-xs text-slate-500">JPEG, PNG hoặc WebP · tối đa 3 MB mỗi ảnh · tối đa {MAX_IMAGES} ảnh mỗi lần</span>
                <input
                  className="sr-only"
                  type="file"
                  accept={IMAGE_TYPES.join(",")}
                  multiple
                  {...form.register("images", {
                    validate: (files) => {
                      const list = Array.from(files ?? []);
                      if (list.length > MAX_IMAGES) return `Chọn tối đa ${MAX_IMAGES} ảnh mỗi lần`;
                      if (list.some((file) => !IMAGE_TYPES.includes(file.type))) return "Chỉ nhận ảnh JPEG, PNG hoặc WebP";
                      if (list.some((file) => file.size > MAX_IMAGE_BYTES)) return "Mỗi ảnh tối đa 3 MB";
                      return true;
                    }
                  })}
                />
              </label>
              {errors.images?.message && <div className="md:col-span-2"><FieldError message={errors.images.message} /></div>}
              {previews.length > 0 && (
                <div className="md:col-span-2">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {previews.map((preview, index) => (
                      <figure key={preview.url} className="relative overflow-hidden rounded-xl border border-line">
                        <img src={preview.url} alt={preview.name} className="aspect-video w-full object-cover" />
                        {index === 0 && !editing && (
                          <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">Ảnh đại diện</span>
                        )}
                      </figure>
                    ))}
                  </div>
                  {courtCount > 1 && (
                    <p className="mt-2 text-sm text-slate-600">
                      Mỗi ảnh được gửi cho từng sân: {previews.length} ảnh × {courtCount} sân = {previews.length * courtCount} ảnh chờ admin duyệt.
                    </p>
                  )}
                  <button type="button" onClick={() => form.resetField("images")} className="mt-2 text-sm font-semibold text-red-600 hover:underline">
                    Bỏ chọn {previews.length} ảnh
                  </button>
                </div>
              )}
              {editing && (
                <Link to={`/partner/courts/${id}/images`} className="text-sm font-semibold text-emerald-700 hover:underline md:col-span-2">
                  Quản lý ảnh hiện có →
                </Link>
              )}
            </Section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
              <h3 className="font-bold text-emerald-900">Quy trình duyệt sân</h3>
              <ol className="mt-3 space-y-3 text-sm text-emerald-900">
                {[
                  editing ? "Bạn lưu thay đổi thông tin sân" : "Bạn gửi đăng ký cơ sở cùng các môn và sân con",
                  editing ? "Admin kiểm tra thông tin và hình ảnh" : "Admin kiểm tra thông tin và hình ảnh của từng sân",
                  editing
                    ? "Sân hiển thị cho khách. Hãy thiết lập sân con và bảng giá để nhận đặt sân"
                    : "Sân hiển thị cho khách. Hãy thiết lập bảng giá cho từng sân để nhận đặt sân"
                ].map((text, index) => (
                  <li key={text} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">{index + 1}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </div>
            {!editing && (
              <div className="rounded-2xl border border-line bg-white p-5 text-sm text-slate-600">
                <h3 className="font-bold text-slate-900">Cơ sở có nhiều môn?</h3>
                <p className="mt-2">
                  Mỗi môn được tạo thành một sân riêng: admin duyệt riêng, có bảng giá, giá theo khung giờ, % cọc và chính sách giờ phát sinh riêng.
                </p>
                <p className="mt-2">Địa chỉ, giờ mở cửa, mô tả và ảnh nhập ở đây dùng chung lúc đăng ký; về sau bạn sửa trên từng sân.</p>
              </div>
            )}
          </aside>
        </div>

        <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur">
          <Button type="button" variant="secondary" onClick={() => navigate("/partner/courts")}>Hủy</Button>
          <Button disabled={mutation.isPending}>
            {mutation.isPending
              ? uploadStatus ?? (editing ? "Đang lưu..." : "Đang đăng ký...")
              : editing
                ? "Lưu và gửi duyệt lại"
                : courtCount > 1
                  ? `Đăng ký ${courtCount} sân`
                  : "Đăng ký sân"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
