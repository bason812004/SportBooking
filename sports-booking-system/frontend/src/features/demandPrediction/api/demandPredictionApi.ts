import { api } from "../../../lib/axios";
import type { ApiResponse, DemandPrediction } from "../../../types/api";

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
  }
};
