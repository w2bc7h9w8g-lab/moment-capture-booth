import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Check, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import { authHeaders, supabaseRest, supabaseUrl } from "@/lib/supabase";
import { photoFrameUrl, type PhotoFrame } from "@/features/photo-frames";

const inputClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30";
const primaryButton = "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40";
const secondaryButton = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-40";

export function FrameManager({ token }: { token: string }) {
  const [frames, setFrames] = useState<PhotoFrame[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await supabaseRest(
        "/rest/v1/photo_frames?select=id,name,storage_path,is_active,sort_order,created_at&order=sort_order.asc,created_at.asc",
        {},
        token,
      );
      const rows = (await response.json()) as Omit<PhotoFrame, "imageUrl">[];
      setFrames(rows.map((row) => ({ ...row, imageUrl: photoFrameUrl(row.storage_path) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as molduras.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setError("");
    setMessage("");
    if (next && !["image/png", "image/webp"].includes(next.type)) {
      setError("Envie uma imagem PNG ou WebP com fundo transparente.");
      setFile(null);
    } else if (next && next.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      setFile(null);
    }
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !name.trim() || uploading) return;
    setUploading(true);
    setError("");
    setMessage("");
    const extension = file.type === "image/webp" ? "webp" : "png";
    const path = `frames/${crypto.randomUUID()}.${extension}`;
    let uploaded = false;
    try {
      const response = await fetch(`${supabaseUrl}/storage/v1/object/photo-frames/${path}`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!response.ok) throw new Error((await response.text()) || "Não foi possível enviar a moldura.");
      uploaded = true;
      await supabaseRest("/rest/v1/photo_frames", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ name: name.trim(), storage_path: path, is_active: true, sort_order: frames.length, created_by: (await getUserId(token)) }),
      }, token);
      setName("");
      setFile(null);
      const picker = document.getElementById("photo-frame-file") as HTMLInputElement | null;
      if (picker) picker.value = "";
      setMessage("Moldura enviada e disponibilizada na cabine.");
      await load();
    } catch (e) {
      if (uploaded) {
        await fetch(`${supabaseUrl}/storage/v1/object/photo-frames/${path}`, {
          method: "DELETE",
          headers: authHeaders(token),
        }).catch(() => undefined);
      }
      setError(e instanceof Error ? e.message : "Não foi possível enviar a moldura.");
    } finally {
      setUploading(false);
    }
  };

  const getUserId = async (accessToken: string) => {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: authHeaders(accessToken) });
    if (!response.ok) throw new Error("Não foi possível validar o usuário administrador.");
    const user = (await response.json()) as { id: string };
    return user.id;
  };

  const toggleActive = async (frame: PhotoFrame) => {
    setBusyId(frame.id);
    setError("");
    setMessage("");
    try {
      await supabaseRest(`/rest/v1/photo_frames?id=eq.${frame.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ is_active: !frame.is_active }),
      }, token);
      setFrames((current) => current.map((item) => item.id === frame.id ? { ...item, is_active: !item.is_active } : item));
      setMessage(`Moldura "${frame.name}" ${frame.is_active ? "desativada" : "ativada"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar a moldura.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (frame: PhotoFrame) => {
    if (!window.confirm(`Excluir a moldura "${frame.name}" permanentemente? Essa ação não pode ser desfeita.`)) return;
    setBusyId(frame.id);
    setError("");
    setMessage("");
    try {
      await supabaseRest(`/rest/v1/photo_frames?id=eq.${frame.id}`, { method: "DELETE" }, token);
      const safePath = frame.storage_path.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`${supabaseUrl}/storage/v1/object/photo-frames/${safePath}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!response.ok) {
        setMessage("Cadastro removido; o arquivo não pôde ser excluído do armazenamento e pode ser removido depois.");
      } else {
        setMessage("Moldura excluída.");
      }
      setFrames((current) => current.filter((item) => item.id !== frame.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir a moldura.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-xl border border-border/80 bg-card/60 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Personalização da cabine</p>
          <h2 className="mt-1 text-lg font-semibold text-cream">Molduras e frames</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Envie molduras PNG ou WebP com transparência. Use arquivos em formato paisagem 16:9 para cobrir a área da foto sem distorção. Somente molduras ativas aparecem para o visitante.</p>
        </div>
        <button type="button" className={secondaryButton} onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar</button>
      </div>

      <form onSubmit={(event) => void upload(event)} className="mt-5 grid gap-3 rounded-xl border border-border/70 bg-background/40 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-end">
        <label className="block space-y-1.5 text-xs text-muted-foreground">
          Nome da moldura
          <input className={inputClass} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Bohemia Experience" required />
        </label>
        <label className="block space-y-1.5 text-xs text-muted-foreground">
          Arquivo PNG ou WebP (máx. 5 MB)
          <input id="photo-frame-file" className={inputClass} type="file" accept="image/png,image/webp" onChange={onFileChange} required />
        </label>
        <button type="submit" className={primaryButton} disabled={!file || !name.trim() || uploading}>
          <Upload size={14} /> {uploading ? "Enviando…" : "Enviar moldura"}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{message}</p>}

      <div className="mt-5">
        {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando molduras…</p> : frames.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {frames.map((frame) => (
              <article key={frame.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
                <div className="relative aspect-video bg-card">
                  <img src={frame.imageUrl} alt={frame.name} className="h-full w-full object-contain" />
                  <span className={`absolute left-2 top-2 rounded-md border px-2 py-1 text-[10px] font-semibold ${frame.is_active ? "border-primary/40 bg-background/90 text-primary" : "border-border bg-background/90 text-muted-foreground"}`}>
                    {frame.is_active ? "Ativa na cabine" : "Desativada"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-cream">{frame.name}</p><p className="text-[11px] text-muted-foreground">{frame.sort_order + 1}ª na lista</p></div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button type="button" className={secondaryButton} onClick={() => void toggleActive(frame)} disabled={busyId === frame.id} title={frame.is_active ? "Desativar moldura" : "Ativar moldura"}>
                      {frame.is_active ? <Check size={13} /> : <ImagePlus size={13} />}
                      {frame.is_active ? "Ativa" : "Ativar"}
                    </button>
                    <button type="button" className={secondaryButton} onClick={() => void remove(frame)} disabled={busyId === frame.id} title="Excluir moldura"><Trash2 size={13} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma moldura cadastrada. Envie a primeira acima.</p>}
      </div>
    </section>
  );
}
