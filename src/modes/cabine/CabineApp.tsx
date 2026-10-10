import { useCallback, useState } from "react";
import { ScreenShell } from "@/components/kiosk/ScreenShell";
import { localSessionService } from "@/features/session/local-session-service";
import { MAX_PHOTOS, type BoothSession, type SessionService } from "@/features/session/types";
import { loadActivePhotoFrames, type PhotoFrame } from "@/features/photo-frames";
import { CameraStage } from "./CameraStage";
import { FrameSelectionScreen } from "./FrameSelectionScreen";
import { GalleryScreen, PhoneScreen, SummaryScreen, WelcomeScreen } from "./screens";

type Step = "welcome" | "phone" | "frames" | "camera" | "gallery" | "summary";

export function CabineApp({ service = localSessionService }: { service?: SessionService }) {
  const [step, setStep] = useState<Step>("welcome");
  const [session, setSession] = useState<BoothSession | null>(null);
  const [phone, setPhone] = useState("");
  const [frames, setFrames] = useState<PhotoFrame[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [frameError, setFrameError] = useState("");
  const [startError, setStartError] = useState("");
  const [finishError, setFinishError] = useState("");

  const reset = useCallback(() => {
    setSession(null);
    setPhone("");
    setFrames([]);
    setSelectedFrameId(null);
    setLoadingFrames(false);
    setStartingSession(false);
    setFrameError("");
    setStartError("");
    setFinishError("");
    setStep("welcome");
  }, []);

  const prepareFrames = async () => {
    setLoadingFrames(true);
    setFrameError("");
    setSelectedFrameId(null);
    try {
      const available = await loadActivePhotoFrames();
      setFrames(available);
    } catch {
      setFrames([]);
      setFrameError("Não foi possível carregar as molduras. Você pode tentar novamente ou continuar sem moldura.");
    } finally {
      setLoadingFrames(false);
      setStep("frames");
    }
  };

  const retryFrames = async () => {
    setLoadingFrames(true);
    setFrameError("");
    try {
      setFrames(await loadActivePhotoFrames());
    } catch {
      setFrames([]);
      setFrameError("Não foi possível carregar as molduras. Você pode continuar sem moldura.");
    } finally {
      setLoadingFrames(false);
    }
  };

  const startSession = async (phoneNumber: string) => {
    setStartError("");
    setPhone(phoneNumber);
    await prepareFrames();
  };

  const continueToCamera = async () => {
    if (startingSession) return;
    setStartingSession(true);
    setStartError("");
    try {
      const nextSession = await service.createSession(phone);
      setSession(nextSession);
      setStep("camera");
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Não foi possível iniciar a sessão. Tente novamente.");
    } finally {
      setStartingSession(false);
    }
  };

  const usePhoto = async (dataUrl: string) => {
    if (!session) return;
    const nextSession = await service.addPhoto(session, dataUrl);
    setSession(nextSession);
    setStep("gallery");
  };

  const finish = async () => {
    if (!session) return;
    setFinishError("");
    try {
      const nextSession = await service.finalizeSession(session);
      setSession(nextSession);
      setStep("summary");
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : "Não foi possível finalizar a sessão. Tente novamente.");
    }
  };

  const photos = session?.photos ?? [];
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? null;

  return (
    <ScreenShell>
      {step === "welcome" && <WelcomeScreen onStart={() => setStep("phone")} />}
      {step === "phone" && <PhoneScreen onSubmit={startSession} onCancel={reset} />}
      {step === "phone" && startError && (
        <p className="mt-4 max-w-2xl text-center text-destructive">{startError}</p>
      )}
      {step === "frames" && (
        <>
          <FrameSelectionScreen
            frames={frames}
            selectedFrameId={selectedFrameId}
            loading={loadingFrames}
            continuing={startingSession}
            error={frameError}
            onSelect={setSelectedFrameId}
            onContinue={() => void continueToCamera()}
            onRetry={() => void retryFrames()}
            onBack={() => setStep("phone")}
          />
          {startError && <p className="mt-4 max-w-2xl text-center text-destructive">{startError}</p>}
        </>
      )}
      {step === "camera" && (
        <CameraStage
          photoNumber={photos.length + 1}
          maxPhotos={MAX_PHOTOS}
          frame={selectedFrame}
          onUse={usePhoto}
          onCancel={() => (photos.length ? setStep("gallery") : reset())}
        />
      )}
      {step === "gallery" && (
        <>
          <GalleryScreen photos={photos} onMore={() => { setFinishError(""); setStep("camera"); }} onFinish={finish} />
          {finishError && <p className="mt-4 max-w-2xl text-center text-destructive">{finishError}</p>}
        </>
      )}
      {step === "summary" && <SummaryScreen photos={photos} onDone={reset} />}
    </ScreenShell>
  );
}
