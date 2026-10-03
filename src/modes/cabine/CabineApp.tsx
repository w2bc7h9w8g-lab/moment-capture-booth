import { useCallback, useState } from "react";
import { ScreenShell } from "@/components/kiosk/ScreenShell";
import { localSessionService } from "@/features/session/local-session-service";
import { MAX_PHOTOS, type BoothSession, type SessionService } from "@/features/session/types";
import { CameraStage } from "./CameraStage";
import { CameraStage, GalleryScreen, PhoneScreen, SummaryScreen, WelcomeScreen } from "./screens";

type Step = "welcome" | "phone" | "camera" | "gallery" | "summary";

export function CabineApp({ service = localSessionService }: { service?: SessionService }) {
  const [step, setStep] = useState<Step>("welcome");
  const [session, setSession] = useState<BoothSession | null>(null);

  const reset = useCallback(() => { setSession(null); setStep("welcome"); }, []);

  const startSession = async (phone: string) => {
    setSession(await service.createSession(phone));
    setStep("camera");
  };
  const usePhoto = async (dataUrl: string) => {
    if (!session) return;
    setSession(await service.addPhoto(session, dataUrl));
    setStep("gallery");
  };
  const finish = async () => {
    if (!session) return;
    setSession(await service.finalizeSession(session));
    setStep("summary");
  };

  const photos = session?.photos ?? [];

  return (
    <ScreenShell>
      {step === "welcome" && <WelcomeScreen onStart={() => setStep("phone")} />}
      {step === "phone" && <PhoneScreen onSubmit={startSession} onCancel={reset} />}
      {step === "camera" && (
        <CameraStage
          photoNumber={photos.length + 1}
          maxPhotos={MAX_PHOTOS}
          onUse={usePhoto}
          onCancel={() => (photos.length ? setStep("gallery") : reset())}
        />
      )}
      {step === "gallery" && (
        <GalleryScreen photos={photos} onMore={() => setStep("camera")} onFinish={finish} />
      )}
      {step === "summary" && <SummaryScreen photos={photos} onDone={reset} />}
    </ScreenShell>
  );
}
