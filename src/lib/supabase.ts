const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://wishwrqlrnbieeepmgxy.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yGWVZRX5EfK-r7T_tG0Gxg_533Lpvjc";

export const supabaseUrl = SUPABASE_URL;

export function authHeaders(token?: string) {
  return {
    apikey: SUPABASE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function supabaseRest(path: string, init: RequestInit = {}, token?: string) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Supabase request failed (${response.status})`);
  }
  return response;
}

export async function getStaffRole(token: string) {
  const response = await supabaseRest(
    "/rest/v1/staff_roles?select=role&limit=1",
    { headers: { Accept: "application/json" } },
    token,
  );
  const rows = (await response.json()) as Array<{ role: "cashier" | "admin" }>;
  return rows[0]?.role ?? null;
}

export async function signIn(email: string, password: string) {
  const response = await supabaseRest(
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
  );
  return (await response.json()) as { access_token: string; refresh_token: string; user: { id: string; email?: string } };
}

export function saveAuth(session: { access_token: string; refresh_token: string; user: { id: string; email?: string } }) {
  localStorage.setItem("photo_booth_auth", JSON.stringify(session));
}

export function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem("photo_booth_auth") || "null") as
      | { access_token: string; refresh_token: string; user: { id: string; email?: string } }
      | null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem("photo_booth_auth");
}

export async function signOut(token: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: authHeaders(token),
  }).catch(() => undefined);
  clearAuth();
}

export async function signedPhotoUrl(path: string, token: string, expiresIn = 600) {
  const response = await supabaseRest(
    `/storage/v1/object/sign/photo-booth/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    },
    token,
  );
  const data = (await response.json()) as { signedURL?: string };
  if (!data.signedURL) throw new Error("Não foi possível gerar o link da foto.");
  return data.signedURL.startsWith("http") ? data.signedURL : `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}
