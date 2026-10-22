import { PageHero } from "../../components/common/PageHero";
import { ReportView } from "../../features/report/components/ReportView";
import { adminReportApi } from "../../features/report/api/reportApi";

export function AdminBusinessReportPage() {
  return (
    <div className="space-y-5">
      <PageHero eyebrow="Báo cáo" title="Báo cáo doanh thu" subtitle="Tổng quan doanh thu, booking và dịch vụ toàn hệ thống." />
      <ReportView queryKeyPrefix="admin-report" api={adminReportApi} includeCommission filenameBase="bao-cao-admin" />
    </div>
  );
}
