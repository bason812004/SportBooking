import { api } from "../../../lib/axios";
import type { ApiResponse, DynamicPrice } from "../../../types/api";

export type DynamicPriceParams = {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
};

export const dynamicPricingApi = {
  async calculate(params: DynamicPriceParams) {
    const { data } = await api.get<ApiResponse<DynamicPrice>>(`/courts/${params.courtId}/dynamic-price`, {
      params: { date: params.date, startTime: params.startTime, endTime: params.endTime }
    });
    return data.data;
  }
};
