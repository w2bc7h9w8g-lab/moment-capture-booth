import { useCallback, useEffect, useRef, useState } from "react";

export type CameraError = "insecure" | "unsupported" | "denied" | "notfound" | "busy" | "unknown";

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

  const capture = useCallback((): string | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1); // match mirrored preview
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.92);
  }, []);

  useEffect(() => stop, [stop]);

  return { videoRef, ready, error, start, stop, capture };
}
