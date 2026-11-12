import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import { boot } from "./lib/store";
import "./index.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
boot();

// Efecto 3D de las cartas grandes siguiendo el puntero.
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.addEventListener("pointermove", e => {
    const c = (e.target as Element).closest?.(".fut.tilt") as HTMLElement | null; if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty("--ry", `${(x - .5) * 18}deg`); c.style.setProperty("--rx", `${(.5 - y) * 14}deg`); c.style.setProperty("--sx", `${110 - x * 120}%`);
  });
  document.addEventListener("pointerout", e => {
    const c = (e.target as Element).closest?.(".fut.tilt") as HTMLElement | null;
    if (c && !c.contains(e.relatedTarget as Node)) ["--rx", "--ry", "--sx"].forEach(v => c.style.removeProperty(v));
  });
}
