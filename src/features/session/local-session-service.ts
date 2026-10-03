import type { BoothSession, SessionService } from "./types";
import { supabaseRest } from "@/lib/supabase";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();
const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

export const localSessionService: SessionService = {
  async createSession(phone) {
    const id = uid();
    const normalizedPhone = normalizePhone(phone);

    await supabaseRest("/rest/v1/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ id, phone: normalizedPhone, status: "active" }),
    });

    return { id, phone: normalizedPhone, photos: [], status: "open", createdAt: Date.now() };
  },

  async addPhoto(session, dataUrl) {
    const photoNumber = session.photos.length + 1;
    const path = `${session.id}/photo-${photoNumber}.jpg`;
    const photoId = uid();

    // Keep the browser request to Storage standard: custom headers can trigger
    // a CORS preflight and make the kiosk upload fail before the request reaches
    // Supabase's Storage policy.
    await supabaseRest(`/storage/v1/object/photo-booth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
      body: await dataUrlToBlob(dataUrl),
    });

    // Do not request the inserted row back: anon intentionally has no SELECT
    // permission on session_photos.
    await supabaseRest("/rest/v1/session_photos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: photoId,
        session_id: session.id,
        storage_path: path,
        photo_number: photoNumber,
      }),
    });

    return {
      ...session,
      photos: [...session.photos, { id: photoId, dataUrl, createdAt: Date.now() }],
    };
  },

  async finalizeSession(session: BoothSession) {
    const response = await supabaseRest("/rest/v1/rpc/finalize_kiosk_session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ p_session_id: session.id }),
    });

    const finalized = (await response.json()) as boolean;
    if (!finalized) {
      throw new Error("A sessão não pôde ser finalizada. Ela pode já ter sido encerrada.");
    }

    return { ...session, status: "finalized" };
  },
};
