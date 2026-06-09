import { useLanguage } from "../../lib/i18n";

export function PartnerPlaceholderPage({ title }: { title: string }) {
  const { t } = useLanguage();
  return <div className="rounded-md border border-line bg-white p-5"><h1 className="text-2xl font-semibold">{t(title)}</h1></div>;
}
