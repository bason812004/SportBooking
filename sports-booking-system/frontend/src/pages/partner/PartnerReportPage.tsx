import { PageHero } from "../../components/common/PageHero";
import { ReportView } from "../../features/report/components/ReportView";
import { partnerReportApi } from "../../features/report/api/reportApi";

export function PartnerReportPage() {
  return (
    <div className="space-y-5">
      <PageHero eyebrow="Báo cáo" title="Báo cáo doanh thu" subtitle="Doanh thu, booking và dịch vụ của các sân bạn đang kinh doanh." />
      <ReportView queryKeyPrefix="partner-report" api={partnerReportApi} includeCommission filenameBase="bao-cao-partner" />
    </div>
  );
}
