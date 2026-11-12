import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatRelativeTime, PN, POS, teamAvg, V, COACH, type ChatMsg } from "../lib/game";
import { go, openPlayer, useData, useUi } from "../lib/store";
import { Avatar, FutCard } from "./FutCard";

// La formación se ve desde atrás del arco propio; la mitad de cancha queda arriba.
const remapY = (y: number) => 13 + (y - 12) * (84 / 78);
/** Tocar una carta abre la ficha, que sale volando desde la carta tocada. */
const pick = (t: number, i: number, el: Element) => openPlayer(t, i, el.querySelector(".fut")?.getBoundingClientRect() ?? el.getBoundingClientRect());

export function Squad() {
  const data = useData(), ui = useUi();
  const t = ui.view;
  const [deal, setDeal] = useState(0);
  // Las cartas se "reparten" cada vez que entrás a un equipo.
  useEffect(() => { if (ui.screen === "squad") setDeal(d => d + 1); }, [ui.screen, t]);
  const avg = teamAvg(data, data.bets, t), count = data.S[t].filter(p => p.n).length;
  const stars = avg ? Math.max(1, Math.min(5, Math.round((avg - 60) / 5))) : 0;
  const open = ui.player && ui.player[0] === t ? ui.player[1] : -1;
  return <section className={`screen squad${ui.screen === "squad" ? " active" : ""}`} id="plantilla" data-team={t} aria-labelledby="team-name">
    <Notes />
    <div className="pitch-wrap">
      <div id="pitch" key={`${t}-${deal}`} className={`team-${t} intro`} role="group" aria-label={`Formación del Equipo ${t + 1}`}>
        <div className="pitch-plane">
          {["inset:0", "left:0;right:0;top:16%;border-width:2px 0 0", "left:50%;top:16%;width:24%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%)",
            "left:21%;right:21%;bottom:0;height:19%;border-bottom:0", "left:37%;right:37%;bottom:0;height:7%;border-bottom:0",
            "left:41%;right:41%;bottom:19%;height:4%;border-radius:50% 50% 0 0/100% 100% 0 0;border-bottom:0"].map(css => <div key={css} className="ln" style={styleOf(css)} />)}
          {data.S[t].map((p, i) => {
            const own = !!p.n && !!data.me && p.o === data.me;
            return <div key={i} className={`p ${p.n ? "occupied" : "empty"}${own ? " mine" : ""}${open === i ? " opened" : ""}`} data-slot={`${t}_${i}`}
              style={{ left: `${V[i][0]}%`, top: `${remapY(V[i][1])}%`, "--i": i } as React.CSSProperties}
              tabIndex={0} role="button" aria-label={`Equipo ${t + 1}, ${PN[i]}: ${p.n || "lugar libre"}`}
              onClick={e => pick(t, i, e.currentTarget)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(t, i, e.currentTarget); } }}>
              <FutCard t={t} i={i} compact />
            </div>;
          })}
        </div>
      </div>
      <Plates t={t} deal={deal} />
    </div>
    <div className="bench-strip" id="bench-section" role="group" aria-label="Suplentes">
      <span className="strip-lbl">Suplentes</span>
      {[0, 1].map(team => <div key={team} className="bench-slots" id={`bench-t${team}`}>
        {data.subs[team].map((_, k) => <BenchSlot key={k} t={team} i={11 + k} empty={`Sup ${k + 1}`} opened={open === 11 + k && team === t} />)}
      </div>)}
    </div>
    <aside className="team-panel" aria-label={`Equipo ${t + 1}`}>
      <div className="team-id"><span className={`team-crest t${t}`} aria-hidden="true"><svg viewBox="0 0 40 46"><path d="M20 1 38 7v16c0 11-8 18-18 22C10 41 2 34 2 23V7Z" /></svg><b>{t + 1}</b></span>
        <h2 id="team-name">Equipo {t + 1}</h2></div>
      <div className="team-rating">
        <b id="hud-avg">{avg || "–"}</b>
        <span><span className="team-stars" aria-label={`${stars} de 5 estrellas`}>{Array.from({ length: 5 }, (_, k) => <i key={k} className={k < stars ? "on" : ""} />)}</span>Media del equipo</span>
      </div>
      <p className="team-count"><b id="hud-count">{count}/11</b> titulares</p>
      <div className="coach-box"><span className="coach-lbl">Director técnico</span><div id="coach-slot"><BenchSlot t={t} i={COACH} empty="Asignar DT" opened={open === COACH} /></div></div>
    </aside>
  </section>;
}
const styleOf = (css: string) => Object.fromEntries(css.split(";").filter(Boolean).map(r => { const [k, ...v] = r.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.join(":").trim()]; }));

function BenchSlot({ t, i, empty, opened }: { t: number; i: number; empty: string; opened: boolean }) {
  const data = useData();
  const p = i === COACH ? data.coach[t] || {} : data.subs[t][i - 11] || {};
  return <button type="button" className={`b-slot${opened ? " opened" : ""}`} data-slot={`${t}_${i}`}
    aria-label={`${i === COACH ? `Equipo ${t + 1}, director técnico` : `Equipo ${t + 1}, suplente ${i - 10}`}: ${p.n || "lugar libre"}`}
    onClick={e => pick(t, i, e.currentTarget)}>
    <FutCard t={t} i={i} compact />{(!p.n || i !== COACH) && <div className={`b-slot-nm${p.n ? "" : " e"}`}>{p.n || empty}</div>}
  </button>;
}

// Colores de nombre como en los grupos de WhatsApp (modo oscuro).
const NAME_COLORS = ["#53bdeb", "#ffd279", "#ff8a8c", "#a5b337", "#06cf9c", "#e26ab6", "#fc9775", "#7f66ff", "#25d366"];
const nameColor = (name: string) => NAME_COLORS[[...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % NAME_COLORS.length];

/** Comentarios como mensajes de WhatsApp: aparecen de a uno, máximo 4 (1 en celular). */
function Notes() {
  const data = useData(), ui = useUi();
  const [notes, setNotes] = useState<(ChatMsg & { k: number; out?: boolean })[]>([]);
  const st = useRef({ queue: [] as ChatMsg[], seen: new Set<string>(), booted: false, cursor: 0, k: 0 });
  const max = () => (innerWidth <= 700 ? 1 : innerWidth <= 1100 ? 2 : 5);
  useEffect(() => {
    const s = st.current;
    if (!s.booted && data.chat.length) { s.booted = true; data.chat.forEach(m => s.seen.add(m.id)); s.queue = data.chat.slice(-max()); return; }
    for (const m of data.chat) if (!s.seen.has(m.id)) { s.seen.add(m.id); s.queue.push(m); }
  }, [data.chat]);
  const chatRef = useRef(data.chat); chatRef.current = data.chat;
  const active = ui.screen === "squad" && !ui.player;
  const notesRef = useRef(notes); notesRef.current = notes;
  useEffect(() => {
    if (!active) return;
    const s = st.current, timers: number[] = [];
    const next = () => {
      if (document.hidden || !chatRef.current.length) return;
      const prev = notesRef.current.filter(n => !n.out);
      let m = s.queue.shift();
      if (!m) {
        const visible = new Set(prev.map(n => n.id));
        const recent = chatRef.current.slice(-12).filter(x => !visible.has(x.id));
        if (!recent.length) return;
        m = recent[s.cursor++ % recent.length];
      }
      const live = [...prev, { ...m, k: ++s.k }], extra = live.length - max();
      setNotes(live.map((n, idx) => (idx < extra ? { ...n, out: true } : n)));
      timers.push(window.setTimeout(() => setNotes(cur => cur.filter(n => !n.out)), 450));
    };
    timers.push(window.setTimeout(next, 600));
    const loop = window.setInterval(next, 4200);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, [active]);
  return <div className="notes-stack" aria-live="polite" aria-label="Últimos comentarios">
    {notes.map(m => <button key={m.k} type="button" className={`wa-note${m.out ? " out" : ""}`} onClick={() => go("chat")}>
      <Avatar className="wa-av" name={m.author} photo={m.photo} />
      <span className="wa-bubble">
        <svg className="wa-tail" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" /></svg>
        <b style={{ color: nameColor(m.author) }}>{m.author}</b>
        <span className="wa-text">{m.text}<time>{formatRelativeTime(m.time)}</time></span>
      </span>
    </button>)}
  </div>;
}

/**
 * Chapitas de posición en una capa plana sobre la cancha 3D: así ninguna carta de la
 * fila de adelante las tapa. Se ubican midiendo dónde quedó cada carta en pantalla.
 */
function Plates({ t, deal }: { t: number; deal: number }) {
  const data = useData();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; w: number }[]>([]);
  useLayoutEffect(() => {
    const layer = ref.current, pitch = document.getElementById("pitch");
    if (!layer || !pitch) return;
    const measure = () => {
      const base = layer.getBoundingClientRect();
      setPos(Array.from({ length: 11 }, (_, i) => {
        const card = pitch.querySelector(`[data-slot="${t}_${i}"] .fut`);
        if (!card) return { x: -999, y: -999, w: 0 };
        const r = card.getBoundingClientRect();
        return { x: r.left + r.width / 2 - base.left, y: r.bottom - base.top, w: r.width };
      }));
    };
    measure();
    // El reparto de cartas anima unos instantes: medir otra vez cuando termina.
    const later = window.setTimeout(measure, 1200);
    const ro = new ResizeObserver(measure); ro.observe(pitch);
    return () => { clearTimeout(later); ro.disconnect(); };
  }, [t, deal, data.S]);
  return <div className="plates-layer" ref={ref} aria-hidden="true">
    {pos.map((p, i) => <span key={i} className={`p-plate t${t}`} style={{ left: p.x, top: p.y, "--pw": `${p.w}px`, "--i": i } as React.CSSProperties}>{POS[i]}<i /></span>)}
  </div>;
}
