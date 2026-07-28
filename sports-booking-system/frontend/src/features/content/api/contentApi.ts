import { api } from "../../../lib/axios";
import { repairObject } from "../../../lib/text";
import type {
  ApiResponse,
  BlogComment,
  BlogPost,
  TeamPostMessage,
  TeamRecruitmentInput,
  TeamRecruitmentPost,
  Tournament,
  Voucher,
  VoucherEligibilityResult,
  VoucherEligibilityResponse
} from "../../../types/api";

export type BlogWriteInput = {
  title: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  allowComments: boolean;
};

export const contentApi = {
  async vouchers() {
    const { data } = await api.get<ApiResponse<Voucher[]>>("/vouchers");
    return repairObject(data.data);
  },

  async blogs(params: { search?: string } = {}) {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs", { params: clean(params) });
    return repairObject(data.data);
  },

  async blog(slug: string) {
    const { data } = await api.get<ApiResponse<BlogPost>>(`/blogs/${slug}`);
    return repairObject(data.data);
  },

  async blogComments(slug: string) {
    const { data } = await api.get<ApiResponse<BlogComment[]>>(`/blogs/${slug}/comments`);
    return repairObject(data.data);
  },

  async createBlogComment(slug: string, content: string) {
    const { data } = await api.post<ApiResponse<BlogComment>>(`/blogs/${slug}/comments`, { content });
    return repairObject(data.data) as BlogComment;
  },

  async updateBlogComment(slug: string, commentId: string, content: string) {
    const { data } = await api.put<ApiResponse<BlogComment>>(`/blogs/${slug}/comments/${commentId}`, { content });
    return repairObject(data.data);
  },

  async deleteBlogComment(slug: string, commentId: string) {
    const { data } = await api.delete<ApiResponse<any>>(`/blogs/${slug}/comments/${commentId}`);
    return repairObject(data.data);
  },

  async myBlogs() {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs/me");
    return repairObject(data.data);
  },

  async myBlog(id: string) {
    const { data } = await api.get<ApiResponse<BlogPost>>(`/blogs/me/${id}`);
    return repairObject(data.data);
  },

  async createBlog(input: BlogWriteInput) {
    const { data } = await api.post<ApiResponse<BlogPost>>("/blogs/me", input);
    return repairObject(data.data);
  },

  async updateBlog(id: string, input: BlogWriteInput) {
    const { data } = await api.put<ApiResponse<BlogPost>>(`/blogs/me/${id}`, input);
    return repairObject(data.data);
  },

  async updateBlogComments(id: string, allowComments: boolean) {
    const { data } = await api.patch<ApiResponse<BlogPost>>(`/blogs/me/${id}/comments`, { allowComments });
    return repairObject(data.data);
  },

  async deleteBlog(id: string) {
    const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/blogs/me/${id}`);
    return data.data;
  },

  async trackVoucherClick(id: string) {
    const { data } = await api.post<ApiResponse<{ id: string; clickCount: number }>>(`/vouchers/${id}/click`);
    return data.data;
  },

  async checkVoucherEligibility(input: {
    courtId: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    subtotal: number;
    lang?: "vi" | "en";
  }) {
    const { data } = await api.post<ApiResponse<VoucherEligibilityResponse>>("/vouchers/check-eligibility", input);
    return repairObject(data.data);
  },

  async tournaments() {
    const { data } = await api.get<ApiResponse<Tournament[]>>("/tournaments");
    return repairObject(data.data);
  },

  async tournament(slug: string) {
    const { data } = await api.get<ApiResponse<Tournament>>(`/tournaments/${slug}`);
    return repairObject(data.data);
  },

  async teamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts");
    return repairObject(data.data);
  },

  async teamPost(id: string) {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}`);
    return repairObject(data.data);
  },

  async myTeamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts/me");
    return repairObject(data.data);
  },

  async joinedTeamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts/joined");
    return repairObject(data.data);
  },

  async createTeamPost(input: TeamRecruitmentInput) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>("/team-posts", input);
    return repairObject(data.data);
  },

  async updateTeamPost(id: string, input: TeamRecruitmentInput) {
    const { data } = await api.put<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}`, input);
    return repairObject(data.data);
  },

  async deleteTeamPost(id: string) {
    const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/team-posts/${id}`);
    return data.data;
  },

  async joinTeamPost(id: string) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}/join`);
    return data.data;
  },

  async teamPostMessages(id: string) {
    const { data } = await api.get<ApiResponse<TeamPostMessage[]>>(`/team-posts/${id}/messages`);
    return repairObject(data.data);
  },

  async teamPostMembers(id: string) {
    const { data } = await api.get<ApiResponse<Array<{
      userId: string;
      fullName: string;
      avatarUrl: string | null;
      role: string;
      status: string;
      joinedAt: string;
    }>>>(`/team-posts/${id}/members`);
    return data.data;
  },

  async createTeamPostMessage(
    id: string,
    payload: {
      content?: string;
      messageType?: "TEXT" | "IMAGE" | "VIDEO" | "SYSTEM";
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentSize?: number;
      thumbnailUrl?: string;
      mimeType?: string;
    }
  ) {
    // Backend returns TeamPostMessage[] — extract the first (the newly created message)
    const { data } = await api.post<ApiResponse<TeamPostMessage[]>>(`/team-posts/${id}/messages`, payload);
    const messages = repairObject(data.data) as TeamPostMessage[];
    return messages[0];
  },

  async reactToMessage(postId: string, payload: { messageId: string; reaction: string }) {
    const { data } = await api.post<ApiResponse<{ reaction: string; createdAt: string }>>(
      `/team-posts/${postId}/reactions`,
      payload
    );
    return data.data;
  },

  async removeReaction(postId: string, messageId: string) {
    const { data } = await api.delete<ApiResponse<{ removed: boolean }>>(
      `/team-posts/${postId}/reactions/${messageId}`
    );
    return data.data;
  },

  async leaveGroup(postId: string) {
    const { data } = await api.post<ApiResponse<{ left: boolean }>>(`/team-posts/${postId}/leave`);
    return data.data;
  },

  async removeMember(postId: string, memberId: string) {
    const { data } = await api.delete<ApiResponse<{ removed: boolean }>>(
      `/team-posts/${postId}/members/${memberId}`
    );
    return data.data;
  }
};

function clean(params: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== undefined));
}
