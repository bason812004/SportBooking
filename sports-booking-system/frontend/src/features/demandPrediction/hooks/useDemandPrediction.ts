import { useQuery } from "@tanstack/react-query";
import { demandPredictionApi, type DemandPredictionParams } from "../api/demandPredictionApi";

export function useDemandPrediction(params: DemandPredictionParams | null) {
  return useQuery({
    queryKey: ["demand-prediction", params],
    queryFn: () => demandPredictionApi.predict(params!),
    enabled: Boolean(params?.courtId && params.date && params.startTime && params.endTime)
  });
}

export function usePartnerDemandOverview() {
  return useQuery({ queryKey: ["partner-demand-overview"], queryFn: demandPredictionApi.overview });
}

export function usePartnerCourtOverview(courtId?: string) {
  return useQuery({
    queryKey: ["partner-demand-court-overview", courtId],
    queryFn: () => demandPredictionApi.courtOverview(courtId!),
    enabled: Boolean(courtId)
  });
}
