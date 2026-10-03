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

const esp32Code = `#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <WiFiManager.h>

// ============================================================
// CONFIGURAÇÕES DO FIREBASE
// ============================================================

#define FIREBASE_URL    "https://comedouro-a8211-default-rtdb.firebaseio.com"
#define FIREBASE_SECRET "6hJNKGBnBFz6d6NHT43eXA5RwijgBc8IrIX5g3il"

// ============================================================
// ID DO DISPOSITIVO
// ============================================================

#define FIREBASE_DEVICE_ID "4"
#define DEVICE_ID "comedouro_001"

// ============================================================
// RELÉ
// ============================================================

#define FEED_PIN 32

// true = relé ativa com LOW
// false = relé ativa com HIGH
#define RELAY_ACTIVE_LOW true

// Tempo do motor ligado para UMA porção
#define FEED_TIME_MS 1000

// Intervalo entre porções
#define PORTION_INTERVAL_MS 1000

// ============================================================
// INTERVALOS
// ============================================================

#define HEARTBEAT_INTERVAL 10000
#define COMMAND_INTERVAL   2000
#define SCHEDULE_INTERVAL  3000

// Timeout das requisições Firebase
#define FIREBASE_TIMEOUT 3000

// ============================================================
// VARIÁVEIS
// ============================================================

unsigned long lastHeartbeat = 0;
unsigned long lastCommandCheck = 0;
unsigned long lastScheduleCheck = 0;

String lastCommandId = "";
String lastScheduleExecution = "";

WiFiClientSecure client;

// ============================================================
// CAMINHO DO DISPOSITIVO
// ============================================================

String devicePath() {
  return String(FIREBASE_URL) +
         "/devices/" +
         FIREBASE_DEVICE_ID;
}

// ============================================================
// RELÉ - LIGA
// ============================================================

void relayOn() {

  if (RELAY_ACTIVE_LOW) {
    digitalWrite(FEED_PIN, LOW);
  } else {
    digitalWrite(FEED_PIN, HIGH);
  }

  Serial.println("[Relé] LIGADO");
}

// ============================================================
// RELÉ - DESLIGA
// ============================================================

void relayOff() {

  if (RELAY_ACTIVE_LOW) {
    digitalWrite(FEED_PIN, HIGH);
  } else {
    digitalWrite(FEED_PIN, LOW);
  }

  Serial.println("[Relé] DESLIGADO");
}

// ============================================================
// FIREBASE - PUT
// ============================================================

bool firebasePut(String path, String json) {

  HTTPClient http;

  String url =
    devicePath() +
    path +
    ".json?auth=" +
    FIREBASE_SECRET;

  Serial.println();
  Serial.println("[Firebase PUT]");
  Serial.println(url);
  Serial.println(json);

  http.begin(client, url);
  http.setTimeout(FIREBASE_TIMEOUT);

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  int httpCode = http.PUT(json);

  Serial.print("HTTP: ");
  Serial.println(httpCode);

  String response = http.getString();

  if (response.length() > 0) {
    Serial.print("Resposta: ");
    Serial.println(response);
  }

  http.end();

  return httpCode >= 200 && httpCode < 300;
}

// ============================================================
// FIREBASE - GET
// ============================================================

String firebaseGet(String path) {

  HTTPClient http;

  String url =
    devicePath() +
    path +
    ".json?auth=" +
    FIREBASE_SECRET;

  Serial.println();
  Serial.println("[Firebase GET]");
  Serial.println(url);

  http.begin(client, url);
  http.setTimeout(FIREBASE_TIMEOUT);

  int httpCode = http.GET();

  Serial.print("HTTP: ");
  Serial.println(httpCode);

  String response = http.getString();

  if (response.length() > 0) {
    Serial.print("Resposta: ");
    Serial.println(response);
  }

  http.end();

  if (httpCode >= 200 && httpCode < 300) {
    return response;
  }

  return "";
}

// ============================================================
// FIREBASE - DELETE
// ============================================================

bool firebaseDelete(String path) {

  HTTPClient http;

  String url =
    devicePath() +
    path +
    ".json?auth=" +
    FIREBASE_SECRET;

  Serial.println();
  Serial.println("[Firebase DELETE]");
  Serial.println(url);

  http.begin(client, url);
  http.setTimeout(FIREBASE_TIMEOUT);

  int httpCode =
    http.sendRequest("DELETE");

  Serial.print("HTTP: ");
  Serial.println(httpCode);

  String response = http.getString();

  if (response.length() > 0) {
    Serial.println(response);
  }

  http.end();

  return httpCode >= 200 && httpCode < 300;
}

// ============================================================
// HEARTBEAT
// ============================================================

void sendHeartbeat() {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println(
      "[Heartbeat] Wi-Fi desconectado."
    );

    return;
  }

  time_t now = time(nullptr);

  long long timestamp =
    (long long)now * 1000LL;

  String json = "{";

  json += "\"status\":\"online\",";
  json += "\"lastSeen\":" +
          String(timestamp) +
          ",";
  json += "\"wifi\":" +
          String(WiFi.RSSI());

  json += "}";

  HTTPClient http;

  String url =
    devicePath() +
    ".json?auth=" +
    FIREBASE_SECRET;

  Serial.println();
  Serial.println(
    "[Firebase PATCH - Heartbeat]"
  );

  Serial.println(url);
  Serial.println(json);

  http.begin(client, url);
  http.setTimeout(FIREBASE_TIMEOUT);

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  int httpCode =
    http.sendRequest("PATCH", json);

  Serial.print("HTTP: ");
  Serial.println(httpCode);

  String response =
    http.getString();

  if (response.length() > 0) {

    Serial.print("Resposta: ");
    Serial.println(response);
  }

  http.end();

  if (httpCode >= 200 && httpCode < 300) {

    Serial.println(
      "[Heartbeat] Firebase atualizado."
    );

  } else {

    Serial.println(
      "[Heartbeat] ERRO no Firebase."
    );
  }
}

// ============================================================
// REGISTRA ALIMENTAÇÃO
// ============================================================

void registerFeeding(
  String type,
  int quantity,
  String commandId
) {

  time_t now = time(nullptr);

  long long timestamp =
    (long long)now * 1000LL;

  // ==========================================================
  // ÚLTIMA ALIMENTAÇÃO
  // ==========================================================

  bool lastFeedingOK =
    firebasePut(
      "/lastFeeding",
      String(timestamp)
    );

  if (lastFeedingOK) {

    Serial.println(
      "[Feeding] lastFeeding salvo com sucesso."
    );

  } else {

    Serial.println(
      "[Feeding] ERRO ao salvar lastFeeding."
    );
  }

  // ==========================================================
  // HISTÓRICO
  // ==========================================================

  String historyId =
    String(timestamp) +
    "_" +
    String(millis());

  String historyJson = "{";

  historyJson += "\"createdAt\":" +
                 String(timestamp) +
                 ",";

  historyJson += "\"timestamp\":" +
                 String(timestamp) +
                 ",";

  historyJson += "\"type\":\"" +
                 type +
                 "\",";

  historyJson += "\"quantity\":" +
                 String(quantity) +
                 ",";

  historyJson += "\"deviceId\":\"" +
                 String(DEVICE_ID) +
                 "\",";

  historyJson += "\"commandId\":\"" +
                 commandId +
                 "\",";

  historyJson += "\"status\":\"success\"";

  historyJson += "}";

  bool historyOK =
    firebasePut(
      "/history/" + historyId,
      historyJson
    );

  if (historyOK) {

    Serial.println(
      "[Feeding] Histórico salvo com sucesso."
    );

  } else {

    Serial.println(
      "[Feeding] ERRO ao salvar histórico."
    );
  }

  // ==========================================================
  // ÚLTIMO EVENTO
  // ==========================================================

  firebasePut(
    "/lastEvent",
    "\"feeding\""
  );

  // ==========================================================
  // ÚLTIMO COMANDO
  // ==========================================================

  firebasePut(
    "/lastCommandId",
    "\"" + commandId + "\""
  );

  Serial.println();
  Serial.println(
    "[Feeding] Alimentação registrada."
  );
}

// ============================================================
// EXECUTA ALIMENTAÇÃO
// ============================================================

void feedFish(
  String type,
  int quantity,
  String commandId
) {

  if (quantity < 1) {
    quantity = 1;
  }

  Serial.println();
  Serial.println("==============================");
  Serial.println("    ALIMENTAÇÃO INICIADA");
  Serial.println("==============================");

  Serial.print("Tipo: ");
  Serial.println(type);

  Serial.print("Porções: ");
  Serial.println(quantity);

  Serial.print("Command ID: ");
  Serial.println(commandId);

  // ==========================================================
  // CADA PORÇÃO = UMA ATIVAÇÃO DO MOTOR
  // ==========================================================

  for (int i = 1; i <= quantity; i++) {

    Serial.println();
    Serial.print("[Porção ");
    Serial.print(i);
    Serial.print(" de ");
    Serial.print(quantity);
    Serial.println("]");

    relayOn();

    delay(FEED_TIME_MS);

    relayOff();

    Serial.print("[Porção ");
    Serial.print(i);
    Serial.println("] liberada.");

    if (i < quantity) {

      Serial.print("Aguardando ");
      Serial.print(PORTION_INTERVAL_MS);
      Serial.println(" ms...");

      delay(PORTION_INTERVAL_MS);
    }
  }

  Serial.println();
  Serial.println(
    "Todas as porções foram liberadas."
  );

  registerFeeding(
    type,
    quantity,
    commandId
  );

  Serial.println("==============================");
  Serial.println("    ALIMENTAÇÃO CONCLUÍDA");
  Serial.println("==============================");
}

// ============================================================
// VERIFICA COMANDO MANUAL DO SITE
// ============================================================

void checkCommand() {

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  String response =
    firebaseGet("/command");

  if (
    response.length() == 0 ||
    response == "null"
  ) {
    return;
  }

  StaticJsonDocument<1024> doc;

  DeserializationError error =
    deserializeJson(
      doc,
      response
    );

  if (error) {

    Serial.print(
      "[Command] Erro JSON: "
    );

    Serial.println(
      error.c_str()
    );

    return;
  }

  bool feed =
    doc["feed"] | false;

  if (!feed) {
    return;
  }

  String commandId =
    doc["requestId"] | "";

  String type =
    doc["type"] | "manual";

  int quantity =
    doc["quantity"] | 1;

  if (commandId.length() == 0) {

    Serial.println(
      "[Command] Sem requestId."
    );

    return;
  }

  // ==========================================================
  // EVITA EXECUTAR O MESMO COMANDO
  // ==========================================================

  if (commandId == lastCommandId) {

    Serial.println(
      "[Command] Comando já executado."
    );

    firebaseDelete("/command");

    return;
  }

  Serial.println();
  Serial.println(
    "[Command] NOVO COMANDO RECEBIDO!"
  );

  // ==========================================================
  // EXECUTA
  // ==========================================================

  feedFish(
    type,
    quantity,
    commandId
  );

  // ==========================================================
  // GUARDA ID
  // ==========================================================

  lastCommandId = commandId;

  // ==========================================================
  // REMOVE COMANDO DO FIREBASE
  // ==========================================================

  firebaseDelete("/command");

  Serial.println(
    "[Command] Comando removido."
  );
}

// ============================================================
// DATA/HORA ATUAL
// ============================================================

String currentDateTimeKey() {

  struct tm timeinfo;

  if (!getLocalTime(&timeinfo, 1000)) {
    return "";
  }

  char buffer[32];

  strftime(
    buffer,
    sizeof(buffer),
    "%Y-%m-%d %H:%M",
    &timeinfo
  );

  return String(buffer);
}

// ============================================================
// VERIFICA AGENDAMENTOS
// ============================================================

void checkSchedules() {

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  String response =
    firebaseGet("/schedules");

  if (
    response.length() == 0 ||
    response == "null"
  ) {
    return;
  }

  StaticJsonDocument<4096> doc;

  DeserializationError error =
    deserializeJson(
      doc,
      response
    );

  if (error) {

    Serial.print(
      "[Schedule] Erro JSON: "
    );

    Serial.println(
      error.c_str()
    );

    return;
  }

  struct tm timeinfo;

  if (!getLocalTime(&timeinfo, 1000)) {

    Serial.println(
      "[Schedule] Horário ainda não disponível."
    );

    return;
  }

  int currentHour =
    timeinfo.tm_hour;

  int currentMinute =
    timeinfo.tm_min;

  String today =
    currentDateTimeKey();

  if (today.length() == 0) {
    return;
  }

  Serial.print(
    "[Schedule] Horário atual: "
  );

  Serial.println(today);

  // ==========================================================
  // PERCORRE OS AGENDAMENTOS
  // ==========================================================

  for (
    JsonPair item : doc.as<JsonObject>()
  ) {

    const char *scheduleId =
      item.key().c_str();

    JsonObject schedule =
      item.value().as<JsonObject>();

    bool active =
      schedule["active"] | false;

    if (!active) {
      continue;
    }

    int hour =
      schedule["hour"] | -1;

    int minute =
      schedule["minute"] | -1;

    int quantity =
      schedule["quantity"] | 1;

    if (
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      continue;
    }

    // ========================================================
    // VERIFICA HORÁRIO
    // ========================================================

    if (
      hour != currentHour ||
      minute != currentMinute
    ) {
      continue;
    }

    // ========================================================
    // EVITA REPETIR NO MESMO MINUTO
    // ========================================================

    String executionKey =
      String(scheduleId) +
      "|" +
      today;

    if (
      executionKey ==
      lastScheduleExecution
    ) {
      continue;
    }

    lastScheduleExecution =
      executionKey;

    // ========================================================
    // ID DO COMANDO
    // ========================================================

    String commandId =
      "schedule-" +
      String(scheduleId) +
      "-" +
      String(time(nullptr));

    // ========================================================
    // LOG
    // ========================================================

    Serial.println();
    Serial.println(
      "=============================="
    );

    Serial.println(
      "[Schedule] AGENDAMENTO ENCONTRADO"
    );

    Serial.print("ID: ");
    Serial.println(scheduleId);

    Serial.print("Horário: ");

    if (hour < 10) {
      Serial.print("0");
    }

    Serial.print(hour);

    Serial.print(":");

    if (minute < 10) {
      Serial.print("0");
    }

    Serial.println(minute);

    Serial.print("Quantidade: ");
    Serial.println(quantity);

    Serial.println(
      "=============================="
    );

    // ========================================================
    // EXECUTA ALIMENTAÇÃO AUTOMÁTICA
    // ========================================================

    feedFish(
      "automatic",
      quantity,
      commandId
    );

    // ========================================================
    // UM AGENDAMENTO POR CICLO
    // ========================================================

    break;
  }
}

// ============================================================
// CONFIGURAÇÃO DO WI-FI
// ============================================================

void connectWiFi() {

  Serial.println();
  Serial.println("==============================");
  Serial.println("      CONFIGURAÇÃO WI-FI");
  Serial.println("==============================");

  WiFi.mode(WIFI_STA);

  WiFiManager wm;

  wm.setConfigPortalTimeout(180);

  Serial.println(
    "Tentando conectar ao Wi-Fi salvo..."
  );

  bool conectado =
    wm.autoConnect("wifi-Comedouro");

  // ==========================================================
  // FALHOU
  // ==========================================================

  if (!conectado) {

    Serial.println();

    Serial.println(
      "Não foi possível conectar."
    );

    Serial.println(
      "Reiniciando ESP32..."
    );

    delay(3000);

    ESP.restart();

    return;
  }

  // ==========================================================
  // CONECTADO
  // ==========================================================

  Serial.println();

  Serial.println("==============================");
  Serial.println("      WI-FI CONECTADO!");
  Serial.println("==============================");

  Serial.print("IP: ");
  Serial.println(
    WiFi.localIP()
  );

  Serial.print("RSSI: ");
  Serial.println(
    WiFi.RSSI()
  );
}

// ============================================================
// CONFIGURAÇÃO DO HORÁRIO
// ============================================================

void setupTime() {

  configTime(
    -3 * 3600,
    0,
    "pool.ntp.org",
    "time.nist.gov"
  );

  Serial.println(
    "Sincronizando horário..."
  );

  time_t now =
    time(nullptr);

  int attempts = 0;

  while (
    now < 100000 &&
    attempts < 30
  ) {

    delay(500);

    Serial.print(".");

    now =
      time(nullptr);

    attempts++;
  }

  Serial.println();

  if (now >= 100000) {

    Serial.println(
      "Horário sincronizado."
    );

    struct tm timeinfo;

    if (
      getLocalTime(
        &timeinfo,
        1000
      )
    ) {

      Serial.print(
        "Hora atual: "
      );

      Serial.printf(
        "%02d:%02d:%02d\n",
        timeinfo.tm_hour,
        timeinfo.tm_min,
        timeinfo.tm_sec
      );
    }

  } else {

    Serial.println(
      "Não foi possível sincronizar horário."
    );
  }
}

// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("=================================");
  Serial.println("        COMEDOURO ESP32");
  Serial.println("=================================");

  Serial.print(
    "Device ID: "
  );

  Serial.println(
    DEVICE_ID
  );

  // ==========================================================
  // RELÉ
  // ==========================================================

  pinMode(
    FEED_PIN,
    OUTPUT
  );

  // Garante relé desligado
  relayOff();

  // ==========================================================
  // HTTPS
  // ==========================================================

  client.setInsecure();

  // ==========================================================
  // WI-FI
  // ==========================================================

  connectWiFi();

  // ==========================================================
  // HORÁRIO
  // ==========================================================

  setupTime();

  // ==========================================================
  // PRIMEIRO HEARTBEAT
  // ==========================================================

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {

    sendHeartbeat();
  }

  Serial.println();
  Serial.println("=================================");
  Serial.println("      SISTEMA PRONTO");
  Serial.println("=================================");
}

// ============================================================
// LOOP
// ============================================================

void loop() {

  // ==========================================================
  // VERIFICA WI-FI
  // ==========================================================

  if (
    WiFi.status() !=
    WL_CONNECTED
  ) {

    Serial.println(
      "[Wi-Fi] Conexão perdida."
    );

    relayOff();

    connectWiFi();

    delay(1000);

    return;
  }

  unsigned long now =
    millis();

  // ==========================================================
  // HEARTBEAT
  // ==========================================================

  if (
    now - lastHeartbeat >=
    HEARTBEAT_INTERVAL
  ) {

    lastHeartbeat =
      now;

    sendHeartbeat();
  }

  // ==========================================================
  // AGENDAMENTOS
  // ==========================================================

  if (
    now - lastScheduleCheck >=
    SCHEDULE_INTERVAL
  ) {

    lastScheduleCheck =
      now;

    checkSchedules();
  }

  // ==========================================================
  // COMANDO MANUAL
  // ==========================================================

  if (
    now - lastCommandCheck >=
    COMMAND_INTERVAL
  ) {

    lastCommandCheck =
      now;

    checkCommand();
  }

  // ==========================================================
  // PEQUENA PAUSA
  // ==========================================================

  delay(50);
}`;
const water_esp32Code = `
// MONITORAMENTO DE AGUA

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <WiFiManager.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ============================================================
// CONFIGURAÇÕES DO FIREBASE
// ============================================================

#define FIREBASE_URL    "https://comedouro-a8211-default-rtdb.firebaseio.com"
#define FIREBASE_SECRET "..."

// ============================================================
// IDENTIFICAÇÃO DO ESP32
// ============================================================

// ID NUMÉRICO cadastrado no site/Firebase
// Exemplo: devices/5
#define FIREBASE_DEVICE_ID "..."

// ID físico do ESP32
#define DEVICE_ID "..."

// ============================================================
// TIPO DO DISPOSITIVO
// ============================================================

#define DEVICE_TYPE "water-monitor"

// ============================================================
// PINOS DOS SENSORES
// ============================================================

// DS18B20 - temperatura
#define TEMP_PIN 32

// TDS / Condutividade
#define TDS_PIN 34

// Turbidez
#define TURBIDITY_PIN 33

// pH
#define PH_PIN 36

// ============================================================
// OBJETO DO DS18B20
// ============================================================

OneWire oneWire(TEMP_PIN);
DallasTemperature temperatureSensor(&oneWire);

// ============================================================
// INTERVALO DE ENVIO
// ============================================================

#define SENSOR_INTERVAL 5000
#define HEARTBEAT_INTERVAL 10000

// ============================================================
// VARIÁVEIS
// ============================================================

unsigned long lastSensorUpdate = 0;
unsigned long lastHeartbeat = 0;

WiFiClientSecure client;

// ============================================================
// URL DO DISPOSITIVO
// ============================================================

String devicePath() {

  return String(FIREBASE_URL) +
         "/devices/" +
         FIREBASE_DEVICE_ID;
}

// ============================================================
// FIREBASE - PATCH
// ============================================================

bool firebasePatch(String path, String json) {

  HTTPClient http;

  String url =
    devicePath() +
    path +
    ".json?auth=" +
    FIREBASE_SECRET;

  Serial.println();
  Serial.println("[Firebase PATCH]");
  Serial.println(url);
  Serial.println(json);

  http.begin(client, url);

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  int httpCode =
    http.sendRequest(
      "PATCH",
      json
    );

  Serial.print("HTTP: ");
  Serial.println(httpCode);

  String response =
    http.getString();

  if (response.length() > 0) {

    Serial.print("Resposta: ");
    Serial.println(response);
  }

  http.end();

  return httpCode >= 200 &&
         httpCode < 300;
}

// ============================================================
// FIREBASE - PUT
// ============================================================

bool firebasePut(String path, String json) {

  HTTPClient http;

  String url =
    devicePath() +
    path +
    ".json?auth=" +
    FIREBASE_SECRET;

  Serial.println();
  Serial.println("[Firebase PUT]");
  Serial.println(url);
  Serial.println(json);

  http.begin(client, url);

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  int httpCode =
    http.PUT(json);

  Serial.print("HTTP: ");
  Serial.println(httpCode);

  String response =
    http.getString();

  if (response.length() > 0) {

    Serial.print("Resposta: ");
    Serial.println(response);
  }

  http.end();

  return httpCode >= 200 &&
         httpCode < 300;
}

// ============================================================
// LEITURA DA TEMPERATURA
// ============================================================

float readTemperature() {

  temperatureSensor.requestTemperatures();

  float temperature =
    temperatureSensor.getTempCByIndex(0);

  if (
    temperature == DEVICE_DISCONNECTED_C ||
    temperature < -50 ||
    temperature > 100
  ) {

    Serial.println(
      "[Temperatura] Sensor não encontrado."
    );

    return -127.0;
  }

  return temperature;
}

// ============================================================
// LEITURA DO TDS
// ============================================================
//
// ATENÇÃO:
// O valor depende do módulo TDS utilizado.
// Esta conversão é uma estimativa inicial.
//
// Depois podemos calibrar usando a leitura real
// do seu sensor.
//

float readTDS(float temperature) {

  int raw =
    analogRead(TDS_PIN);

  float voltage =
    raw * (3.3 / 4095.0);

  // Compensação aproximada de temperatura
  float compensationCoefficient =
    1.0 +
    0.02 *
    (temperature - 25.0);

  float compensatedVoltage =
    voltage /
    compensationCoefficient;

  // Fórmula aproximada para TDS
  float tds =
    (133.42 *
     compensatedVoltage *
     compensatedVoltage *
     compensatedVoltage
     -
     255.86 *
     compensatedVoltage *
     compensatedVoltage
     +
     857.39 *
     compensatedVoltage)
     * 0.5;

  if (tds < 0) {
    tds = 0;
  }

  Serial.print("[TDS] RAW: ");
  Serial.print(raw);

  Serial.print(" | Voltage: ");
  Serial.print(voltage, 3);

  Serial.print(" V | TDS: ");
  Serial.print(tds, 1);

  Serial.println(" ppm");

  return tds;
}

// ============================================================
// LEITURA DO pH
// ============================================================
//
// IMPORTANTE:
// O pH precisa ser CALIBRADO conforme o módulo utilizado.
//
// Os valores abaixo são apenas uma referência inicial.
//

float readPH() {

  int raw =
    analogRead(PH_PIN);

  float voltage =
    raw * (3.3 / 4095.0);

  // ----------------------------------------------------------
  // CALIBRAÇÃO INICIAL
  // ----------------------------------------------------------
  //
  // pH aproximado usando uma relação linear.
  //
  // AJUSTAREMOS posteriormente com seus valores reais
  // de calibração pH 4 / pH 7 / pH 10.
  //

  float ph =
    7.0 +
    ((2.50 - voltage) / 0.18);

  if (ph < 0) {
    ph = 0;
  }

  if (ph > 14) {
    ph = 14;
  }

  Serial.print("[pH] RAW: ");
  Serial.print(raw);

  Serial.print(" | Voltage: ");
  Serial.print(voltage, 3);

  Serial.print(" V | pH: ");
  Serial.println(ph, 2);

  return ph;
}

// ============================================================
// LEITURA DA TURBIDEZ
// ============================================================

float readTurbidity() {

  int raw =
    analogRead(TURBIDITY_PIN);

  float voltage =
    raw * (3.3 / 4095.0);

  // ----------------------------------------------------------
  // Conversão aproximada
  // ----------------------------------------------------------
  //
  // ATENÇÃO:
  // Cada sensor de turbidez possui comportamento diferente.
  //
  // Por enquanto enviamos uma escala aproximada.
  // Depois podemos calibrar em NTU.
  //

  float turbidity;

  if (voltage >= 2.5) {

    turbidity = 0;

  }
  else {

    turbidity =
      300.0 -
      (voltage * 120.0);
  }

  if (turbidity < 0) {
    turbidity = 0;
  }

  Serial.print("[Turbidez] RAW: ");
  Serial.print(raw);

  Serial.print(" | Voltage: ");
  Serial.print(voltage, 3);

  Serial.print(" V | Valor: ");
  Serial.println(turbidity, 1);

  return turbidity;
}

// ============================================================
// ENVIA DADOS DOS SENSORES
// ============================================================

void sendSensorData() {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println(
      "[Sensores] Wi-Fi desconectado."
    );

    return;
  }

  // ----------------------------------------------------------
  // TEMPERATURA
  // ----------------------------------------------------------

  float temperature =
    readTemperature();

  // ----------------------------------------------------------
  // TDS
  // ----------------------------------------------------------

  float tds;

  if (temperature > -100) {

    tds =
      readTDS(temperature);

  }
  else {

    tds =
      readTDS(25.0);
  }

  // ----------------------------------------------------------
  // pH
  // ----------------------------------------------------------

  float ph =
    readPH();

  // ----------------------------------------------------------
  // TURBIDEZ
  // ----------------------------------------------------------

  float turbidity =
    readTurbidity();

  // ----------------------------------------------------------
  // TIMESTAMP
  // ----------------------------------------------------------

  time_t now =
    time(nullptr);

  long long timestamp =
    (long long)now * 1000LL;

  // ----------------------------------------------------------
  // JSON
  // ----------------------------------------------------------

  String json = "{";

  json += "\"type\":\"";
  json += DEVICE_TYPE;
  json += "\",";

  json += "\"deviceId\":\"";
  json += DEVICE_ID;
  json += "\",";

  json += "\"temperature\":";
  json += String(temperature, 2);
  json += ",";

  json += "\"conductivity\":";
  json += String(tds, 1);
  json += ",";

  json += "\"tds\":";
  json += String(tds, 1);
  json += ",";

  json += "\"ph\":";
  json += String(ph, 2);
  json += ",";

  json += "\"turbidity\":";
  json += String(turbidity, 1);
  json += ",";

  json += "\"lastSeen\":";
  json += String(timestamp);
  json += ",";

  json += "\"status\":\"online\",";

  json += "\"wifi\":";
  json += String(WiFi.RSSI());

  json += "}";

  Serial.println();
  Serial.println(
    "================================="
  );

  Serial.println(
    "      ENVIANDO DADOS DA ÁGUA"
  );

  Serial.println(
    "================================="
  );

  Serial.print("Temperatura: ");
  Serial.print(temperature);
  Serial.println(" °C");

  Serial.print("TDS: ");
  Serial.print(tds);
  Serial.println(" ppm");

  Serial.print("pH: ");
  Serial.println(ph);

  Serial.print("Turbidez: ");
  Serial.println(turbidity);

  Serial.println();

  bool success =
    firebasePatch(
      "",
      json
    );

  if (success) {

    Serial.println(
      "[Água] Dados enviados com sucesso!"
    );

  }
  else {

    Serial.println(
      "[Água] ERRO ao enviar dados."
    );
  }
}

// ============================================================
// HEARTBEAT
// ============================================================

void sendHeartbeat() {

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  time_t now =
    time(nullptr);

  long long timestamp =
    (long long)now * 1000LL;

  String json = "{";

  json += "\"type\":\"";
  json += DEVICE_TYPE;
  json += "\",";

  json += "\"deviceId\":\"";
  json += DEVICE_ID;
  json += "\",";

  json += "\"status\":\"online\",";

  json += "\"lastSeen\":";
  json += String(timestamp);
  json += ",";

  json += "\"wifi\":";
  json += String(WiFi.RSSI());

  json += "}";

  bool success =
    firebasePatch(
      "",
      json
    );

  if (success) {

    Serial.println(
      "[Heartbeat] Monitor de água online."
    );

  }
  else {

    Serial.println(
      "[Heartbeat] Erro."
    );
  }
}

// ============================================================
// CONFIGURAÇÃO WI-FI
// ============================================================

void connectWiFi() {

  Serial.println();
  Serial.println(
    "================================="
  );

  Serial.println(
    "     CONFIGURAÇÃO WI-FI"
  );

  Serial.println(
    "================================="
  );

  WiFi.mode(WIFI_STA);

  WiFiManager wm;

  wm.setConfigPortalTimeout(180);

  Serial.println(
    "Tentando conectar ao Wi-Fi salvo..."
  );

  bool conectado =
    wm.autoConnect("Agua-Setup");

  if (!conectado) {

    Serial.println(
      "Não foi possível conectar."
    );

    Serial.println(
      "Reiniciando ESP32..."
    );

    delay(3000);

    ESP.restart();
  }

  Serial.println();
  Serial.println(
    "Wi-Fi conectado!"
  );

  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  Serial.print("RSSI: ");
  Serial.println(WiFi.RSSI());
}

// ============================================================
// CONFIGURAÇÃO DO HORÁRIO
// ============================================================

void setupTime() {

  configTime(
    -3 * 3600,
    0,
    "pool.ntp.org",
    "time.nist.gov"
  );

  Serial.println(
    "Sincronizando horário..."
  );

  time_t now =
    time(nullptr);

  int attempts = 0;

  while (
    now < 100000 &&
    attempts < 30
  ) {

    delay(500);

    Serial.print(".");

    now =
      time(nullptr);

    attempts++;
  }

  Serial.println();

  if (now >= 100000) {

    Serial.println(
      "Horário sincronizado."
    );

  }
  else {

    Serial.println(
      "Não foi possível sincronizar horário."
    );
  }
}

// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println(
    "========================================"
  );

  Serial.println(
    "       MONITORAMENTO DA ÁGUA"
  );

  Serial.println(
    "========================================"
  );

  Serial.print(
    "Device ID: "
  );

  Serial.println(
    DEVICE_ID
  );

  Serial.print(
    "Firebase Device: "
  );

  Serial.println(
    FIREBASE_DEVICE_ID
  );

  Serial.print(
    "Tipo: "
  );

  Serial.println(
    DEVICE_TYPE
  );

  // ==========================================================
  // ADC
  // ==========================================================

  analogReadResolution(12);

  // ==========================================================
  // DS18B20
  // ==========================================================

  temperatureSensor.begin();

  Serial.println(
    "[Sensor] DS18B20 inicializado."
  );

  // ==========================================================
  // HTTPS
  // ==========================================================

  client.setInsecure();

  // ==========================================================
  // WI-FI
  // ==========================================================

  connectWiFi();

  // ==========================================================
  // HORÁRIO
  // ==========================================================

  setupTime();

  // ==========================================================
  // PRIMEIRO HEARTBEAT
  // ==========================================================

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {

    sendHeartbeat();

    delay(500);

    sendSensorData();
  }

  Serial.println();
  Serial.println(
    "Monitoramento iniciado!"
  );
}

// ============================================================
// LOOP
// ============================================================

void loop() {

  // ==========================================================
  // VERIFICA WI-FI
  // ==========================================================

  if (
    WiFi.status() !=
    WL_CONNECTED
  ) {

    Serial.println(
      "[Wi-Fi] Conexão perdida."
    );

    connectWiFi();

    delay(1000);

    return;
  }

  unsigned long now =
    millis();

  // ==========================================================
  // HEARTBEAT
  // ==========================================================

  if (
    now - lastHeartbeat >=
    HEARTBEAT_INTERVAL
  ) {

    lastHeartbeat =
      now;

    sendHeartbeat();
  }

  // ==========================================================
  // LEITURA DOS SENSORES
  // ==========================================================

  if (
    now - lastSensorUpdate >=
    SENSOR_INTERVAL
  ) {

    lastSensorUpdate =
      now;

    sendSensorData();
  }

  delay(50);
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
            <span className="section-kicker">ACESSO</span>
            <h2>Entrar no COMEDOURO</h2>
            <p>Acesse o painel do seu comedouro.</p>
          </div>
          <button
            className="primary-button auth-button"
            onClick={() => startLogin()}
          >
            Entrar no sistema
            <ArrowRight size={17} />
          </button>
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
        description="Conheça a instituição, o curso e a equipe responsável pelo desenvolvimento do COMEDOURO."
      />

      <div className="about-grid">
        <section className="about-hero panel">
          <div className="logo-place lica-logo">
            <img src="/logo-lica.png" alt="Logo do LICA" />
          </div>

          <div className="logo-place course">
            <img
              src="/marca-if-baiano-campus-senhor-do-bonfim-horizontal-branca.png"
              alt="Instituto Federal Baiano - Campus Senhor do Bonfim"
            />
          </div>

          <div>
            <span className="section-kicker">SOBRE O COMEDOURO</span>

            <h2>Automação que cuida da rotina.</h2>

            <p>
              O COMEDOURO é um projeto desenvolvido com o objetivo de
              proporcionar automação e praticidade na alimentação de animais,
              utilizando tecnologia, programação e conectividade para facilitar
              o controle dos horários e das porções.
            </p>

            <p>
              O projeto integra conhecimentos de tecnologia e Ciências Agrárias,
              buscando desenvolver uma solução acessível para automatizar a
              alimentação e permitir o acompanhamento do dispositivo de forma
              remota.
            </p>
          </div>
        </section>

        <section className="panel editable-info">
          <div>
            <span className="section-kicker">INFORMAÇÕES DO PROJETO</span>
            <h3>Equipe e instituição</h3>
          </div>

          <div className="about-fields">
            <Detail
              label="Instituição"
              value="Instituto Federal de Educação, Ciência e Tecnologia Baiano – Campus Senhor do Bonfim"
            />

            <Detail
              label="Cursos"
              value="Licenciatura em Ciências Agrárias e Técnico em Agropecuária. "
            />

            <Detail
              label="Projeto"
              value="COMEDOURO – Sistema Automatizado de Alimentação"
            />

            <Detail
              label="PROFESSORES ORIENTADORES"
              value="Claudia Kiya, Jaciara Silva, Juracir Santos e Thales Mendes"
            />

            <Detail
              label="ALUNOS ORIENTADORES"
              value="Mirella Anjos e Pedro Josafá"
            />
            <Detail label="ALUNOS" value="Davi Santos e Pedro Júnior" />
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
  }, [page, overview.data, overview.refetch, user, setLocation]);
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
