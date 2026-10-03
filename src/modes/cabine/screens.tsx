import { useEffect, useState } from "react";
import { KioskButton } from "@/components/kiosk/KioskButton";
import { formatBrPhone, isValidBrMobile, onlyDigits } from "@/lib/phone";
import type { CameraError } from "@/features/camera/use-camera";
import type { Photo } from "@/features/session/types";
import { MAX_PHOTOS } from "@/features/session/types";

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="frame-ornate flex flex-col items-center rounded-3xl px-16 py-14 text-center">
      <p className="mb-4 text-sm tracking-[0.5em] text-primary uppercase">Desde sempre, um brinde</p>
      <h1 className="font-display text-7xl leading-none font-semibold text-cream md:text-8xl">
        Guarde esse momento
      </h1>
      <p className="mt-6 max-w-xl text-xl text-muted-foreground">
        Tire suas fotos e leve essa lembrança para casa.
      </p>
      <KioskButton size="xl" className="mt-12" onClick={onStart}>
        Começar
      </KioskButton>
    </div>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "limpar", "0", "apagar"];

export function PhoneScreen({ onSubmit, onCancel }: { onSubmit: (p: string) => void; onCancel: () => void }) {
  const [digits, setDigits] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = isValidBrMobile(digits);
  const press = (k: string) => {
    if (k === "limpar") setDigits("");
    else if (k === "apagar") setDigits((d) => d.slice(0, -1));
    else setDigits((d) => onlyDigits(d + k));
  };
  return (
    <div className="grid w-full max-w-5xl grid-cols-2 items-center gap-12">
      <div>
        <h2 className="font-display text-6xl text-cream">Seu celular</h2>
        <p className="mt-3 text-lg text-muted-foreground">Usaremos apenas para identificar suas fotos.</p>
        <input
          inputMode="numeric"
          aria-label="Número de celular"
          value={formatBrPhone(digits)}
          onChange={(e) => setDigits(onlyDigits(e.target.value))}
          onBlur={() => setTouched(true)}
          placeholder="(11) 98765-4321"
          className="mt-8 w-full rounded-2xl border-2 border-input bg-card px-6 py-5 text-4xl tracking-wider text-cream outline-none focus:border-primary"
        />
        <p className="mt-3 h-6 text-destructive">
          {touched && digits.length > 0 && !valid ? "Digite um celular válido com DDD." : ""}
        </p>
        <div className="mt-6 flex gap-4">
          <KioskButton variant="ghost" onClick={onCancel}>Voltar</KioskButton>
          <KioskButton disabled={!valid} onClick={() => onSubmit(digits)} className="flex-1">
            Continuar
          </KioskButton>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => { press(k); setTouched(true); }}
            className={`h-24 rounded-2xl border border-border bg-card font-bold text-cream transition active:scale-95 active:bg-primary active:text-primary-foreground ${k.length > 1 ? "text-base uppercase tracking-widest text-muted-foreground" : "text-4xl"}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CountdownScreen({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n === 0) { onDone(); return; }
    const t = setTimeout(() => setN((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div className="text-center">
      <h2 className="font-display text-6xl text-cream">Prepare-se!</h2>
      <div key={n} className="animate-pop mt-8 font-display text-[16rem] leading-none font-bold text-primary">
        {n > 0 ? n : "✦"}
      </div>
    </div>
  );
}

const ERRORS: Record<CameraError, { title: string; steps: string[] }> = {
  insecure: { title: "Conexão não segura", steps: ["A câmera só funciona em HTTPS ou localhost.", "Abra a cabine por um endereço seguro."] },
  unsupported: { title: "Navegador sem suporte à câmera", steps: ["Use uma versão recente do Chrome, Edge ou Safari."] },
  denied: { title: "Permissão da câmera negada", steps: ["Toque no ícone de cadeado/câmera na barra de endereço.", "Permita o acesso à câmera para este site.", "Depois toque em “Tentar novamente”."] },
  notfound: { title: "Nenhuma câmera encontrada", steps: ["Verifique se a webcam está conectada.", "Reconecte o cabo USB e tente novamente."] },
  busy: { title: "Câmera em uso", steps: ["Feche outros programas que usam a câmera.", "Depois toque em “Tentar novamente”."] },
  unknown: { title: "Não foi possível abrir a câmera", steps: ["Tente novamente ou chame um atendente."] },
};

export function CameraErrorPanel({ error, onRetry, onCancel }: { error: CameraError; onRetry: () => void; onCancel: () => void }) {
  const e = ERRORS[error];
  return (
    <div className="frame-ornate max-w-2xl rounded-3xl bg-card/80 p-12 text-center">
      <h2 className="font-display text-5xl text-cream">{e.title}</h2>
      <ol className="mt-6 space-y-2 text-left text-xl text-muted-foreground">
        {e.steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}
      </ol>
      <div className="mt-10 flex justify-center gap-4">
        <KioskButton variant="ghost" onClick={onCancel}>Cancelar</KioskButton>
        <KioskButton onClick={onRetry}>Tentar novamente</KioskButton>
      </div>
    </div>
  );
}

export function PhotoGrid({ photos, size = "md" }: { photos: Photo[]; size?: "sm" | "md" }) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {photos.map((p, i) => (
        <div key={p.id} className="relative rounded-xl border-2 border-primary/50 bg-card p-1.5 shadow-gold">
          <img src={p.dataUrl} alt={`Foto ${i + 1}`} className={`${size === "sm" ? "h-28" : "h-44"} aspect-video rounded-lg object-cover`} />
          <span className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

export function GalleryScreen({ photos, onMore, onFinish }: { photos: Photo[]; onMore: () => void; onFinish: () => void }) {
  const canMore = photos.length < MAX_PHOTOS;
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-display text-6xl text-cream">Suas fotos</h2>
      <p className="mt-2 text-lg text-muted-foreground">{photos.length} de {MAX_PHOTOS} fotos</p>
      <div className="my-10"><PhotoGrid photos={photos} /></div>
      <div className="flex gap-6">
        <KioskButton variant="outline" disabled={!canMore} onClick={onMore}>Tirar outra foto</KioskButton>
        <KioskButton onClick={onFinish}>Finalizar</KioskButton>
      </div>
    </div>
  );
}

export function SummaryScreen({ photos, onDone, seconds = 10 }: { photos: Photo[]; onDone: () => void; seconds?: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onDone(); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm tracking-[0.5em] text-primary uppercase">Saúde!</p>
      <h2 className="mt-2 font-display text-7xl text-cream">Fotos enviadas</h2>
      <p className="mt-4 max-w-2xl text-xl text-muted-foreground">
        Suas fotos foram enviadas ao atendimento. Procure um atendente para retirá-las.
      </p>
      <div className="my-10"><PhotoGrid photos={photos} size="sm" /></div>
      <KioskButton variant="ghost" onClick={onDone}>Concluir ({left})</KioskButton>
    </div>
  );
}
