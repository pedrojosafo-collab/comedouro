import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Clock3,
  Code2,
  Copy,
  Cpu,
  Droplets,
  ExternalLink,
  Gauge,
  History,
  House,
  Leaf,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
  Thermometer,
  Waves,
  TestTube2,
} from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: House },
  { path: "/feeding", label: "Alimentação manual", icon: Zap },
  { path: "/schedule", label: "Programação", icon: CalendarClock },
  { path: "/history", label: "Histórico", icon: History },
  { path: "/device", label: "Meus dispositivos", icon: Cpu },
  { path: "/water", label: "Monitoramento da água", icon: Droplets },
  { path: "/collaborators", label: "Colaboradores", icon: Users },
  { path: "/code", label: "Código ESP32", icon: Code2 },
  { path: "/install", label: "Como instalar", icon: BookOpen },
  { path: "/about", label: "Sobre o projeto", icon: Leaf },
];

const esp32Code = `/* COMEDOURO — firmware base para ESP32 + Firebase Realtime Database
 * Configure somente os campos abaixo. Nunca publique seu token em repositórios.
 * Bibliotecas: WiFi, HTTPClient, ArduinoJson (6.x)
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define WIFI_SSID "SEU_WIFI"
#define WIFI_PASSWORD "SUA_SENHA"
#define FIREBASE_HOST "https://comedouro-a8211-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH_TOKEN "COLOQUE_SEU_TOKEN_AQUI"
#define DEVICE_ID "COMEDOURO-001"
#define SERVO_PIN 18
#define FEEDING_MS 1200

unsigned long lastHeartbeat = 0;
unsigned long lastScheduleCheck = 0;
String basePath() { return String(FIREBASE_HOST) + "/devices/" + DEVICE_ID; }

void connectWifi() {
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWi-Fi conectado");
}
String authUrl(String path) { return basePath() + path + ".json?auth=" + FIREBASE_AUTH_TOKEN; }
void firebasePut(String path, String json) {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  HTTPClient http; http.begin(authUrl(path)); http.addHeader("Content-Type", "application/json");
  http.PUT(json); http.end();
}
String firebaseGet(String path) {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  HTTPClient http; http.begin(authUrl(path)); int code = http.GET();
  String body = code > 0 ? http.getString() : ""; http.end(); return body;
}
void dispense(String type, int quantity) {
  // Acione aqui o servo, motor ou relé do seu protótipo.
  digitalWrite(SERVO_PIN, HIGH); delay(FEEDING_MS * quantity); digitalWrite(SERVO_PIN, LOW);
  unsigned long now = (unsigned long)time(nullptr) * 1000UL;
  String payload = "{\\"type\\":\\"" + type + "\\",\\"quantity\\":" + String(quantity) + ",\\"createdAt\\":" + String(now) + "}";
  firebasePut("/lastFeeding", String(now));
  firebasePut("/lastEvent", payload);
  if (type == "automatic") firebasePut("/history/" + String(now), payload);
  firebasePut("/command/feed", "false");
}
String lastScheduleKey = "";
void checkSchedules() {
  String body = firebaseGet("/schedules"); StaticJsonDocument<2048> doc;
  if (deserializeJson(doc, body) != DeserializationError::Ok) return;
  time_t now = time(nullptr); struct tm *clockNow = localtime(&now);
  String minuteKey = String(clockNow->tm_year) + "-" + String(clockNow->tm_yday) + "-" + String(clockNow->tm_hour) + "-" + String(clockNow->tm_min);
  for (JsonPair item : doc.as<JsonObject>()) {
    JsonObject schedule = item.value().as<JsonObject>();
    if (!(schedule["active"] | false)) continue;
    int hour = schedule["hour"] | -1; int minute = schedule["minute"] | -1; int quantity = schedule["quantity"] | 1;
    String scheduleKey = String(item.key().c_str()) + "-" + minuteKey;
    if (hour == clockNow->tm_hour && minute == clockNow->tm_min && scheduleKey != lastScheduleKey) {
      dispense("automatic", quantity); lastScheduleKey = scheduleKey;
    }
  }
}
void checkManualCommand() {
  String body = firebaseGet("/command"); StaticJsonDocument<512> doc;
  if (deserializeJson(doc, body) == DeserializationError::Ok && doc["feed"] == true) {
    int quantity = doc["quantity"] | 1; const char* type = doc["type"] | "manual"; dispense(type, quantity);
  }
}
void checkSchedules() {
  // O firmware deve comparar os horários ativos com hora/minuto local.
  // O identificador do minuto evita repetir a mesma programação.
  String body = firebaseGet("/schedules");
  // Faça o parse de cada item e compare hour/minute quando integrar RTC/NTP.
  (void)body;
}
void setup() {
  Serial.begin(115200); pinMode(SERVO_PIN, OUTPUT); digitalWrite(SERVO_PIN, LOW);
  connectWifi(); configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}
void loop() {
  if (millis() - lastHeartbeat > 60000) { firebasePut("/lastSeen", String((unsigned long)time(nullptr) * 1000)); firebasePut("/wifi", String(WiFi.SSID())); lastHeartbeat = millis(); }
  if (millis() - lastScheduleCheck > 15000) { checkManualCommand(); checkSchedules(); lastScheduleCheck = millis(); }
  if (WiFi.status() != WL_CONNECTED) connectWifi(); delay(100);
}`;

function formatDate(value?: Date | string | null) {
  if (!value) return "Ainda não registrada";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
        <div className="auth-art-content">
          <div className="brand-mark large">
            <Droplets size={24} />
          </div>
          <p className="eyebrow">CONTROLE INTELIGENTE</p>
          <h1>
            Alimente com
            <br />
            <em>tranquilidade.</em>
          </h1>
          <p className="auth-description">
            Acompanhe seu comedouro, programe refeições e cuide da rotina de
            quem você ama de qualquer lugar.
          </p>
          <div className="trust-line">
            <ShieldCheck size={16} /> Dados protegidos e acesso por conta segura
          </div>
        </div>
        <div className="auth-watermark">COMEDOURO / 01</div>
      </div>
      <div className="auth-card">
        <div className="auth-card-inner">
          <div className="mobile-brand">
            <div className="brand-mark">
              <Droplets size={18} />
            </div>
            <span>COMEDOURO</span>
          </div>
          <div className="auth-heading">
            <span className="section-kicker">
              {mode === "login" ? "BEM-VINDO DE VOLTA" : "PRIMEIRO ACESSO"}
            </span>
            <h2>
              {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
            </h2>
            <p>
              {mode === "login"
                ? "Acesse o painel do seu comedouro."
                : "Configure seu comedouro em poucos passos."}
            </p>
          </div>
          <div className="field">
            <label>E-mail</label>
            <div className="input-with-icon">
              <Users size={17} />
              <input type="email" placeholder="voce@email.com" />
            </div>
          </div>
          <div className="field">
            <label>Senha</label>
            <div className="input-with-icon">
              <ShieldCheck size={17} />
              <input type="password" placeholder="Sua senha" />
            </div>
          </div>
          {mode === "signup" && (
            <div className="field">
              <label>Nome completo</label>
              <div className="input-with-icon">
                <Sparkles size={17} />
                <input type="text" placeholder="Como podemos chamar você?" />
              </div>
            </div>
          )}
          <button
            className="primary-button auth-button"
            onClick={() => startLogin()}
          >
            {mode === "login" ? "Entrar com segurança" : "Criar conta segura"}
            <ArrowRight size={17} />
          </button>
          <button
            className="text-button"
            onClick={() =>
              toast.info(
                "A recuperação de acesso é feita pelo portal seguro da conta.",
              )
            }
          >
            Esqueci minha senha
          </button>
          <div className="auth-switch">
            {mode === "login"
              ? "Ainda não tem uma conta?"
              : "Já possui uma conta?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </div>
          <p className="auth-note">
            A autenticação é concluída no portal seguro do projeto. A senha
            nunca é armazenada no banco do comedouro.
          </p>
        </div>
      </div>
    </div>
  );
}

function AppShell({
  children,
  page,
  setPage,
  user,
  onLogout,
}: {
  children: React.ReactNode;
  page: string;
  setPage: (path: string) => void;
  user: any;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <Droplets size={18} />
            </div>
            <span>COMEDOURO</span>
          </div>
          <button className="sidebar-close" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace">
          <span>ÁREA DE CONTROLE</span>
          <div className="workspace-row">
            <div className="workspace-avatar">
              {(user?.name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{user?.name || "Minha conta"}</strong>
              <small>Meu comedouro</small>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                className={`nav-item ${page === item.path ? "active" : ""}`}
                onClick={() => {
                  setPage(item.path);
                  setOpen(false);
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {page === item.path && (
                  <ChevronRight size={15} className="nav-arrow" />
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setPage("/settings")}>
            <Settings size={17} />
            <span>Configurações</span>
          </button>
          <button className="nav-item logout" onClick={onLogout}>
            <LogOut size={17} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>COMEDOURO</span>
            <ChevronRight size={14} />
            <strong>
              {navItems.find((n) => n.path === page)?.label || "Configurações"}
            </strong>
          </div>
          <div className="topbar-actions">
            <div className="connection-pill">
              <span className="connection-dot" /> Sistema protegido
            </div>
            <button
              className="icon-button"
              onClick={() =>
                document.documentElement.classList.toggle("dark-mode")
              }
            >
              <Moon size={17} />
            </button>
            <div className="top-avatar">
              {(user?.name || "U").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function EmptyDevice({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-device">
      <div className="empty-device-icon">
        <Cpu size={26} />
      </div>
      <h3>Você ainda não possui um comedouro conectado.</h3>
      <p>
        Cadastre o ID do seu ESP32 para acompanhar o status e começar a
        automatizar as refeições.
      </p>
      <button className="primary-button" onClick={onAdd}>
        <Plus size={17} /> Adicionar dispositivo
      </button>
    </div>
  );
}
function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span className="section-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function StatusBadge({ online }: { online: boolean }) {
  return (
    <span className={`status-badge ${online ? "online" : "offline"}`}>
      <span /> {online ? "Online" : "Offline"}
    </span>
  );
}

function Dashboard({
  data,
  setPage,
  refresh,
}: {
  data: any;
  setPage: (path: string) => void;
  refresh: () => void;
}) {
  const device = data?.device;
  const schedules = data?.schedules || [];
  const feedings = data?.feedings || [];
  const online = device?.status === "online";
  const todayCount = feedings.filter(
    (f: any) =>
      new Date(f.createdAt).toDateString() === new Date().toDateString(),
  ).length;
  const next = schedules.find((s: any) => s.active);
  return (
    <>
      <PageHeader
        eyebrow="VISÃO GERAL"
        title={`Olá, ${device ? "vamos cuidar do seu comedouro" : "vamos começar"}.`}
        description={
          device
            ? "Tudo o que você precisa para acompanhar a rotina alimentar em um só lugar."
            : "Conecte seu primeiro dispositivo para começar a acompanhar a rotina."
        }
        action={
          <button className="icon-button refresh" onClick={refresh}>
            <RefreshCcw size={17} />
          </button>
        }
      />
      {!device ? (
        <EmptyDevice onAdd={() => setPage("/device")} />
      ) : (
        <>
          <div className="hero-status">
            <div className="hero-status-icon">
              <Activity size={25} />
            </div>
            <div>
              <span className="section-kicker">STATUS DO DISPOSITIVO</span>
              <h2>Seu comedouro está {online ? "online" : "offline"}.</h2>
              <p>
                {online
                  ? "A comunicação com o ESP32 está acontecendo normalmente."
                  : "Verifique a energia e o Wi-Fi do ESP32 para reconectar."}
              </p>
            </div>
            <StatusBadge online={online} />
            <div className="hero-status-meta">
              <span>Última comunicação</span>
              <strong>{formatDate(device.lastSeen)}</strong>
            </div>
          </div>
          <div className="metrics-grid">
            <MetricCard
              icon={<Clock3 />}
              label="Última alimentação"
              value={formatDate(device.lastFeeding)}
              tone="mint"
            />
            <MetricCard
              icon={<CalendarClock />}
              label="Próxima alimentação"
              value={
                next ? formatTime(next.hour, next.minute) : "Não programada"
              }
              tone="amber"
            />
            <MetricCard
              icon={<Gauge />}
              label="Hoje"
              value={`${todayCount} ${todayCount === 1 ? "alimentação" : "alimentações"}`}
              tone="blue"
            />
            <MetricCard
              icon={online ? <Wifi /> : <WifiOff />}
              label="Conexão"
              value={device.wifi || "Aguardando ESP32"}
              tone="violet"
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel schedule-preview">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">ROTINA DE HOJE</span>
                  <h3>Programação de alimentação</h3>
                </div>
                <button
                  className="link-button"
                  onClick={() => setPage("/schedule")}
                >
                  Ver tudo <ArrowRight size={14} />
                </button>
              </div>
              {schedules.length === 0 ? (
                <div className="small-empty">
                  Nenhum horário cadastrado ainda.{" "}
                  <button onClick={() => setPage("/schedule")}>
                    Criar programação
                  </button>
                </div>
              ) : (
                <div className="schedule-list">
                  {schedules.slice(0, 4).map((s: any) => (
                    <div className="schedule-row" key={s.id}>
                      <div
                        className={`time-marker ${s.active ? "active" : ""}`}
                      >
                        <Clock3 size={16} />
                      </div>
                      <strong>{formatTime(s.hour, s.minute)}</strong>
                      <span>
                        {s.quantity} porção{s.quantity > 1 ? "ões" : ""}
                      </span>
                      <div className="row-spacer" />
                      <span className={`mini-state ${s.active ? "on" : "off"}`}>
                        {s.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="panel recent-preview">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">REGISTROS</span>
                  <h3>Atividade recente</h3>
                </div>
                <button
                  className="link-button"
                  onClick={() => setPage("/history")}
                >
                  Histórico <ArrowRight size={14} />
                </button>
              </div>
              {feedings.length === 0 ? (
                <div className="small-empty">
                  As alimentações realizadas aparecerão aqui.
                </div>
              ) : (
                <div className="activity-list">
                  {feedings.slice(0, 4).map((f: any) => (
                    <div className="activity-row" key={f.id}>
                      <div className={`activity-icon ${f.type}`}>
                        <Zap size={14} />
                      </div>
                      <div>
                        <strong>
                          {f.type === "manual"
                            ? "Alimentação manual"
                            : "Alimentação automática"}
                        </strong>
                        <span>{formatDate(f.createdAt)}</span>
                      </div>
                      <span className="row-spacer" />
                      <span className="quantity">{f.quantity}x</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function FeedingPage({
  device,
  refetch,
}: {
  device: any;
  refetch: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const mutation = trpc.app.feedNow.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.synced
          ? "Comando enviado ao ESP32."
          : "Alimentação registrada. Configure a ponte Firebase para enviar ao hardware.",
      );
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader
        eyebrow="AÇÃO RÁPIDA"
        title="Alimentação manual"
        description="Acione o mecanismo do seu comedouro e registre o evento no histórico."
      />
      {!device ? (
        <EmptyDevice onAdd={() => window.location.assign("/device")} />
      ) : (
        <div className="feeding-layout">
          <section className="feed-control panel">
            <div className="feed-rings">
              <div className="feed-ring ring-a" />
              <div className="feed-ring ring-b" />
              <div className="feed-button">
                <Droplets size={38} />
              </div>
            </div>
            <span className="section-kicker">COMANDO MANUAL</span>
            <h2>Alimentar agora</h2>
            <p>
              O comando será enviado para <strong>{device.name}</strong>. O
              ESP32 registra a execução quando concluir.
            </p>
            <div className="quantity-control">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                −
              </button>
              <span>
                <strong>{quantity}</strong> porção{quantity > 1 ? "ões" : ""}
              </span>
              <button onClick={() => setQuantity(Math.min(10, quantity + 1))}>
                +
              </button>
            </div>
            <button
              className="primary-button feed-now"
              onClick={() => mutation.mutate({ deviceId: device.id, quantity })}
              disabled={mutation.isPending}
            >
              <Zap size={18} />{" "}
              {mutation.isPending ? "Enviando comando..." : "ALIMENTAR AGORA"}
            </button>
            <div className="feed-notice">
              <ShieldCheck size={15} /> A ação fica registrada no histórico
            </div>
          </section>
          <section className="panel info-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">COMO FUNCIONA</span>
                <h3>Do clique ao comedouro</h3>
              </div>
            </div>
            <div className="step-list">
              <Step
                n="01"
                title="Você solicita"
                text="O comando é salvo com tipo, quantidade e horário."
              />
              <Step
                n="02"
                title="O ESP32 consulta"
                text="O dispositivo verifica o Firebase e identifica novos comandos."
              />
              <Step
                n="03"
                title="A porção é liberada"
                text="O mecanismo é acionado e o evento fica disponível no histórico."
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="step">
      <span>{n}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function SchedulePage({ data, refetch }: { data: any; refetch: () => void }) {
  const device = data?.device;
  const schedules = data?.schedules || [];
  const [hour, setHour] = useState("06:00");
  const [quantity, setQuantity] = useState(1);
  const add = trpc.app.addSchedule.useMutation({
    onSuccess: () => {
      toast.success("Horário adicionado à programação.");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const toggle = trpc.app.toggleSchedule.useMutation({
    onSuccess: () => {
      toast.success("Status do horário atualizado.");
      refetch();
    },
  });
  const remove = trpc.app.deleteSchedule.useMutation({
    onSuccess: () => {
      toast.success("Horário excluído.");
      refetch();
    },
  });
  const [h, m] = hour.split(":").map(Number);
  return (
    <>
      <PageHeader
        eyebrow="ROTINA INTELIGENTE"
        title="Programação de alimentação"
        description="Defina os horários e deixe o ESP32 cuidar da rotina automaticamente."
      />
      {!device ? (
        <EmptyDevice onAdd={() => window.location.assign("/device")} />
      ) : (
        <div className="schedule-layout">
          <section className="panel add-schedule">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">NOVO HORÁRIO</span>
                <h3>Adicionar à rotina</h3>
              </div>
              <CalendarClock size={20} />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Hora</label>
                <input
                  type="time"
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Porções</label>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option value={n} key={n}>
                      {n} porção{n > 1 ? "ões" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              className="primary-button"
              onClick={() =>
                add.mutate({
                  deviceId: device.id,
                  hour: h,
                  minute: m,
                  quantity,
                })
              }
              disabled={add.isPending}
            >
              <Plus size={17} /> Adicionar horário
            </button>
            <p className="helper-text">
              O dispositivo evita executar o mesmo horário mais de uma vez por
              minuto.
            </p>
          </section>
          <section className="panel schedule-manager">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">HORÁRIOS CADASTRADOS</span>
                <h3>
                  {schedules.length}{" "}
                  {schedules.length === 1 ? "horário" : "horários"}
                </h3>
              </div>
              <span className="date-chip">Todos os dias</span>
            </div>
            {schedules.length === 0 ? (
              <div className="small-empty">
                Sua rotina ainda está vazia. Adicione o primeiro horário ao
                lado.
              </div>
            ) : (
              <div className="schedule-list full">
                {schedules.map((s: any) => (
                  <div className="schedule-row" key={s.id}>
                    <div className={`time-marker ${s.active ? "active" : ""}`}>
                      <Clock3 size={16} />
                    </div>
                    <strong>{formatTime(s.hour, s.minute)}</strong>
                    <span>
                      {s.quantity} porção{s.quantity > 1 ? "ões" : ""}
                    </span>
                    <div className="row-spacer" />
                    <button
                      className={`toggle ${s.active ? "checked" : ""}`}
                      onClick={() =>
                        toggle.mutate({ scheduleId: s.id, active: !s.active })
                      }
                    >
                      <span />
                    </button>
                    <span className={`mini-state ${s.active ? "on" : "off"}`}>
                      {s.active ? "Ativo" : "Inativo"}
                    </span>
                    <button
                      className="row-action danger"
                      onClick={() => remove.mutate({ scheduleId: s.id })}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function HistoryPage({ data }: { data: any }) {
  const feedings = data?.feedings || [];
  const [filter, setFilter] = useState<"all" | "manual" | "automatic">("all");
  const filtered = feedings.filter(
    (f: any) => filter === "all" || f.type === filter,
  );
  return (
    <>
      <PageHeader
        eyebrow="ACOMPANHAMENTO"
        title="Histórico"
        description="Veja todas as alimentações realizadas pelo seu comedouro."
        action={
          <div className="filter-tabs">
            {[
              ["all", "Todas"],
              ["manual", "Manuais"],
              ["automatic", "Automáticas"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value as any)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {!data?.device ? (
        <EmptyDevice onAdd={() => window.location.assign("/device")} />
      ) : (
        <section className="panel history-panel">
          {filtered.length === 0 ? (
            <div className="small-empty">
              Nenhuma alimentação encontrada para este filtro.
            </div>
          ) : (
            <div className="history-table">
              <div className="history-head">
                <span>Data e horário</span>
                <span>Tipo</span>
                <span>Quantidade</span>
                <span>Origem</span>
              </div>
              {filtered.map((f: any) => (
                <div className="history-line" key={f.id}>
                  <div className="history-time">
                    <strong>
                      {new Date(f.createdAt).toLocaleDateString("pt-BR")}
                    </strong>
                    <span>
                      {new Date(f.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div>
                    <span className={`type-pill ${f.type}`}>
                      {f.type === "manual" ? "Manual" : "Automática"}
                    </span>
                  </div>
                  <strong>{f.quantity}x</strong>
                  <span className="muted">
                    {f.type === "manual" ? "Painel de controle" : "Programação"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function WaterMonitoringPage({
  data,
  refresh,
}: {
  data: any;
  refresh: () => void;
}) {
  const sensors = data?.waterSensors || {};
  const online = sensors.status === "online";
  return (
    <>
      <PageHeader
        eyebrow="MONITORAMENTO"
        title="Qualidade da água"
        description="Acompanhe os sensores do ESP32 de monitoramento em tempo real."
        action={
          <button className="icon-button refresh" onClick={refresh}>
            <RefreshCcw size={17} />
          </button>
        }
      />
      {!data?.waterDevice ? (
        <div className="empty-device">
          <div className="empty-device-icon">
            <Droplets size={26} />
          </div>
          <h3>Nenhum monitor de água cadastrado.</h3>
          <p>
            Cadastre um ESP32 do tipo “Monitoramento da água” para receber
            temperatura, condutividade, pH e turbidez.
          </p>
          <button
            className="primary-button"
            onClick={() => window.location.assign("/device")}
          >
            <Plus size={17} /> Adicionar monitor
          </button>
        </div>
      ) : (
        <>
          <div className="hero-status">
            <div className="hero-status-icon">
              <Droplets size={25} />
            </div>
            <div>
              <span className="section-kicker">ESP32 DE MONITORAMENTO</span>
              <h2>{data.waterDevice.name}</h2>
              <p>
                {online
                  ? "Os sensores estão comunicando normalmente."
                  : "O ESP32 não envia dados há mais de 30 segundos."}
              </p>
            </div>
            <StatusBadge online={online} />
            <div className="hero-status-meta">
              <span>Última comunicação</span>
              <strong>{formatDate(sensors.lastSeen)}</strong>
            </div>
          </div>
          <div className="metrics-grid">
            <MetricCard
              icon={<Thermometer />}
              label="Temperatura"
              value={
                sensors.temperature != null
                  ? `${Number(sensors.temperature).toFixed(1)} °C`
                  : "--"
              }
              tone="mint"
            />
            <MetricCard
              icon={<Waves />}
              label="Condutividade"
              value={
                sensors.conductivity != null
                  ? `${Number(sensors.conductivity).toFixed(0)} µS/cm`
                  : "--"
              }
              tone="blue"
            />
            <MetricCard
              icon={<TestTube2 />}
              label="pH"
              value={sensors.ph != null ? Number(sensors.ph).toFixed(2) : "--"}
              tone="violet"
            />
            <MetricCard
              icon={<Droplets />}
              label="Turbidez"
              value={
                sensors.turbidity != null
                  ? `${Number(sensors.turbidity).toFixed(1)} NTU`
                  : "--"
              }
              tone="amber"
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">DISPOSITIVO</span>
                <h3>Informações do monitor</h3>
              </div>
              <StatusBadge online={online} />
            </div>
            <div className="detail-grid">
              <Detail label="ID do ESP32" value={data.waterDevice.deviceId} />
              <Detail
                label="Wi-Fi"
                value={sensors.wifi || "Ainda não enviado"}
              />
              <Detail
                label="Temperatura"
                value={
                  sensors.temperature != null
                    ? `${sensors.temperature} °C`
                    : "Sem leitura"
                }
              />
              <Detail
                label="Última atualização"
                value={formatDate(sensors.lastSeen)}
              />
            </div>
          </section>
        </>
      )}
    </>
  );
}

function DevicePage({ data, refetch }: { data: any; refetch: () => void }) {
  const device = data?.device;
  const devices = data?.devices || [];
  const [showForm, setShowForm] = useState(!device);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"feeder" | "water-monitor">("feeder");
  const add = trpc.app.addDevice.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Dispositivo cadastrado. Chave: ${result.deviceKey.slice(0, 8)}…`,
      );
      setShowForm(false);
      setId("");
      setName("");
      setType("feeder");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const rename = trpc.app.renameDevice.useMutation({
    onSuccess: () => {
      toast.success("Nome atualizado.");
      refetch();
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="HARDWARE"
        title="Meu dispositivo"
        description="Gerencie o ESP32 que está conectado à sua conta."
        action={
          device && (
            <button
              className="secondary-button"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus size={16} /> Adicionar outro
            </button>
          )
        }
      />
      {showForm && (
        <section className="panel device-form">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">CADASTRAR ESP32</span>
              <h3>Conecte um comedouro</h3>
            </div>
            <Cpu size={22} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Tipo de dispositivo</label>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "feeder" | "water-monitor")
                }
              >
                <option value="feeder">Comedouro</option>
                <option value="water-monitor">Monitoramento da água</option>
              </select>
            </div>
            <div className="field">
              <label>ID do dispositivo</label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder={type === "feeder" ? "COMEDOURO-001" : "AGUA-001"}
              />
            </div>
            <div className="field">
              <label>Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  type === "feeder"
                    ? "Comedouro da sala"
                    : "Monitoramento da água"
                }
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              onClick={() => add.mutate({ deviceId: id, name, type })}
              disabled={add.isPending || !id || !name}
            >
              {add.isPending ? "Cadastrando..." : "Cadastrar dispositivo"}
            </button>
          </div>
          <p className="helper-text">
            Depois do cadastro, copie o código na página “Código ESP32” e
            substitua o DEVICE_ID pelo mesmo identificador.
          </p>
        </section>
      )}
      {device && (
        <section className="panel device-detail">
          <div className="device-detail-top">
            <div className="device-visual">
              <Cpu size={32} />
            </div>
            <div>
              <span className="section-kicker">DISPOSITIVO ATIVO</span>
              <h2>{device.name}</h2>
              <p className="mono">{device.deviceId}</p>
            </div>
            <div className="row-spacer" />
            <StatusBadge online={device.status === "online"} />
          </div>
          <div className="detail-grid">
            <Detail
              label="Última comunicação"
              value={formatDate(device.lastSeen)}
            />
            <Detail
              label="Última alimentação"
              value={formatDate(device.lastFeeding)}
            />
            <Detail
              label="Rede Wi-Fi"
              value={device.wifi || "Ainda não enviada"}
            />
            <Detail
              label="Sincronização"
              value={
                data.firebaseConfigured
                  ? "Firebase configurado"
                  : "Aguardando token Firebase"
              }
            />
          </div>
          <div className="device-rename">
            <div className="field">
              <label>Nome do dispositivo</label>
              <input
                defaultValue={device.name}
                onBlur={(e) =>
                  e.target.value !== device.name &&
                  rename.mutate({ deviceId: device.id, name: e.target.value })
                }
              />
            </div>
            <div className="device-key">
              <span>Chave de instalação</span>
              <code>{device.deviceKey}</code>
              <button
                className="icon-button"
                onClick={() => {
                  navigator.clipboard?.writeText(device.deviceKey);
                  toast.success("Chave copiada.");
                }}
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CollaboratorsPage({
  data,
  refetch,
}: {
  data: any;
  refetch: () => void;
}) {
  const device = data?.device;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"collaborator" | "administrator">(
    "collaborator",
  );
  const add = trpc.app.addCollaborator.useMutation({
    onSuccess: () => {
      toast.success("Colaborador adicionado.");
      setEmail("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.app.removeCollaborator.useMutation({
    onSuccess: () => {
      toast.success("Colaborador removido.");
      refetch();
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="ACESSO COMPARTILHADO"
        title="Colaboradores"
        description="Convide pessoas de confiança para acompanhar e controlar este comedouro."
      />
      {!device ? (
        <EmptyDevice onAdd={() => window.location.assign("/device")} />
      ) : (
        <div className="collab-layout">
          <section className="panel add-collab">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">NOVO ACESSO</span>
                <h3>Adicionar colaborador</h3>
              </div>
              <UserPlus size={20} />
            </div>
            <div className="field">
              <label>Gmail ou e-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@email.com"
              />
            </div>
            <div className="field">
              <label>Nível de permissão</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                <option value="collaborator">
                  Colaborador — visualizar e alimentar
                </option>
                <option value="administrator">
                  Administrador — também gerencia horários
                </option>
              </select>
            </div>
            <button
              className="primary-button"
              onClick={() => add.mutate({ deviceId: device.id, email, role })}
              disabled={!email || add.isPending}
            >
              <UserPlus size={17} /> Adicionar colaborador
            </button>
            <p className="helper-text">
              O acesso será associado ao e-mail da conta da pessoa convidada.
            </p>
          </section>
          <section className="panel collab-list">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">PESSOAS COM ACESSO</span>
                <h3>
                  {(data.collaborators || []).length} colaborador
                  {(data.collaborators || []).length === 1 ? "" : "es"}
                </h3>
              </div>
              <Users size={20} />
            </div>
            {(data.collaborators || []).length === 0 ? (
              <div className="small-empty">
                Você ainda não compartilhou este comedouro.
              </div>
            ) : (
              <div className="people-list">
                {data.collaborators.map((c: any) => (
                  <div className="person-row" key={c.id}>
                    <div className="person-avatar">
                      {c.email.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{c.email}</strong>
                      <span>
                        {c.role === "administrator"
                          ? "Administrador"
                          : "Colaborador"}
                      </span>
                    </div>
                    <div className="row-spacer" />
                    <button
                      className="row-action danger"
                      onClick={() => remove.mutate({ collaboratorId: c.id })}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function CodePage() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(esp32Code);
    setCopied(true);
    toast.success("Código copiado para a área de transferência.");
    setTimeout(() => setCopied(false), 1800);
  };
  const download = () => {
    const blob = new Blob([esp32Code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "comedouro-esp32.ino";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        eyebrow="FIRMWARE"
        title="Código ESP32"
        description="Firmware base comentado para conectar seu dispositivo ao Firebase Realtime Database."
        action={
          <div className="header-actions">
            <button className="secondary-button" onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
              {copied ? "Copiado" : "Copiar código"}
            </button>
            <button className="primary-button" onClick={download}>
              <ArrowRight size={16} /> Baixar .ino
            </button>
          </div>
        }
      />
      <div className="code-layout">
        <section className="code-card">
          <div className="code-toolbar">
            <div>
              <span className="code-dot red" />
              <span className="code-dot yellow" />
              <span className="code-dot green" />
            </div>
            <span>comedouro-esp32.ino</span>
            <button onClick={copy}>
              <Clipboard size={15} /> Copiar
            </button>
          </div>
          <pre>
            <code>{esp32Code}</code>
          </pre>
        </section>
        <aside className="panel code-side">
          <span className="section-kicker">ANTES DO UPLOAD</span>
          <h3>Checklist rápido</h3>
          <div className="check-list">
            <CheckItem text="Preencha Wi-Fi e token Firebase" />
            <CheckItem text="Ajuste SERVO_PIN para seu circuito" />
            <CheckItem text="Instale as bibliotecas necessárias" />
            <CheckItem text="Faça o upload pela Arduino IDE" />
          </div>
          <button
            className="link-button"
            onClick={() => window.location.assign("/install")}
          >
            Ver guia de instalação <ArrowRight size={14} />
          </button>
          <div className="warning-box">
            <AlertCircle size={16} />
            <span>
              O token é responsabilidade do proprietário. Não compartilhe seu
              arquivo .ino publicamente.
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
function CheckItem({ text }: { text: string }) {
  return (
    <div className="check-item">
      <span>
        <Check size={13} />
      </span>
      {text}
    </div>
  );
}

function InstallPage() {
  return (
    <>
      <PageHeader
        eyebrow="PRIMEIROS PASSOS"
        title="Como instalar"
        description="Um guia simples para colocar o seu comedouro online com o ESP32."
      />
      <div className="install-grid">
        <section className="panel install-steps">
          <div className="install-step">
            <span>01</span>
            <div>
              <h3>Instale a Arduino IDE</h3>
              <p>
                Baixe a versão mais recente no site oficial e instale no seu
                computador.
              </p>
              <a
                href="https://www.arduino.cc/en/software"
                target="_blank"
                rel="noreferrer"
              >
                Abrir Arduino IDE <ExternalLink size={13} />
              </a>
            </div>
          </div>
          <div className="install-step">
            <span>02</span>
            <div>
              <h3>Adicione o suporte ESP32</h3>
              <p>
                Em Preferências, adicione a URL do gerenciador de placas ESP32;
                depois instale “esp32 by Espressif Systems”.
              </p>
            </div>
          </div>
          <div className="install-step">
            <span>03</span>
            <div>
              <h3>Instale as bibliotecas</h3>
              <p>
                Use o Gerenciador de Bibliotecas para instalar ArduinoJson 6.x.
                WiFi e HTTPClient já acompanham o ESP32.
              </p>
            </div>
          </div>
          <div className="install-step">
            <span>04</span>
            <div>
              <h3>Configure e envie o código</h3>
              <p>
                Abra o arquivo .ino, preencha Wi-Fi, token, DEVICE_ID e pino do
                mecanismo. Selecione sua placa e clique em Upload.
              </p>
            </div>
          </div>
          <div className="install-step">
            <span>05</span>
            <div>
              <h3>Confirme no Dashboard</h3>
              <p>
                Ligue o ESP32 e aguarde até um minuto. O cartão do dispositivo
                deve mostrar a última comunicação.
              </p>
            </div>
          </div>
        </section>
        <aside className="panel install-tip">
          <div className="tip-icon">
            <CircleHelp size={22} />
          </div>
          <span className="section-kicker">DICA DE PROJETO</span>
          <h3>Comece com o mecanismo desligado</h3>
          <p>
            Teste primeiro a comunicação e o status. Depois conecte o servo,
            motor ou relé para evitar uma liberação acidental de ração durante a
            instalação.
          </p>
          <div className="tip-line">
            <ShieldCheck size={15} /> Segurança antes da automação
          </div>
        </aside>
      </div>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="INSTITUCIONAL"
        title="Sobre o projeto"
        description="Um espaço para apresentar a história, a instituição e as pessoas por trás do COMEDOURO."
      />
      <div className="about-grid">
        <section className="about-hero panel">
          <div className="logo-place">
            <span>
              LOGO DA
              <br />
              INSTITUIÇÃO
            </span>
          </div>
          <div className="logo-place course">
            <span>
              LOGO DO
              <br />
              CURSO
            </span>
          </div>
          <div>
            <span className="section-kicker">SOBRE O COMEDOURO</span>
            <h2>Automação que cuida da rotina.</h2>
            <p>
              O COMEDOURO foi criado para facilitar a alimentação de animais de
              estimação por meio de um dispositivo conectado, programação de
              horários e acompanhamento remoto.
            </p>
            <p className="muted">
              Substitua este texto com a apresentação oficial da instituição, do
              curso e do projeto.
            </p>
          </div>
        </section>
        <section className="panel editable-info">
          <div>
            <span className="section-kicker">CAMPOS CONFIGURÁVEIS</span>
            <h3>Complete a apresentação</h3>
          </div>
          <div className="about-fields">
            <Detail
              label="Instituição"
              value="Adicione o nome da instituição"
            />
            <Detail label="Curso" value="Adicione o nome do curso" />
            <Detail label="Integrantes" value="Adicione os nomes da equipe" />
            <Detail
              label="Orientador(a)"
              value="Adicione o nome do orientador"
            />
          </div>
        </section>
      </div>
    </>
  );
}

function SettingsPage({ user }: { user: any }) {
  return (
    <>
      <PageHeader
        eyebrow="PREFERÊNCIAS"
        title="Configurações"
        description="Gerencie sua conta e as preferências do sistema."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-profile">
            <div className="profile-avatar">
              {(user?.name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <span className="section-kicker">PERFIL</span>
              <h3>{user?.name || "Usuário COMEDOURO"}</h3>
              <p>{user?.email || "E-mail protegido"}</p>
            </div>
            <button className="secondary-button">
              <Pencil size={15} /> Editar nome
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>E-mail da conta</strong>
              <span>Usado para identificação e compartilhamento</span>
            </div>
            <b>{user?.email || "Não informado"}</b>
          </div>
          <div className="setting-row">
            <div>
              <strong>Autenticação</strong>
              <span>Gerenciada pelo portal seguro do projeto</span>
            </div>
            <span className="verified">
              <Check size={14} /> Protegida
            </span>
          </div>
        </section>
        <section className="panel settings-card">
          <div>
            <span className="section-kicker">SISTEMA</span>
            <h3>Preferências do painel</h3>
          </div>
          <div className="setting-row">
            <div>
              <strong>Atualização de status</strong>
              <span>
                O dashboard considera o ESP32 online por até 150 segundos sem
                novo heartbeat.
              </span>
            </div>
            <span className="verified">
              <Wifi size={14} /> Automática
            </span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Modo de interface</strong>
              <span>
                Alternância disponível no ícone de lua da barra superior.
              </span>
            </div>
            <Moon size={17} className="muted" />
          </div>
        </section>
      </div>
    </>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const page = location === "/" ? "/dashboard" : location;
  const overview = trpc.app.overview.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });
  const content = useMemo(() => {
    if (page === "/feeding")
      return (
        <FeedingPage
          device={overview.data?.device}
          refetch={() => overview.refetch()}
        />
      );
    if (page === "/schedule")
      return (
        <SchedulePage data={overview.data} refetch={() => overview.refetch()} />
      );
    if (page === "/history") return <HistoryPage data={overview.data} />;
    if (page === "/device")
      return (
        <DevicePage data={overview.data} refetch={() => overview.refetch()} />
      );
    if (page === "/water")
      return (
        <WaterMonitoringPage
          data={overview.data}
          refresh={() => overview.refetch()}
        />
      );
    if (page === "/collaborators")
      return (
        <CollaboratorsPage
          data={overview.data}
          refetch={() => overview.refetch()}
        />
      );
    if (page === "/code") return <CodePage />;
    if (page === "/install") return <InstallPage />;
    if (page === "/about") return <AboutPage />;
    if (page === "/settings") return <SettingsPage user={user} />;
    return (
      <Dashboard
        data={overview.data}
        setPage={setLocation}
        refresh={() => overview.refetch()}
      />
    );
  }, [page, overview.data, user, setLocation]);
  if (loading)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Droplets size={20} />
        </div>
        <div className="loading-pulse" />
        <span>Carregando seu espaço…</span>
      </div>
    );
  if (!isAuthenticated) return <LoginScreen />;
  return (
    <AppShell
      page={page}
      setPage={setLocation}
      user={user}
      onLogout={() => logout()}
    >
      {overview.isLoading && !overview.data ? (
        <div className="content-loading">
          <RefreshCcw className="spin" size={22} />
          <span>Sincronizando seu comedouro…</span>
        </div>
      ) : (
        content
      )}
    </AppShell>
  );
}
