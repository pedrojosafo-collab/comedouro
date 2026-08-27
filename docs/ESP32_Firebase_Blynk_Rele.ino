/*
  COMEDOURO ESP32 - FIREBASE + BLYNK + RELE
  ------------------------------------------------
  Site:
    - envia comandos pelo Firebase
    - acompanha online/offline
    - cria e executa agendamentos
    - recebe confirmacao success/failed

  Blynk:
    V0 = botao "ALIMENTAR" (momentaneo/push)
    V1 = quantidade em gramas (10..500)
    V2 = botao "TESTAR RELE" (momentaneo/push, pulso de 1 segundo)
    V3 = status do ESP32 (1 online / 0 offline)
    V4 = RSSI do Wi-Fi
    V5 = ultima alimentacao (timestamp Unix)

  Relé:
    GPIO 32
    RELAY_ACTIVE_LOW = true para a maioria dos modulos de rele.
    Se o seu rele trabalhar invertido, troque para false.

  Wi-Fi:
    Na primeira inicializacao:
      SSID: COMEDOURO-ESP32
      Senha: 12345678
    Abra 192.168.4.1 e escolha o Wi-Fi.

  Arduino IDE - bibliotecas:
    - WiFiManager
    - ArduinoJson
    - Blynk
*/

#define BLYNK_TEMPLATE_ID "SEU_TEMPLATE_ID"
#define BLYNK_TEMPLATE_NAME "Comedouro ESP32"
#define BLYNK_AUTH_TOKEN "SEU_TOKEN_BLYNK"

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiManager.h>
#include <BlynkSimpleEsp32.h>
#include <time.h>
#include <math.h>

// ------------------------------------------------------------
// CONFIGURACAO
// ------------------------------------------------------------

#define FIREBASE_URL "https://comedouro-a8211-default-rtdb.firebaseio.com"
#define DEVICE_ID "esp32-001"

#define RELAY_PIN 32
#define LED_PIN 2
#define RELAY_ACTIVE_LOW true

// Calibracao inicial: 1000 ms de rele ligado ~= 10 g.
// Ajuste conforme a quantidade real liberada pelo seu mecanismo.
#define MOTOR_MS_PER_10G 1000
#define MOTOR_PAUSE_MS 250

#define MIN_GRAMS 10
#define MAX_GRAMS 500

#define COMMAND_POLL_MS 1200
#define SCHEDULE_POLL_MS 15000
#define HEARTBEAT_MS 15000
#define BLYNK_RECONNECT_MS 5000

// Pulso do botao de teste do rele no Blynk.
#define RELAY_TEST_MS 1000

const char* FIRMWARE = "4.0.0-FIREBASE-BLYNK-RELE";

// ------------------------------------------------------------
// ESTADO
// ------------------------------------------------------------

unsigned long lastCommandPoll = 0;
unsigned long lastSchedulePoll = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastBlynkReconnect = 0;

String lastScheduleKey = "";

bool feeding = false;

int activeGrams = 0;
int activeRepetitions = 1;
int activeRepetition = 0;
int activeCycle = 0;
int activeCycles = 0;

enum FeedSource {
  SOURCE_BLYNK,
  SOURCE_MANUAL,
  SOURCE_SCHEDULED
};

FeedSource activeSource = SOURCE_MANUAL;
String activeCommandId = "";
int blynkGrams = 50;

enum FeedPhase {
  FEED_IDLE,
  FEED_RELAY_ON,
  FEED_PAUSE
};

FeedPhase feedPhase = FEED_IDLE;
unsigned long feedPhaseStarted = 0;

bool relayTesting = false;
unsigned long relayTestStarted = 0;

long long lastFeedTimestamp = 0;

// ------------------------------------------------------------
// FIREBASE
// ------------------------------------------------------------

String firebaseUrl(const String& path) {
  return String(FIREBASE_URL) + "/devices/" + DEVICE_ID + path + ".json";
}

bool firebaseGet(const String& path, String& response) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.setTimeout(5000);

  if (!http.begin(firebaseUrl(path))) return false;

  int code = http.GET();
  response = (code > 0) ? http.getString() : "";
  http.end();

  return code >= 200 && code < 300;
}

bool firebasePut(const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.setTimeout(5000);

  if (!http.begin(firebaseUrl(path))) return false;
  http.addHeader("Content-Type", "application/json");

  int code = http.PUT(body);
  http.end();

  return code >= 200 && code < 300;
}

bool firebasePatch(const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.setTimeout(5000);

  if (!http.begin(firebaseUrl(path))) return false;
  http.addHeader("Content-Type", "application/json");

  int code = http.PATCH(body);
  http.end();

  return code >= 200 && code < 300;
}

long long nowMs() {
  time_t now;
  time(&now);

  if (now > 100000) return (long long)now * 1000LL;
  return (long long)millis();
}

// ------------------------------------------------------------
// WIFI + BLYNK
// ------------------------------------------------------------

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  WiFiManager wm;
  wm.setConfigPortalTimeout(300);

  Serial.println("[WIFI] Conectando...");
  bool ok = wm.autoConnect("COMEDOURO-ESP32", "12345678");

  if (!ok) {
    Serial.println("[WIFI] Falha. Reiniciando...");
    delay(2000);
    ESP.restart();
  }

  Serial.println("[WIFI] Conectado!");
  Serial.print("[WIFI] SSID: ");
  Serial.println(WiFi.SSID());
  Serial.print("[WIFI] IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("[WIFI] RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
}

void connectBlynk() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (Blynk.connected()) return;

  Serial.println("[BLYNK] Conectando...");
  Blynk.config(BLYNK_AUTH_TOKEN);

  if (Blynk.connect(5000)) {
    Serial.println("[BLYNK] Conectado!");
    Blynk.virtualWrite(V3, 1);
    Blynk.virtualWrite(V4, WiFi.RSSI());
    if (lastFeedTimestamp > 0) {
      Blynk.virtualWrite(V5, (long)lastFeedTimestamp / 1000L);
    }
  } else {
    Serial.println("[BLYNK] Nao conectou. Firebase continua funcionando.");
  }
}

void reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[WIFI] Conexao perdida. Reconectando...");
  WiFi.reconnect();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WIFI] Reconectado: ");
    Serial.println(WiFi.localIP());
  }
}

// ------------------------------------------------------------
// STATUS
// ------------------------------------------------------------

void sendHeartbeat() {
  StaticJsonDocument<384> doc;

  doc["status"] = "online";
  doc["lastSeen"] = nowMs();
  doc["wifi"] = WiFi.RSSI();
  doc["relay"] = feeding || relayTesting;
  doc["motor"] = "relay";
  doc["firmware"] = FIRMWARE;
  doc["ip"] = WiFi.localIP().toString();
  doc["ssid"] = WiFi.SSID();
  doc["deviceId"] = DEVICE_ID;
  doc["blynk"] = Blynk.connected() ? "online" : "offline";

  if (lastFeedTimestamp > 0) {
    doc["lastFeed"] = lastFeedTimestamp;
  }

  // PATCH e nao PUT: nao apaga lastFeed, foodLevel ou outros dados
  // que possam ser adicionados ao status pelo futuro hardware.
  String body;
  serializeJson(doc, body);

  if (firebasePatch("/status", body)) {
    Serial.println("[FIREBASE] Heartbeat enviado.");
  } else {
    Serial.println("[FIREBASE] Falha no heartbeat.");
  }

  if (Blynk.connected()) {
    Blynk.virtualWrite(V3, 1);
    Blynk.virtualWrite(V4, WiFi.RSSI());
    if (lastFeedTimestamp > 0) {
      Blynk.virtualWrite(V5, (long)(lastFeedTimestamp / 1000LL));
    }
  }
}

void saveHistory(int quantity, const char* type, bool success) {
  StaticJsonDocument<192> doc;

  doc["quantity"] = quantity;
  doc["type"] = type;
  doc["status"] = success ? "success" : "failed";
  doc["timestamp"] = nowMs();

  String body;
  serializeJson(doc, body);

  String id = String((unsigned long)millis()) + "-" + String(random(100, 999));
  firebasePut("/history/" + id, body);

  lastFeedTimestamp = nowMs();

  StaticJsonDocument<128> patch;
  patch["lastFeed"] = lastFeedTimestamp;
  patch["relay"] = false;

  String patchBody;
  serializeJson(patch, patchBody);
  firebasePatch("/status", patchBody);

  if (Blynk.connected()) {
    Blynk.virtualWrite(V5, (long)(lastFeedTimestamp / 1000LL));
  }
}

void setCommandStatus(const String& id, const char* status) {
  if (id.length() == 0) return;

  StaticJsonDocument<128> doc;
  doc["status"] = status;
  doc["processedAt"] = nowMs();

  String body;
  serializeJson(doc, body);

  firebasePatch("/commands/" + id, body);
}

// ------------------------------------------------------------
// RELE
// ------------------------------------------------------------

void relayOn() {
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? LOW : HIGH);
}

void relayOff() {
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
}

bool relayIsOn() {
  return digitalRead(RELAY_PIN) == (RELAY_ACTIVE_LOW ? LOW : HIGH);
}

int limitGrams(int grams) {
  return constrain(grams, MIN_GRAMS, MAX_GRAMS);
}

// ------------------------------------------------------------
// ALIMENTACAO NAO-BLOQUEANTE
// ------------------------------------------------------------

void startFeed(int grams, int repetitions, FeedSource source, const String& commandId = "") {
  if (feeding || relayTesting) {
    Serial.println("[RELE] Ocupado. Comando nao iniciado.");
    if (commandId.length() > 0) {
      setCommandStatus(commandId, "failed");
    }
    return;
  }

  activeGrams = limitGrams(grams);
  activeRepetitions = constrain(repetitions, 1, 10);
  activeRepetition = 0;
  activeCycles = max(1, (int)round(activeGrams / 10.0));
  activeCycle = 0;

  activeSource = source;
  activeCommandId = commandId;

  feeding = true;
  feedPhase = FEED_RELAY_ON;
  feedPhaseStarted = millis();

  digitalWrite(LED_PIN, HIGH);
  relayOn();

  Serial.print("[MOTOR] Inicio: ");
  Serial.print(activeGrams);
  Serial.print(" g | ");
  Serial.print(activeRepetitions);
  Serial.print(" repeticao(oes) | ");
  Serial.print(activeCycles);
  Serial.println(" ciclo(s)");
}

void startRelayTest(const String& commandId = "") {
  if (feeding || relayTesting) {
    if (commandId.length() > 0) setCommandStatus(commandId, "failed");
    return;
  }

  relayTesting = true;
  relayTestStarted = millis();
  relayOn();
  digitalWrite(LED_PIN, HIGH);
  Serial.println("[RELE] Teste iniciado.");

  // O comando do site e finalizado em updateRelayTest().
  if (commandId.length() > 0) {
    activeCommandId = commandId;
  } else {
    activeCommandId = "";
  }
}

void finishFeed(bool success) {
  relayOff();
  digitalWrite(LED_PIN, LOW);

  feeding = false;
  feedPhase = FEED_IDLE;

  const char* historyType =
      activeSource == SOURCE_SCHEDULED ? "scheduled" : "manual";

  saveHistory(activeGrams * activeRepetitions, historyType, success);

  if (activeCommandId.length() > 0) {
    setCommandStatus(activeCommandId, success ? "success" : "failed");
  }

  if (Blynk.connected()) {
    Blynk.virtualWrite(V3, 1);
  }

  Serial.println(success
      ? "[MOTOR] Alimentacao concluida."
      : "[MOTOR] Alimentacao falhou.");

  activeCommandId = "";
}

void updateFeed() {
  if (!feeding) return;

  unsigned long elapsed = millis() - feedPhaseStarted;

  if (feedPhase == FEED_RELAY_ON) {
    if (elapsed >= MOTOR_MS_PER_10G) {
      relayOff();
      feedPhase = FEED_PAUSE;
      feedPhaseStarted = millis();
      activeCycle++;

      Serial.print("[MOTOR] Ciclo ");
      Serial.print(activeCycle);
      Serial.print("/");
      Serial.println(activeCycles);
    }
    return;
  }

  if (feedPhase == FEED_PAUSE && elapsed >= MOTOR_PAUSE_MS) {
    if (activeCycle >= activeCycles) {
      activeRepetition++;

      if (activeRepetition >= activeRepetitions) {
        finishFeed(true);
        return;
      }

      activeCycle = 0;
      delay(50);
    }

    relayOn();
    feedPhase = FEED_RELAY_ON;
    feedPhaseStarted = millis();
  }
}

// ------------------------------------------------------------
// BLYNK
// ------------------------------------------------------------

BLYNK_CONNECTED() {
  Serial.println("[BLYNK] Sessao conectada.");
  Blynk.syncVirtual(V1);
  Blynk.virtualWrite(V3, 1);
  Blynk.virtualWrite(V4, WiFi.RSSI());
  if (lastFeedTimestamp > 0) {
    Blynk.virtualWrite(V5, (long)(lastFeedTimestamp / 1000LL));
  }
}

// V0: botao de alimentacao. Configure o widget como PUSH.
// V1: quantidade em gramas, 10..500.
BLYNK_WRITE(V0) {
  int pressed = param.asInt();

  if (pressed != 1) return;

  int grams = 50;
  if (Blynk.connected()) {
    // O valor atual de V1 fica armazenado no servidor do Blynk.
    // O callback de V1 atualiza blynkGrams abaixo.
  }

  if (blynkGrams < MIN_GRAMS || blynkGrams > MAX_GRAMS) blynkGrams = 50;

  if (!feeding && !relayTesting) {
    startFeed(blynkGrams, 1, SOURCE_BLYNK);
  } else {
    Serial.println("[BLYNK] Comando ignorado: rele ocupado.");
  }

  Blynk.virtualWrite(V0, 0);
}

BLYNK_WRITE(V1) {
  blynkGrams = limitGrams(param.asInt());
  Serial.print("[BLYNK] Quantidade: ");
  Serial.print(blynkGrams);
  Serial.println(" g");
}

// V2: teste rapido do rele. Configure o widget como PUSH.
BLYNK_WRITE(V2) {
  int pressed = param.asInt();

  if (pressed != 1) return;

  if (feeding) {
    Serial.println("[BLYNK] Teste de rele ignorado: alimentacao em andamento.");
    Blynk.virtualWrite(V2, 0);
    return;
  }

  relayTesting = true;
  relayTestStarted = millis();
  relayOn();

  Serial.println("[BLYNK] Teste do rele: LIGADO.");
  Blynk.virtualWrite(V2, 0);
}

void updateRelayTest() {
  if (!relayTesting) return;

  if (millis() - relayTestStarted >= RELAY_TEST_MS) {
    relayOff();
    relayTesting = false;
    digitalWrite(LED_PIN, LOW);

    if (activeCommandId.length() > 0) {
      setCommandStatus(activeCommandId, "success");
      activeCommandId = "";
    }

    Serial.println("[RELE] Teste concluido: DESLIGADO.");
  }
}

// ------------------------------------------------------------
// COMANDOS DO SITE
// ------------------------------------------------------------

void checkCommands() {
  if (feeding || relayTesting) return;

  String body;

  if (!firebaseGet("/commands", body)) return;
  if (body.length() < 3 || body == "null") return;

  DynamicJsonDocument doc(12288);
  if (deserializeJson(doc, body)) {
    Serial.println("[FIREBASE] Erro em commands.");
    return;
  }

  JsonObject commands = doc.as<JsonObject>();

  for (JsonPair item : commands) {
    String commandId = item.key().c_str();
    JsonObject command = item.value().as<JsonObject>();

    String type = command["type"] | "";
    String status = command["status"] | "";

    if (status != "pending") continue;

    if (type == "relay_test") {
      Serial.print("[COMANDO] Teste de rele recebido: ");
      Serial.println(commandId);
      setCommandStatus(commandId, "processing");
      startRelayTest(commandId);
      return;
    }

    if (type != "feed") continue;

    int quantity = limitGrams(command["quantity"] | 50);
    int repetitions = constrain(command["repetitions"] | 1, 1, 10);

    Serial.print("[COMANDO] Recebido do site: ");
    Serial.println(commandId);

    setCommandStatus(commandId, "processing");

    startFeed(quantity, repetitions, SOURCE_MANUAL, commandId);
    return;
  }
}

// ------------------------------------------------------------
// AGENDAMENTOS
// ------------------------------------------------------------

String dayKey() {
  struct tm info;

  if (!getLocalTime(&info, 1000)) return "";

  char buffer[16];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d", &info);
  return String(buffer);
}

String hourMinute() {
  struct tm info;

  if (!getLocalTime(&info, 1000)) return "";

  char buffer[8];
  strftime(buffer, sizeof(buffer), "%H:%M", &info);
  return String(buffer);
}

void checkSchedules() {
  if (feeding || relayTesting) return;

  String body;

  if (!firebaseGet("/schedules", body)) return;
  if (body.length() < 3 || body == "null") return;

  String today = dayKey();
  String currentTime = hourMinute();

  if (today == "" || currentTime == "") return;

  DynamicJsonDocument doc(8192);
  if (deserializeJson(doc, body)) return;

  JsonObject schedules = doc.as<JsonObject>();

  for (JsonPair item : schedules) {
    JsonObject schedule = item.value().as<JsonObject>();

    if (!(schedule["enabled"] | false)) continue;

    String scheduledTime = schedule["time"] | "";
    if (scheduledTime != currentTime) continue;

    String key = today + "|" + String(item.key().c_str());

    if (key == lastScheduleKey) continue;

    lastScheduleKey = key;

    int quantity = limitGrams(schedule["quantity"] | 50);
    int repetitions = constrain(schedule["repetitions"] | 1, 1, 10);

    Serial.println("[AGENDA] Executando horario.");

    startFeed(quantity, repetitions, SOURCE_SCHEDULED);
    return;
  }
}

// ------------------------------------------------------------
// SETUP
// ------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  pinMode(RELAY_PIN, OUTPUT);
  relayOff();

  randomSeed(analogRead(34));

  Serial.println();
  Serial.println("==============================================");
  Serial.println(" COMEDOURO ESP32 - FIREBASE + BLYNK + RELE");
  Serial.println("==============================================");

  connectWiFi();

  configTime(
    -3 * 3600,
    0,
    "pool.ntp.org",
    "time.nist.gov",
    "time.google.com"
  );

  // O Firebase funciona mesmo que o Blynk nao esteja configurado.
  connectBlynk();

  sendHeartbeat();

  Serial.println("[SISTEMA] Pronto.");
  Serial.print("[SISTEMA] Device ID: ");
  Serial.println(DEVICE_ID);
}

// ------------------------------------------------------------
// LOOP
// ------------------------------------------------------------

void loop() {
  reconnectWiFi();

  if (WiFi.status() != WL_CONNECTED) {
    relayOff();
    delay(100);
    return;
  }

  unsigned long now = millis();

  if (Blynk.connected()) {
    Blynk.run();
  } else if (now - lastBlynkReconnect >= BLYNK_RECONNECT_MS) {
    lastBlynkReconnect = now;
    connectBlynk();
  }

  updateFeed();
  updateRelayTest();

  if (now - lastCommandPoll >= COMMAND_POLL_MS) {
    lastCommandPoll = now;
    checkCommands();
  }

  if (now - lastSchedulePoll >= SCHEDULE_POLL_MS) {
    lastSchedulePoll = now;
    checkSchedules();
  }

  if (now - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // Garantia extra: se nenhum estado de acionamento estiver ativo,
  // o rele permanece desligado.
  if (!feeding && !relayTesting && relayIsOn()) {
    relayOff();
  }

  delay(5);
}
