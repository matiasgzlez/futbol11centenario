import { useRef, useState } from "react";
import { formatRelativeTime, getSlot, PN, safePhoto, COACH } from "../lib/game";
import { adminDeleteMessage, adminLogin, adminLogout, adminSavePlayer, isAdmin, notifyUser, useData, useUi } from "../lib/store";
import { useDialog } from "./PlayerDialog";

const slotLabel = (t: number, i: number) => t === 2 ? "Árbitro" : i === COACH ? `Equipo ${t + 1} · DT` : i >= 11 ? `Equipo ${t + 1} · Suplente ${i - 10}` : `Equipo ${t + 1} · ${PN[i]}`;
const SLOTS: [number, number][] = [...[0, 1].flatMap(t => [...Array.from({ length: 11 }, (_, i) => [t, i] as [number, number]), ...[11, 12, 13, 14, 15, COACH].map(i => [t, i] as [number, number])]), [2, 0]];

/** Panel de administración: moderar comentarios y editar cualquier jugador. */
export function AdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useUi(); // re-render al iniciar/cerrar sesión
  const data = useData();
  const ref = useDialog(open, onClose);
  const [user, setUser] = useState(""), [pass, setPass] = useState(""), [msg, setMsg] = useState({ text: "", ok: false });
  const [tab, setTab] = useState<"chat" | "players">("chat"), [query, setQuery] = useState("");
  const [editing, setEditing] = useState<[number, number] | null>(null);
  const logged = isAdmin();
  const login = () => { if (adminLogin(user, pass)) { setMsg({ text: "", ok: false }); setPass(""); } else setMsg({ text: "Usuario o contraseña incorrectos.", ok: false }); };
  const del = async (id: string | null) => {
    if (id === null && !confirm("¿Borrar TODOS los comentarios?")) return;
    try { await adminDeleteMessage(id); setMsg({ text: id ? "Comentario borrado." : "Se borraron todos los comentarios.", ok: true }); }
    catch (e) { setMsg({ text: (e as Error).message, ok: false }); }
  };
  const q = query.trim().toLowerCase();
  return <dialog ref={ref} id="dlg-admin" className="sheet admin-sheet" aria-labelledby="admin-title">
    <div className="modal-hdr"><div><span className="modal-kicker">Organización</span><h3 id="admin-title">Panel de admin</h3></div>
      <button type="button" className="btn-close" id="admin-close" aria-label="Cerrar" onClick={onClose}>✕</button></div>
    {!logged ? <div className="admin-login">
      <p className="form-help">Ingresá para moderar los comentarios y editar jugadores.</p>
      <label className="field" htmlFor="admin-inp-user">Usuario</label>
      <input type="text" id="admin-inp-user" autoComplete="username" value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => { if (e.key === "Enter") login(); }} />
      <label className="field" htmlFor="admin-inp-pass">Contraseña</label>
      <input type="password" id="admin-inp-pass" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") login(); }} />
      <output id="admin-feedback" className="form-feedback">{msg.text}</output>
      <button type="button" className="cta primary" id="admin-btn-login" onClick={login}>Ingresar</button>
    </div> : <div className="admin-body">
      <div className="admin-bar">
        <nav className="admin-tabs">{([["chat", `Comentarios (${data.chat.length})`], ["players", "Jugadores"]] as const).map(([k, l]) => <button key={k} type="button" className={`admin-tab${tab === k ? " on" : ""}`} aria-pressed={tab === k} onClick={() => { setTab(k); setEditing(null); }}>{l}</button>)}</nav>
        <button type="button" className="ghost-btn" id="admin-btn-logout" onClick={adminLogout}>Cerrar sesión</button>
      </div>
      <input type="search" className="admin-search" placeholder={tab === "chat" ? "Buscar por autor o texto…" : "Buscar jugador…"} aria-label="Buscar" value={query} onChange={e => setQuery(e.target.value)} />
      <output id="admin-dash-feedback" className={`form-feedback${msg.ok ? " success" : ""}`}>{msg.text}</output>
      {tab === "chat" ? <div className="admin-list" id="admin-chat-list">
        {data.chat.length > 0 && <button type="button" className="btn-clear-all" onClick={() => void del(null)}>Borrar todos</button>}
        {[...data.chat].reverse().filter(m => !q || m.author.toLowerCase().includes(q) || m.text.toLowerCase().includes(q)).map(m => <div key={m.id} className="admin-msg-card">
          <div className="admin-msg-info"><b>{m.author}</b> <small>{formatRelativeTime(m.time)}</small><p>{m.text}</p></div>
          <button type="button" className="btn-msg-del" onClick={() => void del(m.id)}>Borrar</button>
        </div>)}
        {!data.chat.length && <p className="form-help">No hay comentarios.</p>}
      </div> : editing ? <AdminEdit slot={editing} onDone={text => { setEditing(null); if (text) { setMsg({ text, ok: true }); notifyUser(text); } }} />
        : <div className="admin-list admin-players">{SLOTS.filter(([t, i]) => !q || (getSlot(data, t, i).n || "").toLowerCase().includes(q)).map(([t, i]) => {
          const p = getSlot(data, t, i), f = safePhoto(p.f);
          return <button key={`${t}_${i}`} type="button" className="admin-player-card" onClick={() => setEditing([t, i])}>
            <span className="admin-player-av" style={f ? { backgroundImage: `url(${JSON.stringify(f)})` } : undefined}>{f ? "" : (p.n || "+").slice(0, 2).toUpperCase()}</span>
            <span className="admin-player-info"><b className={p.n ? "" : "e"}>{p.n || "Lugar libre"}{p.c ? " (C)" : ""}</b><small>{slotLabel(t, i)}</small></span><span aria-hidden="true">✎</span>
          </button>;
        })}</div>}
    </div>}
  </dialog>;
}

function AdminEdit({ slot, onDone }: { slot: [number, number]; onDone: (msg?: string) => void }) {
  const data = useData();
  const [t, i] = slot, p = getSlot(data, t, i);
  const [name, setName] = useState(p.n || ""), [photo, setPhoto] = useState(p.f || ""), [cap, setCap] = useState(!!p.c), [target, setTarget] = useState(`${t}_${i}`);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const fixed = t === 2 || i === COACH, shown = safePhoto(photo);
  const pick = (f?: File) => {
    if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { const c = document.createElement("canvas"), s = c.width = c.height = 400, crop = Math.min(img.width, img.height);
      c.getContext("2d")!.drawImage(img, (img.width - crop) / 2, (img.height - crop) * .3, crop, crop, 0, 0, s, s); setPhoto(c.toDataURL("image/jpeg", .85)); URL.revokeObjectURL(url); };
    img.onerror = () => { setErr("No se pudo leer la foto."); URL.revokeObjectURL(url); };
    img.src = url;
  };
  const save = async () => {
    const n = name.trim().slice(0, 20);
    if (!n) { setErr("Ingresá un nombre."); return; }
    setBusy(true); setErr("");
    try { await adminSavePlayer(t, i, target.split("_").map(Number) as [number, number], n, photo, cap); onDone("Jugador actualizado por el admin."); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="admin-edit">
    <p className="modal-kicker">{slotLabel(t, i)}</p>
    <div className="admin-photo-row"><span className="pre" style={shown ? { backgroundImage: `url(${JSON.stringify(shown)})` } : undefined} />
      <input type="file" ref={file} accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; pick(f); }} />
      <button type="button" className="ghost-btn" onClick={() => file.current?.click()}>Cambiar foto</button></div>
    <label className="field" htmlFor="admin-player-inp">Nombre</label>
    <input type="text" id="admin-player-inp" maxLength={20} value={name} onChange={e => setName(e.target.value)} />
    {!fixed && <>
      <label className="field" htmlFor="admin-player-mv">Posición</label>
      <select id="admin-player-mv" value={target} onChange={e => setTarget(e.target.value)}>
        {[0, 1].flatMap(k => [...PN.map((n, j) => <option key={`${k}_${j}`} value={`${k}_${j}`}>Eq {k + 1} · {n}{data.S[k][j].n ? ` (${data.S[k][j].n})` : ""}</option>),
          ...[0, 1, 2, 3, 4].map(s => <option key={`${k}_${11 + s}`} value={`${k}_${11 + s}`}>Eq {k + 1} · Suplente {s + 1}{data.subs[k][s].n ? ` (${data.subs[k][s].n})` : ""}</option>)])}
      </select>
      <label className="switch"><input type="checkbox" checked={cap} onChange={e => setCap(e.target.checked)} /><span className="switch-ui" aria-hidden="true" /><span><b>Capitán</b><small>Uno por equipo.</small></span></label>
    </>}
    <output className="form-feedback">{err}</output>
    <div className="btn-row"><button type="button" className="cta" onClick={() => onDone()}>Volver</button><button type="button" className="cta primary" id="admin-player-save" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar"}</button></div>
  </div>;
}
