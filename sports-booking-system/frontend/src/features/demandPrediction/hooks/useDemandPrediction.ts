import { useQuery } from "@tanstack/react-query";
import { demandPredictionApi, type DemandPredictionParams } from "../api/demandPredictionApi";

export function useDemandPrediction(params: DemandPredictionParams | null) {
  return useQuery({
    queryKey: ["demand-prediction", params],
    queryFn: () => demandPredictionApi.predict(params!),
    enabled: Boolean(params?.courtId && params.date && params.startTime && params.endTime)
  });
}
