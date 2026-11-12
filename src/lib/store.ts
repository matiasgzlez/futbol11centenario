// Datos compartidos (Supabase) + caché local + estado de la interfaz.
// Ningún guardado se confirma desde la caché: solo con una respuesta válida de la base.
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { canonicalBets, getSlot, isMine, mapBetRow, refreshBetNames, allPlayers, COACH, type Bet, type ChatMsg, type Player, type Squads, type StatId } from "./game";

const SUPABASE_URL = "https://xeukyzwstqbaciugubtf.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldWt5endzdHFiYWNpdWd1YnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NzM1NzAsImV4cCI6MjEwNjU0OTU3MH0.mP_dWBirPW8XJfJUeiLnrDZQqyVgMkuGvYrsRDj9yUU";
const K = "f11c", K_SUBS = "f11_subs", K_REF = "f11_ref", K_COACH = "f11_coach", K_CHAT = "f11_chat", K_BETS = "f11_bets";
type Table = "players" | "chat_messages" | "bets";

function readCache<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}
const writeCache = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } };
const isPlayer = (p: unknown): p is Player => !!p && typeof p === "object" && !Array.isArray(p);
function readTeams(key: string, size: number): Player[][] {
  const d = readCache<unknown[][] | null>(key, null);
  return [0, 1].map(t => Array.from({ length: size }, (_, i) => { const p = d?.[t]?.[i]; return isPlayer(p) ? p : {}; }));
}
const emptyTeams = (size: number): Player[][] => [0, 1].map(() => Array.from({ length: size }, () => ({})));

export interface Status { label: string; bad: boolean; detail: string }
export interface DataState extends Squads { chat: ChatMsg[]; bets: Bet[]; me: string; status: Status; ready: Record<Table, boolean> }

const cachedChat = readCache<ChatMsg[]>(K_CHAT, []);
const cachedCoach = readCache<unknown[]>(K_COACH, []);
const initial: Squads = {
  S: readTeams(K, 11), subs: readTeams(K_SUBS, 5),
  coach: [0, 1].map(t => (isPlayer(cachedCoach?.[t]) ? cachedCoach[t] as Player : {})),
  referee: (() => { const r = readCache<unknown>(K_REF, {}); return isPlayer(r) ? r : {}; })(),
};
let data: DataState = {
  ...initial,
  chat: Array.isArray(cachedChat) ? cachedChat : [],
  bets: refreshBetNames(canonicalBets(Array.isArray(readCache(K_BETS, [])) ? readCache<unknown[]>(K_BETS, []) : []), initial),
  me: "", status: { label: "Conectando…", bad: false, detail: "Tocá para actualizar los datos compartidos" },
  ready: { players: false, bets: false, chat_messages: false },
};
const listeners = new Set<() => void>();
function setData(patch: Partial<DataState>) {
  data = { ...data, ...patch };
  if (patch.S || patch.subs || patch.coach || patch.bets) data = { ...data, bets: refreshBetNames(data.bets, data) };
  listeners.forEach(l => l());
}
export const getData = () => data;
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const useData = () => useSyncExternalStore(subscribe, () => data);

// ---------- Interfaz ----------
export type Screen = "home" | "squad" | "bets" | "chat";
export interface UiState { screen: Screen; back: "home" | "squad"; view: 0 | 1; inspected: [number, number] | null; player: [number, number] | null; toast: string; toastId: number }
let ui: UiState = { screen: "home", back: "home", view: 0, inspected: null, player: null, toast: "", toastId: 0 };
const uiListeners = new Set<() => void>();
export function setUi(patch: Partial<UiState>) { ui = { ...ui, ...patch }; uiListeners.forEach(l => l()); }
export const getUi = () => ui;
export const useUi = () => useSyncExternalStore(cb => { uiListeners.add(cb); return () => { uiListeners.delete(cb); }; }, () => ui);
export function go(screen: Screen) { setUi({ screen, back: screen === "home" || screen === "squad" ? screen : ui.screen === "home" || ui.screen === "squad" ? ui.screen : ui.back }); }
export function showTeam(view: 0 | 1) { setUi({ view, screen: "squad", back: "squad", inspected: view === ui.view ? ui.inspected : null }); }
/** Abre la ficha de un lugar. `from` es la carta tocada: la ficha sale volando desde ahí. */
let playerOrigin: DOMRect | null = null;
export const takePlayerOrigin = () => { const o = playerOrigin; playerOrigin = null; return o; };
export function openPlayer(t: number, i: number, from?: DOMRect) { playerOrigin = from ?? null; setUi({ player: [t, i] }); }
export function notifyUser(message: string) { setUi({ toast: message, toastId: ui.toastId + 1 }); }

// ---------- Acceso ----------
let tok = "";
try { tok = localStorage.getItem("f11tok") || crypto.randomUUID(); localStorage.setItem("f11tok", tok); } catch { /* sin almacenamiento */ }
export const identityReady = (async () => {
  if (!tok || !crypto.subtle) throw new Error("Abrí la web por HTTPS para usar tu acceso.");
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok));
  setData({ me: [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("") });
})();
identityReady.catch(() => { /* se informa en el estado de conexión */ });
let db: SupabaseClient | null = null;
try { db = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { "x-owner": tok } } }); } catch { /* sin conexión */ }

export const rememberName = (name: string) => { try { localStorage.setItem("f11_name", name); } catch { /* */ } };
export const rememberedName = () => { try { return localStorage.getItem("f11_name") || ""; } catch { return ""; } };

function connectionStatus(label: string, bad = false, detail = "Tocá para actualizar los datos compartidos") {
  const s = data.status; if (s.label === label && s.bad === bad && s.detail === detail) return;
  setData({ status: { label, bad, detail } });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function backendError(error: any): string {
  if (error?.code === "PGRST202" || error?.code === "42P01" || error?.code === "42703") return "Falta aplicar la reparación de Supabase. Avisale al organizador; el cambio no se confirmó.";
  if (error?.code === "42501") return "No tenés permiso para guardar este cambio. Recuperá el acceso original.";
  if (/fetch|network|ECONN|AbortError/i.test(error?.message || "")) return "No se pudo conectar. Revisá internet y volvé a intentar; el cambio no se confirmó.";
  return error?.message || "No se pudo conectar. Revisá internet y volvé a intentar.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsToSquads(rows: any[]): Squads {
  const sq: Squads = { S: emptyTeams(11), subs: emptyTeams(5), coach: [{}, {}], referee: {} };
  for (const r of rows) {
    if (!r || ![0, 1, 2].includes(r.team) || !Number.isInteger(r.pos)) continue;
    const p: Player = { n: r.name || "", f: r.photo || "", o: r.owner || "", id: r.player_id || "" };
    if (r.team === 2) sq.referee = p;
    else if (r.pos === COACH) sq.coach[r.team] = p;
    else if (r.pos >= 11 && r.pos < 16) sq.subs[r.team][r.pos - 11] = { ...p, c: !!r.is_captain };
    else if (r.pos >= 0 && r.pos <= 10) sq.S[r.team][r.pos] = { ...p, c: !!r.is_captain };
  }
  return sq;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replacePlayers(rows: any[]) {
  const sq = rowsToSquads(rows);
  if (JSON.stringify([sq.S, sq.subs, sq.coach, sq.referee]) === JSON.stringify([data.S, data.subs, data.coach, data.referee])) return;
  writeCache(K, sq.S); writeCache(K_SUBS, sq.subs); writeCache(K_REF, sq.referee); writeCache(K_COACH, sq.coach);
  setData(sq);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapChat = (c: any): ChatMsg => ({ id: c.id, author: c.author, team: c.team, photo: c.photo, text: c.text, time: c.created_at, owner: c.owner, image: c.image || null });
function setChat(chat: ChatMsg[]) { if (JSON.stringify(chat) === JSON.stringify(data.chat)) return; writeCache(K_CHAT, chat); setData({ chat }); }
function setBets(bets: Bet[]) { writeCache(K_BETS, bets); setData({ bets }); }

// ---------- Sincronización ----------
let syncing: Promise<void> | null = null, syncAgain = false, syncTimer = 0, stateRevision = 0;
export async function sync(): Promise<void> {
  if (syncing) { syncAgain = true; return syncing; }
  if (!db) { connectionStatus("Sin conexión", true); return; }
  const client = db;
  syncing = (async () => {
    connectionStatus("Actualizando…");
    const revision = stateRevision;
    const requests = await Promise.allSettled([
      client.from("players").select("*"),
      client.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(50),
      client.from("bets").select("*").order("created_at", { ascending: false }),
    ]);
    const tables: Table[] = ["players", "chat_messages", "bets"];
    const failures: Table[] = [];
    // Una respuesta iniciada antes de un guardado no debe deshacerlo en pantalla.
    if (revision !== stateRevision) { scheduleSync(); return; }
    const ready = { ...data.ready };
    requests.forEach((result, i) => {
      const table = tables[i];
      if (result.status === "rejected" || result.value.error || !Array.isArray(result.value.data)) { ready[table] = false; failures.push(table); return; }
      ready[table] = true;
      const rows = result.value.data;
      if (table === "players") replacePlayers(rows);
      if (table === "chat_messages") setChat([...rows].reverse().map(mapChat));
      if (table === "bets") setBets(canonicalBets(rows));
    });
    if (JSON.stringify(ready) !== JSON.stringify(data.ready)) setData({ ready });
    const labels: Record<Table, string> = { players: "jugadores", chat_messages: "chat", bets: "Prode" };
    connectionStatus(failures.length === 3 ? "Sin conexión" : failures.length ? "Conexión parcial" : "Al día", !!failures.length,
      failures.length ? "No se pudieron cargar: " + failures.map(t => labels[t]).join(", ") + ". Tocá para reintentar." : "Datos compartidos actualizados. Tocá para actualizar.");
  })();
  try { await syncing; } catch { connectionStatus("Sin conexión", true); } finally {
    syncing = null; if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}
export function scheduleSync() { clearTimeout(syncTimer); syncTimer = window.setTimeout(() => void sync(), 150); }
/** Los avisos solo provocan una lectura de la base: nunca son prueba de guardado. */
export function handleLiveNotice({ payload }: { payload?: unknown }) { if (payload) scheduleSync(); }
let liveCh: RealtimeChannel | null = null;
function broadcast(event: string, payload: unknown) { if (liveCh) void liveCh.send({ type: "broadcast", event, payload }).catch(() => { /* */ }); }
export function startRealtime() {
  if (!db) return;
  for (const table of ["players", "chat_messages", "bets"]) {
    db.channel(table + "_ch").on("postgres_changes" as never, { event: "*", schema: "public", table }, scheduleSync).subscribe();
  }
  liveCh = db.channel("centenario_live", { config: { broadcast: { self: false } } });
  for (const event of ["chat_msg", "chat_msg_del", "new_bet", "del_bet", "player_extra"]) liveCh.on("broadcast", { event }, handleLiveNotice);
  liveCh.subscribe(status => { if (status === "SUBSCRIBED") scheduleSync(); });
}
async function requireShared(table: Table) {
  await identityReady;
  if (!navigator.onLine) throw new Error("Estás sin conexión. Volvé a intentar con internet; el cambio no se confirmó.");
  if (!db) throw new Error("No se pudo conectar. Recargá la web con internet.");
  if (!data.ready[table]) await sync();
  if (!data.ready[table]) throw new Error("No se pudieron cargar los datos compartidos. Volvé a intentar con internet.");
  return db;
}

// ---------- Acciones ----------
async function uploadPhoto(client: SupabaseClient, photo: string) {
  if (!photo.startsWith("data:")) return photo;
  const blob = await (await fetch(photo)).blob();
  const path = `${data.me}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("No se pudo subir la foto. " + backendError(error));
  return client.storage.from("fotos").getPublicUrl(path).data.publicUrl;
}
export async function savePlayer(t: number, i: number, target: [number, number], name: string, photo: string, captain: boolean) {
  const client = await requireShared("players");
  if (!isMine(data, data.me, t, i)) throw new Error("Recuperá el acceso con el que cargaste este jugador.");
  const [t2, i2] = t === 2 || i === COACH ? [t, i] : target;
  if (!isMine(data, data.me, t2, i2)) throw new Error("El lugar de destino ya pertenece a otro jugador.");
  const uploaded = await uploadPhoto(client, photo || "");
  const { data: rows, error } = await client.rpc("save_centenario_player", {
    source_team: t, source_pos: i, target_team: t2, target_pos: i2, player_name: name, player_photo: uploaded || null, captain: !!captain,
  });
  if (error) throw new Error(backendError(error));
  if (!Array.isArray(rows) || !rows.length) throw new Error("La base no confirmó el cambio. Actualizá los datos y volvé a intentar.");
  stateRevision++;
  replacePlayers(rows); rememberName(name);
  broadcast("player_extra", { team: t2, pos: i2 });
  return [t2, i2] as [number, number];
}
export async function sendChat(author: string, text: string, image?: string) {
  const client = await requireShared("chat_messages");
  const player = allPlayers(data).find(p => p.o === data.me && p.n.toLowerCase() === author.toLowerCase());
  const uploaded = image ? await uploadPhoto(client, image) : null;
  const msg = { id: crypto.randomUUID(), author, team: player?.t ?? null, photo: player?.f || null, text: text || "📷 Foto", owner: data.me, ...(uploaded ? { image: uploaded } : {}) };
  const { data: rows, error } = await client.from("chat_messages").insert(msg).select();
  if (error) throw new Error(backendError(error));
  if (!rows?.length) throw new Error("No se confirmó el envío. Volvé a intentar.");
  stateRevision++;
  const saved = mapChat(rows[0]);
  setChat([...data.chat.filter(m => m.id !== saved.id), saved].slice(-50));
  rememberName(author); broadcast("chat_msg", { id: msg.id });
}
/** Boleta en armado: resultado, hasta 3 jugadores por premio (claves de jugador) y fichas. */
export interface BetDraft { user: string; s0: number; s1: number; chips: number; sel: Partial<Record<StatId, string[]>> }
export async function saveBet(d: BetDraft) {
  const client = await requireShared("bets");
  const players = allPlayers(data);
  const pick = (cat: StatId) => (d.sel[cat] || []).map(k => players.find(p => p.key === k)).filter(Boolean) as typeof players;
  for (const ks of Object.values(d.sel)) for (const k of ks || []) if (!players.some(p => p.key === k)) throw new Error("Un jugador elegido ya no está en el plantel. Volvé a seleccionarlo.");
  const multi: Record<string, string[]> = {}, names: Record<string, string[]> = {}, refs: Record<string, string> = {}, first: Record<string, string> = {};
  for (const c of ["scorer", "mvp", "defender", "keeper", "assist", "yellow", "blooper"] as StatId[]) {
    const ps = pick(c);
    names[c] = ps.map(p => p.n);
    multi[c] = ps.filter(p => p.id).map(p => p.id!);
    if (ps[0]?.id) refs[c] = ps[0].id;
    first[c] = ps[0]?.n || "";
  }
  // Campos sueltos para compatibilidad con boletas y versiones anteriores.
  const extra = { s0: d.s0, s1: d.s1, pick: d.s0 > d.s1 ? "0" : d.s0 < d.s1 ? "1" : "emp",
    mvp: first.mvp, defender: first.defender, keeper: first.keeper, assist: first.assist, blooper: first.blooper, refs, multi, names };
  const id = data.bets.find(b => b.owner === data.me)?.id || crypto.randomUUID();
  const { data: rows, error } = await client.rpc("save_centenario_bet", {
    bet_id: id, user_label: d.user, prediction: JSON.stringify(extra), goals: d.s0 + d.s1 >= 3 ? "mas" : "menos",
    scorer_name: names.scorer.join(", ").slice(0, 20), yellow_name: names.yellow.join(", ").slice(0, 20), chips: d.chips,
  });
  if (error) throw new Error(backendError(error));
  if (!rows?.length) throw new Error("No se confirmó tu boleta. Volvé a intentar.");
  stateRevision++;
  const saved = mapBetRow(rows[0])!;
  setBets([saved, ...data.bets.filter(b => b.owner !== data.me)]);
  rememberName(d.user); broadcast("new_bet", { id: saved.id });
}
const deleting = new Set<string>();
export async function deleteBet(id: string) {
  const bet = data.bets.find(b => b.id === id);
  if (!bet || !data.me || bet.owner !== data.me || deleting.has(id)) return;
  deleting.add(id);
  try {
    const client = await requireShared("bets");
    const { data: rows, error } = await client.from("bets").delete().eq("id", id).eq("owner", data.me).select();
    if (error) throw new Error(backendError(error));
    if (!rows?.length) throw new Error("No se confirmó el borrado. Actualizá los datos y volvé a intentar.");
    stateRevision++;
    setBets(data.bets.filter(b => b.id !== id)); broadcast("del_bet", { id });
    notifyUser("Boleta eliminada.");
  } finally { deleting.delete(id); }
}
export const slotOf = (t: number, i: number) => getSlot(data, t, i);

// ---------- Administración ----------
// Misma clave que valida Supabase (admin_save_centenario_player / admin_delete_chat_message).
const ADMIN_USER = "centenarioutn412", ADMIN_PASS = "centenarioutn412";
export const isAdmin = () => { try { return sessionStorage.getItem("f11_admin") === "true"; } catch { return false; } };
export function adminLogin(user: string, pass: string) {
  if (user.trim() !== ADMIN_USER || pass.trim() !== ADMIN_PASS) return false;
  try { sessionStorage.setItem("f11_admin", "true"); } catch { /* */ }
  setUi({}); return true;
}
export function adminLogout() { try { sessionStorage.removeItem("f11_admin"); } catch { /* */ } setUi({}); }
/** Borra un mensaje (o todos con `null`). */
export async function adminDeleteMessage(id: string | null) {
  const client = await requireShared("chat_messages");
  const { error } = await client.rpc("admin_delete_chat_message", { msg_id: id, admin_pass: ADMIN_PASS });
  if (error) throw new Error(backendError(error));
  stateRevision++;
  setChat(id ? data.chat.filter(m => m.id !== id) : []);
  broadcast("chat_msg_del", { id });
}
/** Edita o mueve cualquier lugar sin ser su dueño (conserva el dueño original). */
export async function adminSavePlayer(t: number, i: number, target: [number, number], name: string, photo: string, captain: boolean) {
  const client = await requireShared("players");
  const [t2, i2] = t === 2 || i === COACH ? [t, i] : target;
  const uploaded = await uploadPhoto(client, photo || "");
  const { data: rows, error } = await client.rpc("admin_save_centenario_player", {
    admin_pass: ADMIN_PASS, source_team: t, source_pos: i, target_team: t2, target_pos: i2, player_name: name, player_photo: uploaded || null, captain: t !== 2 && i !== COACH && captain,
  });
  if (error) throw new Error(backendError(error));
  if (!Array.isArray(rows) || !rows.length) throw new Error("La base no confirmó el cambio. Actualizá los datos y volvé a intentar.");
  stateRevision++;
  replacePlayers(rows); broadcast("player_extra", { team: t2, pos: i2 });
}

// ---------- Arranque ----------
export function boot() {
  addEventListener("visibilitychange", () => { if (!document.hidden) void sync(); });
  addEventListener("online", () => void sync());
  addEventListener("offline", () => connectionStatus("Sin conexión", true));
  setInterval(() => { if (!document.hidden) void sync(); }, 20000);
  identityReady.then(() => { startRealtime(); void sync(); }).catch((error: Error) => connectionStatus("Acceso no disponible", true, error.message));
  // Ganchos para las pruebas automáticas (igual que en la versión anterior).
  Object.assign(window, { sync, handleLiveNotice });
}
