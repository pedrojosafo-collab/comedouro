// Direção Casa Serena: painel assimétrico, acolhedor e preciso; ações físicas são claras, reversíveis e acompanhadas por telemetria.
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarClock,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  Droplets,
  History,
  MoreHorizontal,
  PawPrint,
  Radio,
  RefreshCw,
  Settings2,
  Signal,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_DEVICE_ID,
  FeedEvent,
  FeederStatus,
  Schedule,
  removeSchedule,
  saveSchedule,
  sendFeedCommand,
  sendRelayTestCommand,
  subscribeToDevice,
  subscribeToHistory,
  subscribeToSchedules,
  updateSchedule,
  waitForCommandResult,
} from "@/lib/firebase";

const formatDate = (timestamp: number | null) =>
  timestamp
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(timestamp)
    : "ainda não registrado";
const formatTime = (timestamp: number | null) =>
  timestamp
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(timestamp)
    : "--:--";

function Metric({
  label,
  value,
  unit,
  icon,
  tone = "sage",
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  tone?: "sage" | "terracotta" | "ink";
}) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>
          {value}
          <small>{unit}</small>
        </strong>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [deviceId, setDeviceId] = useState(
    () => localStorage.getItem("comedouro-device-id") || DEFAULT_DEVICE_ID,
  );
  const [deviceInput, setDeviceInput] = useState(deviceId);
  const [status, setStatus] = useState<FeederStatus>({
    status: "unknown",
    lastSeen: null,
    foodLevel: null,
    wifi: null,
    servo: null,
    relay: null,
    lastFeed: null,
    firmware: null,
    raw: {},
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [history, setHistory] = useState<FeedEvent[]>([]);
  const [quantity, setQuantity] = useState(50);
  const [time, setTime] = useState("08:00");
  const [scheduleQuantity, setScheduleQuantity] = useState(50);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubDevice = subscribeToDevice(deviceId, setStatus);
    const unsubSchedules = subscribeToSchedules(deviceId, setSchedules);
    const unsubHistory = subscribeToHistory(deviceId, setHistory);
    return () => {
      unsubDevice();
      unsubSchedules();
      unsubHistory();
    };
  }, [deviceId]);

  const online = status.status === "online";
  const foodLevel = status.foodLevel ?? 0;
  const nextSchedule = useMemo(
    () => schedules.find((schedule) => schedule.enabled),
    [schedules],
  );

  const changeDevice = () => {
    const next = deviceInput.trim() || DEFAULT_DEVICE_ID;
    localStorage.setItem("comedouro-device-id", next);
    setDeviceId(next);
    toast.success(`Dispositivo ${next} selecionado`);
  };

  const feedNow = async () => {
    if (!online) {
      toast.error("ESP32 offline", {
        description:
          "O comando não será enviado enquanto não houver heartbeat recente.",
      });
      return;
    }
    setSaving(true);
    try {
      const commandId = await sendFeedCommand(deviceId, quantity);
      const result = await waitForCommandResult(deviceId, commandId, 70_000);
      if (result === "success")
        toast.success(`${quantity} g executados pelo ESP32`, {
          description: "O dispositivo confirmou a execução do comando.",
        });
      else if (result === "failed")
        toast.error("O ESP32 recusou ou falhou na alimentação", {
          description:
            "O comando chegou ao dispositivo, mas foi marcado como falho.",
        });
      else
        toast.warning("Comando enviado, mas sem confirmação", {
          description:
            "O Firebase recebeu o comando, porém o ESP32 não confirmou a execução em 20 segundos.",
        });
    } catch {
      toast.error("Não foi possível enviar o comando", {
        description: "Verifique a conexão e as regras do Realtime Database.",
      });
    } finally {
      setSaving(false);
    }
  };

  const testRelay = async () => {
    if (!online) {
      toast.error("ESP32 offline", {
        description: "Conecte o ESP32 ao Wi-Fi antes de testar o relé.",
      });
      return;
    }
    setSaving(true);
    try {
      const commandId = await sendRelayTestCommand(deviceId);
      const result = await waitForCommandResult(deviceId, commandId, 10_000);
      if (result === "success") {
        toast.success("Relé acionado e desligado pelo ESP32");
      } else if (result === "failed") {
        toast.error("O teste do relé falhou");
      } else {
        toast.warning("Teste enviado, mas sem confirmação do ESP32");
      }
    } catch {
      toast.error("Não foi possível testar o relé");
    } finally {
      setSaving(false);
    }
  };

  const addSchedule = async () => {
    if (!time) return;
    try {
      await saveSchedule(deviceId, {
        time,
        quantity: scheduleQuantity,
        repetitions: 1,
        enabled: true,
      });
      toast.success("Agendamento salvo no Firebase");
    } catch {
      toast.error("Falha ao salvar agendamento");
    }
  };

  const toggleSchedule = async (schedule: Schedule) => {
    try {
      await updateSchedule(deviceId, schedule.id, {
        enabled: !schedule.enabled,
      });
    } catch {
      toast.error("Falha ao atualizar agendamento");
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      await removeSchedule(deviceId, id);
      toast.success("Agendamento removido");
    } catch {
      toast.error("Falha ao remover agendamento");
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <PawPrint size={21} strokeWidth={2.5} />
          </div>
          <span>comedouro</span>
        </div>
        <div className="sidebar-rule" />
        <nav>
          <a className="nav-item active">
            <Activity size={18} /> Visão geral
          </a>
          <a className="nav-item"></a>
          <a className="nav-item"></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-link">
            <CircleHelp size={17} />
            <span>Ajuda rápida</span>
          </div>
          <div className="device-mini">
            <div className={`status-dot ${online ? "online" : "offline"}`} />
            <div>
              <small>DISPOSITIVO</small>
              <strong>{deviceId}</strong>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow"></p>
            <h1>Bom dia, seu pet está bem cuidado.</h1>
          </div>
          <div className="top-actions">
            <Badge
              className={`connection-badge ${online ? "connected" : "disconnected"}`}
            >
              <span className="status-dot" />{" "}
              {online ? "ESP32 online" : "Aguardando ESP32"}
            </Badge>
            <Button variant="ghost" size="icon" className="avatar">
              <span>MC</span>
            </Button>
          </div>
        </header>

        <section className="hero-panel">
          <div className="hero-copy">
            <span className="section-kicker">
              <Zap size={14} /> CUIDADO EM TEMPO REAL
            </span>
            <h2>
              Uma rotina simples,
              <br />
              <em>um cuidado constante.</em>
            </h2>
            <p>
              Controle porções, acompanhe o estoque e deixe o ESP32 cuidar do
              próximo momento.
            </p>
            <div className="hero-meta">
              <div>
                <small>Próxima refeição</small>
                <strong>{nextSchedule?.time || "--:--"}</strong>
              </div>
              <div className="meta-divider" />
              <div>
                <small>Última porção</small>
                <strong>{formatTime(status.lastFeed)}</strong>
              </div>
            </div>
          </div>
          <div className="hero-art">
            <img
              src="imagem.png"
              alt="Comedouro automático em uma mesa clara"
            />
            <div className="art-note">
              <span className="pulse" />{" "}
              {online ? "sincronizado agora" : "sem sinal recente"}
            </div>
          </div>
        </section>

        <div className="content-grid">
          <section className="primary-column">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LEITURA DO DISPOSITIVO</p>
                <h3>Como está o comedouro</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={15} /> Atualizar
              </Button>
            </div>
            <div className="metrics-grid">
              <div className="metric metric-stock">
                <div className="stock-ruler">
                  <span
                    className="stock-fill"
                    style={{
                      height: `${Math.min(100, Math.max(0, foodLevel))}%`,
                    }}
                  />
                  <i />
                  <i />
                  <i />
                </div>
                <div>
                  <p>Estoque estimado</p>
                  <strong>
                    {status.foodLevel === null ? "--" : foodLevel}
                    <small>{status.foodLevel === null ? "" : "%"}</small>
                  </strong>
                  <span className="metric-sub">
                    {status.foodLevel === null
                      ? "aguardando leitura"
                      : foodLevel < 20
                        ? "repor em breve"
                        : "nível seguro"}
                  </span>
                </div>
              </div>
              <Metric
                label="Sinal Wi-Fi"
                value={status.wifi === null ? "--" : String(status.wifi)}
                unit={status.wifi === null ? "" : " dBm"}
                icon={<Signal size={18} />}
              />
              <Metric
                label="Última alimentação"
                value={formatTime(status.lastFeed)}
                icon={<Clock3 size={18} />}
                tone="ink"
              />
            </div>

            <Card className="feed-card">
              <CardHeader>
                <div>
                  <p className="eyebrow">AÇÃO MANUAL</p>
                  <CardTitle>Servir uma porção agora</CardTitle>
                </div>
                <div className="card-icon terracotta">
                  <PawPrint size={19} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="feed-control">
                  <div className="quantity-input">
                    <Input
                      type="number"
                      min={10}
                      max={500}
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(Math.max(10, Number(event.target.value)))
                      }
                    />
                    <span>gramas</span>
                  </div>
                  <Button
                    className="feed-button"
                    onClick={feedNow}
                    disabled={saving}
                  >
                    <Zap size={17} />{" "}
                    {saving ? "Enviando…" : `Liberar ${quantity} g`}
                    <ChevronRight size={17} />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={testRelay}
                    disabled={saving}
                  >
                    Testar relé
                  </Button>
                </div>
                <p className="form-hint">
                  <Radio size={14} /> O comando será entregue ao ESP32 pelo
                  caminho <code>devices/{deviceId}/commands</code>.
                </p>
              </CardContent>
            </Card>

            <div className="section-heading schedule-heading">
              <div>
                <p className="eyebrow">ROTINA PROGRAMADA</p>
                <h3>Próximos horários</h3>
              </div>
            </div>
            <Card className="schedule-card">
              <CardContent>
                <div className="new-schedule">
                  <div>
                    <label>Horário</label>
                    <Input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </div>
                  <div>
                    <label>Porção</label>
                    <div className="unit-input">
                      <Input
                        type="number"
                        min={10}
                        max={500}
                        value={scheduleQuantity}
                        onChange={(event) =>
                          setScheduleQuantity(Number(event.target.value))
                        }
                      />
                      <span>g</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="add-button"
                    onClick={addSchedule}
                  >
                    Adicionar horário <ChevronRight size={15} />
                  </Button>
                </div>
                {schedules.length === 0 ? (
                  <EmptyState
                    icon={<CalendarClock size={21} />}
                    title="Nenhum horário programado"
                    text="Adicione uma rotina e o ESP32 fará o resto."
                  />
                ) : (
                  <div className="schedule-list">
                    {schedules.map((schedule) => (
                      <div className="schedule-row" key={schedule.id}>
                        <div className="schedule-time">
                          <strong>{schedule.time}</strong>
                          <span>
                            {schedule.quantity} g ·{" "}
                            {schedule.enabled ? "ativo" : "pausado"}
                          </span>
                        </div>
                        <Switch
                          checked={schedule.enabled}
                          onCheckedChange={() => toggleSchedule(schedule)}
                          aria-label={`Ativar horário ${schedule.time}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSchedule(schedule.id)}
                          aria-label="Remover horário"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <aside className="secondary-column">
            <Card className="connection-card">
              <CardHeader>
                <CardTitle>
                  <span
                    className={`status-orb ${online ? "online" : "offline"}`}
                  >
                    <Cpu size={19} />
                  </span>
                  <span>Conexão do dispositivo</span>
                </CardTitle>
                <Badge
                  variant="outline"
                  className={online ? "badge-online" : "badge-offline"}
                >
                  <span className="seal-pulse" />
                  {online ? "ONLINE" : "OFFLINE"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div
                  className={`connection-timeline ${online ? "online" : "offline"}`}
                >
                  <span className="timeline-line" />
                  <span className="timeline-dot" />
                  <div>
                    <strong>
                      {online ? "Sinal recebido" : "Nenhum sinal recente"}
                    </strong>
                    <small>
                      {online
                        ? "o ESP32 está pronto para receber comandos"
                        : "o painel continua pronto; verifique energia e Wi-Fi"}
                    </small>
                  </div>
                </div>
                <div className="connection-line">
                  <span>Última comunicação</span>
                  <strong>{formatDate(status.lastSeen)}</strong>
                </div>
                <div className="connection-line">
                  <span>Firmware</span>
                  <strong>{status.firmware || "não informado"}</strong>
                </div>
                <div className="connection-line">
                  <span>Atuador relé</span>
                  <strong>{status.relay === true ? "ligado" : "desligado"}</strong>
                </div>
                <div className="device-id-field">
                  <label>ID do dispositivo</label>
                  <div>
                    <Input
                      value={deviceInput}
                      onChange={(event) => setDeviceInput(event.target.value)}
                    />
                    <Button
                      size="icon"
                      onClick={changeDevice}
                      aria-label="Salvar dispositivo"
                    >
                      <Check size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="history-card">
              <CardHeader>
                <CardTitle>Últimas porções</CardTitle>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal size={18} />
                </Button>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <EmptyState
                    icon={<History size={20} />}
                    title="Histórico vazio"
                    text="As próximas alimentações aparecerão aqui."
                  />
                ) : (
                  <div className="history-list">
                    {history.slice(0, 5).map((event) => (
                      <div className="history-row" key={event.id}>
                        <div
                          className={`history-mark ${event.status === "failed" ? "failed" : ""}`}
                        >
                          <PawPrint size={14} />
                        </div>
                        <div>
                          <strong>
                            {event.quantity} g ·{" "}
                            {event.type === "scheduled" ? "Agendado" : "Manual"}
                          </strong>
                          <span>{formatDate(event.timestamp)}</span>
                        </div>
                        <span className={`event-status ${event.status}`}>
                          {event.status === "success"
                            ? "Concluído"
                            : event.status === "failed"
                              ? "Falhou"
                              : "Pendente"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="support-note">
              <Settings2 size={17} />
              <div>
                <strong>Precisa ajustar o ESP32?</strong>
                <p>
                  Use o mesmo ID no firmware e neste painel para manter os
                  comandos no dispositivo certo.
                </p>
              </div>
            </div>
          </aside>
        </div>
        <footer className="footer">
          <span>Firebase Realtime Database</span>
          <span className="footer-separator">·</span>
          <span>Atualização automática</span>
          <span className="footer-spacer" />
          <span>
            <WifiOff size={14} /> Regras de segurança devem ser configuradas no
            Firebase
          </span>
        </footer>
      </main>
    </div>
  );
}
