import { motion } from "motion/react";
import { LairChat } from "@/lair/components/LairChat";

export function LairFloatingSidebar({ open }: { open: boolean }) {
  if (!open) return null;

  return (
    <motion.aside
      data-ai-input-bar
      data-lair-floating-sidebar
      initial={{ opacity: 0, x: 18, scale: 0.99 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 18, scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="fixed right-4 top-16 bottom-12 z-40 flex w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
      aria-label="Lair chat"
    >
      <LairChat />
    </motion.aside>
  );
}
