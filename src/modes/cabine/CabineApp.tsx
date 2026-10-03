import { useCallback, useState } from "react";
import { ScreenShell } from "@/components/kiosk/ScreenShell";
import { localSessionService } from "@/features/session/local-session-service";
import { MAX_PHOTOS, type BoothSession, type SessionService } from "@/features/session/types";
import { CameraStage } from "./CameraStage";
import { GalleryScreen, PhoneScreen, SummaryScreen, WelcomeScreen } from "./screens";

type Step = "welcome" | "phone" | "camera" | "gallery" | "summary";

export function CabineApp({ service = localSessionService }: { service?: SessionService }) {
  const [step, setStep] = useState<Step>("welcome");
  const [session, setSession] = useState<BoothSession | null>(null);
  const [startError, setStartError] = useState("");
  const [finishError, setFinishError] = useState("");

  const reset = useCallback(() => {
    setSession(null);
    setStartError("");
    setFinishError("");
    setStep("welcome");
  }, []);

  const startSession = async (phone: string) => {
    setStartError("");
    try {
      const nextSession = await service.createSession(phone);
      setSession(nextSession);
      setStep("camera");
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Não foi possível iniciar a sessão. Tente novamente.");
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

  return (
    <ScreenShell>
      {step === "welcome" && <WelcomeScreen onStart={() => setStep("phone")} />}
      {step === "phone" && <PhoneScreen onSubmit={startSession} onCancel={reset} />}
      {step === "phone" && startError && (
        <p className="mt-4 max-w-2xl text-center text-destructive">{startError}</p>
      )}
      {step === "camera" && (
        <CameraStage
          photoNumber={photos.length + 1}
          maxPhotos={MAX_PHOTOS}
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
