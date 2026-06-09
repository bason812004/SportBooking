import { type PropsWithChildren } from "react";
import { motion } from "framer-motion";

export function DetailSection({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
      <Reveal>
        <h2 className="text-2xl font-black text-[#0b1220] md:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-slate-600">{description}</p>}
      </Reveal>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Reveal({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.55, delay }}>
      {children}
    </motion.div>
  );
}
