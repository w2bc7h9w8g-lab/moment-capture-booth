import type { BoothSession, SessionService } from "./types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** In-memory implementation. Replace with a Supabase-backed one later. */
export const localSessionService: SessionService = {
  async createSession(phone) {
    return { id: uid(), phone, photos: [], status: "open", createdAt: Date.now() };
  },
  async addPhoto(session, dataUrl) {
    return {
      ...session,
      photos: [...session.photos, { id: uid(), dataUrl, createdAt: Date.now() }],
    };
  },
  async finalizeSession(session: BoothSession) {
    return { ...session, status: "finalized" };
  },
};
