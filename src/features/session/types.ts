export type AppMode = "cabine" | "loja";

export interface Photo {
  id: string;
  dataUrl: string;
  createdAt: number;
}

export interface BoothSession {
  id: string;
  phone: string; // digits only, e.g. 11987654321
  photos: Photo[];
  status: "open" | "finalized";
  createdAt: number;
}

/** Abstraction so a Supabase implementation can be plugged in later. */
export interface SessionService {
  createSession(phone: string): Promise<BoothSession>;
  addPhoto(session: BoothSession, dataUrl: string): Promise<BoothSession>;
  finalizeSession(session: BoothSession): Promise<BoothSession>;
}

export const MAX_PHOTOS = 5;
