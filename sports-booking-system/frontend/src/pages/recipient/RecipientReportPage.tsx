import { PageHero } from "../../components/common/PageHero";
import { ReportView } from "../../features/report/components/ReportView";
import { recipientReportApi } from "../../features/report/api/reportApi";

export function RecipientReportPage() {
  return (
    <div className="space-y-5">
      <PageHero eyebrow="Báo cáo" title="Báo cáo hoạt động" subtitle="Doanh thu, booking và dịch vụ tại sân bạn đang quản lý." />
      <ReportView queryKeyPrefix="recipient-report" api={recipientReportApi} includeCommission={false} filenameBase="bao-cao-recipient" />
    </div>
  );
}
