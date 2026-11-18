import { api } from "../../../lib/axios";
import type { ApiResponse, MyReportThread, ReportThreadEntry } from "../../../types/api";

/** The customer's own violation reports (POST /reports, which creates one, lives in reviewApi.report). */
export const courtReportApi = {
  async thread(id: string) {
    const { data } = await api.get<ApiResponse<MyReportThread>>(`/reports/${id}`);
    return data.data;
  },
  /** Only while the report waits, and at most a few messages in a row before an admin answers. */
  async reply(id: string, content: string) {
    const { data } = await api.post<ApiResponse<ReportThreadEntry>>(`/reports/${id}/messages`, { content });
    return data.data;
  }
};
