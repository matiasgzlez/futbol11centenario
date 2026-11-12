import type { ReactNode } from "react";
import { cardInfo, initials, safePhoto, type Votes } from "../lib/game";
import { useData } from "../lib/store";
import { CasShield, UtnLogo } from "./Logos";

/** Datos que se dibujan en la carta; la ficha los arma a mano para mostrar cambios en vivo. */
export interface CardFace { t: number; ovr: number | null; pos: string; tier: string; name: string; photo?: string; votes: Votes; captain?: boolean }

/**
 * Carta estilo oro de EA FC: media y posición arriba a la izquierda, foto grande,
 * nombre legible, fila de stats (etiqueta arriba, número abajo) e íconos al pie.
 * `compact` (banco, selector) omite stats e íconos para que el nombre se lea chico.
 */
export function CardView({ face, compact = false, tilt = false, photoSlot }: { face: CardFace; compact?: boolean; tilt?: boolean; photoSlot?: ReactNode }) {
  const photo = safePhoto(face.photo);
  const long = face.name.length > 11;
  return <div className={`fut ${face.tier}${compact ? " compact" : ""}${tilt ? " tilt" : ""}`} data-team={face.t}>
    <div className="fut-in">
      <div className="fut-top"><b className="fut-ovr">{face.ovr}</b><span className="fut-pos">{face.pos}</span></div>
      {photoSlot ?? <div className="fut-photo" style={photo ? { backgroundImage: `url(${JSON.stringify(photo)})` } : undefined}>{!photo && <span className="fut-initials">{initials(face.name)}</span>}</div>}
      <div className={`fut-name${long ? " long" : ""}`}>{face.name}</div>
      {!compact && <div className="fut-stats"><StatsRow b={face.votes} /></div>}
      {!compact && <div className="fut-foot" aria-hidden="true"><i className="fut-crest" /><UtnLogo className="fut-utn" wordmark={false} /><CasShield className="fut-cas" /></div>}
    </div>
    {face.captain && <span className="fut-cap" title="Capitán">C</span>}
  </div>;
}

export function FutCard({ t, i, compact = false, tilt = false }: { t: number; i: number; xl?: boolean; compact?: boolean; tilt?: boolean }) {
  const data = useData();
  const { p, b, ovr, tier, pos } = cardInfo(data, data.bets, t, i);
  if (!p.n) {
    return <div className={`fut empty${compact ? " compact" : ""}`} data-team={t}><div className="fut-in">
      <span className="fut-pos-lbl">{pos}</span><span className="fut-plus" /><span className="fut-free">Libre</span>
    </div></div>;
  }
  return <CardView compact={compact} tilt={tilt} face={{ t, ovr, pos, tier, name: p.n, photo: p.f, votes: b, captain: p.c && i < 11 }} />;
}

export function StatsRow({ b }: { b: Pick<Votes, "goals" | "mvp" | "defender" | "keeper" | "assist" | "cards"> }) {
  return <>{([["GOL", b.goals], ["MVP", b.mvp], ["DEF", b.defender], ["ATJ", b.keeper], ["ASI", b.assist], ["TAR", b.cards]] as const).map(([k, v]) => <span key={k}><em>{k}</em><b>{v}</b></span>)}</>;
}
export function Avatar({ name, photo, className }: { name: string; photo?: string | null; className: string }) {
  const f = safePhoto(photo);
  return <span className={className} style={f ? { backgroundImage: `url(${JSON.stringify(f)})` } : undefined}>{f ? "" : initials(name)}</span>;
}
