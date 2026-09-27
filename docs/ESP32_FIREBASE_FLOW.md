# Fluxo de comunicação ESP32 <-> Firebase <-> Site

## Comando manual
1. O site chama `app.feedNow`.
2. O servidor grava em `devices/{DEVICE_ID}/command`:
   - `requestId`
   - `feed: true`
   - `type: manual`
   - `quantity`
   - `requestedAt`
3. O ESP32 consulta `/command` a cada 2 segundos.
4. O ESP32 executa o mecanismo.
5. O ESP32 grava `lastFeeding`, `lastEvent`, `history/{timestamp}` e `lastCommandId`.
6. O ESP32 limpa `/command` para `null`.
7. O site lê `history` e mostra a execução no histórico.

## Status
O ESP32 grava a cada 10 segundos:
- `/status = "online"`
- `/lastSeen = timestamp em ms`
- `/wifi = SSID`

O backend considera o dispositivo online se `lastSeen` tiver menos de 30 segundos. Ao desligar o ESP32, ele passa para offline após o timeout.

## Estrutura
```text
devices/{DEVICE_ID}/
  status
  lastSeen
  wifi
  command
  lastCommandId
  lastFeeding
  lastEvent
  history/{timestamp}
  schedules/{id}
```
