// Switch portado del header de MARQ (marq-agilidadavanzada): píldora flotante con un
// resaltado blanco compartido (layoutId) que se desliza con resorte entre opciones.
import { useId, type KeyboardEvent, type ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/cn";

export interface Segment { value: string; label: ReactNode; id?: string; accessory?: ReactNode }
export function SegmentedControl({ options, value, onValueChange, label, className }: { options: Segment[]; value: string | null; onValueChange: (v: string) => void; label: string; className?: string }) {
  const id = useId();
  const reduced = useReducedMotion();
  const found = options.findIndex(o => o.value === value), selectedIndex = Math.max(0, found);
  // Flechas, Inicio y Fin mueven la selección como una lista de pestañas.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const from = options.findIndex(o => o.id ? o.id === e.currentTarget.id : o.value === e.currentTarget.dataset.v);
    const target = e.key === "ArrowRight" ? (from === last ? 0 : from + 1)
      : e.key === "ArrowLeft" ? (from <= 0 ? last : from - 1)
        : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (target < 0) return;
    e.preventDefault();
    (e.currentTarget.parentElement?.querySelectorAll("button")[target] as HTMLElement | undefined)?.focus();
  };
  return <LayoutGroup id={id}>
    <nav aria-label={label} className={cn("mode-switch flex rounded-full bg-[#06100f]/90 p-1 shadow-[0_0.75rem_2rem_-0.75rem_rgb(0_0_0/0.5)] ring-1 ring-white/15 backdrop-blur-sm", className)}>
      {options.map((o, index) => {
        const on = value === o.value;
        return <button key={o.value} id={o.id} type="button" aria-current={on ? "page" : undefined} tabIndex={index === selectedIndex || (found < 0 && index === 0) ? 0 : -1} data-v={o.value}
          onClick={() => onValueChange(o.value)} onKeyDown={onKeyDown}
          className={cn("relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[clamp(0.8rem,1vw,1.05rem)] font-semibold transition-colors max-[380px]:gap-1 max-[380px]:px-2 max-[380px]:text-[0.72rem] sm:px-4 sm:py-2.5 lg:px-6", on ? "text-[#06100f]" : "text-white/80 hover:text-white")}>
          {on && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-white" transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }} />}
          <span className="relative flex items-center gap-1.5">{o.label}{o.accessory}</span>
        </button>;
      })}
    </nav>
  </LayoutGroup>;
}
