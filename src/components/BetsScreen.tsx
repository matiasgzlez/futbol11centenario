import { useEffect, useMemo, useState } from "react";
import { allPlayers, formatRelativeTime, MAX_PICKS, STAT_CATEGORIES, type Bet, type ListedPlayer, type StatId } from "../lib/game";
import { deleteBet, getData, go, notifyUser, rememberedName, saveBet, useData, useUi } from "../lib/store";
import { FutCard } from "./FutCard";
import { CasShield, UtnLogo } from "./Logos";
import { useDialog } from "./PlayerDialog";

type Sel = Partial<Record<StatId, string[]>>;
interface Draft { user: string; s0: number; s1: number; chips: number; sel: Sel }
const EMPTY: Draft = { user: "", s0: 1, s1: 0, chips: 500, sel: {} };
const CHIPS = [100, 250, 500, 1000];
const STEPS = ["Resultado", "Premios", "Fichas"] as const;

function claimedName() {
  const d = getData();
  for (const t of [0, 1]) for (const p of [...d.S[t], ...d.subs[t]]) if (p.o === d.me && p.n) return p.n;
  return "";
}
/** Pasa la boleta guardada al borrador (IDs de jugador → claves de la lista actual). */
function draftFromBet(b: Bet, players: ListedPlayer[]): Draft {
  const sel: Sel = {};
  for (const c of STAT_CATEGORIES) {
    const v = b.sel?.[c.id]; if (!v) continue;
    const keys = (v.ids.length ? v.ids.map(id => players.find(p => p.id === id)?.key) : v.names.map(n => players.find(p => p.n.toLowerCase() === n.toLowerCase())?.key)).filter(Boolean) as string[];
    if (keys.length) sel[c.id] = keys.slice(0, MAX_PICKS);
  }
  return { user: b.user, s0: b.s0, s1: b.s1, chips: b.amount, sel };
}

export function BetsScreen() {
  const data = useData(), ui = useUi();
  const active = ui.screen === "bets";
  const players = allPlayers(data);
  const mine = data.bets.find(b => data.me && b.owner === data.me);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [wizard, setWizard] = useState(false), [step, setStep] = useState(0), [cat, setCat] = useState<StatId>("scorer");
  const [feedback, setFeedback] = useState({ msg: "", ok: false }), [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null), [tab, setTab] = useState<"mine" | "all" | "band">("mine");
  const [printed, setPrinted] = useState(0), [reached, setReached] = useState(0);
  // Al entrar: si ya jugaste, se ve tu boleta; si no, un ejemplo vacío.
  useEffect(() => {
    if (!active) { setWizard(false); return; }
    const d = getData(), b = d.bets.find(x => d.me && x.owner === d.me);
    setDraft(b ? draftFromBet(b, allPlayers(d)) : { ...EMPTY, user: rememberedName() || claimedName() });
    setFeedback({ msg: "", ok: false });
  }, [active]);

  // En celular el asistente ocupa la pantalla: se esconde el switch de abajo mientras tanto.
  useEffect(() => { document.body.classList.toggle("wizard-open", wizard && active); return () => document.body.classList.remove("wizard-open"); }, [wizard, active]);
  const names = (c: StatId) => (draft.sel[c] || []).map(k => players.find(p => p.key === k)?.n).filter(Boolean) as string[];
  const start = () => { setReached(mine ? 2 : 0); setStep(0); setCat("scorer"); setWizard(true); setTab("mine"); setFeedback({ msg: "", ok: false }); };
  const submit = async () => {
    if (busy) return;
    const user = draft.user.trim().slice(0, 20);
    if (!user) { setFeedback({ msg: "Escribí tu nombre para imprimir la boleta.", ok: false }); return; }
    setBusy(true); setFeedback({ msg: "", ok: false });
    try {
      await saveBet({ user, s0: draft.s0, s1: draft.s1, chips: draft.chips, sel: draft.sel });
      setWizard(false); setPrinted(n => n + 1);
      setFeedback({ msg: "Boleta impresa y guardada para todos.", ok: true }); notifyUser("Tu boleta está guardada.");
    } catch (e) { setFeedback({ msg: (e as Error).message, ok: false }); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!mine || !confirm("¿Borrar tu boleta?")) return;
    try { await deleteBet(mine.id); setDraft({ ...EMPTY, user: draft.user }); setFeedback({ msg: "", ok: false }); }
    catch (e) { setFeedback({ msg: (e as Error).message, ok: false }); }
  };
  const showing = wizard || !!mine || printed > 0;

  return <section className={`screen bets-screen${active ? " active" : ""}${wizard ? " wizarding" : ""}`} id="dlg-bets" data-tab={tab} aria-labelledby="bets-title">
    <header className="bets-head">
      <div><h2 id="bets-title">El Prode</h2><p>Puntos virtuales: no hay plata de por medio.</p></div>
      <nav className="bets-tabs" aria-label="Secciones del Prode">
        {([["mine", "Mi boleta"], ["all", "Boletas"], ["band", "La banda"]] as const).map(([k, l]) => <button key={k} type="button" className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      <button type="button" className="btn-close" id="bets-cls" aria-label="Cerrar" onClick={() => go(ui.back)}>✕</button>
    </header>

    <div className="bets-cols">
      <div className="bets-left">
        <Ticket idPrefix="ticket" draft={showing ? draft : null} names={names} number={mine ? data.bets.length - data.bets.indexOf(mine) : data.bets.length + 1}
          state={wizard ? "draft" : mine ? "saved" : "example"} highlight={wizard ? step : -1} printKey={printed} hideChips={wizard && reached < 2} />
        <output id="bet-feedback" className={`form-feedback${feedback.ok ? " success" : ""}`}>{feedback.msg}</output>
        {!wizard && <div className="bets-left-actions">
          <button type="button" className="cta primary bet-start" id="bet-start" onClick={start}>{mine ? "Editar mi boleta" : "Arrancar apuesta"}</button>
          {mine && <button type="button" className="bet-del" onClick={() => void remove()}>Borrar mi boleta</button>}
        </div>}
      </div>

      <Band bets={data.bets} players={players} />

      <div className="bets-center bets-others">
        <h3>Boletas de los pibes <span className="badge" id="bets-count">{data.bets.length}</span></h3>
        {data.bets.length ? <>
          <div className="ticket-stack">
            {data.bets.slice(0, 3).map((b, k) => <button key={b.id} type="button" className="stack-item" style={{ "--k": k } as React.CSSProperties} onClick={() => setViewer(k)} aria-label={`Ver la boleta de ${b.user}`}>
              <MiniTicket bet={b} />
            </button>)}
          </div>
          <button type="button" className="cta" id="bets-view" onClick={() => setViewer(0)}>{data.bets.length === 1 ? "Ver la boleta" : `Ver las ${data.bets.length} boletas`}</button>
        </> : <p className="bets-empty">Todavía nadie jugó. La primera boleta queda arriba de la pila.</p>}
      </div>


      {wizard && <Wizard draft={draft} setDraft={setDraft} step={step} setStep={n => { setStep(n); setReached(r => Math.max(r, n)); }} cat={cat} setCat={setCat} players={players}
        busy={busy} onSubmit={() => void submit()} onClose={() => setWizard(false)} feedback={feedback.ok ? "" : feedback.msg} />}
    </div>
    <Viewer bets={data.bets} index={viewer} setIndex={setViewer} me={data.me} />
  </section>;
}

/** Boleta impresa. En el asistente, la línea del paso actual se resalta mientras se completa. */
function Ticket({ draft, names, number, state, highlight, idPrefix, printKey, hideChips }: { draft: Draft | null; names: (c: StatId) => string[]; number: number; state: "example" | "draft" | "saved"; highlight: number; idPrefix?: string; printKey?: number; hideChips?: boolean }) {
  const id = (s: string) => (idPrefix ? `${idPrefix}-${s}` : undefined);
  const d = draft;
  const winner = !d ? "—" : d.s0 > d.s1 ? "Gana Equipo 1" : d.s0 < d.s1 ? "Gana Equipo 2" : "Empate";
  return <article className={`ticket ${state}`} key={printKey} aria-label="Tu boleta">
    <header className="ticket-top">
      <span className="ticket-logos"><UtnLogo className="t-utn" wordmark={false} /><span>×</span><CasShield className="t-cas" /></span>
      <b>Prode Centenario</b>
      <small>Boleta Nº {String(number).padStart(4, "0")} · Domingo 29/11 o 6/12</small>
    </header>
    <div className={`ticket-sec${highlight === 0 ? " hot" : ""}`}>
      <span className="ticket-k">Resultado</span>
      <div className={`ticket-result ${!d ? "" : d.s0 > d.s1 ? "t0" : d.s0 < d.s1 ? "t1" : ""}`}>
        <b>{winner}</b><span id={id("score")}>{d ? `${d.s0} – ${d.s1}` : "– –"}</span>
      </div>
      <small id={id("goals")}>{d ? (d.s0 + d.s1 >= 3 ? "+2.5 goles" : "-2.5 goles") : "Elegí quién gana"}</small>
    </div>
    <div className={`ticket-sec${highlight === 1 ? " hot" : ""}`}>
      <span className="ticket-k">Premios</span>
      {STAT_CATEGORIES.map(c => { const n = d ? names(c.id) : []; return <div key={c.id} className="ticket-row">
        <span>{c.icon} {c.title}</span><b id={id(c.id)} className={n.length ? "" : "nil"}>{n.length ? n.join(", ") : c.defaultVal}</b></div>; })}
    </div>
    <div className={`ticket-sec${highlight === 2 ? " hot" : ""}`}>
      <div className="ticket-row total"><span>Fichas</span><b id={id("chips")} className={d && !hideChips ? "" : "nil"}>{d && !hideChips ? `🪙 ${d.chips}` : "—"}</b></div>
      <div className="ticket-row"><span>A nombre de</span><b className={d?.user ? "" : "nil"}>{d?.user || "—"}</b></div>
    </div>
    <footer className="ticket-bar" aria-hidden="true"><i /><small>{state === "saved" ? "GUARDADA" : state === "draft" ? "EN ARMADO" : "EJEMPLO"}</small></footer>
    {state === "example" && <span className="ticket-stamp-ex" aria-hidden="true">Ejemplo</span>}
  </article>;
}

function MiniTicket({ bet }: { bet: Bet }) {
  const picks = STAT_CATEGORIES.filter(c => bet.sel?.[c.id]?.names.length).slice(0, 3);
  return <div className="mini-ticket">
    <b>{bet.user}</b>
    <span className={`mt-score ${bet.s0 > bet.s1 ? "t0" : bet.s0 < bet.s1 ? "t1" : ""}`}>{bet.s0} – {bet.s1}</span>
    {picks.map(c => <small key={c.id}>{c.icon} {bet.sel[c.id].names.join(", ")}</small>)}
    <em>🪙 {bet.amount} · {formatRelativeTime(bet.time)}</em>
  </div>;
}

/** Asistente de 3 pasos. La boleta de la izquierda se va completando en vivo. */
function Wizard({ draft, setDraft, step, setStep, cat, setCat, players, busy, onSubmit, onClose, feedback }: {
  draft: Draft; setDraft: (f: (d: Draft) => Draft) => void; step: number; setStep: (n: number) => void; cat: StatId; setCat: (c: StatId) => void;
  players: ListedPlayer[]; busy: boolean; onSubmit: () => void; onClose: () => void; feedback: string;
}) {
  const chooseWinner = (pick: "0" | "1" | "emp") => setDraft(d => {
    let a = d.s0, b = d.s1;
    if (pick === "0" && a <= b) { a = Math.min(15, b + 1); }
    else if (pick === "1" && b <= a) { b = Math.min(15, a + 1); }
    else if (pick === "emp") b = a;
    return { ...d, s0: a, s1: b };
  });
  const stepScore = (team: 0 | 1, delta: number) => setDraft(d => (team ? { ...d, s1: Math.max(0, Math.min(15, d.s1 + delta)) } : { ...d, s0: Math.max(0, Math.min(15, d.s0 + delta)) }));
  const winner = draft.s0 > draft.s1 ? "0" : draft.s0 < draft.s1 ? "1" : "emp";
  const chosen = draft.sel[cat] || [];
  const toggle = (key: string) => setDraft(d => {
    const cur = d.sel[cat] || [];
    const next = cur.includes(key) ? cur.filter(k => k !== key) : cur.length >= MAX_PICKS ? cur : [...cur, key];
    return { ...d, sel: { ...d.sel, [cat]: next } };
  });
  const info = STAT_CATEGORIES.find(c => c.id === cat)!;
  const byTeam = useMemo(() => [0, 1].map(t => players.filter(p => p.t === t)), [players]);
  return <div className="bet-wizard" role="dialog" aria-modal="false" aria-labelledby="wiz-title">
    <div className="wiz-head">
      <ol className="wiz-steps">{STEPS.map((s, k) => <li key={s} className={k === step ? "on" : k < step ? "done" : ""}><button type="button" onClick={() => setStep(k)} aria-current={k === step ? "step" : undefined}><i>{k < step ? "✓" : k + 1}</i>{s}</button></li>)}</ol>
      <button type="button" className="btn-close" aria-label="Cerrar el armado" onClick={onClose}>✕</button>
    </div>

    {step === 0 && <div className="wiz-body wiz-result">
      <h3 id="wiz-title">¿Quién gana?</h3>
      <div className="winner-pick">
        <button type="button" className={`win-btn t0${winner === "0" ? " sel" : ""}`} onClick={() => chooseWinner("0")}><span className="wb-crest" /><b>Equipo 1</b><small>Azul</small></button>
        <button type="button" className={`win-btn draw${winner === "emp" ? " sel" : ""}`} onClick={() => chooseWinner("emp")}><b>Empate</b></button>
        <button type="button" className={`win-btn t1${winner === "1" ? " sel" : ""}`} onClick={() => chooseWinner("1")}><span className="wb-crest" /><b>Equipo 2</b><small>Rojo</small></button>
      </div>
      <div className="score-mini">
        <span>Marcador exacto (opcional)</span>
        {([0, 1] as const).map(t => <div key={t} className={`score-team t${t + 1}`}>
          <button type="button" className="score-btn" aria-label={`Restar gol al Equipo ${t + 1}`} onClick={() => stepScore(t, -1)}>−</button>
          <b id={`score-val-${t}`}>{t ? draft.s1 : draft.s0}</b>
          <button type="button" className="score-btn" aria-label={`Sumar gol al Equipo ${t + 1}`} onClick={() => stepScore(t, 1)}>+</button>
        </div>)}
      </div>
    </div>}

    {step === 1 && <div className="wiz-body wiz-awards">
      <div className="award-cats">
        <h3 id="wiz-title" className="sr-only">Premios</h3>
        {STAT_CATEGORIES.map(c => { const n = (draft.sel[c.id] || []).length; return <button key={c.id} type="button" data-cat={c.id} className={`award-cat${cat === c.id ? " on" : ""}${n ? " has" : ""}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
          <i>{c.icon}</i><span>{c.title}</span><em>{n}/{MAX_PICKS}</em></button>; })}
      </div>
      <div className="award-players">
        <p className="award-hint"><b>{info.icon} {info.title}:</b> {info.sub}. Tocá hasta {MAX_PICKS} cartas. <span className="award-count">{chosen.length}/{MAX_PICKS}</span></p>
        {byTeam.map((list, t) => <div key={t} className="award-team">
          <span className={`award-team-lbl t${t}`}>Equipo {t + 1}</span>
          <div className="award-grid">
            {list.map(p => { const on = chosen.includes(p.key), full = !on && chosen.length >= MAX_PICKS; return <button key={p.key} type="button" data-pick-player={p.key} data-player={p.n}
              className={`award-card${on ? " sel" : ""}${full ? " full" : ""}`} aria-pressed={on} aria-label={`${p.n}${on ? ", elegido" : ""}`} onClick={() => toggle(p.key)}>
              <FutCard t={p.t} i={p.pos} compact />{on && <span className="award-check" aria-hidden="true">✓</span>}</button>; })}
            {!list.length && <p className="form-help">Sin jugadores anotados.</p>}
          </div>
        </div>)}
      </div>
    </div>}

    {step === 2 && <div className="wiz-body wiz-chips">
      <h3 id="wiz-title">Fichas en juego</h3>
      <div className="chips-row" id="bet-pick-chips">{CHIPS.map(v => <button key={v} type="button" className={`chip-btn${draft.chips === v ? " sel" : ""}`} data-val={v} onClick={() => setDraft(d => ({ ...d, chips: v }))}><i />{v}</button>)}</div>
      <label className="field" htmlFor="bet-inp-user">A nombre de</label>
      <input type="text" id="bet-inp-user" maxLength={20} placeholder="Tu nombre o apodo" autoComplete="nickname" value={draft.user} onChange={e => setDraft(d => ({ ...d, user: e.target.value }))} />
      {feedback && <p className="form-feedback" role="alert">{feedback}</p>}
    </div>}

    <div className="wiz-foot">
      {step > 0 ? <button type="button" className="cta" id="bet-back" onClick={() => setStep(step - 1)}>Atrás</button> : <span />}
      {step < 2 ? <button type="button" className="cta primary" id="bet-next" onClick={() => setStep(step + 1)}>Siguiente: {STEPS[step + 1]}</button>
        : <button type="button" className="cta primary" id="bet-btn-submit" disabled={busy} onClick={onSubmit}>{busy ? "Imprimiendo…" : "Imprimir boleta"}</button>}
    </div>
  </div>;
}

/** Lo que dice la banda: un tablero de estadio con cómo vienen las apuestas. */
function Band({ bets, players }: { bets: Bet[]; players: ListedPlayer[] }) {
  const total = bets.length;
  const t1 = bets.filter(b => b.s0 > b.s1).length, t2 = bets.filter(b => b.s0 < b.s1).length, emp = total - t1 - t2;
  const pct = (n: number) => (total ? Math.round(n / total * 100) : 0);
  const scores: Record<string, number> = {};
  for (const b of bets) scores[`${b.s0}-${b.s1}`] = (scores[`${b.s0}-${b.s1}`] || 0) + 1;
  const fav = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const [f0, f1] = fav ? fav[0].split("-") : ["-", "-"];
  const leader = (c: StatId) => {
    const n: Record<string, number> = {};
    for (const b of bets) for (const name of b.sel?.[c]?.names || []) n[name] = (n[name] || 0) + 1;
    return Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  };
  const chips = bets.reduce((a, b) => a + (b.amount || 0), 0);
  const meters = [["t0", "Equipo 1", t1], ["emp", "Empate", emp], ["t1", "Equipo 2", t2]] as const;
  const top = Math.max(1, t1, emp, t2);
  const leaders = STAT_CATEGORIES.map(c => ({ c, l: leader(c.id) })).filter(x => x.l);
  return <CrtTv total={total} pct={pct} meters={meters} top={top} f0={f0} f1={f1} chips={chips} leaders={leaders as { c: typeof STAT_CATEGORIES[number]; l: [string, number] }[]} leaderOf={leader} players={players} />;
}

const CH_COUNT = 2 + STAT_CATEGORIES.length;
/** Televisor CRT: CH −/+ cambian de canal (informe, la cancha y un canal por premio). */
function CrtTv({ total, pct, meters, top, f0, f1, chips, leaders, leaderOf, players }: {
  total: number; pct: (n: number) => number; meters: readonly (readonly ["t0" | "emp" | "t1", string, number])[]; top: number; f0: string; f1: string; chips: number;
  leaders: { c: typeof STAT_CATEGORIES[number]; l: [string, number] }[]; leaderOf: (c: StatId) => [string, number] | undefined; players: ListedPlayer[];
}) {
  const [ch, setCh] = useState(0), [on, setOn] = useState(true), [auto, setAuto] = useState(false);
  const go = (n: number) => setCh(((n % CH_COUNT) + CH_COUNT) % CH_COUNT);
  useEffect(() => { if (!auto || !on) return; const id = setInterval(() => setCh(c => (c + 1) % CH_COUNT), 4500); return () => clearInterval(id); }, [auto, on]);
  const award = ch >= 2 ? STAT_CATEGORIES[ch - 2] : null;
  const al = award ? leaderOf(award.id) : undefined;
  const ap = al ? players.find(p => p.n === al[0]) : undefined;
  return <aside className="bets-band crt" aria-label="Lo que dice la banda">
    <div className="crt-shell">
      <div className={`crt-screen${on ? "" : " off"}`} aria-live="polite">
        {on && <div className="crt-ch" key={ch}>
          <div className="crt-osd" aria-hidden="true"><span>CH {String(ch + 1).padStart(3, "0")}</span><span className="crt-live"><i />EN VIVO</span></div>
          {ch === 0 && <>
            <h3 className="crt-title"><small>Informe:</small>Lo que dice<br />la banda</h3>
            <div className="crt-odds" role="img" aria-label={`Gana Equipo 1 ${pct(meters[0][2])}%, empate ${pct(meters[1][2])}%, gana Equipo 2 ${pct(meters[2][2])}%`}>
              {meters.map(([k, l, n]) => <div key={k} className={`crt-odd ${k}${n === top && total ? " lead" : ""}`}><b>{pct(n)}<small>%</small></b><span>{l}</span></div>)}
              <div className="crt-split" aria-hidden="true">{total ? meters.map(([k, , n]) => <i key={k} className={k} style={{ flexGrow: Math.max(n, .0001) }} />) : <i className="emp" style={{ flexGrow: 1 }} />}</div>
            </div>
            <div className="crt-facts">
              <div className="crt-fact"><small>Marcador más votado</small><b>{f0} – {f1}</b></div>
              <div className="crt-fact"><small>Fichas en juego</small><b id="stat-chips">{chips.toLocaleString("es-AR")}</b></div>
              <div className="crt-fact"><small>Boletas</small><b>{total}</b></div>
            </div>
            <ul className="crt-leaders">
              {leaders.map(({ c, l }) => <li key={c.id}><span>{c.icon} {c.title}</span><b>{l[0]}</b><em>{l[1]}</em></li>)}
              <li className="crt-more">{leaders.length ? `${leaders.length} ${leaders.length === 1 ? "premio con votos" : "premios con votos"}` : "Sin votos en los premios"} · CH + para verlos</li>
              {leaders.length < STAT_CATEGORIES.length && <li className="crt-rest">{leaders.length ? `${STAT_CATEGORIES.length - leaders.length} premios sin votos · CH + para verlos` : "Todavía no hay votos · CH + para ver la cancha"}</li>}
            </ul>
          </>}
          {ch === 1 && <div className="crt-venue">
            <h3 className="crt-title"><small>La cancha:</small>Estadio<br />Centenario</h3>
            <figure className="crt-photo"><img src="/assets/estadio.jpg" alt="Estadio Centenario de Sarmiento, en Resistencia" /></figure>
            <p className="crt-caption">Av. Alvear 1950 · Resistencia, Chaco<br />Domingo 29/11 o 6/12 · Fútbol 11</p>
          </div>}
          {award && <div className="crt-award">
            <h3 className="crt-title"><small>Premio {ch - 1} de {STAT_CATEGORIES.length}:</small>{award.icon} {award.title}</h3>
            {al && ap ? <div className="crt-award-body">
              <div className="crt-card"><FutCard t={ap.t} i={ap.pos} /></div>
              <div className="crt-award-info"><b className={al[0].length > 12 ? "xl-long" : al[0].length > 7 ? "long" : ""}>{al[0]}</b><span>{al[1]} {al[1] === 1 ? "voto" : "votos"} de {total} {total === 1 ? "boleta" : "boletas"}</span><small>{award.sub}</small></div>
            </div> : <div className="crt-nosignal"><b>Sin señal</b><span>Nadie votó todavía para {award.title.toLowerCase()}.</span></div>}
          </div>}
        </div>}
      </div>
      <div className="crt-panel">
        <span className="crt-fuse" aria-hidden="true"><small>FUSE</small><i /></span>
        <span className="crt-brand" aria-hidden="true"><svg viewBox="0 0 40 46"><path d="M20 1 38 7v16c0 11-8 18-18 22C10 41 2 34 2 23V7Z" /></svg>CENTENARIO</span>
        <span className="crt-keys">
          <button type="button" aria-pressed={auto} aria-label="Pasar canales solo" onClick={() => { setAuto(a => !a); setOn(true); }}><small>A.PROG</small><i className={auto ? "on" : ""} /></button>
          <button type="button" aria-label="Volver al informe" onClick={() => { setCh(0); setOn(true); }}><small>MENU</small><i /></button>
          <span className="crt-ch-keys"><small>− CH +</small><span><button type="button" aria-label="Canal anterior" onClick={() => { go(ch - 1); setOn(true); }}><i /></button><button type="button" aria-label="Canal siguiente" onClick={() => { go(ch + 1); setOn(true); }}><i /></button></span></span>
        </span>
        <span className={`crt-led${on ? "" : " off"}`} aria-hidden="true" />
        <button type="button" className="crt-power" aria-pressed={on} aria-label={on ? "Apagar la tele" : "Prender la tele"} onClick={() => setOn(o => !o)}><small>POWER</small><i /></button>
      </div>
    </div>
  </aside>;
}

/** Visor de boletas: fondo oscuro, una boleta por vez y flechas para pasar. */
function Viewer({ bets, index, setIndex, me }: { bets: Bet[]; index: number | null; setIndex: (n: number | null) => void; me: string }) {
  const ref = useDialog(index !== null, () => setIndex(null));
  const i = index ?? 0, b = bets[i];
  useEffect(() => {
    if (index === null) return;
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") setIndex((i + 1) % bets.length); if (e.key === "ArrowLeft") setIndex((i - 1 + bets.length) % bets.length); };
    addEventListener("keydown", key); return () => removeEventListener("keydown", key);
  }, [index, i, bets.length, setIndex]);
  const names = (c: StatId) => b?.sel?.[c]?.names || [];
  return <dialog ref={ref} className="bets-viewer" aria-label="Boletas de los pibes">
    {b && <>
      <button type="button" className="bv-arrow prev" aria-label="Boleta anterior" onClick={() => setIndex((i - 1 + bets.length) % bets.length)}>‹</button>
      <div className="bv-stage" key={b.id}>
        <Ticket draft={{ user: b.user, s0: b.s0, s1: b.s1, chips: b.amount, sel: {} }} names={names} number={bets.length - i} state="saved" highlight={-1} />
        <p className="bv-meta">{b.owner === me ? "Tu boleta · " : ""}{formatRelativeTime(b.time)} · {i + 1} de {bets.length}</p>
      </div>
      <button type="button" className="bv-arrow next" aria-label="Boleta siguiente" onClick={() => setIndex((i + 1) % bets.length)}>›</button>
      <button type="button" className="btn-close bv-close" aria-label="Cerrar" onClick={() => setIndex(null)}>✕</button>
    </>}
  </dialog>;
}
