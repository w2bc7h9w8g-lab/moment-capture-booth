import type { BoothSession, SessionService } from "./types";
import { supabaseRest } from "@/lib/supabase";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();
const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
type SessionRow = { id: string; phone: string; created_at: string };

export const localSessionService: SessionService = {
  async createSession(phone) {
    const response = await supabaseRest("/rest/v1/sessions?select=id,phone,created_at&limit=1", {
      method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ phone: normalizePhone(phone), status: "active" }),
    });
    const row = (await response.json() as SessionRow[])[0];
    return { id: row.id, phone: row.phone, photos: [], status: "open", createdAt: Date.parse(row.created_at) };
  },
  async addPhoto(session, dataUrl) {
    const photoNumber = session.photos.length + 1;
    const path = `${session.id}/photo-${photoNumber}.jpg`;
    await supabaseRest(`/storage/v1/object/photo-booth/${path}`, {
      method: "POST", headers: { "Content-Type": "image/jpeg", "x-upsert": "true" }, body: await dataUrlToBlob(dataUrl),
    });
    const response = await supabaseRest("/rest/v1/session_photos?select=id,created_at&limit=1", {
      method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ session_id: session.id, storage_path: path, photo_number: photoNumber }),
    });
    const row = (await response.json() as Array<{ id: string; created_at: string }>)[0];
    return { ...session, photos: [...session.photos, { id: row?.id ?? uid(), dataUrl, createdAt: row ? Date.parse(row.created_at) : Date.now() }] };
  },
  async finalizeSession(session: BoothSession) {
    await supabaseRest(`/rest/v1/sessions?id=eq.${session.id}&status=eq.active`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "awaiting_print" }),
    });
    return { ...session, status: "finalized" };
  },
};
