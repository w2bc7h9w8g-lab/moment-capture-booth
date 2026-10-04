import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Camera,
  LogOut,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Users,
  KeyRound,
  Save,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  clearAuth,
  getStaffRole,
  loadAuth,
  saveAuth,
  signIn,
  signOut,
  supabaseFunction,
  supabaseRest,
} from "@/lib/supabase";
import { RemoteCameraViewer } from "@/features/remote-camera/RemoteCameraViewer";

type SessionRow = {
  id: string;
  created_at: string;
  status: string;
  printed_photo_count: number;
};

type PhotoRow = {
  id: string;
  session_id: string;
};

type Staff = {
  id: string;
  email: string;
  role: "admin" | "cashier";
  created_at: string;
  last_sign_in_at: string | null;
};

type DailyPoint = {
  key: string;
  label: string;
  sessions: number;
  photos: number;
  printed: number;
};

const buttonBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-40";
const primaryButton = `${buttonBase} bg-primary text-primary-foreground hover:brightness-110`;
const secondaryButton = `${buttonBase} border border-border bg-card text-foreground hover:bg-secondary`;
const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30";

function localDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDay(key: string) {
  const [year, month, day] = key.split("-");
  return `${day}/${month}`;
}

function startOfPeriod(days: number) {
  return new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
}

function buildDays(days: number) {
  const start = startOfPeriod(days);
  const points: DailyPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = localDateKey(date);
    points.push({ key, label: formatDay(key), sessions: 0, photos: 0, printed: 0 });
  }
  return points;
}

function Login({ ready }: { ready: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const go = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const session = await signIn(email, password);
      if ((await getStaffRole(session.access_token)) !== "admin") {
        throw new Error("Acesso restrito ao administrador.");
      }
      saveAuth(session);
      ready();
    } catch (error) {
      clearAuth();
      setError(error instanceof Error ? error.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stage px-5 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="w-full rounded-2xl border border-border/80 bg-card/80 p-7 shadow-2xl backdrop-blur">
          <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck size={20} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Bohemia Photo Booth</p>
          <h1 className="mt-2 text-2xl font-semibold text-cream">Painel administrativo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso exclusivo para administração.</p>

          <div className="mt-7 space-y-3">
            <input className={inputClass} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              className={inputClass}
              placeholder="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void go()}
            />
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <button type="button" className={`${primaryButton} mt-5 w-full`} onClick={() => void go()} disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-cream">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function Dashboard({ token, out }: { token: string; out: () => void }) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [points, setPoints] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [name, setName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffMessage, setStaffMessage] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<Staff | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const loadAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const start = startOfPeriod(period).toISOString();
      const sessionsResponse = await supabaseRest(
        `/rest/v1/sessions?select=id,created_at,status,printed_photo_count&created_at=gte.${encodeURIComponent(start)}&order=created_at.asc`,
        {},
        token,
      );
      const sessions = (await sessionsResponse.json()) as SessionRow[];

      const photosResponse = await supabaseRest(
        `/rest/v1/session_photos?select=id,session_id&created_at=gte.${encodeURIComponent(start)}&order=created_at.asc`,
        {},
        token,
      );
      const photos = (await photosResponse.json()) as PhotoRow[];

      const bySession = new Map<string, number>();
      photos.forEach((photo) => bySession.set(photo.session_id, (bySession.get(photo.session_id) ?? 0) + 1));

      const next = buildDays(period);
      const byKey = new Map(next.map((point) => [point.key, point]));
      sessions.forEach((session) => {
        const point = byKey.get(localDateKey(new Date(session.created_at)));
        if (!point) return;
        point.sessions += 1;
        point.printed += session.printed_photo_count || 0;
        point.photos += bySession.get(session.id) ?? 0;
      });

      setPoints(next);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar os indicadores.");
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    setStaffLoading(true);
    setStaffError("");
    try {
      const result = (await supabaseFunction("manage-staff", { action: "list" }, token)) as { staff?: Staff[] };
      setStaff(result.staff ?? []);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Não foi possível carregar a equipe.");
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [period]);

  useEffect(() => {
    void loadStaff();
  }, []);

  const totals = useMemo(
    () => ({
      sessions: points.reduce((sum, point) => sum + point.sessions, 0),
      photos: points.reduce((sum, point) => sum + point.photos, 0),
      printed: points.reduce((sum, point) => sum + point.printed, 0),
    }),
    [points],
  );

  const busiest = useMemo(
    () => [...points].filter((point) => point.sessions > 0 || point.photos > 0).sort((a, b) => b.photos - a.photos)[0],
    [points],
  );

  const activeDays = useMemo(
    () => [...points].filter((point) => point.sessions > 0 || point.photos > 0),
    [points],
  );

  const bestDays = useMemo(() => [...activeDays].sort((a, b) => b.photos - a.photos).slice(0, 3), [activeDays]);
  const lowestDays = useMemo(() => [...activeDays].sort((a, b) => a.photos - b.photos).slice(0, 3), [activeDays]);

  const updateRole = async (member: Staff, role: Staff["role"]) => {
    if (editingRole) return;
    setEditingRole(member.id);
    setStaffError("");
    setStaffMessage("");
    try {
      await supabaseFunction("manage-staff", { action: "update_role", user_id: member.id, role }, token);
      setStaff((current) => current.map((item) => item.id === member.id ? { ...item, role } : item));
      setStaffMessage(`Permissão de ${member.email} atualizada para ${role === "admin" ? "Admin" : "Caixa"}.`);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Não foi possível alterar a permissão.");
      await loadStaff();
    } finally {
      setEditingRole(null);
    }
  };

  const openPasswordDialog = (member: Staff) => {
    setPasswordUser(member);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("");
    setPasswordError("");
  };

  const closePasswordDialog = () => {
    if (passwordSaving) return;
    setPasswordUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("");
    setPasswordError("");
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordUser || passwordSaving) return;
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setPasswordSaving(true);
    try {
      await supabaseFunction("manage-staff", { action: "reset_password", user_id: passwordUser.id, password: newPassword }, token);
      setPasswordMessage("Senha alterada com sucesso.");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => closePasswordDialog(), 900);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const createStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (creatingStaff) return;
    setCreatingStaff(true);
    setStaffError("");
    setStaffMessage("");
    try {
      await supabaseFunction(
        "manage-staff",
        { action: "create", name, email: staffEmail, password: staffPassword },
        token,
      );
      setName("");
      setStaffEmail("");
      setStaffPassword("");
      setStaffMessage("Login de impressão criado com sucesso.");
      await loadStaff();
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Não foi possível criar o login.");
    } finally {
      setCreatingStaff(false);
    }
  };

  return (
    <div className="min-h-screen bg-stage">
      <header className="border-b border-border/70 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <BarChart3 size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-cream">Bohemia Photo Booth</p>
              <p className="text-xs text-muted-foreground">Administração e monitoramento</p>
            </div>
          </div>
          <button type="button" className={secondaryButton} onClick={out}>
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Visão geral</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-cream">Desempenho da cabine</h1>
            <p className="mt-1 text-sm text-muted-foreground">Movimento, fotos e impressão por dia.</p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((value) => (
              <button
                key={value}
                type="button"
                className={period === value ? primaryButton : secondaryButton}
                onClick={() => setPeriod(value as 7 | 30 | 90)}
              >
                {value} dias
              </button>
            ))}
            <button type="button" className={secondaryButton} onClick={() => void loadAnalytics()} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </section>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Sessões" value={totals.sessions} detail={`${period} dias analisados`} icon={<Activity size={16} />} />
          <StatCard label="Fotos capturadas" value={totals.photos} detail={totals.sessions ? `${(totals.photos / totals.sessions).toFixed(1)} por sessão` : "Sem sessões"} icon={<Camera size={16} />} />
          <StatCard label="Fotos impressas" value={totals.printed} detail={totals.photos ? `${Math.round((totals.printed / totals.photos) * 100)}% das capturadas` : "Sem fotos"} icon={<Printer size={16} />} />
          <StatCard label="Melhor dia" value={busiest?.label ?? "—"} detail={busiest ? `${busiest.photos} fotos · ${busiest.sessions} sessões` : "Sem movimento"} icon={<BarChart3 size={16} />} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-card/60 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-cream">Fotos por dia</h2>
                <p className="text-xs text-muted-foreground">Dias de maior e menor movimento</p>
              </div>
              <Camera size={16} className="text-muted-foreground" />
            </div>
            <div className="h-64">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{ background: "rgba(25,22,20,0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar dataKey="photos" name="Fotos" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card/60 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-cream">Sessões por dia</h2>
                <p className="text-xs text-muted-foreground">Quantidade de atendimentos iniciados</p>
              </div>
              <Users size={16} className="text-muted-foreground" />
            </div>
            <div className="h-64">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{ background: "rgba(25,22,20,0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar dataKey="sessions" name="Sessões" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-card/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-cream">Dias de maior movimento</h2>
            </div>
            <div className="divide-y divide-border/70">
              {bestDays.length ? bestDays.map((day) => (
                <div key={day.key} className="flex items-center justify-between py-3">
                  <div><p className="text-sm font-medium text-foreground">{day.label}</p><p className="text-xs text-muted-foreground">{day.sessions} sessões</p></div>
                  <p className="text-sm font-semibold text-cream">{day.photos} fotos</p>
                </div>
              )) : <p className="py-4 text-sm text-muted-foreground">Ainda não há movimento no período.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Activity size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-cream">Dias de menor movimento</h2>
            </div>
            <div className="divide-y divide-border/70">
              {lowestDays.length ? lowestDays.map((day) => (
                <div key={day.key} className="flex items-center justify-between py-3">
                  <div><p className="text-sm font-medium text-foreground">{day.label}</p><p className="text-xs text-muted-foreground">{day.sessions} sessões</p></div>
                  <p className="text-sm font-semibold text-cream">{day.photos} fotos</p>
                </div>
              )) : <p className="py-4 text-sm text-muted-foreground">Ainda não há movimento no período.</p>}
            </div>
          </div>
        </section>

        <RemoteCameraViewer token={token} />

        <section className="rounded-xl border border-border/80 bg-card/60 p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Equipe</p>
              <h2 className="mt-1 text-lg font-semibold text-cream">Logins da impressão</h2>
              <p className="mt-1 text-sm text-muted-foreground">Crie acessos individuais para a equipe que atende no caixa.</p>
            </div>
            <span className="text-xs text-muted-foreground">{staff.length} acesso(s)</span>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
            <form onSubmit={(event) => void createStaff(event)} className="rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Plus size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-cream">Novo acesso</h3>
              </div>
              <div className="space-y-3">
                <input className={inputClass} placeholder="Nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
                <input className={inputClass} type="email" placeholder="E-mail" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required />
                <input className={inputClass} type="password" placeholder="Senha (mínimo 8 caracteres)" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} minLength={8} required />
                <button type="submit" className={`${primaryButton} w-full`} disabled={creatingStaff}>
                  <Plus size={14} />
                  {creatingStaff ? "Criando…" : "Criar acesso de impressão"}
                </button>
              </div>
              {staffMessage && <p className="mt-3 text-xs text-primary">{staffMessage}</p>}
              {staffError && <p className="mt-3 text-xs text-destructive">{staffError}</p>}
            </form>

            <div className="overflow-hidden rounded-xl border border-border/70">
              <div className="grid grid-cols-[minmax(0,1fr)_150px_110px_150px] gap-4 border-b border-border/70 bg-background/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Usuário</span><span>Permissão</span><span>Último acesso</span><span className="text-right">Ações</span>
              </div>
              {staffLoading ? (
                <div className="p-5 text-sm text-muted-foreground">Carregando equipe…</div>
              ) : staff.length ? (
                staff.map((member) => (
                  <div key={member.id} className="grid grid-cols-[minmax(0,1fr)_150px_110px_150px] items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{member.email}</p>
                      <p className="text-[11px] text-muted-foreground">{member.role === "admin" ? "Administrador" : "Caixa / impressão"}</p>
                    </div>
                    <select
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                      value={member.role}
                      disabled={editingRole === member.id}
                      onChange={(event) => void updateRole(member, event.target.value as Staff["role"])}
                      aria-label={"Permissão de " + member.email}
                    >
                      <option value="admin">Admin</option>
                      <option value="cashier">Caixa</option>
                    </select>
                    <span className="text-xs text-muted-foreground">{member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleDateString("pt-BR") : "Nunca"}</span>
                    <div className="flex justify-end">
                      <button type="button" className={secondaryButton} onClick={() => openPasswordDialog(member)} disabled={passwordSaving} title="Alterar senha">
                        <KeyRound size={13} />
                        Senha
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-5 text-sm text-muted-foreground">Nenhum acesso cadastrado.</div>
              )}
            </div>
          </div>
        </section>
      </main>
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onClick={closePasswordDialog}>
          <form onSubmit={(event) => void resetPassword(event)} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Segurança</p>
                <h3 className="mt-1 text-lg font-semibold text-cream">Alterar senha</h3>
                <p className="mt-1 text-sm text-muted-foreground">{passwordUser.email}</p>
              </div>
              <button type="button" className={secondaryButton} onClick={closePasswordDialog} disabled={passwordSaving} aria-label="Fechar"><X size={14} /></button>
            </div>
            <div className="mt-5 space-y-3">
              <input className={inputClass} type="password" autoComplete="new-password" placeholder="Nova senha (mínimo 8 caracteres)" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required autoFocus />
              <input className={inputClass} type="password" autoComplete="new-password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
            </div>
            {passwordError && <p className="mt-3 text-sm text-destructive">{passwordError}</p>}
            {passwordMessage && <p className="mt-3 text-sm text-primary">{passwordMessage}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={closePasswordDialog} disabled={passwordSaving}>Cancelar</button>
              <button type="submit" className={primaryButton} disabled={passwordSaving}><Save size={13} />{passwordSaving ? "Salvando…" : "Salvar nova senha"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/admin")({ component: Page });

function Page() {
  const [auth, setAuth] = useState(loadAuth());
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setRole(null);
      return;
    }
    getStaffRole(auth.access_token).then(setRole).catch(() => setRole(null));
  }, [auth]);

  if (!auth || role !== "admin") {
    return <Login ready={() => setAuth(loadAuth())} />;
  }

  return (
    <Dashboard
      token={auth.access_token}
      out={() => {
        void signOut(auth.access_token);
        setAuth(null);
        setRole(null);
      }}
    />
  );
}
