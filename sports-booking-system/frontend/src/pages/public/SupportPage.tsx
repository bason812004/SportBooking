import { Link } from "react-router-dom";
import { MessageSquare, Facebook, ChevronRight, Phone } from "lucide-react";
import { APP_NAME } from "../../lib/constants";

export function SupportPage() {
  return (
    <div className="min-h-screen bg-[#f8faf9] py-16 text-slate-900 flex items-center justify-center">
      <div className="mx-auto max-w-4xl px-6 w-full text-center">
        {/* Breadcrumbs */}
        <div className="mb-8 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
          <Link to="/" className="hover:underline">Trang chủ</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-500">Liên hệ hỗ trợ</span>
        </div>

        {/* Header Section */}
        <header className="mb-14">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600 mb-3.5">{APP_NAME}</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Liên hệ hỗ trợ</h1>
          <p className="mt-4 max-w-xl mx-auto text-sm md:text-base leading-relaxed text-slate-500">
            Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7. Hãy liên hệ với chúng tôi qua các kênh dưới đây.
          </p>
        </header>

        {/* Contact Cards Grid */}
        <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
          
          {/* Zalo Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col items-center justify-between hover:shadow-md transition-all duration-300 group">
            <div className="flex flex-col items-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-blue-600 mb-6 group-hover:scale-105 transition-transform duration-300">
                <MessageSquare className="h-8 w-8 fill-blue-50" />
              </div>
              <h3 className="font-black text-slate-900 text-xl">Zalo</h3>
              <p className="mt-3 text-sm text-slate-500 max-w-[200px] leading-relaxed">
                Chat trực tiếp với đội ngũ hỗ trợ qua Zalo.
              </p>
            </div>
            
            <a
              href="https://zalo.me/0986966745"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center justify-center w-full rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3.5 text-sm font-black text-white shadow-sm transition-all tracking-wider"
            >
              0986966745
            </a>
          </div>

          {/* Facebook Fanpage Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col items-center justify-between hover:shadow-md transition-all duration-300 group">
            <div className="flex flex-col items-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-indigo-50 text-indigo-600 mb-6 group-hover:scale-105 transition-transform duration-300">
                <Facebook className="h-8 w-8 fill-indigo-50" />
              </div>
              <h3 className="font-black text-slate-900 text-xl">Fanpage</h3>
              <p className="mt-3 text-sm text-slate-500 max-w-[220px] leading-relaxed">
                Kết nối và nhận hỗ trợ qua Fanpage Facebook.
              </p>
            </div>
            
            <a
              href="https://www.facebook.com/nbasonw/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center justify-center w-full rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3.5 text-sm font-black text-white shadow-sm transition-all tracking-wider"
            >
              nbasonw
            </a>
          </div>

        </div>

        {/* Footer info note */}
        <div className="mt-12 text-xs text-slate-400">
          <p className="flex items-center justify-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            <span>Hotline hỗ trợ khẩn cấp: 1900 2026</span>
          </p>
        </div>
      </div>
    </div>
  );
}
