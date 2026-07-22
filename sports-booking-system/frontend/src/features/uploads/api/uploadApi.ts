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

export const uploadApi = {
  async uploadAvatar(file: File): Promise<AvatarUploadResult> {
    const form = new FormData();
    form.append("image", file);
    const res = await api.post("/uploads/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data.data as AvatarUploadResult;
  },

  async uploadTeamChatImage(postId: string, file: File): Promise<UploadedImageResult> {
    const form = new FormData();
    form.append("image", file);
    const res = await api.post(`/uploads/team-chat/${postId}/image`, form, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data.data as UploadedImageResult;
  },

  async uploadTeamChatVideo(postId: string, file: File): Promise<UploadedVideoResult> {
    const form = new FormData();
    form.append("video", file);
    const res = await api.post(`/uploads/team-chat/${postId}/video`, form, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data.data as UploadedVideoResult;
  }
};
