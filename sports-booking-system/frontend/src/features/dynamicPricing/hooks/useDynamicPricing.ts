import { useQuery } from "@tanstack/react-query";
import { dynamicPricingApi, type DynamicPriceParams } from "../api/dynamicPricingApi";

export function useDynamicPrice(params: DynamicPriceParams | null) {
  return useQuery({
    queryKey: ["dynamic-price", params],
    queryFn: () => dynamicPricingApi.calculate(params!),
    enabled: Boolean(params?.courtId && params.date && params.startTime && params.endTime)
  });
}
