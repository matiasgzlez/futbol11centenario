import { useEffect, useRef } from "react";
import { allPlayers, topPlayers, V } from "../lib/game";
import { go, openPlayer, showTeam, useData, useUi } from "../lib/store";
import { Avatar, CardView, FutCard } from "./FutCard";

const MAPS = "https://www.google.com/maps/place/Estadio+Centenario+-+C.A.+Sarmiento+de+Resistencia/@-27.4426378,-59.0133138,17z/data=!3m1!4b1!4m6!3m5!1s0x94450c783ef7a051:0xcd239a4a8f9ad665!8m2!3d-27.4426378!4d-59.0107389!16s%2Fg%2F1tfcv9pc!5m1!1e4";

export function Home() {
  const data = useData(), ui = useUi();
  const top = topPlayers(data, data.bets);
  const off = (r: number) => (r === 0 ? 0 : (r % 2 ? -1 : 1) * Math.ceil(r / 2)); // el mejor al centro
  return <section className={`screen home${ui.screen === "home" ? " active" : ""}`} id="inicio" aria-label="Inicio">
    <StadiumBackground active={ui.screen === "home"} />
    <div className="home-shade" aria-hidden="true" />
    <div className="home-grid">
      <div className="home-logo">
        <h1 className="sr-only">UTN contra Sarmiento de Resistencia</h1>
        <p className="home-title">El partido<br />del año</p>
        <div className="home-meta">
          <span className="meta-date"><b>Domingo 29/11</b> o <b>6/12</b></span>
          <a className="meta-place" href={MAPS} target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="10" r="2.6" /></svg>
            <span>Estadio Centenario<small>Cómo llegar</small></span>
          </a>
        </div>
        <div className="home-staff">
          <StaffCard kind="ref" label="Árbitro confirmado" name="Mateo Pitana" photo="/assets/arbitro.jpg" pos="ÁRB" />
          <StaffCard kind="coach" label="Organizador" name="Chiqui Mafia" photo="/assets/organizador.jpg" pos="ORG" />
        </div>
      </div>
      <div className="home-fan" role="group" aria-label="Los mejor puntuados">
        {top.length ? top.map((x, r) => <button key={`${x.t}_${x.i}_${x.p.n}`} type="button" className="fan-card" data-fan={`${x.t}_${x.i}`}
          style={{ "--off": off(r), "--abs": Math.abs(off(r)), "--r": r } as React.CSSProperties}
          aria-label={`${x.p.n}, media ${x.ovr}`}
          onClick={e => { showTeam(x.t as 0 | 1); openPlayer(x.t, x.i, e.currentTarget.querySelector(".fut")?.getBoundingClientRect()); }}>
          <FutCard t={x.t} i={x.i} />
        </button>)
          : [0, -1, 1, -2, 2].map((o, r) => <div key={r} className="fan-card ghost" style={{ "--off": o, "--abs": Math.abs(o), "--r": r } as React.CSSProperties}>
            <div className="fut fut-xl empty"><div className="fut-in"><span className="fut-plus">+</span></div></div></div>)}
      </div>
      <div className="home-tiles">
        <TeamsBoard onOpen={() => showTeam(ui.view)} />
        <BetTicket onOpen={() => go("bets")} />
      </div>
    </div>
  </section>;
}

/** Pizarra táctica: la formación en tiza y las caras de los que ya se anotaron. */
function TeamsBoard({ onOpen }: { onOpen: () => void }) {
  const data = useData();
  const players = allPlayers(data);
  const faces = [...players.filter(p => p.f), ...players.filter(p => !p.f)].slice(0, 7);
  const free = 22 - data.S.flat().filter(p => p.n).length;
  return <button type="button" className="tile-board" id="tile-teams" onClick={onOpen}>
    <span className="board-left">
      <span className="tile-faces" aria-hidden="true">
        {faces.map(p => <Avatar key={p.key} className={`tile-face t${p.t}`} name={p.n} photo={p.f} />)}
        {players.length > faces.length && <span className="tile-face more">+{players.length - faces.length}</span>}
      </span>
      <span className="tile-copy"><b>Equipos</b><em>{free === 1 ? "Queda 1 lugar en cancha" : free ? `Quedan ${free} lugares en cancha` : "Mirá las formaciones y quién juega dónde"}</em></span>
    </span>
    <svg className="board-chalk" viewBox="0 0 160 104" aria-hidden="true">
      <rect x="2" y="2" width="156" height="100" rx="1.5" /><line x1="80" y1="2" x2="80" y2="102" /><circle cx="80" cy="52" r="13" />
      <rect x="2" y="28" width="20" height="48" /><rect x="138" y="28" width="20" height="48" /><rect x="2" y="40" width="7" height="24" /><rect x="151" y="40" width="7" height="24" />
      {V.map(([x, y], k) => <circle key={k} className="board-dot" cx={8 + (88 - y) * .88} cy={6 + x * .92} r="2.8" style={{ "--k": k } as React.CSSProperties} />)}
      {V.map(([x, y], k) => <path key={`x${k}`} className="board-x" d={`M${150 - (88 - y) * .88} ${4 + x * .92}l4 4m0 -4l-4 4`} />)}
      <path className="board-arrow" d="M47 52 C 60 30, 78 30, 96 40" />
    </svg>
  </button>;
}

/** Boleta de Prode: muestra en vivo el marcador que más se repite. */
function BetTicket({ onOpen }: { onOpen: () => void }) {
  const data = useData();
  const tally: Record<string, number> = {};
  for (const b of data.bets) tally[`${b.s0}-${b.s1}`] = (tally[`${b.s0}-${b.s1}`] || 0) + 1;
  const fav = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0]?.split("-");
  const mine = !!data.me && data.bets.some(b => b.owner === data.me);
  return <button type="button" className="tile-ticket" id="tile-bets" onClick={onOpen}>
    <span className="ticket-paper">
      <span className="tile-copy"><b>Apuestas</b><em>{data.bets.length ? `${data.bets.length} ${data.bets.length === 1 ? "boleta jugada" : "boletas jugadas"}` : "Todavía nadie jugó"}</em></span>
      <span className="ticket-fav" aria-label={fav ? `Lo más votado: ${fav[0]} a ${fav[1]}` : "Sin votos"}>
        <small>{fav ? "Lo más votado" : "Tu pronóstico"}</small>
        <span><i>Eq 1</i><b>{fav ? fav[0] : "?"}</b><span className="dash">–</span><b>{fav ? fav[1] : "?"}</b><i>Eq 2</i></span>
      </span>
      <span className="ticket-stamp" aria-hidden="true">{mine ? "Editar" : "Jugar"}</span>
    </span>
  </button>;
}

function StadiumBackground({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const api = useRef<{ setActive(v: boolean): void; dispose(): void } | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    let alive = true;
    import("../lib/stadium").then(m => {
      if (!alive || !ref.current) return;
      try { api.current = m.mountStadium(ref.current); api.current.setActive(activeRef.current); ref.current.classList.add("ready"); }
      catch { /* sin WebGL: queda el degradé de fondo */ }
    }).catch(() => { /* sin WebGL */ });
    return () => { alive = false; api.current?.dispose(); api.current = null; };
  }, []);
  useEffect(() => { api.current?.setActive(active); }, [active]);
  return <canvas ref={ref} id="field-bg" aria-hidden="true" />;
}

/** Carta especial del Home (árbitro, organizador). La foto se toma de public/assets. */
function StaffCard({ kind, label, name, photo, pos }: { kind: "ref" | "coach"; label: string; name: string; photo: string; pos: string }) {
  const votes = { goals: 0, mvp: 0, defender: 0, keeper: 0, assist: 0, cards: 0, bloopers: 0, list: [] };
  return <figure className={`staff-card ${kind}`}>
    <CardView compact face={{ t: 2, ovr: null, pos, tier: kind, name, photo, votes }} />
    <figcaption>{label}</figcaption>
  </figure>;
}
