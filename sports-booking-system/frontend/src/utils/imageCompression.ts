export type CompressImageOptions = {
  /** Longest edge of the result, in pixels. */
  maxSize?: number;
  quality?: number;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renamed(file: File, blob: Blob, mimeType: string): File {
  const base = file.name.replace(/\.[^.]+$/, "");
  const extension = mimeType === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${base}.${extension}`, { type: mimeType, lastModified: Date.now() });
}

/**
 * Shrinks an image before it is uploaded. Product pictures are never shown larger than ~160px
 * (service cards, POS tiles, stock thumbnails), so sending the original megapixels only costs
 * upload time — which is what makes uploads fail on a slow uplink.
 *
 * Never throws and never returns something worse than the input: on any failure, or when the
 * compressed result is not actually smaller, the original file is returned unchanged.
 */
export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  const maxSize = options.maxSize ?? 800;
  const quality = options.quality ?? 0.82;

  if (!file.type.startsWith("image/")) return file;
  // Re-encoding a GIF would drop its animation, and SVG is already tiny and resolution-free.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    let mimeType = "image/webp";
    let blob = await canvasToBlob(canvas, mimeType, quality);
    if (!blob) {
      mimeType = "image/jpeg";
      blob = await canvasToBlob(canvas, mimeType, quality);
    }
    if (!blob || blob.size >= file.size) return file;

    return renamed(file, blob, mimeType);
  } catch (err) {
    console.error("Image compression failed, uploading the original file:", err);
    return file;
  } finally {
    bitmap?.close();
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
