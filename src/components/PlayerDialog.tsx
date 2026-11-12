import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cardInfo, getSlot, isMine, PN, safePhoto, COACH } from "../lib/game";
import { getUi, go, notifyUser, savePlayer, setUi, takePlayerOrigin, useData, useUi } from "../lib/store";
import { CardView } from "./FutCard";

/** Diálogo nativo que se abre/cierra según el estado y avisa cuando se cierra. */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    const close = () => onClose();
    // Solo el clic fuera del rectángulo cierra el diálogo.
    const click = (e: MouseEvent) => { const r = d.getBoundingClientRect(); if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close(); };
    d.addEventListener("close", close); d.addEventListener("click", click);
    return () => { d.removeEventListener("close", close); d.removeEventListener("click", click); };
  }, [onClose]);
  return ref;
}
const closePlayer = () => setUi({ player: null });

/** Ficha del jugador: la carta grande a la izquierda y toda su información a la derecha. */
export function PlayerDialog() {
  const data = useData(), ui = useUi();
  const slot = ui.player;
  const ref = useDialog(!!slot, closePlayer);
  const card = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [shownKey, setShownKey] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(""), [photo, setPhoto] = useState(""), [target, setTarget] = useState("0_0"), [captain, setCaptain] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loadingPhoto, setLoadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const key = slot?.join("_");

  // Al abrir otra carta: cargar lo guardado y elegir modo durante el render (sin un cuadro con datos viejos).
  if (key !== shownKey) {
    setShownKey(key);
    if (slot) {
      const p0 = getSlot(data, slot[0], slot[1]);
      setName(p0.n || ""); setPhoto(p0.f || ""); setCaptain(!!p0.c); setTarget(key!); setError(""); setBusy(false);
      setMode(p0.n ? "view" : "edit");
    }
  }
  useEffect(() => { if (mode === "edit" && slot) inputRef.current?.focus(); }, [mode, key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Salida tipo walkout: la carta vuela desde la cancha, crece girando y se asienta.
  useLayoutEffect(() => {
    if (!slot) return;
    const el = card.current, from = takePlayerOrigin();
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = el.getBoundingClientRect();
    if (from && to.width) {
      const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2), s = from.width / to.width;
      el.animate([
        { transform: `translate(${dx}px,${dy}px) scale(${s})` },
        { transform: "translate(0,0) scale(1.1) rotateY(-200deg)", offset: .55 },
        { transform: "translate(0,0) scale(.97) rotateY(-360deg)", offset: .82 },
        { transform: "none" },
      ], { duration: 900, easing: "cubic-bezier(.22,.8,.24,1)" });
    } else {
      el.animate([{ transform: "scale(.6) rotateY(-120deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 600, easing: "cubic-bezier(.22,.8,.24,1)" });
    }
  }, [key]);

  if (!slot) return <dialog id="dlg" ref={ref} className="pm" />;
  const [t, i] = slot, p = getSlot(data, t, i), mine = isMine(data, data.me, t, i);
  const editing = mode === "edit" && mine;
  const info = cardInfo(data, data.bets, t, i, (editing ? name.trim() : p.n) || "x");
  const fixed = t === 2 || i === COACH;
  const role = t === 2 ? "Árbitro" : i === COACH ? "Director técnico" : i >= 11 ? "Suplente" : PN[i];
  const shown = safePhoto(editing ? photo : p.f);
  const shownName = (editing ? name.trim() : p.n) || "Tu nombre";

  const pickPhoto = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 15 * 1024 * 1024) { setError("Elegí una imagen de hasta 15 MB."); return; }
    const image = new Image(), url = URL.createObjectURL(f), editingKey = key;
    setLoadingPhoto(true); setError("Preparando foto…");
    const done = () => { URL.revokeObjectURL(url); setLoadingPhoto(false); };
    image.onload = () => {
      try {
        if (getUi().player?.join("_") !== editingKey) return;
        // Recorte cuadrado de 400px, un poco hacia arriba (las caras suelen estar arriba).
        const canvas = document.createElement("canvas"), size = canvas.width = canvas.height = 400, crop = Math.min(image.width, image.height);
        canvas.getContext("2d")!.drawImage(image, (image.width - crop) / 2, (image.height - crop) * .3, crop, crop, 0, 0, size, size);
        setPhoto(canvas.toDataURL("image/jpeg", .85)); setError("");
      } catch { setError("No se pudo leer la foto. Probá con un JPG o PNG."); } finally { done(); }
    };
    image.onerror = () => { setError("No se pudo leer la foto. Probá con un JPG o PNG."); done(); };
    image.src = url;
  };
  const save = async () => {
    if (busy || loadingPhoto) return;
    const n = name.trim().slice(0, 20);
    if (!n) { setError("Ingresá un nombre para guardar."); return; }
    setBusy(true); setError("");
    try {
      await savePlayer(t, i, target.split("_").map(Number) as [number, number], n, photo, captain);
      setUi({ player: null }); notifyUser("Jugador guardado para todos.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const options = [0, 1].flatMap(k => [
    { label: `Equipo ${k + 1} - Titulares`, items: PN.map((n, j) => ({ v: `${k}_${j}`, text: `Eq ${k + 1} · ${n}${data.S[k][j].n ? ` (${data.S[k][j].n})` : ""}`, dis: !isMine(data, data.me, k, j) })) },
    { label: `Equipo ${k + 1} - Suplentes`, items: [0, 1, 2, 3, 4].map(s => ({ v: `${k}_${11 + s}`, text: `Eq ${k + 1} · Suplente ${s + 1}${data.subs[k][s].n ? ` (${data.subs[k][s].n})` : ""}`, dis: !isMine(data, data.me, k, 11 + s) })) },
  ]);
  const rows: [string, string, number][] = [["GOL", "Goleador", info.b.goals], ["MVP", "Figura", info.b.mvp], ["DEF", "Muralla", info.b.defender], ["ATJ", "Arquero", info.b.keeper], ["ASI", "Asistencia", info.b.assist], ["TAR", "Amarilla", info.b.cards], ["ASD", "Paga el asado", info.b.bloopers]];
  const max = Math.max(1, ...rows.map(r => r[2]));
  const betRows = innerHeight < 800 ? 2 : 3;

  return <dialog id="dlg" ref={ref} className={`pm t${t}${mine ? "" : " ro"}`} aria-labelledby="pm-title">
    <div className="pm-grid">
      <div className="pm-stage">
        <span className="pm-burst" aria-hidden="true" key={`b${key}`} />
        <div ref={card} className="pm-flip">
        <div className="fut-back" aria-hidden="true"><svg viewBox="0 0 40 46"><path d="M20 1 38 7v16c0 11-8 18-18 22C10 41 2 34 2 23V7Z" /></svg><b>11</b></div>
        <CardView tilt face={{ t, ovr: info.ovr, pos: info.pos, tier: info.tier, name: shownName, photo: shown, votes: info.b, captain: (editing ? captain : !!p.c) && !fixed }}
          photoSlot={<div className="fut-photo" id="pre" role={editing ? "button" : undefined} tabIndex={editing ? 0 : undefined} aria-label={editing ? "Subir foto" : undefined}
            style={shown ? { backgroundImage: `url(${JSON.stringify(shown)})` } : undefined}
            onClick={() => editing && fileRef.current?.click()} onKeyDown={e => { if (editing && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileRef.current?.click(); } }}>
            <span className="fut-initials">{shown ? "" : name.trim() || p.n ? shownName.slice(0, 2).toUpperCase() : "📷"}</span></div>} />
        </div>
        <input type="file" id="file" ref={fileRef} accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; pickPhoto(f); }} />
        {editing && <button className="ghost-btn photo-btn" id="fb" type="button" onClick={() => fileRef.current?.click()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>{shown ? "Cambiar foto" : "Subir foto"}</button>}
      </div>

      <div className="pm-info" key={key}>
        <button type="button" className="btn-close pm-close" id="cls" aria-label="Cerrar" onClick={closePlayer}>✕</button>
        <p className="pm-kicker"><i className={`team-dot ${t ? "red" : "blue"}`} />Equipo {t + 1} · {role}</p>
        {!editing ? <>
          <h2 id="pm-title" className="pm-name">{p.n || "Lugar libre"}</h2>
          <div className="pm-tags">{p.c && !fixed && <span className="pm-tag cap">Capitán</span>}{mine && p.n && <span className="pm-tag me">Tu carta</span>}{!mine && <span className="pm-tag">Solo quien la cargó puede editarla</span>}</div>
          {!fixed && <>
            <div className="pm-grid-stats">
              <div className="pm-tile ovr"><b>{info.ovr}</b><span>Media</span></div>
              {rows.map(([k, l, v], n) => <div key={k} className={`pm-tile${v ? " on" : ""}`} style={{ "--n": n } as React.CSSProperties} title={l}>
                <b>{v}</b><span>{l}</span><i style={{ "--w": `${Math.round(v / max * 100)}%` } as React.CSSProperties} /></div>)}
            </div>
            <p className="pm-note">La media sube 2 puntos con cada pálpito a favor del Prode.</p>
            <div className="pm-bets">
              <h3>Apuestas sobre {p.n} <span>{info.b.list.length}</span></h3>
              {info.b.list.length ? <ul>{info.b.list.slice(0, betRows).map((x, k) => <li key={k}><b>{x.user}</b><span>{x.items.join(" · ")}</span><small>{x.score} · {x.chips} fichas</small></li>)}
                {info.b.list.length > betRows && <li className="more">y {info.b.list.length - betRows} más en Apuestas</li>}</ul>
                : <p className="pm-empty">Nadie apostó por {p.n} todavía.</p>}
            </div>
          </>}
          <div className="pm-actions">
            {!fixed && <button type="button" className="cta" onClick={() => { closePlayer(); go("bets"); }}>Apostar por {p.n?.split(" ")[0]}</button>}
            {mine && <button type="button" className="cta primary" id="insp-open" onClick={() => setMode("edit")}>Editar mi carta</button>}
          </div>
        </> : <>
          <h2 id="pm-title" className="pm-name">{p.n ? "Editá tu carta" : "Armá tu carta"}</h2>
          <p id="player-access-note" className="form-help">Tu nombre y tu foto se ven en la cancha para todos. Tocá la carta para subir la foto.</p>
          <label className="field" htmlFor="inp">Nombre o apodo</label>
          <input type="text" id="inp" ref={inputRef} maxLength={20} placeholder="Tu nombre o apodo" autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} />
          {!fixed && <><label className="field" htmlFor="mv">Posición</label>
            <select id="mv" value={target} onChange={e => setTarget(e.target.value)}>
              {options.map(g => <optgroup key={g.label} label={g.label}>{g.items.map(o => <option key={o.v} value={o.v} disabled={o.dis}>{o.text}</option>)}</optgroup>)}
            </select></>}
          {!fixed && <label className="switch" id="cap-box"><input type="checkbox" id="inp-cap" checked={captain} onChange={e => setCaptain(e.target.checked)} /><span className="switch-ui" aria-hidden="true" /><span><b>Capitán del equipo</b><small>Lleva la cinta. Uno por equipo.</small></span></label>}
          <p id="player-error" className="form-feedback" role="alert">{error}</p>
          <div className="pm-actions">
            {p.n && <button type="button" className="cta" onClick={() => { setMode("view"); setName(p.n || ""); setPhoto(p.f || ""); setError(""); }}>Cancelar</button>}
            <button type="button" className="cta primary" id="save" disabled={busy || loadingPhoto} onClick={() => void save()}>{busy ? "Guardando…" : p.n ? "Guardar" : "Anotarme"}</button>
          </div>
        </>}
      </div>
    </div>
  </dialog>;
}
