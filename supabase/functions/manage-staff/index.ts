import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getKey = (name: string, legacyName: string) => {
  const grouped = Deno.env.get(name);
  if (grouped) {
    try {
      const parsed = JSON.parse(grouped);
      if (parsed.default) return parsed.default;
    } catch {
      // Fall through to the legacy variable for older runtimes.
    }
  }
  return Deno.env.get(legacyName) ?? "";
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const publishableKey = getKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secretKey = getKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

const authClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const adminClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado." }, 401);
    }

    const token = authorization.slice("Bearer ".length);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: "Sessão inválida." }, 401);
    }

    const { data: roleRow, error: roleError } = await adminClient
      .from("staff_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (roleError || roleRow?.role !== "admin") {
      return json({ error: "Acesso restrito ao administrador." }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: "list" | "create";
      email?: string;
      password?: string;
      name?: string;
    };

    if (body.action === "list") {
      const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (usersError) return json({ error: usersError.message }, 400);

      const { data: roles, error: rolesError } = await adminClient
        .from("staff_roles")
        .select("user_id, role, created_at");
      if (rolesError) return json({ error: rolesError.message }, 400);

      const roleByUser = new Map((roles ?? []).map((row) => [row.user_id, row]));
      const staff = usersData.users
        .map((user) => {
          const role = roleByUser.get(user.id);
          if (!role) return null;
          return {
            id: user.id,
            email: user.email ?? "",
            role: role.role,
            created_at: role.created_at ?? user.created_at,
            last_sign_in_at: user.last_sign_in_at ?? null,
          };
        })
        .filter(Boolean);

      return json({ staff });
    }

    if (body.action === "create") {
      const email = body.email?.trim().toLowerCase() ?? "";
      const password = body.password ?? "";
      const name = body.name?.trim() ?? "";

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return json({ error: "Informe um e-mail válido." }, 400);
      }
      if (password.length < 8) {
        return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: name ? { name } : undefined,
      });

      if (createError || !created.user) {
        const message = createError?.message ?? "Não foi possível criar o usuário.";
        const status = /already|exists|registered/i.test(message) ? 409 : 400;
        return json({ error: message }, status);
      }

      const { error: roleInsertError } = await adminClient
        .from("staff_roles")
        .insert({ user_id: created.user.id, role: "cashier" });

      if (roleInsertError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        return json({ error: "Usuário criado, mas não foi possível definir a permissão de impressão." }, 500);
      }

      return json({
        staff: {
          id: created.user.id,
          email: created.user.email ?? email,
          role: "cashier",
          created_at: created.user.created_at,
          last_sign_in_at: null,
        },
      }, 201);
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
