// Reglas del partido: posiciones, cartas, pálpitos y boletas.
// Portado de la versión anterior (app.js) sin cambiar el comportamiento.

export const PN = ["Arquero", "Lateral izq", "Central izq", "Central der", "Lateral der", "Medio izq", "Medio centro", "Medio der", "Extremo izq", "Delantero", "Extremo der"];
export const POS = ["ARQ", "LI", "DFC", "DFC", "LD", "MC", "MC", "MC", "EI", "DC", "ED"];
/** Coordenadas 4-3-3 en vertical: x de izquierda a derecha, y desde el arco rival (0) al propio (100). */
// Escalonada para que ninguna carta quede justo detrás de otra en la cancha.
export const V: [number, number][] = [[50, 90], [10, 68], [35, 72], [65, 72], [90, 68], [28, 41], [50, 43], [72, 41], [11, 16], [50, 11], [89, 16]];
export const COACH = 16;

export interface Player { n?: string; f?: string; o?: string; id?: string; c?: boolean }
export type Team = 0 | 1;
export interface ChatMsg { id: string; author: string; team: number | null; photo: string | null; text: string; time: string; owner?: string; image?: string | null }
export interface Bet {
  id: string; user: string; s0: number; s1: number; team_pick: string; total_goals: string;
  scorer: string; mvp: string; defender: string; keeper: string; assist: string; yellow_card: string; blooper: string;
  refs: Record<string, string>; amount: number; time: string; owner: string;
  /** Hasta 3 jugadores por premio (IDs estables y nombres para mostrar). */
  sel: Record<StatId, { ids: string[]; names: string[] }>;
}
export interface Squads { S: Player[][]; subs: Player[][]; coach: Player[]; referee: Player }

export const STAT_CATEGORIES = [
  { id: "scorer", icon: "⚽", title: "Goleador", sub: "Quién mete los goles o abre el marcador", defaultVal: "Cualquiera" },
  { id: "mvp", icon: "👑", title: "Figura (MVP)", sub: "El crack y mejor jugador del partido", defaultVal: "Cualquiera" },
  { id: "defender", icon: "🛡️", title: "Muralla", sub: "El candado que corta todo y no pasa nadie", defaultVal: "Cualquiera" },
  { id: "keeper", icon: "🧤", title: "Arquero", sub: "La salvada heroica bajo los tres palos", defaultVal: "Cualquiera" },
  { id: "assist", icon: "🪄", title: "Asistencia / Caño", sub: "El pase gol milimétrico o la jugada de lujo", defaultVal: "Cualquiera" },
  { id: "yellow", icon: "🟨", title: "Amarilla", sub: "El más rústico: patada criminal o foul táctico", defaultVal: "Nadie" },
  { id: "blooper", icon: "🥩", title: "Paga el asado", sub: "El blooper o el gol errado insólito", defaultVal: "Nadie" },
] as const;
export type StatId = typeof STAT_CATEGORIES[number]["id"];
export const MAX_PICKS = 3;
/** Campo de la boleta donde se guarda cada premio. */
export const betField = (id: StatId) => (id === "yellow" ? "yellow_card" : id) as keyof Bet;

export function safePhoto(photo: unknown): string {
  return typeof photo === "string" && /^(https:\/\/|data:image\/(jpeg|png|webp);base64,|\/assets\/[\w.-]+\.(jpe?g|png|webp)$)/i.test(photo) ? photo : "";
}
export const initials = (name?: string) => String(name || "").trim().slice(0, 2).toUpperCase();

export function getSlot(sq: Squads, t: number, i: number): Player {
  if (t === 2) return sq.referee;
  if (i === COACH) return sq.coach[t] || {};
  if (i >= 11) return sq.subs[t]?.[i - 11] || {};
  return sq.S[t]?.[i] || {};
}
/** Un lugar libre lo puede tomar cualquiera; uno ocupado, solo el acceso que lo cargó. */
export function isMine(sq: Squads, me: string, t: number, i: number) {
  const p = getSlot(sq, t, i);
  if (!p.n) return true;
  return !!me && (!p.o || p.o === me);
}

export interface Votes { goals: number; mvp: number; defender: number; keeper: number; assist: number; cards: number; bloopers: number; list: { user: string; items: string[]; score: string; chips: number }[] }
export function getPlayerBets(bets: Bet[], name?: string, playerId?: string): Votes {
  const out: Votes = { goals: 0, mvp: 0, defender: 0, keeper: 0, assist: 0, cards: 0, bloopers: 0, list: [] };
  if (!name) return out;
  const target = name.trim().toLowerCase();
  const rows: [keyof Bet, string, keyof Omit<Votes, "list">, string][] = [
    ["scorer", "scorer", "goals", "⚽ Gol"], ["mvp", "mvp", "mvp", "👑 MVP"], ["defender", "defender", "defender", "🛡️ Muralla"],
    ["keeper", "keeper", "keeper", "🧤 Atajadón"], ["assist", "assist", "assist", "🪄 Asistencia"], ["yellow_card", "yellow", "cards", "🟨 Amarilla"], ["blooper", "blooper", "bloopers", "🥩 Paga asado"],
  ];
  for (const b of bets) {
    const items: string[] = [];
    for (const [, cat, key, label] of rows) {
      const pick = b.sel?.[cat as StatId];
      if (!pick) continue;
      const hit = playerId && pick.ids.length ? pick.ids.includes(playerId) : pick.names.some(n => n.trim().toLowerCase() === target);
      if (hit) { out[key]++; items.push(label); }
    }
    if (items.length) out.list.push({ user: b.user, items, score: `${b.s0} - ${b.s1}`, chips: b.amount || 500 });
  }
  return out;
}

/** La media arranca en 75 y suma 2 por cada pálpito positivo del Prode. */
export function cardInfo(sq: Squads, bets: Bet[], t: number, i: number, overrideName?: string) {
  const p = getSlot(sq, t, i), name = overrideName ?? p.n;
  const b = getPlayerBets(bets, p.n, p.id);
  const votes = b.goals + b.mvp + b.defender + b.keeper + b.assist;
  const ovr = name ? Math.min(99, 75 + votes * 2 + (p.c ? 1 : 0)) : null;
  const tier = t === 2 ? "ref" : i === COACH ? "coach" : (ovr ?? 0) >= 85 ? "inform" : "";
  const pos = t === 2 ? "ÁRB" : i === COACH ? "DT" : i >= 11 ? "SUP" : POS[i];
  return { p, b, ovr, tier, pos, votes };
}

export function teamPlayers(sq: Squads, t: number) {
  return [...sq.S[t].map((p, pos) => ({ ...p, t, pos })), ...sq.subs[t].map((p, i) => ({ ...p, t, pos: i + 11 }))]
    .filter(p => typeof p.n === "string" && p.n.trim())
    .map(p => ({ ...p, n: p.n!.trim(), key: p.id || `${t}_${p.pos}` }));
}
export type ListedPlayer = ReturnType<typeof teamPlayers>[number];
export const allPlayers = (sq: Squads) => [...teamPlayers(sq, 0), ...teamPlayers(sq, 1)];

export function teamAvg(sq: Squads, bets: Bet[], t: number) {
  const r = sq.S[t].map((p, i) => (p.n ? cardInfo(sq, bets, t, i).ovr! : 0)).filter(Boolean);
  return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : 0;
}
export function topPlayers(sq: Squads, bets: Bet[], n = 5) {
  return [0, 1].flatMap(t => [...sq.S[t].map((p, i) => ({ t, i, p })), ...sq.subs[t].map((p, k) => ({ t, i: 11 + k, p }))])
    .filter(x => x.p.n).map(x => ({ ...x, ovr: cardInfo(sq, bets, x.t, x.i).ovr! }))
    .sort((a, b) => b.ovr - a.ovr || Number(!!b.p.f) - Number(!!a.p.f) || a.p.n!.localeCompare(b.p.n!)).slice(0, n);
}

/** Boletas nuevas y antiguas comparten un único formato en pantalla. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBetRow(b: any): Bet | null {
  if (!b) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let p: any = {};
  if (typeof b.team_pick === "string" && b.team_pick.trim().startsWith("{")) { try { p = JSON.parse(b.team_pick); } catch { /* boleta antigua */ } }
  let s0 = p.s0 ?? b.s0, s1 = p.s1 ?? b.s1;
  if (s0 === undefined || s1 === undefined) {
    const m = String(b.team_pick || "").match(/(\d+)\s*-\s*(\d+)/);
    [s0, s1] = m ? [Number(m[1]), Number(m[2])] : b.team_pick === "1" ? [1, 2] : b.team_pick === "emp" ? [1, 1] : [2, 1];
  }
  s0 = Math.max(0, Math.min(15, Number(s0) || 0)); s1 = Math.max(0, Math.min(15, Number(s1) || 0));
  return {
    id: b.id, user: b.user_name || b.user || "Anónimo", s0, s1,
    team_pick: s0 > s1 ? "0" : s0 < s1 ? "1" : "emp", total_goals: s0 + s1 >= 3 ? "mas" : "menos",
    scorer: b.scorer || "", mvp: p.mvp || b.mvp || "", defender: p.defender || b.defender || "",
    keeper: p.keeper || b.keeper || "", assist: p.assist || b.assist || "",
    yellow_card: b.yellow_card || "", blooper: p.blooper || b.blooper || "",
    refs: p.refs || b.refs || {}, amount: Number(b.amount) || 500,
    time: b.created_at || b.time || new Date().toISOString(), owner: b.owner || "",
    sel: Object.fromEntries(STAT_CATEGORIES.map(c => {
      const field = c.id === "yellow" ? "yellow_card" : c.id;
      const legacyName = (c.id === "scorer" ? b.scorer : c.id === "yellow" ? b.yellow_card : p[c.id] || b[field]) || "";
      const ids: string[] = Array.isArray(p.multi?.[c.id]) ? p.multi[c.id] : (p.refs?.[c.id] ? [p.refs[c.id]] : []);
      const names: string[] = Array.isArray(p.names?.[c.id]) ? p.names[c.id] : (legacyName && !/^(Cualquiera|Nadie|Otro)/.test(legacyName) ? [legacyName] : []);
      return [c.id, { ids, names }];
    })) as Bet["sel"],
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canonicalBets(rows: any[]): Bet[] {
  const seen = new Set<string>();
  return rows.map(mapBetRow).filter((b): b is Bet => !!b).sort((a, b) => +new Date(b.time) - +new Date(a.time)).filter(b => {
    if (!b.owner) return true;
    if (seen.has(b.owner)) return false;
    seen.add(b.owner); return true;
  });
}
/** Los votos guardados por ID muestran el nombre actual del jugador aunque lo hayan cambiado. */
export function refreshBetNames(bets: Bet[], sq: Squads): Bet[] {
  const players = allPlayers(sq);
  return bets.map(b => {
    const next = { ...b };
    for (const [cat, id] of Object.entries(b.refs || {})) {
      const pl = players.find(p => p.id === id);
      if (pl) (next as unknown as Record<string, unknown>)[cat === "yellow" ? "yellow_card" : cat] = pl.n;
    }
    if (b.sel) next.sel = Object.fromEntries(Object.entries(b.sel).map(([cat, v]) => [cat, {
      ids: v.ids, names: v.ids.length ? v.ids.map((id, k) => players.find(p => p.id === id)?.n ?? v.names[k] ?? "") : v.names,
    }])) as Bet["sel"];
    return next;
  });
}

export function formatRelativeTime(ts?: string) {
  if (!ts) return "Ahora";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return "hace días";
}
