import { useCallback, useEffect, useRef, useState } from "react";

export type CameraError = "insecure" | "unsupported" | "denied" | "notfound" | "busy" | "unknown";

async function loadOverlay(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a moldura selecionada."));
    image.src = src;
  });
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!window.isSecureContext) return setError("insecure");
    if (!navigator.mediaDevices?.getUserMedia) return setError("unsupported");
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") setError("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setError("notfound");
      else if (name === "NotReadableError" || name === "AbortError") setError("busy");
      else setError("unknown");
    }
  }, [stop]);

  const capture = useCallback(async (frameUrl?: string): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;

    // Match the mirrored selfie preview, then draw the frame normally so its text remains readable.
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.setTransform(1, 0, 0, 1, 0, 0);

    if (frameUrl) {
      try {
        const overlay = await loadOverlay(frameUrl);
        context.drawImage(overlay, 0, 0, canvas.width, canvas.height);
      } catch {
        throw new Error("A moldura não carregou. Tente novamente ou escolha outra moldura.");
      }
    }

    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  useEffect(() => stop, [stop]);

  return { videoRef, ready, error, start, stop, capture };
}
