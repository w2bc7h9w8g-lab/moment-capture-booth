import { useEffect, useState } from "react";
import { Camera, RotateCcw, X, Check } from "lucide-react";
import { KioskButton } from "@/components/kiosk/KioskButton";
import { useCamera } from "@/features/camera/use-camera";
import type { PhotoFrame } from "@/features/photo-frames";
import { CameraErrorPanel } from "./screens";

interface Props {
  photoNumber: number;
  maxPhotos: number;
  frame: PhotoFrame | null;
  onUse: (dataUrl: string) => Promise<void>;
  onCancel: () => void;
}

const COUNTDOWN_START = 3;

/** Live preview + capture (with post-click countdown) + review (retake / use). */
export function CameraStage({ photoNumber, maxPhotos, frame, onUse, onCancel }: Props) {
  const { videoRef, ready, error, start, stop, capture } = useCamera();
  const [shot, setShot] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { void start(); return stop; }, [start, stop]);

  const take = async () => {
    try {
      const img = await capture(frame?.imageUrl);
      if (img) {
        setSaveError("");
        setShot(img);
        setFlash((f) => f + 1);
      } else {
        setSaveError("A câmera ainda não está pronta. Tente novamente.");
      }
    } catch (captureError) {
      setSaveError(captureError instanceof Error ? captureError.message : "Não foi possível capturar a foto.");
    }
  };

  const beginCountdown = () => {
    if (count !== null) return;
    setCount(COUNTDOWN_START);
  };

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      void take();
      setCount(null);
      return;
    }
    const t = setTimeout(() => setCount((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (error) return <CameraErrorPanel error={error} onRetry={start} onCancel={onCancel} />;

  const counting = count !== null;

  const useCurrentPhoto = async () => {
    if (!shot || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await onUse(shot);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar a foto. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full max-w-6xl flex-col items-center">
      <p className="mb-3 text-lg tracking-[0.3em] text-primary uppercase">Foto {photoNumber} de {maxPhotos}</p>
      {frame && <p className="mb-2 text-sm text-muted-foreground">Moldura: <span className="font-semibold text-cream">{frame.name}</span></p>}
      <div className="relative aspect-video w-full max-h-[65vh] overflow-hidden rounded-3xl border-4 border-primary/60 bg-card shadow-gold">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full -scale-x-100 object-cover ${shot ? "invisible" : ""}`}
        />
        {shot ? (
          <img src={shot} alt="Foto capturada" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          frame && <img src={frame.imageUrl} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
        )}
        {!ready && !shot && (
          <div className="absolute inset-0 flex items-center justify-center text-xl text-muted-foreground">Abrindo câmera…</div>
        )}
        {counting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70">
            <p className="mb-2 font-display text-3xl text-cream">Prepare-se!</p>
            <div key={count} className="animate-pop font-display text-[12rem] leading-none font-bold text-primary">
              {count}
            </div>
          </div>
        )}
        {flash > 0 && <div key={flash} className="animate-flash pointer-events-none absolute inset-0 bg-cream" />}
      </div>
      {saveError && <p className="mt-4 max-w-3xl text-center text-destructive">{saveError}</p>}
      <div className="mt-6 flex gap-6">
        {shot ? (
          <>
            <KioskButton variant="outline" disabled={saving} onClick={() => { setSaveError(""); setShot(null); }}>
              <RotateCcw className="h-6 w-6" />Tirar novamente
            </KioskButton>
            <KioskButton disabled={saving} onClick={useCurrentPhoto}>
              <Check className="h-6 w-6" />{saving ? "Salvando…" : "Usar foto"}
            </KioskButton>
          </>
        ) : (
          <>
            <KioskButton variant="ghost" onClick={onCancel}><X className="h-6 w-6" />Cancelar</KioskButton>
            <KioskButton size="xl" disabled={!ready || counting} onClick={beginCountdown}><Camera className="h-8 w-8" />Capturar</KioskButton>
            <KioskButton variant="ghost" onClick={() => void start()}><RotateCcw className="h-6 w-6" />Repetir</KioskButton>
          </>
        )}
      </div>
    </div>
  );
}
