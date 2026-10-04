import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Printer, Search, Square, X } from "lucide-react";
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

type SessionRow = {
  id: string;
  phone: string;
  created_at: string;
  status: string;
  printed_photo_count: number;
};

type Photo = {
  id: string;
  storage_path: string;
  photo_number: number;
  url: string;
  selected: boolean;
};

const buttonBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-40";
const primaryButton = `${buttonBase} bg-primary text-primary-foreground hover:brightness-110`;
const secondaryButton = `${buttonBase} border border-border bg-card text-foreground hover:bg-secondary`;
const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30";

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
          <p className="mt-1 text-sm text-muted-foreground">Encontre a sessão pelo telefone e selecione as fotos.</p>

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
          <button type="button" className={`${primaryButton} mt-5 w-full`} onClick={() => void go()} disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "printed") return "Impressa";
  if (status === "completed") return "Concluída";
  if (status === "awaiting_print") return "Aguardando impressão";
  return "Em andamento";
}

function App({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [phone, setPhone] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [printing, setPrinting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedCount = photos.filter((photo) => photo.selected).length;

  const search = async () => {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 10) {
      setError("Digite um telefone válido.");
      return;
    }

    setLoading(true);
    setError("");
    setSelected(null);
    setPhotos([]);

    try {
      const response = await supabaseRest(
        `/rest/v1/sessions?select=id,phone,created_at,status,printed_photo_count&phone=eq.${normalized}&order=created_at.desc&limit=20`,
        {},
        token,
      );
      setSessions(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível pesquisar as sessões.");
    } finally {
      setLoading(false);
    }
  };

  const openSession = async (session: SessionRow) => {
    setSelected(session);
    setError("");
    try {
      const response = await supabaseRest(
        `/rest/v1/session_photos?select=id,storage_path,photo_number&session_id=eq.${session.id}&order=photo_number.asc`,
        {},
        token,
      );
      const rows = (await response.json()) as Array<{ id: string; storage_path: string; photo_number: number }>;
      setPhotos(await Promise.all(rows.map(async (row) => ({
        ...row,
        url: await signedPhotoUrl(row.storage_path, token),
        selected: true,
      }))));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar as fotos.");
      setPhotos([]);
    }
  };

  const toggleAll = () => {
    const all = photos.length > 0 && photos.every((photo) => photo.selected);
    setPhotos((current) => current.map((photo) => ({ ...photo, selected: !all })));
  };

  const markPrinted = async () => {
    if (!selected || selectedCount === 0) return;
    try {
      await supabaseRest(
        `/rest/v1/sessions?id=eq.${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "printed",
            printed_at: new Date().toISOString(),
            printed_photo_count: selectedCount,
          }),
        },
        token,
      );

      const next = { ...selected, status: "printed", printed_photo_count: selectedCount };
      setSelected(next);
      setSessions((current) => current.map((session) => session.id === selected.id ? next : session));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível registrar a impressão.");
    }
  };

  const printSelected = async () => {
    if (!selectedCount || printing) return;
    setPrinting(true);
    setError("");

    try {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>(".print-only-photo"));
      await Promise.all(images.map((image) => {
        if (image.complete && image.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
          window.setTimeout(done, 5000);
        });
      }));
      window.setTimeout(() => window.print(), 50);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível abrir a impressão.");
    } finally {
      window.setTimeout(() => setPrinting(false), 300);
    }
  };

  const selectionLabel = useMemo(
    () => `${selectedCount} de ${photos.length} selecionada(s)`,
    [photos.length, selectedCount],
  );

  return (
    <>
      <div className="min-h-screen bg-stage print:hidden">
        <header className="border-b border-border/70 bg-background/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Printer size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-cream">Bohemia Photo Booth</p>
                <p className="text-xs text-muted-foreground">Central de impressão</p>
              </div>
            </div>
            <button type="button" className={secondaryButton} onClick={onLogout}>Sair</button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-5 px-5 py-6 lg:px-8">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Atendimento</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-cream">Fotos para imprimir</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pesquise pelo telefone informado na cabine.</p>
          </section>

          <section className="rounded-xl border border-border/80 bg-card/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`${inputClass} pl-9`}
                  placeholder="(24) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void search()}
                />
              </div>
              <button type="button" className={primaryButton} onClick={() => void search()} disabled={loading}>
                <Search size={14} />
                {loading ? "Buscando…" : "Buscar"}
              </button>
            </div>
          </section>

          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-border/80 bg-card/60 p-3">
              <div className="flex items-center justify-between px-2 py-1">
                <h2 className="text-sm font-semibold text-cream">Sessões encontradas</h2>
                <span className="text-xs text-muted-foreground">{sessions.length}</span>
              </div>

              <div className="mt-2 space-y-1">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => void openSession(session)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition hover:bg-secondary/60 ${
                      selected?.id === session.id ? "border-primary/50 bg-primary/10" : "border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{new Date(session.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-[10px] text-muted-foreground">{statusLabel(session.status)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(session.created_at).toLocaleDateString("pt-BR")} · {session.printed_photo_count} impressa(s)
                    </p>
                  </button>
                ))}

                {!sessions.length && (
                  <div className="px-2 py-10 text-center text-xs text-muted-foreground">
                    Pesquise um telefone para localizar uma sessão.
                  </div>
                )}
              </div>
            </aside>

            <div className="rounded-xl border border-border/80 bg-card/60 p-4">
              {!selected ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <Square size={17} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-foreground">Nenhuma sessão selecionada</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">Escolha uma sessão à esquerda para visualizar e preparar as fotos.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Sessão</p>
                      <h2 className="mt-1 text-lg font-semibold text-cream">{selected.phone}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(selected.created_at).toLocaleString("pt-BR")} · {statusLabel(selected.status)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selectionLabel}</span>
                      <button type="button" className={secondaryButton} onClick={toggleAll} disabled={!photos.length}>
                        {photos.length && photos.every((photo) => photo.selected) ? <X size={14} /> : <Check size={14} />}
                        {photos.length && photos.every((photo) => photo.selected) ? "Desmarcar" : "Selecionar todas"}
                      </button>
                      <button type="button" className={primaryButton} onClick={() => void printSelected()} disabled={!selectedCount || printing}>
                        <Printer size={14} />
                        {printing ? "Abrindo…" : "Imprimir"}
                      </button>
                      <button type="button" className={secondaryButton} onClick={() => void markPrinted()} disabled={!selectedCount}>
                        Marcar impressas
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {photos.map((photo) => (
                      <label
                        key={photo.id}
                        className={`group cursor-pointer overflow-hidden rounded-lg border bg-background/40 transition ${
                          photo.selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border/70 opacity-70"
                        }`}
                      >
                        <div className="relative aspect-video overflow-hidden bg-black">
                          <img src={photo.url} alt={`Foto ${photo.photo_number}`} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                          <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/65 text-white">
                            {photo.selected ? <Check size={13} /> : <span className="h-3 w-3 rounded-sm border border-white/70" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs text-foreground">Foto {photo.photo_number}</span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={photo.selected}
                            onChange={() => setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, selected: !item.selected } : item))}
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </main>
      </div>

      <PrintView photos={photos} />
    </>
  );
}

function PrintView({ photos }: { photos: Photo[] }) {
  const selected = photos.filter((photo) => photo.selected);

  return (
    <div className="hidden print:block print:bg-white">
      {selected.map((photo) => (
        <div key={photo.id} className="flex min-h-[100vh] items-center justify-center p-0 [break-after:page]">
          <img src={photo.url} alt={`Foto ${photo.photo_number}`} className="print-only-photo max-h-[100vh] max-w-[100vw] object-contain" />
        </div>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/photostoprint")({ component: Page });

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

  if (!auth || !role) {
    return <Login onReady={() => setAuth(loadAuth())} />;
  }

  return (
    <App
      token={auth.access_token}
      onLogout={() => {
        void signOut(auth.access_token);
        setAuth(null);
        setRole(null);
      }}
    />
  );
}
