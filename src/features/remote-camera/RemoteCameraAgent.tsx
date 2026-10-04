import { useEffect } from "react";
import { supabaseRest } from "@/lib/supabase";
import { PublicRealtimeChannel } from "./realtime";

const DEVICE_KEY = "bohemia_booth_device_id";
const getDeviceId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const getOrCreateDeviceId = () => {
  const current = localStorage.getItem(DEVICE_KEY);
  if (current) return current;
  const id = getDeviceId();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
};

type SignalPayload = {
  requestId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

export function RemoteCameraAgent() {
  useEffect(() => {
    let disposed = false;
    let channel: PublicRealtimeChannel | null = null;
    let peer: RTCPeerConnection | null = null;
    let stream: MediaStream | null = null;
    let heartbeat: number | null = null;

    const deviceId = getOrCreateDeviceId();
    const topic = `camera:${deviceId}`;

    const cleanupPeer = () => {
      peer?.close();
      peer = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const send = (event: string, payload: Record<string, unknown>) => channel?.send(event, payload);

    const startPeer = async (requestId: string) => {
      cleanupPeer();

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        send("camera-status", { requestId, status: "error", message: "A câmera remota precisa de HTTPS e suporte a câmera no navegador." });
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });

        if (disposed) return;

        peer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        stream.getTracks().forEach((track) => peer?.addTrack(track, stream!));

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            send("camera-ice", {
              requestId,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        peer.onconnectionstatechange = () => {
          if (!peer) return;
          const state = peer.connectionState;
          send("camera-status", { requestId, status: state });
          if (state === "failed" || state === "closed") cleanupPeer();
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        send("camera-offer", {
          requestId,
          sdp: peer.localDescription,
        });
      } catch (error) {
        cleanupPeer();
        send("camera-status", {
          requestId,
          status: "error",
          message: error instanceof DOMException ? `${error.name}: ${error.message}` : "Não foi possível acessar a câmera.",
        });
      }
    };

    const onSignal = async (event: string, payload: Record<string, unknown>) => {
      const data = payload as SignalPayload;

      if (event === "camera-request" && data.requestId) {
        await startPeer(data.requestId);
        return;
      }

      if (event === "camera-answer" && data.sdp && peer) {
        try {
          await peer.setRemoteDescription(data.sdp);
        } catch {
          send("camera-status", { requestId: data.requestId, status: "error", message: "Falha ao concluir a conexão da câmera." });
        }
        return;
      }

      if (event === "camera-ice" && data.candidate && peer?.remoteDescription) {
        try {
          await peer.addIceCandidate(data.candidate);
        } catch {
          // Ignore individual ICE candidates; the connection can still succeed through another candidate.
        }
        return;
      }

      if (event === "camera-stop") {
        cleanupPeer();
      }
    };

    const init = async () => {
      try {
        const register = await supabaseRest("/rest/v1/booth_devices", {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ id: deviceId, label: "Cabine principal" }),
        }).catch(() => null);

        if (register && !register.ok) return;

        await supabaseRest("/rest/v1/rpc/touch_booth_device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ p_device_id: deviceId }),
        }).catch(() => null);

        channel = new PublicRealtimeChannel(topic);
        channel.on(onSignal);
        await channel.connect();

        heartbeat = window.setInterval(() => {
          void supabaseRest("/rest/v1/rpc/touch_booth_device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ p_device_id: deviceId }),
          }).catch(() => null);
        }, 20000);
      } catch {
        // Remote monitoring is auxiliary. Never surface errors or interrupt the customer flow.
      }
    };

    void init();

    return () => {
      disposed = true;
      if (heartbeat !== null) window.clearInterval(heartbeat);
      cleanupPeer();
      channel?.close();
    };
  }, []);

  return null;
}
