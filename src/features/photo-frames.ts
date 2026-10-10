import { supabaseRest, supabaseUrl } from "@/lib/supabase";

export type PhotoFrame = {
  id: string;
  name: string;
  storage_path: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  imageUrl: string;
};

export function photoFrameUrl(path: string) {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/photo-frames/${safePath}`;
}

export async function loadActivePhotoFrames(): Promise<PhotoFrame[]> {
  const response = await supabaseRest(
    "/rest/v1/photo_frames?select=id,name,storage_path,is_active,sort_order,created_at&is_active=eq.true&order=sort_order.asc,created_at.asc",
  );
  const rows = (await response.json()) as Omit<PhotoFrame, "imageUrl">[];
  return rows.map((row) => ({ ...row, imageUrl: photoFrameUrl(row.storage_path) }));
}
