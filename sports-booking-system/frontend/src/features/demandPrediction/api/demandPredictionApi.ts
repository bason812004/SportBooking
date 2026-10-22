import { api } from "../../../lib/axios";
import type { ApiResponse, DemandPrediction, PartnerDemandCourtOverview, PartnerDemandForecast, PartnerDemandOverview } from "../../../types/api";

export type DemandPredictionParams = {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
};

export const demandPredictionApi = {
  async predict(params: DemandPredictionParams) {
    const { data } = await api.get<ApiResponse<DemandPrediction>>(`/courts/${params.courtId}/demand-prediction`, {
      params: { date: params.date, startTime: params.startTime, endTime: params.endTime }
    });
    return data.data;
  },
  async overview() {
    const { data } = await api.get<ApiResponse<PartnerDemandOverview>>("/partner/demand-prediction/overview");
    return data.data;
  },
  async courtOverview(courtId: string) {
    const { data } = await api.get<ApiResponse<PartnerDemandCourtOverview>>(`/partner/demand-prediction/courts/${courtId}`);
    return data.data;
  },
  async forecast(courtId: string, date: string) {
    const { data } = await api.get<ApiResponse<PartnerDemandForecast>>(`/partner/demand-prediction/courts/${courtId}/forecast`, {
      params: { date }
    });
    return data.data;
  }
};
