import { api, cleanParams } from "./client";
import type {
  ApiResponse,
  BlogComment,
  BlogPost,
  GroupMember,
  TeamPostMessage,
  TeamRecruitmentInput,
  TeamRecruitmentPost,
  Tournament
} from "./types";

export const contentApi = {
  // ── Blogs ──
  async blogs(params: { search?: string } = {}) {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs", { params: cleanParams(params) });
    return data.data;
  },
  async blog(slug: string) {
    const { data } = await api.get<ApiResponse<BlogPost>>(`/blogs/${slug}`);
    return data.data;
  },
  async blogComments(slug: string) {
    const { data } = await api.get<ApiResponse<BlogComment[]>>(`/blogs/${slug}/comments`);
    return data.data;
  },
  async createBlogComment(slug: string, content: string) {
    const { data } = await api.post<ApiResponse<BlogComment>>(`/blogs/${slug}/comments`, { content });
    return data.data;
  },
  async deleteBlogComment(slug: string, commentId: string) {
    const { data } = await api.delete<ApiResponse<unknown>>(`/blogs/${slug}/comments/${commentId}`);
    return data.data;
  },
  async myBlogs() {
    const { data } = await api.get<ApiResponse<BlogPost[]>>("/blogs/me");
    return data.data;
  },

  // ── Tournaments ──
  async tournaments() {
    const { data } = await api.get<ApiResponse<Tournament[]>>("/tournaments");
    return data.data;
  },
  async tournament(slug: string) {
    const { data } = await api.get<ApiResponse<Tournament>>(`/tournaments/${slug}`);
    return data.data;
  },
  async registerTournament(id: string, payload: { teamName?: string; contactPhone: string; note?: string }) {
    const { data } = await api.post<ApiResponse<unknown>>(`/tournaments/${id}/register`, payload);
    return data.data;
  },

  // ── Teammates & Recruitment Posts ──
  async teamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts");
    return data.data;
  },
  async teamPost(id: string) {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}`);
    return data.data;
  },
  async myTeamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts/me");
    return data.data;
  },
  async joinedTeamPosts() {
    const { data } = await api.get<ApiResponse<TeamRecruitmentPost[]>>("/team-posts/joined");
    return data.data;
  },
  async createTeamPost(input: TeamRecruitmentInput) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>("/team-posts", input);
    return data.data;
  },
  async updateTeamPost(id: string, input: TeamRecruitmentInput) {
    const { data } = await api.put<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}`, input);
    return data.data;
  },
  async deleteTeamPost(id: string) {
    const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/team-posts/${id}`);
    return data.data;
  },
  async joinTeamPost(id: string) {
    const { data } = await api.post<ApiResponse<TeamRecruitmentPost>>(`/team-posts/${id}/join`);
    return data.data;
  },
  async leaveGroup(postId: string) {
    const { data } = await api.post<ApiResponse<{ left: boolean }>>(`/team-posts/${postId}/leave`);
    return data.data;
  },
  async removeMember(postId: string, memberId: string) {
    const { data } = await api.delete<ApiResponse<{ removed: boolean }>>(`/team-posts/${postId}/members/${memberId}`);
    return data.data;
  },

  // ── Team Group Chat & Messages ──
  async teamPostMessages(id: string) {
    const { data } = await api.get<ApiResponse<TeamPostMessage[]>>(`/team-posts/${id}/messages`);
    return data.data;
  },
  async teamPostMembers(id: string) {
    const { data } = await api.get<ApiResponse<GroupMember[]>>(`/team-posts/${id}/members`);
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
    const { data } = await api.post<ApiResponse<TeamPostMessage | TeamPostMessage[]>>(`/team-posts/${id}/messages`, payload);
    if (Array.isArray(data.data)) {
      return data.data[data.data.length - 1];
    }
    return data.data;
  },
  async reactToMessage(postId: string, payload: { messageId: string; reaction: string }) {
    const { data } = await api.post<ApiResponse<{ reaction: string; createdAt: string }>>(
      `/team-posts/${postId}/reactions`,
      payload
    );
    return data.data;
  },
  async removeReaction(postId: string, messageId: string) {
    const { data } = await api.delete<ApiResponse<{ removed: boolean }>>(`/team-posts/${postId}/reactions/${messageId}`);
    return data.data;
  }
};
