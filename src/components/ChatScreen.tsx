import { useEffect, useRef, useState } from "react";
import { formatRelativeTime, safePhoto } from "../lib/game";
import { getData, go, rememberedName, sendChat, useData, useUi } from "../lib/store";
import { Avatar } from "./FutCard";

const EMOJIS = ["⚽", "🔥", "🥅", "🧤", "🏆", "🍻", "🟨", "🟥", "👏", "😂", "🥩", "💪"];
// Colores de nombre como en los grupos de WhatsApp (modo oscuro).
// El color del nombre dice de qué equipo es: azul, rojo o turquesa (hinchada).
const teamColor = (team: number | null | undefined) => (team === 0 ? "#6fa8ff" : team === 1 ? "#ff7a86" : "#37c9a6");
const hhmm = (ts?: string) => (ts ? new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");

/** Comprime la foto (lado mayor 1280px, JPEG) antes de subirla. */
function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) { reject(new Error("Elegí una imagen de hasta 15 MB.")); return; }
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", .82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la foto. Probá con un JPG o PNG.")); };
    img.src = url;
  });
}

export function ChatScreen() {
  const data = useData(), ui = useUi();
  const active = ui.screen === "chat";
  const [name, setName] = useState(""), [editingName, setEditingName] = useState(false);
  const [msg, setMsg] = useState(""), [image, setImage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [emojis, setEmojis] = useState(false);
  const feed = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!active) return;
    const d = getData();
    const mine = [...d.S.flat(), ...d.subs.flat()].find(p => p.o === d.me && p.n)?.n;
    if (!name) { const n = rememberedName() || mine || ""; setName(n); setEditingName(!n); }
    requestAnimationFrame(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; }, [data.chat.length]);
  const send = async () => {
    if (busy) return;
    const author = name.trim().slice(0, 20), text = msg.trim().slice(0, 280);
    if (!author) { setEditingName(true); setError("Poné tu nombre para comentar."); return; }
    if (!text && !image) { setError("Escribí un mensaje o adjuntá una foto."); return; }
    setBusy(true); setError("");
    try { await sendChat(author, text, image || undefined); setMsg(""); setImage(""); setEditingName(false); setEmojis(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const attach = async (f?: File) => { if (!f) return; try { setImage(await compress(f)); setError(""); } catch (e) { setError((e as Error).message); } };

  return <section className={`screen screen-dlg chat-screen wa${active ? " active" : ""}`} id="dlg-chat" aria-labelledby="chat-title">
    <div className="modal-hdr wa-hdr">
      <div className="wa-hdr-id"><span className="wa-group-av" aria-hidden="true">⚽</span><div><h3 id="chat-title">La tribuna</h3><small><i className="live" />{data.chat.length} comentarios</small></div></div>
      <button type="button" className="btn-close" id="chat-cls" aria-label="Cerrar" onClick={() => go(ui.back)}>✕</button>
    </div>
    <div className="chat-scroll wa-wall" id="chat-feed" ref={feed}>
      {!data.chat.length && <div className="chat-empty"><b>Tribuna vacía</b>Todavía no hay comentarios. Tirá el primero.</div>}
      {data.chat.map((m, k) => {
        const mine = !!data.me && m.owner === data.me, first = k === 0 || data.chat[k - 1].author !== m.author, img = safePhoto(m.image);
        return <div key={m.id} className={`chat-item ${m.team === 0 ? "t0" : m.team === 1 ? "t1" : "t2"}${mine ? " mine" : ""}${first ? " first" : ""}`}>
          {!mine && (first ? <Avatar className="chat-item-av" name={m.author} photo={m.photo} /> : <span className="chat-item-av ghost" />)}
          <div className="chat-item-body">
            {first && <svg className="wa-tail" viewBox="0 0 8 13" aria-hidden="true"><path d={mine ? "M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" : "M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"} /></svg>}
            {first && !mine && <span className="chat-item-user" style={{ color: teamColor(m.team) }}>{m.author}<em>{m.team === 0 ? " · Equipo 1" : m.team === 1 ? " · Equipo 2" : ""}</em></span>}
            {img && <a className="chat-img" href={img} target="_blank" rel="noopener"><img src={img} alt={`Foto de ${m.author}`} loading="lazy" /></a>}
            <span className="chat-item-line">{!(img && m.text === "📷 Foto") && <span className="chat-item-text">{m.text}</span>}<time className="chat-item-time" title={formatRelativeTime(m.time)}>{hhmm(m.time)}{mine && <span className="wa-ticks" aria-label="Enviado">✓✓</span>}</time></span>
          </div>
        </div>;
      })}
    </div>
    <div className="chat-compose wa-compose">
      {emojis && <div className="chat-emojis">{EMOJIS.map(e => <button key={e} type="button" onClick={() => { setMsg(v => v + e); input.current?.focus(); }}>{e}</button>)}</div>}
      {image && <div className="wa-preview"><img src={image} alt="Foto para enviar" /><button type="button" aria-label="Quitar foto" onClick={() => setImage("")}>✕</button></div>}
      <p id="chat-feedback" className="form-feedback" role="alert">{error}</p>
      <div className="chat-input-row wa-bar">
        {editingName ? <input type="text" id="chat-inp-name" className="wa-name-input" maxLength={20} placeholder="Tu nombre" aria-label="Tu nombre" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && name.trim()) { setEditingName(false); input.current?.focus(); } }} />
          : <button type="button" className="wa-name-chip" onClick={() => setEditingName(true)} title="Cambiar el nombre"><b style={{ color: teamColor(null) }}>{name}</b> ✎</button>}
        <button type="button" className="wa-icon" aria-label="Emojis" aria-pressed={emojis} onClick={() => setEmojis(v => !v)}>😊</button>
        <input type="text" id="chat-inp-msg" ref={input} maxLength={280} placeholder="Mensaje" aria-label="Mensaje" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void send(); }} />
        <button type="button" className="wa-icon" aria-label="Adjuntar foto" onClick={() => file.current?.click()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5 12.6 19.9a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" /></svg></button>
        <input type="file" ref={file} accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; void attach(f); }} />
        <button className="wa-send" id="chat-send" type="button" disabled={busy} aria-label="Enviar" onClick={() => void send()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" /></svg></button>
      </div>
    </div>
  </section>;
}
