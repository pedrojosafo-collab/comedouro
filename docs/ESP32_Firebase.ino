/*
  COMEDOURO ESP32 - COMUNICACAO REAL COM FIREBASE
  - Wi-Fi configurado pelo WiFiManager
  - Heartbeat no Firebase
  - Recebe comando "feed" pelo Firebase
  - Aciona rele/motor
  - Registra historico
  - Executa agendamentos
  - Nao possui servidor web local nem troca de Wi-Fi pelo painel

  Arduino IDE:
    WiFiManager
    ArduinoJson

  Placa:
    ESP32 Dev Module

  Primeiro uso:
    1. Grave o firmware.
    2. Abra o Monitor Serial em 115200.
    3. Conecte na rede COMEDOURO-ESP32 (senha 12345678).
    4. Abra 192.168.4.1 e escolha seu Wi-Fi.

  RELE:
    GPIO 13
    Se o rele funcionar ao contrario, troque RELAY_ACTIVE_LOW para false.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiManager.h>
#include <time.h>

#define FIREBASE_URL "https://comedouro-a8211-default-rtdb.firebaseio.com"
#define DEVICE_ID "esp32-001"

#define RELAY_PIN 13
#define LED_PIN 2
#define RELAY_ACTIVE_LOW true

// Ajuste para sua mecanica.
// 1000 ms = aproximadamente 10 g neste exemplo.
#define MOTOR_MS_PER_10G 1000
#define MOTOR_PAUSE_MS 250

#define MIN_GRAMS 10
#define MAX_GRAMS 500

#define COMMAND_POLL_MS 1500
#define SCHEDULE_POLL_MS 30000
#define HEARTBEAT_MS 15000

const char* FIRMWARE = "3.0.0-SIMPLES";

unsigned long lastCommandPoll = 0;
unsigned long lastSchedulePoll = 0;
unsigned long lastHeartbeat = 0;

String lastCommandId = "";
String lastScheduleKey = "";
bool feeding = false;

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
// WIFI
// ------------------------------------------------------------

void connectWiFi() {
  WiFi.mode(WIFI_STA);

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
  StaticJsonDocument<256> doc;

  doc["status"] = "online";
  doc["lastSeen"] = nowMs();
  doc["wifi"] = WiFi.RSSI();
  doc["relay"] = digitalRead(RELAY_PIN) == (RELAY_ACTIVE_LOW ? LOW : HIGH);
  doc["motor"] = "relay";
  doc["firmware"] = FIRMWARE;
  doc["ip"] = WiFi.localIP().toString();
  doc["deviceId"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  if (firebasePut("/status", body)) {
    Serial.println("[FIREBASE] Heartbeat enviado.");
  } else {
    Serial.println("[FIREBASE] Falha no heartbeat.");
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

  // ID simples e praticamente unico para este projeto.
  String id = String((unsigned long)millis()) + "-" + String(random(100, 999));
  firebasePut("/history/" + id, body);

  StaticJsonDocument<96> patch;
  patch["lastFeed"] = nowMs();
  patch["relay"] = false;

  String patchBody;
  serializeJson(patch, patchBody);
  firebasePatch("/status", patchBody);
}

void setCommandStatus(const String& id, const char* status) {
  StaticJsonDocument<128> doc;
  doc["status"] = status;
  doc["processedAt"] = nowMs();

  String body;
  serializeJson(doc, body);

  firebasePatch("/commands/" + id, body);
}

// ------------------------------------------------------------
// RELE / MOTOR
// ------------------------------------------------------------

void relayOn() {
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? LOW : HIGH);
}

void relayOff() {
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
}

int limitGrams(int grams) {
  return constrain(grams, MIN_GRAMS, MAX_GRAMS);
}

bool feed(int grams, int repetitions = 1) {
  if (feeding) return false;

  grams = limitGrams(grams);
  repetitions = constrain(repetitions, 1, 10);

  feeding = true;
  digitalWrite(LED_PIN, HIGH);

  int cycles = max(1, (int)round(grams / 10.0));

  Serial.print("[MOTOR] ");
  Serial.print(grams);
  Serial.print(" g | ");
  Serial.print(repetitions);
  Serial.println(" repeticao(oes)");

  for (int r = 0; r < repetitions; r++) {
    for (int c = 0; c < cycles; c++) {
      relayOn();
      delay(MOTOR_MS_PER_10G);
      relayOff();
      delay(MOTOR_PAUSE_MS);
    }

    relayOff();

    if (r + 1 < repetitions) {
      delay(300);
    }
  }

  relayOff();
  digitalWrite(LED_PIN, LOW);
  feeding = false;

  Serial.println("[MOTOR] Alimentacao concluida.");
  return true;
}

// ------------------------------------------------------------
// COMANDOS DO SITE
// ------------------------------------------------------------

void checkCommands() {
  String body;

  if (!firebaseGet("/commands", body)) return;
  if (body.length() < 3 || body == "null") return;

  DynamicJsonDocument doc(8192);
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
    if (commandId == lastCommandId) continue;

    if (type != "feed") continue;

    int quantity = limitGrams(command["quantity"] | 50);
    int repetitions = constrain(command["repetitions"] | 1, 1, 10);

    lastCommandId = commandId;

    Serial.print("[COMANDO] Recebido: ");
    Serial.println(commandId);

    setCommandStatus(commandId, "processing");

    bool success = feed(quantity, repetitions);

    saveHistory(quantity * repetitions, "manual", success);
    setCommandStatus(commandId, success ? "success" : "failed");

    sendHeartbeat();
    break;
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

    bool success = feed(quantity, repetitions);

    saveHistory(quantity * repetitions, "scheduled", success);
    sendHeartbeat();

    break;
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
  Serial.println("======================================");
  Serial.println(" COMEDOURO ESP32 - COMUNICACAO REAL");
  Serial.println("======================================");

  connectWiFi();

  configTime(
    -3 * 3600,
    0,
    "pool.ntp.org",
    "time.nist.gov",
    "time.google.com"
  );

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
    delay(500);
    return;
  }

  unsigned long now = millis();

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

  delay(20);
}
