import { Camera, Maximize2, PlayCircle, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

export function HeroGallery({ images }: { images: string[] }) {
  const gallery = images.length >= 5 ? images.slice(0, 5) : [...images, ...images].slice(0, 5);
  return (
    <section className="grid gap-3 lg:grid-cols-[1.45fr_1fr]">
      <motion.div whileHover={{ scale: 1.01 }} className="relative h-[420px] overflow-hidden rounded-[2rem]">
        <img src={gallery[0]} alt="Ảnh chính sân thể thao" className="h-full w-full object-cover" />
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          <Badge icon={PlayCircle} label="Video giới thiệu" />
          <Badge icon={RotateCcw} label="360°" />
        </div>
      </motion.div>
      <div className="grid grid-cols-2 gap-3">
        {gallery.slice(1, 5).map((image, index) => (
          <button key={image + index} className="relative overflow-hidden rounded-[1.5rem]">
            <img src={image} alt="Gallery sân" loading="lazy" className="h-full min-h-[200px] w-full object-cover transition duration-700 hover:scale-110" />
            {index === 3 && <span className="absolute inset-0 grid place-items-center bg-black/45 text-lg font-black text-white"><Camera className="mr-2 inline h-5 w-5" /> Xem {images.length} ảnh</span>}
          </button>
        ))}
      </div>
      <button className="fixed bottom-24 left-6 z-40 hidden rounded-full bg-white px-4 py-3 font-black text-[#0b1220] shadow-xl lg:inline-flex">
        <Maximize2 className="mr-2 h-5 w-5" />
        Lightbox / Zoom
      </button>
    </section>
  );
}

function Badge({ icon: Icon, label }: { icon: typeof PlayCircle; label: string }) {
  return <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-black"><Icon className="h-4 w-4" /> {label}</span>;
}
