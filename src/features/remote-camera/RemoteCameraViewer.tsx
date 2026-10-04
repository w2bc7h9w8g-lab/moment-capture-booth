import { useEffect, useRef, useState } from "react";
import { supabaseRest } from "@/lib/supabase";
import { PublicRealtimeChannel } from "./realtime";

type Device = {
  id: string;
  label: string;
  created_at: string;
  last_seen_at: string;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function RemoteCameraViewer({ token }: { token: string }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("Selecione a cabine");
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<PublicRealtimeChannel | null>(null);
  const requestRef = useRef("");
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const loadDevices = async () => {
    const r = await supabaseRest(
      "/rest/v1/booth_devices?select=id,label,created_at,last_seen_at&order=last_seen_at.desc",
      {},
      token,
    );
    setDevices(await r.json());
  };

  const stop = () => {
    const id = selectedId;
    if (id) {
      channelRef.current?.send("camera-stop", { requestId: requestRef.current });
    }
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    pendingIceRef.current = [];
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setStatus("Teste encerrado");
  };

  const start = async () => {
    if (!selectedId || active) return;

    stop();
    setStatus("Conectando à cabine…");

    const channel = new PublicRealtimeChannel(`camera:${selectedId}`);
    channelRef.current = channel;
    requestRef.current = newId();

    channel.on(async (event, payload) => {
      if (payload.requestId !== requestRef.current) return;

      if (event === "camera-status") {
        const value = String(payload.status ?? "");
        if (value === "connected") setStatus("Câmera conectada");
        else if (value === "connecting") setStatus("Conectando vídeo…");
        else if (value === "failed") setStatus("Falha na conexão");
        else if (value === "error") setStatus(String(payload.message ?? "Falha ao acessar a câmera."));
        return;
      }

      if (event === "camera-offer" && payload.sdp) {
        const peer = peerRef.current;
        if (!peer) return;
        await peer.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
        for (const candidate of pendingIceRef.current) {
          await peer.addIceCandidate(candidate).catch(() => undefined);
        }
        pendingIceRef.current = [];
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        channel.send("camera-answer", { requestId: requestRef.current, sdp: peer.localDescription });
        return;
      }

      if (event === "camera-ice" && payload.candidate) {
        const candidate = payload.candidate as RTCIceCandidateInit;
        if (peerRef.current?.remoteDescription) {
          await peerRef.current.addIceCandidate(candidate).catch(() => undefined);
        } else {
          pendingIceRef.current.push(candidate);
        }
      }
    });

    try {
      await channel.connect();
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerRef.current = peer;

      peer.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          void videoRef.current.play().catch(() => undefined);
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send("camera-ice", {
            requestId: requestRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        if (state === "connected") {
          setActive(true);
          setStatus("Câmera conectada");
        } else if (state === "connecting") {
          setStatus("Conectando vídeo…");
        } else if (state === "failed") {
          setActive(false);
          setStatus("Falha na conexão de vídeo");
        }
      };

      channel.send("camera-request", { requestId: requestRef.current });
      setStatus("Solicitando imagem da cabine…");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível conectar à cabine.");
      channel.close();
      channelRef.current = null;
    }
  };

  useEffect(() => {
    void loadDevices().catch(() => setStatus("Não foi possível carregar as cabines."));
    const interval = window.setInterval(() => {
      void loadDevices().catch(() => undefined);
    }, 15000);

    return () => {
      window.clearInterval(interval);
      channelRef.current?.send("camera-stop", { requestId: requestRef.current });
      channelRef.current?.close();
      peerRef.current?.close();
    };
  }, []);

  const online = (lastSeen: string) => Date.now() - new Date(lastSeen).getTime() < 60000;

  return (
    <section className="rounded-2xl border border-border/80 bg-card/70 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Monitoramento</p>
          <h2 className="mt-1 text-lg font-semibold text-cream">Teste remoto da câmera</h2>
          <p className="mt-1 text-sm text-muted-foreground">Verifique a câmera da cabine sem interromper a interface do público.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => { stop(); setSelectedId(e.target.value); }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="">Selecionar cabine</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label} — {online(device.last_seen_at) ? "online" : "offline"}
              </option>
            ))}
          </select>
          {!active ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={!selectedId}
              className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
            >
              Testar câmera
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="h-9 rounded-lg border border-destructive/50 px-4 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
            >
              Encerrar teste
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-black">
        {active ? (
          <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-contain" />
        ) : (
          <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {status}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{status}</span>
        <span>{selectedId ? (devices.find((x) => x.id === selectedId)?.last_seen_at ? `Último sinal: ${new Date(devices.find((x) => x.id === selectedId)!.last_seen_at).toLocaleTimeString("pt-BR")}` : "") : ""}</span>
      </div>
    </section>
  );
}
