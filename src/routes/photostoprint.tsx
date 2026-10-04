import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListOrdered,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Repeat,
  Search,
  Square,
  User,
  X,
} from "lucide-react";
import {
  clearAuth,
  getStaffRole,
  loadAuth,
  saveAuth,
  signIn,
  signOut,
  signedPhotoUrl,
  supabaseRest,
} from "@/lib/supabase";

/* ---------------------------------- types --------------------------------- */

type SessionRow = {
  id: string;
  phone: string;
  created_at: string;
  status: string;
  printed_photo_count: number;
  printed_at?: string | null;
  photo_count?: number;
};

type Photo = {
  id: string;
  storage_path: string;
  photo_number: number;
  url: string;
  selected: boolean;
  copies: number;
};

type FormatId = "10x15" | "13x18" | "15x20" | "square" | "custom";

/** Operator-side metadata kept on this device (operator, copies, extra timestamps). */
type SessionMeta = {
  status?: string;
  operator?: string;
  printedAt?: string;
  completedAt?: string;
  printingAt?: string;
  copies?: Record<string, number>;
  format?: FormatId;
};

const FORMATS: Record<FormatId, { label: string; w: number; h: number }> = {
  "10x15": { label: "10x15 cm", w: 10, h: 15 },
  "13x18": { label: "13x18 cm", w: 13, h: 18 },
  "15x20": { label: "15x20 cm", w: 15, h: 20 },
  square: { label: "Quadrado 15x15 cm", w: 15, h: 15 },
  custom: { label: "Personalizado", w: 10, h: 15 },
};
const DEFAULT_FORMAT: FormatId = "10x15";

/* --------------------------------- helpers -------------------------------- */

const META_KEY = "photo_booth_print_meta";
function loadMeta(): Record<string, SessionMeta> {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveMetaFor(id: string, patch: SessionMeta) {
  const all = loadMeta();
  all[id] = { ...all[id], ...patch };
  localStorage.setItem(META_KEY, JSON.stringify(all));
  return all;
}

const STATUS_FLOW = ["awaiting_print", "printing", "printed", "completed"] as const;

function statusLabel(status: string) {
  if (status === "awaiting_print") return "Aguardando impressão";
  if (status === "printing") return "Em impressão";
  if (status === "printed") return "Impressa";
  if (status === "completed") return "Finalizada";
  return "Em andamento";
}
function statusTone(status: string) {
  if (status === "awaiting_print") return "bg-primary/15 text-primary border-primary/30";
  if (status === "printing") return "bg-accent/20 text-accent-foreground border-accent/40";
  if (status === "printed") return "bg-secondary text-foreground border-border";
  if (status === "completed") return "bg-muted text-muted-foreground border-border";
  return "bg-muted/60 text-muted-foreground border-border";
}

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return phone;
  return `(${d.slice(0, 2)}) •••••-${d.slice(-4)}`;
}
function fullPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}
function elapsed(from: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}
const fmtTime = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(t);
  }, [interval]);
  return now;
}

/* ---------------------------------- styles -------------------------------- */

const buttonBase =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-40";
const primaryButton = `${buttonBase} bg-primary text-primary-foreground hover:brightness-110`;
const secondaryButton = `${buttonBase} border border-border bg-card text-foreground hover:bg-secondary`;
const ghostButton = `${buttonBase} text-muted-foreground hover:bg-secondary hover:text-foreground`;
const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30";
const selectClass =
  "h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30";

/* ---------------------------------- login --------------------------------- */

function Login({ onReady }: { onReady: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const go = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const session = await signIn(email, password);
      if (!(await getStaffRole(session.access_token))) throw new Error("Usuário sem permissão.");
      saveAuth(session);
      onReady();
    } catch (error) {
      clearAuth();
      setError(error instanceof Error ? error.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stage px-5 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="w-full rounded-2xl border border-border/80 bg-card/80 p-7 shadow-2xl backdrop-blur">
          <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Printer size={20} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Bohemia Photo Booth</p>
          <h1 className="mt-2 text-2xl font-semibold text-cream">Impressão</h1>
          <p className="mt-1 text-sm text-muted-foreground">As sessões recentes aparecem automaticamente. Use os filtros para localizar uma sessão.</p>
          <div className="mt-7 space-y-3">
            <input className={inputClass} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              className={inputClass}
              placeholder="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void go()}
            />
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button type="button" className={`${primaryButton} mt-5 h-10 w-full`} onClick={() => void go()} disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- app ---------------------------------- */

type Filter = "all" | "awaiting_print" | "printing" | "printed" | "completed" | "active";

function App({ token, operator, role, onLogout }: { token: string; operator: string; role: string; onLogout: () => void }) {
  const now = useNow();
  const [meta, setMeta] = useState<Record<string, SessionMeta>>({});
  const [phone, setPhone] = useState("");
  const [onlyToday, setOnlyToday] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Filter>("all");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [format, setFormat] = useState<FormatId>(DEFAULT_FORMAT);
  const [custom, setCustom] = useState({ w: 10, h: 15 });
  const [quickCount, setQuickCount] = useState(1);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [tab, setTab] = useState<"queue" | "history">("history");
  const [error, setError] = useState("");

  useEffect(() => setMeta(loadMeta()), []);

  const effStatus = useCallback((s: SessionRow) => meta[s.id]?.status ?? s.status, [meta]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("select", "id,phone,created_at,status,printed_photo_count,printed_at");
      params.set("order", "created_at.desc");
      params.set("limit", "200");
      let qs = params.toString();
      if (onlyToday) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        qs += `&created_at=gte.${encodeURIComponent(start.toISOString())}`;
      }
      const response = await supabaseRest(`/rest/v1/sessions?${qs}`, {}, token);
      const rows = (await response.json()) as SessionRow[];
      if (rows.length) {
        const ids = rows.map((r) => r.id).join(",");
        const pr = await supabaseRest(`/rest/v1/session_photos?select=session_id&session_id=in.(${ids})`, {}, token);
        const counts = new Map<string, number>();
        for (const p of (await pr.json()) as Array<{ session_id: string }>) counts.set(p.session_id, (counts.get(p.session_id) ?? 0) + 1);
        rows.forEach((r) => (r.photo_count = counts.get(r.id) ?? 0));
      }
      setSessions(rows);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar as sessões.");
    } finally {
      setLoading(false);
    }
  }, [onlyToday, token]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyToday, token]);

  const filtered = useMemo(() => {
    const digits = phone.replace(/\D/g, "");
    return sessions.filter((s) => {
      if (digits && !s.phone.replace(/\D/g, "").includes(digits)) return false;
      const st = effStatus(s);
      if (statusFilter !== "all" && st !== statusFilter) return false;
      const hm = new Date(s.created_at).toTimeString().slice(0, 5);
      if (fromTime && hm < fromTime) return false;
      if (toTime && hm > toTime) return false;
      return true;
    });
  }, [sessions, phone, statusFilter, fromTime, toTime, effStatus]);

  const queue = useMemo(
    () =>
      sessions
        .filter((s) => ["awaiting_print", "printing"].includes(effStatus(s)))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [sessions, effStatus],
  );
  const awaitingCount = queue.filter((s) => effStatus(s) === "awaiting_print").length;

  const openSession = async (session: SessionRow) => {
    setSelected(session);
    setError("");
    setLightbox(null);
    setPreview(false);
    setLoadingPhotos(true);
    const m = loadMeta()[session.id];
    setFormat(m?.format ?? DEFAULT_FORMAT);
    try {
      const response = await supabaseRest(
        `/rest/v1/session_photos?select=id,storage_path,photo_number&session_id=eq.${session.id}&order=photo_number.asc`,
        {},
        token,
      );
      const rows = (await response.json()) as Array<{ id: string; storage_path: string; photo_number: number }>;
      const list = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          url: await signedPhotoUrl(row.storage_path, token),
          selected: true,
          copies: Math.max(1, m?.copies?.[row.id] ?? 1),
        })),
      );
      setPhotos(list);
      setQuickCount(Math.min(Math.max(1, quickCount), Math.max(1, list.length)));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar as fotos.");
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const nextInQueue = () => {
    const next = queue.find((s) => s.id !== selected?.id && effStatus(s) === "awaiting_print") ?? queue.find((s) => s.id !== selected?.id);
    if (next) void openSession(next);
  };

  /* selection */
  const selectedPhotos = photos.filter((p) => p.selected);
  const selectedCount = selectedPhotos.length;
  const totalPrints = selectedPhotos.reduce((sum, p) => sum + p.copies, 0);
  const setAll = (v: boolean) => setPhotos((c) => c.map((p) => ({ ...p, selected: v })));
  const invert = () => setPhotos((c) => c.map((p) => ({ ...p, selected: !p.selected })));
  const selectFirst = (n: number) => setPhotos((c) => c.map((p, i) => ({ ...p, selected: i < n })));
  const toggle = (id: string) => setPhotos((c) => c.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  const setCopies = (id: string, delta: number) =>
    setPhotos((c) => {
      const next = c.map((p) => (p.id === id ? { ...p, copies: Math.min(20, Math.max(1, p.copies + delta)) } : p));
      if (selected) setMeta(saveMetaFor(selected.id, { copies: Object.fromEntries(next.map((p) => [p.id, p.copies])) }));
      return next;
    });

  /* status */
  const updateStatus = async (status: string) => {
    if (!selected) return;
    const at = new Date().toISOString();
    const localPatch: SessionMeta = { status, operator };
    if (status === "printing") localPatch.printingAt = at;
    if (status === "printed") localPatch.printedAt = at;
    if (status === "completed") localPatch.completedAt = at;
    // Persist known DB statuses on the server; "printing" stays on this device only.
    if (status !== "printing") {
      const body: Record<string, unknown> = { status };
      if (status === "printed") {
        body["printed_at"] = at;
        body["printed_photo_count"] = selectedCount;
      }
      try {
        await supabaseRest(
          `/rest/v1/sessions?id=eq.${selected.id}`,
          { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
          token,
        );
      } catch (error) {
        setError(error instanceof Error ? error.message : "Não foi possível atualizar o status.");
        return;
      }
    }
    setMeta(saveMetaFor(selected.id, localPatch));
    const next: SessionRow = {
      ...selected,
      status: status === "printing" ? selected.status : status,
      ...(status === "printed" ? { printed_at: at, printed_photo_count: selectedCount } : {}),
    };
    setSelected(next);
    setSessions((c) => c.map((s) => (s.id === next.id ? next : s)));
  };

  /* printing */
  const changeFormat = (f: FormatId) => {
    setFormat(f);
    if (selected) setMeta(saveMetaFor(selected.id, { format: f }));
  };
  const dims = format === "custom" ? custom : FORMATS[format];

  const confirmPrint = async () => {
    if (!selectedCount || printing) return;
    setPrinting(true);
    setError("");
    try {
      if (selected && effStatus(selected) !== "printed" && effStatus(selected) !== "completed") await updateStatus("printing");
      const images = Array.from(document.querySelectorAll<HTMLImageElement>(".print-only-photo"));
      await Promise.all(
        images.map((image) => {
          if (image.complete && image.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
            window.setTimeout(resolve, 5000);
          });
        }),
      );
      setPreview(false);
      window.setTimeout(() => window.print(), 80);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível abrir a impressão.");
    } finally {
      window.setTimeout(() => setPrinting(false), 300);
    }
  };

  /* keyboard for lightbox */
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
      if (e.key === " ") {
        e.preventDefault();
        const p = photos[lightbox];
        if (p) toggle(p.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, photos]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreview(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const selMeta = selected ? meta[selected.id] : undefined;
  const selStatus = selected ? effStatus(selected) : "";
  const endedAt = selMeta?.completedAt ?? selMeta?.printedAt ?? selected?.printed_at ?? null;
  const stepIndex = STATUS_FLOW.indexOf(selStatus as (typeof STATUS_FLOW)[number]);

  return (
    <>
      <div className="min-h-screen bg-stage print:hidden">
        <header className="border-b border-border/70 bg-background/70 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Printer size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-cream">Bohemia Photo Booth</p>
                <p className="text-[11px] text-muted-foreground">Central de impressão</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTab("queue");
                  nextInQueue();
                }}
                className={`${buttonBase} border ${awaitingCount ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                <ListOrdered size={13} /> {awaitingCount} aguardando impressão
              </button>
              <span className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground sm:inline-flex">
                <User size={12} /> {operator}
              </span>
              <button type="button" className={secondaryButton} onClick={onLogout}>Sair</button>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-[1500px] gap-4 px-5 py-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-6">
          {/* ---------------- sidebar ---------------- */}
          <aside className="space-y-3">
            <section className="space-y-2 rounded-lg border border-border/80 bg-card/60 p-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className={`${inputClass} pl-8`}
                    placeholder="Filtrar por telefone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    
                  />
                </div>
                <button type="button" className={`${primaryButton} h-9`} onClick={() => void load()} disabled={loading}>
                  {loading ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${buttonBase} border ${onlyToday ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  onClick={() => setOnlyToday((v) => !v)}
                >
                  <CalendarDays size={12} /> Sessões de hoje
                </button>
                <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Filter)}>
                  <option value="all">Todos os status</option>
                  <option value="awaiting_print">Aguardando impressão</option>
                  <option value="printing">Em impressão</option>
                  <option value="printed">Impressa</option>
                  <option value="completed">Finalizada</option>
                  <option value="active">Em andamento</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock size={12} />
                <input type="time" className={`${selectClass} flex-1`} value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
                até
                <input type="time" className={`${selectClass} flex-1`} value={toTime} onChange={(e) => setToTime(e.target.value)} />
              </div>
            </section>

            <section className="rounded-lg border border-border/80 bg-card/60">
              <div className="flex border-b border-border/70 text-xs">
                {(["queue", "history"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex-1 px-3 py-2 font-semibold ${tab === t ? "border-b-2 border-primary text-cream" : "text-muted-foreground"}`}
                  >
                    {t === "queue" ? `Fila de impressão (${queue.length})` : `Últimas sessões (${filtered.length})`}
                  </button>
                ))}
              </div>

              <div className="max-h-[calc(100vh-290px)] overflow-y-auto p-1.5">
                {tab === "queue" ? (
                  queue.length ? (
                    queue.map((s, i) => (
                      <SessionItem key={s.id} s={s} status={effStatus(s)} active={selected?.id === s.id} now={now} index={i + 1} onOpen={() => void openSession(s)} />
                    ))
                  ) : (
                    <Empty text="Nenhum pedido aguardando impressão." />
                  )
                ) : filtered.length ? (
                  filtered.map((s) => (
                    <SessionItem key={s.id} s={s} status={effStatus(s)} active={selected?.id === s.id} now={now} onOpen={() => void openSession(s)} />
                  ))
                ) : (
                  <Empty text={loading ? "Carregando…" : "Nenhuma sessão encontrada."} />
                )}
              </div>
            </section>
          </aside>

          {/* ---------------- detail ---------------- */}
          <section className="min-w-0 space-y-3">
            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">{error}</div>}

            {!selected ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center rounded-lg border border-border/80 bg-card/60 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Square size={16} />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">Nenhuma sessão selecionada</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">Escolha um pedido da fila ou do histórico para preparar a impressão.</p>
              </div>
            ) : (
              <>
                {/* info */}
                <div className="rounded-lg border border-border/80 bg-card/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-cream">{fullPhone(selected.phone)}</h2>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusTone(selStatus)}`}>{statusLabel(selStatus)}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">ID {selected.id}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select className={selectClass} value={selStatus} onChange={(e) => void updateStatus(e.target.value)} title="Atualizar status manualmente">
                        {!STATUS_FLOW.includes(selStatus as (typeof STATUS_FLOW)[number]) && <option value={selStatus}>{statusLabel(selStatus)}</option>}
                        {STATUS_FLOW.map((s) => (
                          <option key={s} value={s}>{statusLabel(s)}</option>
                        ))}
                      </select>
                      {stepIndex >= 0 && stepIndex < STATUS_FLOW.length - 1 && (
                        <button type="button" className={secondaryButton} onClick={() => void updateStatus(STATUS_FLOW[stepIndex + 1]!)}>
                          Avançar: {statusLabel(STATUS_FLOW[stepIndex + 1]!)}
                        </button>
                      )}
                      <button type="button" className={ghostButton} onClick={nextInQueue} disabled={!queue.some((s) => s.id !== selected.id)}>
                        Próximo da fila <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs sm:grid-cols-4 xl:grid-cols-8">
                    <Info label="Início" value={fmtTime(selected.created_at)} />
                    <Info label="Término" value={fmtTime(endedAt)} />
                    <Info label="Decorrido" value={elapsed(selected.created_at, now)} mono />
                    <Info label="Fotos tiradas" value={String(photos.length || selected.photo_count || 0)} />
                    <Info label="Selecionadas" value={String(selectedCount)} />
                    <Info label="Impressas" value={String(selected.printed_photo_count ?? 0)} />
                    <Info label="Impressa em" value={fmtDateTime(selMeta?.printedAt ?? selected.printed_at)} />
                    <Info label="Operador" value={selMeta?.operator ?? "—"} />
                  </dl>
                </div>

                {/* toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card/60 p-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <button type="button" className={ghostButton} onClick={() => setAll(true)} disabled={!photos.length}><Check size={13} /> Todas</button>
                    <button type="button" className={ghostButton} onClick={() => setAll(false)} disabled={!photos.length}><X size={13} /> Nenhuma</button>
                    <button type="button" className={ghostButton} onClick={invert} disabled={!photos.length}><Repeat size={13} /> Inverter</button>
                    <span className="mx-1 h-5 w-px bg-border" />
                    <span className="text-xs text-muted-foreground">Selecionar</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, photos.length)}
                      value={quickCount}
                      onChange={(e) => setQuickCount(Math.max(1, Math.min(photos.length || 1, Number(e.target.value) || 1)))}
                      className="h-8 w-12 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    />
                    <button type="button" className={secondaryButton} onClick={() => selectFirst(quickCount)} disabled={!photos.length}>fotos</button>
                    <span className="ml-2 text-xs font-semibold text-cream">{selectedCount} / {photos.length} fotos selecionadas</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select className={selectClass} value={format} onChange={(e) => changeFormat(e.target.value as FormatId)}>
                      {(Object.keys(FORMATS) as FormatId[]).map((f) => (
                        <option key={f} value={f}>{FORMATS[f].label}{f === DEFAULT_FORMAT ? " (padrão)" : ""}</option>
                      ))}
                    </select>
                    {format === "custom" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input type="number" min={3} max={60} value={custom.w} onChange={(e) => setCustom((c) => ({ ...c, w: Number(e.target.value) || c.w }))} className="h-8 w-12 rounded-md border border-border bg-background px-1.5 text-xs text-foreground" />
                        ×
                        <input type="number" min={3} max={60} value={custom.h} onChange={(e) => setCustom((c) => ({ ...c, h: Number(e.target.value) || c.h }))} className="h-8 w-12 rounded-md border border-border bg-background px-1.5 text-xs text-foreground" />
                        cm
                      </span>
                    )}
                    <button type="button" className={primaryButton} onClick={() => setPreview(true)} disabled={!selectedCount}>
                      <Printer size={13} /> Imprimir {totalPrints} {totalPrints === 1 ? "foto" : "fotos"}
                    </button>
                  </div>
                </div>
                <p className="px-1 text-[11px] text-muted-foreground">Formato padrão: 10x15 cm · Total de impressões (com cópias): <span className="font-semibold text-foreground">{totalPrints}</span></p>

                {/* grid */}
                <div className="rounded-lg border border-border/80 bg-card/60 p-3">
                  {loadingPhotos ? (
                    <Empty text="Carregando fotos…" />
                  ) : !photos.length ? (
                    <Empty text="Esta sessão não possui fotos." />
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                      {photos.map((photo, i) => (
                        <div
                          key={photo.id}
                          className={`overflow-hidden rounded-md border bg-background/40 transition ${photo.selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border/70 opacity-60"}`}
                        >
                          <div className="group relative aspect-video cursor-zoom-in overflow-hidden bg-black" onClick={() => setLightbox(i)}>
                            <img src={photo.url} alt={`Foto ${photo.photo_number}`} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                            <button
                              type="button"
                              aria-label={photo.selected ? "Desmarcar foto" : "Selecionar foto"}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(photo.id);
                              }}
                              className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded bg-black/65 text-white"
                            >
                              {photo.selected ? <Check size={13} /> : <span className="h-3 w-3 rounded-sm border border-white/70" />}
                            </button>
                          </div>
                          <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-[11px] text-foreground">Foto {photo.photo_number}</span>
                            <Copies value={photo.copies} disabled={!photo.selected} onChange={(d) => setCopies(photo.id, d)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </main>

        {/* lightbox */}
        {lightbox !== null && photos[lightbox] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6" onClick={() => setLightbox(null)}>
            <div className="relative flex max-h-full w-full max-w-6xl flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between text-xs text-white/80">
                <span>Foto {photos[lightbox].photo_number} · {lightbox + 1} de {photos.length}</span>
                <div className="flex items-center gap-2">
                  <button type="button" className={photos[lightbox].selected ? secondaryButton : primaryButton} onClick={() => toggle(photos[lightbox]!.id)}>
                    {photos[lightbox].selected ? <><X size={13} /> Desmarcar</> : <><Check size={13} /> Selecionar</>}
                  </button>
                  <button type="button" className={secondaryButton} onClick={() => setLightbox(null)} aria-label="Fechar"><X size={13} /></button>
                </div>
              </div>
              <div className="relative flex items-center justify-center">
                <button type="button" aria-label="Anterior" className="absolute left-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80" onClick={() => setLightbox((lightbox - 1 + photos.length) % photos.length)}>
                  <ChevronLeft size={20} />
                </button>
                <img src={photos[lightbox].url} alt={`Foto ${photos[lightbox].photo_number}`} className="max-h-[80vh] max-w-full rounded object-contain" />
                <button type="button" aria-label="Próxima" className="absolute right-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80" onClick={() => setLightbox((lightbox + 1) % photos.length)}>
                  <ChevronRight size={20} />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-white/50">ESC fecha · ← → navega · Espaço seleciona</p>
            </div>
          </div>
        )}

        {/* print preview */}
        {preview && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setPreview(false)}>
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-cream">Prévia de impressão</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {maskPhone(selected.phone)} · {selectedCount} foto(s) · {totalPrints} impressão(ões) · {format === "custom" ? `${custom.w}x${custom.h} cm` : FORMATS[format].label}
                  </p>
                </div>
                <button type="button" className={ghostButton} onClick={() => setPreview(false)} aria-label="Fechar"><X size={14} /></button>
              </div>
              <div className="grid flex-1 grid-cols-3 gap-3 overflow-y-auto p-4 sm:grid-cols-4">
                {selectedPhotos.map((p) => (
                  <div key={p.id} className="text-center">
                    <div className="mx-auto overflow-hidden rounded border border-border bg-background shadow" style={{ aspectRatio: `${dims.w} / ${dims.h}` }}>
                      <img src={p.url} alt={`Foto ${p.photo_number}`} className="h-full w-full object-cover" />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Foto {p.photo_number} · {p.copies}x</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">Total: <b className="text-foreground">{totalPrints}</b> impressões</span>
                <div className="flex gap-2">
                  <button type="button" className={secondaryButton} onClick={() => setPreview(false)}>Cancelar</button>
                  <button type="button" className={primaryButton} onClick={() => void confirmPrint()} disabled={printing}>
                    <Printer size={13} /> {printing ? "Abrindo…" : "Imprimir"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <PrintView photos={photos} dims={dims} />
    </>
  );
}

/* ------------------------------- subcomponents ---------------------------- */

function SessionItem({ s, status, active, now, index, onOpen }: { s: SessionRow; status: string; active: boolean; now: number; index?: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mb-1 w-full rounded-md border px-2.5 py-2 text-left transition hover:bg-secondary/60 ${active ? "border-primary/50 bg-primary/10" : "border-transparent"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {index !== undefined && <span className="rounded bg-secondary px-1 text-[10px] text-muted-foreground">#{index}</span>}
          {fmtTime(s.created_at)} · {maskPhone(s.phone)}
        </span>
        <span className={`rounded border px-1.5 py-px text-[9px] font-semibold ${statusTone(status)}`}>{statusLabel(status)}</span>
      </div>
      <p className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{s.photo_count ?? 0} foto(s) · {s.printed_photo_count ?? 0} impressa(s)</span>
        <span className="font-mono">{elapsed(s.created_at, now)}</span>
      </p>
    </button>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`truncate text-foreground ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Copies({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (d: number) => void }) {
  return (
    <div className={`flex items-center rounded border border-border ${disabled ? "opacity-40" : ""}`}>
      <button type="button" aria-label="Menos cópias" className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={disabled || value <= 1} onClick={() => onChange(-1)}>
        <Minus size={11} />
      </button>
      <span className="min-w-5 text-center text-[11px] font-semibold text-foreground">{value}</span>
      <button type="button" aria-label="Mais cópias" className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={disabled} onClick={() => onChange(1)}>
        <Plus size={11} />
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-2 py-10 text-center text-xs text-muted-foreground">{text}</div>;
}

function PrintView({ photos, dims }: { photos: Photo[]; dims: { w: number; h: number } }) {
  const pages = photos.filter((p) => p.selected).flatMap((p) => Array.from({ length: p.copies }, (_, i) => ({ p, key: `${p.id}-${i}` })));
  return (
    <div className="hidden print:block print:bg-white">
      <style>{`@media print { @page { size: ${dims.w}cm ${dims.h}cm; margin: 0; } }`}</style>
      {pages.map(({ p, key }) => (
        <div key={key} className="flex items-center justify-center overflow-hidden [break-after:page]" style={{ width: `${dims.w}cm`, height: `${dims.h}cm` }}>
          <img src={p.url} alt={`Foto ${p.photo_number}`} className="print-only-photo h-full w-full object-contain" />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- route --------------------------------- */

export const Route = createFileRoute("/photostoprint")({
  head: () => ({
    meta: [
      { title: "Central de impressão — Bohemia Experience" },
      { name: "description", content: "Fila, histórico e impressão das sessões da cabine." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const [auth, setAuth] = useState(loadAuth());
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setRole(null);
      return;
    }
    getStaffRole(auth.access_token).then(setRole).catch(() => setRole(null));
  }, [auth]);

  if (!auth || !role) return <Login onReady={() => setAuth(loadAuth())} />;

  return (
    <App
      token={auth.access_token}
      operator={auth.user.email ?? auth.user.id.slice(0, 8)}
      role={role}
      onLogout={() => {
        void signOut(auth.access_token);
        setAuth(null);
        setRole(null);
      }}
    />
  );
}
