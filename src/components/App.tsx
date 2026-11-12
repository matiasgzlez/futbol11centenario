import { useCallback, useEffect, useState } from "react";
import { AdminDialog } from "./AdminDialog";
import { go, notifyUser, setUi, showTeam, sync, useData, useUi } from "../lib/store";
import { BetsScreen } from "./BetsScreen";
import { ChatScreen } from "./ChatScreen";
import { Home } from "./Home";
import { CasShield, UtnLogo } from "./Logos";
import { PlayerDialog } from "./PlayerDialog";
import { SegmentedControl } from "./SegmentedControl";
import { Squad } from "./Squad";

/** Copia el enlace limpio del partido para pasarlo al grupo. */
async function copyLink() {
  const url = new URL(location.href); url.search = ""; url.hash = "";
  try { await navigator.clipboard.writeText(url.href); notifyUser("Enlace copiado. Pegalo en el grupo."); }
  catch { prompt("Copiá el enlace del partido:", url.href); }
}

export function App() {
  const data = useData(), ui = useUi();
  const [admin, setAdmin] = useState(false);
  const closeAdmin = useCallback(() => setAdmin(false), []);
  // El switch del centro: Equipo 1 · Equipo 2 · Apuestas · Comentarios.
  const value = ui.screen === "squad" ? String(ui.view) : ui.screen === "bets" ? "bets" : ui.screen === "chat" ? "chat" : null;
  const onValue = (v: string) => { if (v === "0" || v === "1") showTeam(Number(v) as 0 | 1); else go(v as "bets" | "chat"); };
  useEffect(() => { document.body.dataset.screen = ui.screen; }, [ui.screen]);
  return <div className="app-shell">
    <header className="topbar">
      {ui.screen === "home" ? <span className="brand-lockup" role="img" aria-label="UTN por Sarmiento de Resistencia"><UtnLogo className="bl-utn" /><i>×</i><CasShield className="bl-cas" /></span> : <button type="button" className="home-btn" aria-label="Volver al inicio" onClick={() => setUi({ screen: "home", back: "home" })}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4Z" /></svg><span>Inicio</span></button>}
      <SegmentedControl label="Pantallas" value={value} onValueChange={onValue} options={[
        { value: "0", label: <><i className="team-dot blue" />Equipo 1</> },
        { value: "1", label: <><i className="team-dot red" />Equipo 2</> },
        { value: "bets", id: "btn-bets", label: "Apuestas", accessory: <b id="bets-badge" className="badge">{data.bets.length}</b> },
        { value: "chat", id: "btn-chat", label: "Comentarios", accessory: data.chat.length ? <b id="chat-badge" className="badge">{data.chat.length}</b> : null },
      ]} />
      <div className="top-actions">
        <button type="button" className="top-icon" id="btn-invite" aria-label="Copiar enlace del partido" title="Copiar enlace" onClick={() => void copyLink()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></svg></button>
        <a className="top-icon" href="https://github.com/matiasgzlez/futbol11centenario" target="_blank" rel="noopener" aria-label="Ver el código en GitHub" title="GitHub">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="gh"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg></a>
        <button type="button" className="top-icon" id="btn-admin" aria-label="Panel de administración" title="Admin" onClick={() => setAdmin(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></button>
      <button id="sync-status" className={`sync-status${data.status.bad ? " offline" : ""}`} type="button" title={data.status.detail} onClick={() => void sync()}>{data.status.label}</button>
      </div>
    </header>
    <main>
      <Home />
      <Squad />
      <BetsScreen />
      <ChatScreen />
    </main>
    <PlayerDialog />
    <AdminDialog open={admin} onClose={closeAdmin} />
    <Toast />
  </div>;
}

function Toast() {
  const ui = useUi();
  const [shown, setShown] = useState(false);
  useEffect(() => { if (!ui.toastId) return; setShown(true); const t = setTimeout(() => setShown(false), 5000); return () => clearTimeout(t); }, [ui.toastId]);
  return <output id="toast" className="toast" aria-live="polite" hidden={!shown}>{ui.toast}</output>;
}
