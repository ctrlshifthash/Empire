import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../lib/store";

const STYLES: Record<string, string> = {
  info: "border-royal-light/40 bg-royal/30",
  success: "border-emerald-400/40 bg-emerald-700/30",
  warn: "border-blood-light/50 bg-blood/30",
};

const ICONS: Record<string, string> = {
  info: "ℹ️",
  success: "✅",
  warn: "⚠️",
};

export default function Toaster() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto cursor-pointer rounded-lg border px-4 py-3 text-sm text-parchment-50 shadow-deep backdrop-blur-md ${
              STYLES[t.kind] ?? STYLES.info
            }`}
          >
            <span className="mr-2">{ICONS[t.kind] ?? ICONS.info}</span>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
