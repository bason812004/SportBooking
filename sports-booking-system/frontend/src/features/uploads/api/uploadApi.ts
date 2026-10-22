import { api } from "../../../lib/axios";

export type UploadedImageResult = {
  url: string;
  publicId: string;
  fileName?: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
};

export type UploadedVideoResult = {
  url: string;
  publicId: string;
  duration?: number;
  format?: string;
  fileName?: string;
  size?: number;
};

export type AvatarUploadResult = {
  url: string;
  publicId: string;
  user: { id: string; fullName: string; email: string; role: string; avatarUrl: string };
};

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
};

export const uploadApi = {
  async uploadAvatar(file: File, options?: UploadOptions): Promise<AvatarUploadResult> {
    const form = new FormData();
    form.append("image", file);
    // DO NOT set Content-Type — Axios must auto-generate the multipart boundary.
    const res = await api.post("/uploads/avatar", form, {
      onUploadProgress: options?.onProgress
        ? (e) => {
            if (e.total) {
              options.onProgress!({
                loaded: e.loaded,
                total: e.total,
                percent: Math.round((e.loaded * 100) / e.total)
              });
            }
          }
        : undefined
    });
    return res.data.data as AvatarUploadResult;
  },

  async uploadTeamChatImage(postId: string, file: File, options?: UploadOptions): Promise<UploadedImageResult> {
    const form = new FormData();
    form.append("image", file);
    // DO NOT set Content-Type — Axios must auto-generate the multipart boundary.
    const res = await api.post(`/uploads/team-chat/${postId}/image`, form, {
      onUploadProgress: options?.onProgress
        ? (e) => {
            if (e.total) {
              options.onProgress!({
                loaded: e.loaded,
                total: e.total,
                percent: Math.round((e.loaded * 100) / e.total)
              });
            }
          }
        : undefined
    });
    return res.data.data as UploadedImageResult;
  },

  async uploadTeamChatVideo(postId: string, file: File, options?: UploadOptions): Promise<UploadedVideoResult> {
    const form = new FormData();
    form.append("video", file);
    // DO NOT set Content-Type — Axios must auto-generate the multipart boundary.
    const res = await api.post(`/uploads/team-chat/${postId}/video`, form, {
      onUploadProgress: options?.onProgress
        ? (e) => {
            if (e.total) {
              options.onProgress!({
                loaded: e.loaded,
                total: e.total,
                percent: Math.round((e.loaded * 100) / e.total)
              });
            }
          }
        : undefined
    });
    return res.data.data as UploadedVideoResult;
  }
};
