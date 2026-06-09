import { Send } from "lucide-react";
import { footerColumns, socialLinks } from "./homeData";

export function FooterSection() {
  return (
    <footer className="bg-[#07111f] text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-3xl font-black text-emerald-300">SportBooking</p>
            <p className="mt-4 max-w-xl leading-7 text-slate-300">Nền tảng đặt sân thể thao trực tuyến dành cho người chơi, đội nhóm và chủ sân tại Việt Nam.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map((item) => <span key={item} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-200">{item}</span>)}
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5">
            <p className="text-xl font-black">Nhận ưu đãi mỗi tuần</p>
            <div className="mt-4 flex gap-2 rounded-2xl bg-white p-2">
              <input className="min-w-0 flex-1 bg-transparent px-3 text-[#0b1220] outline-none" placeholder="Email của bạn" />
              <button className="grid h-12 w-12 place-items-center rounded-xl bg-[#0f766e] text-white"><Send className="h-5 w-5" /></button>
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="font-black">{column.title}</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {column.links.map((link) => <a key={link} className="block hover:text-emerald-300" href="#">{link}</a>)}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-slate-400">© 2026 SportBooking. Bản quyền thuộc về hệ thống đặt sân thể thao trực tuyến.</p>
      </div>
    </footer>
  );
}
