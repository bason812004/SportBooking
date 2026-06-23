import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { blogs } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function BlogSection() {
  return (
    <SectionShell eyebrow="Blog thể thao" title="Nội dung giúp người chơi ở lại lâu hơn" description="Các bài viết chiến thuật, kỹ thuật và sức khỏe tạo thêm lý do để người dùng quay lại.">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {blogs.map((post, index) => (
          <Reveal key={post.title} delay={index * 0.05}>
            <Link to={`/blogs/${post.slug}`} className="group block overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <img src={post.image} alt={post.title} loading="lazy" className="h-44 w-full object-cover transition duration-700 group-hover:scale-110" />
              <div className="p-5">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">{post.category}</span>
                <h3 className="mt-3 text-xl font-black">{post.title}</h3>
                <span className="mt-5 inline-flex items-center gap-2 font-black text-blue-700">Đọc bài viết <ArrowRight className="h-4 w-4" /></span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
