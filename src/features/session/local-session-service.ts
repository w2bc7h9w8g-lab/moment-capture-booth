import type { BoothSession, SessionService } from "./types";
import { supabaseRest } from "@/lib/supabase";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();
const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

export const localSessionService: SessionService = {
  async createSession(phone) {
    // Generate the session UUID in the browser so the kiosk does not need
    // SELECT permission just to receive the inserted row back from Supabase.
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

    await supabaseRest(`/storage/v1/object/photo-booth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
      body: await dataUrlToBlob(dataUrl),
    });

    // Do not request the inserted row back: anon intentionally has no SELECT
    // permission on session_photos. The ID is generated client-side instead.
    await supabaseRest("/rest/v1/session_photos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
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
    await supabaseRest(`/rest/v1/sessions?id=eq.${session.id}&status=eq.active`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": session.id,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "awaiting_print" }),
    }, undefined);
    return { ...session, status: "finalized" };
  },
};
