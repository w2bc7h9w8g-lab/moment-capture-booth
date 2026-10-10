import type { PhotoFrame } from "@/features/photo-frames";
import { KioskButton } from "@/components/kiosk/KioskButton";

type Props = {
  frames: PhotoFrame[];
  selectedFrameId: string | null;
  loading: boolean;
  continuing: boolean;
  error: string;
  onSelect: (frameId: string | null) => void;
  onContinue: () => void;
  onRetry: () => void;
  onBack: () => void;
};

export function FrameSelectionScreen({
  frames, selectedFrameId, loading, continuing, error, onSelect, onContinue, onRetry, onBack,
}: Props) {
  return (
    <div className="flex w-full max-w-6xl flex-col items-center text-center">
      <p className="mb-3 text-sm tracking-[0.35em] text-primary uppercase">Personalize sua lembrança</p>
      <h2 className="font-display text-6xl text-cream md:text-7xl">Escolha sua moldura</h2>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Selecione uma moldura antes de tirar suas fotos. Você poderá tirar até {5} fotos com a mesma escolha.</p>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{error}</p>
          <button type="button" className="mt-2 underline" onClick={onRetry}>Tentar carregar novamente</button>
        </div>
      )}

      {loading ? (
        <p className="my-12 text-lg text-muted-foreground">Carregando molduras…</p>
      ) : (
        <div className="my-8 grid w-full grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-pressed={selectedFrameId === null}
            className={`rounded-2xl border-2 p-3 text-left transition ${selectedFrameId === null ? "border-primary bg-primary/10 shadow-gold" : "border-border bg-card/60 hover:border-primary/50"}`}
          >
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-background/60 text-sm text-muted-foreground">Sem moldura</div>
            <p className="mt-3 text-base font-semibold text-cream">Original</p>
            <p className="mt-1 text-sm text-muted-foreground">Foto sem moldura</p>
          </button>
          {frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => onSelect(frame.id)}
              aria-pressed={selectedFrameId === frame.id}
              className={`rounded-2xl border-2 p-3 text-left transition ${selectedFrameId === frame.id ? "border-primary bg-primary/10 shadow-gold" : "border-border bg-card/60 hover:border-primary/50"}`}
            >
              <div className="relative aspect-video overflow-hidden rounded-lg bg-background">
                <img src={frame.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <p className="mt-3 truncate text-base font-semibold text-cream">{frame.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedFrameId === frame.id ? "Selecionada" : "Toque para selecionar"}</p>
            </button>
          ))}
          {!frames.length && !error && (
            <div className="col-span-full rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
              Ainda não há molduras disponíveis. Você pode continuar sem moldura.
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <KioskButton variant="ghost" onClick={onBack}>Voltar</KioskButton>
        <KioskButton size="xl" onClick={onContinue} disabled={loading || continuing}>{continuing ? "Iniciando sessão…" : "Continuar para a câmera"}</KioskButton>
      </div>
    </div>
  );
}
