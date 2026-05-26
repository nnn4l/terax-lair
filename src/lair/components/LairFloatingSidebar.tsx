import { motion } from "motion/react";
import { LairChat } from "@/lair/components/LairChat";

export function LairFloatingSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose?: () => void;
}) {
  if (!open) return null;

  return (
    <motion.aside
      data-ai-input-bar
      data-lair-floating-sidebar
      initial={{ opacity: 0, x: 18, scale: 0.99 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 18, scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="fixed right-4 top-16 bottom-12 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-12px_rgba(0,0,0,0.45),0_8px_16px_-8px_rgba(0,0,0,0.3)] ring-1 ring-black/5 dark:ring-white/5"
      aria-label="Lair chat"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-foreground/[0.03] to-transparent"
      />
      <LairChat onClose={onClose} />
    </motion.aside>
  );
}
