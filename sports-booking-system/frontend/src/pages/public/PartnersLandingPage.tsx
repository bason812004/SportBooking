import { Link } from "react-router-dom";
import { BarChart3, CalendarDays, CheckCircle2, Rocket, TrendingUp, WalletCards } from "lucide-react";
import { Button } from "../../components/ui/Button";

const benefits = [
  { title: "Tang booking", description: "Tiep can khach hang dang tim san moi ngay tren SportBooking.", icon: Rocket },
  { title: "Quan ly lich thong minh", description: "Theo doi khung gio trong, booking moi va lich su dat san.", icon: CalendarDays },
  { title: "Thanh toan minh bach", description: "Kiem soat trang thai thanh toan, doanh thu va doi soat.", icon: WalletCards },
  { title: "Thong ke chi tiet", description: "Bao cao hieu suat san, doanh thu va ti le lap day.", icon: BarChart3 }
];

const steps = ["Dang ky", "Cho duyet", "Them san", "Nhan khach"];

export function PartnersLandingPage() {
  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-white via-white to-[#effbea]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#b9cdb7] bg-[#eef9ec] px-4 py-1 text-sm font-medium text-[#0a6c2b]">
              <CheckCircle2 className="h-4 w-4" />
              Danh cho Chu San
            </span>
            <h1 className="mt-8 max-w-xl text-5xl font-black leading-tight tracking-tight md:text-6xl">
              Hop tac cung <span className="text-[#02712a]">SportBooking</span> Toi uu cong suat san cua ban
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              He thong quan ly thong minh giup ban toi da hoa doanh thu, giam thieu thoi gian trong va mang lai trai nghiem dat san chuyen nghiep.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register-partner">
                <Button className="h-12 rounded-md bg-[#24c866] px-7 text-base hover:bg-[#16a34a]">
                  Dang ky lam doi tac
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" className="h-12 rounded-md border-blue-700 px-7 text-base text-blue-700">
                  Dang nhap doi tac
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              className="h-[380px] w-full rounded-[28px] border-4 border-black object-cover shadow-2xl"
              src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1400&q=80"
              alt="Indoor sports facility"
            />
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-2xl border border-[#b9cdb7] bg-white/90 p-5 shadow-lg backdrop-blur">
              <div>
                <p className="text-sm font-medium">Doanh thu hom nay</p>
                <p className="text-2xl font-extrabold text-[#02712a]">+12,500,000d</p>
              </div>
              <span className="rounded-full bg-[#c9f7d8] p-4 text-[#02712a]">
                <TrendingUp className="h-6 w-6" />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f1fbef] py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="text-center">
            <h2 className="text-4xl font-bold">Tai sao chon chung toi?</h2>
            <p className="mt-4 text-slate-600">Giai phap toan dien giup chu san thanh thoi quan ly, but pha doanh thu.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {benefits.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[#dfe8dc] bg-white p-6 shadow-sm">
                <span className="inline-flex rounded-xl bg-[#eef9ec] p-3 text-[#02712a]">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <h2 className="text-4xl font-bold">Bat dau de dang voi 4 buoc</h2>
          <div className="mt-14 grid gap-8 md:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="relative">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#02712a] bg-white font-bold text-[#02712a]">
                  {index + 1}
                </span>
                <h3 className="mt-5 font-bold">{step}</h3>
                <p className="mt-3 text-sm text-slate-600">
                  {index === 0 && "Dien thong tin co ban ve co so the thao cua ban."}
                  {index === 1 && "Doi doi ngu admin lien he xac minh nhanh chong."}
                  {index === 2 && "Thiet lap danh sach san, khung gio va bang gia."}
                  {index === 3 && "Bat dau nhan booking va theo doi doanh thu."}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-20 flex flex-col gap-6 rounded-[28px] bg-[#24c866] p-10 text-left text-white shadow-xl md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold">San sang so hoa san tap cua ban?</h2>
              <p className="mt-3 text-white/80">Tham gia cong dong doi tac cua chung toi ngay hom nay.</p>
            </div>
            <Link to="/register-partner">
              <Button variant="secondary" className="h-12 min-w-60 rounded-md border-0">
                Dang ky lam doi tac
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
