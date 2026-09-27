# Teste completo de comunicação

## 1. Firebase

Para o teste inicial, publique `firebase/database.rules.json` no Realtime Database.

O dispositivo deve ficar em:

```text
devices/SEU_DEVICE_ID/
```

## 2. ESP32

Abra o Serial Monitor em `115200 baud`.

Ao ligar, o esperado é:

```text
Wi-Fi conectado. IP: ...
Horário sincronizado.
[Firebase PUT] /status -> HTTP 200
[Firebase PUT] /lastSeen -> HTTP 200
[Firebase PUT] /wifi -> HTTP 200
Heartbeat: status=OK lastSeen=OK wifi=OK
```

Depois, aproximadamente a cada 10 segundos, o heartbeat é repetido.

## 3. Site

Cadastre o mesmo `DEVICE_ID` usado no firmware.

O dashboard deve mostrar `Online` depois do primeiro heartbeat.

Se o ESP32 for desligado, o dashboard deve mudar para `Offline` depois de aproximadamente 30 segundos sem heartbeat.

## 4. Alimentação manual

Ao clicar em `ALIMENTAR AGORA`, o servidor grava:

```text
devices/SEU_DEVICE_ID/command/
  requestId
  feed: true
  type: manual
  quantity: 1..10
  requestedAt
```

O ESP32 consulta esse nó a cada 2 segundos.

Após executar, ele grava:

```text
devices/SEU_DEVICE_ID/
  lastFeeding
  lastEvent
  lastCommandId
  history/TIMESTAMP
```

E depois:

```text
command: null
```

## 5. Se não funcionar

### Site envia, mas ESP32 não recebe

Confira no Serial Monitor:

```text
[Firebase GET] /command -> HTTP 200
```

E verifique se o `DEVICE_ID` do firmware é exatamente igual ao cadastrado no site.

### ESP32 envia, mas site mostra offline

Confira:

```text
[Firebase PUT] /lastSeen -> HTTP 200
```

Depois atualize o dashboard. O servidor usa o `lastSeen` do Firebase e considera online por 30 segundos.

### Firebase retorna 401/403

Verifique as regras do Realtime Database e o token configurado no firmware. Para o teste inicial, o firmware pode funcionar sem token quando `FIREBASE_AUTH_TOKEN` estiver exatamente como `COLOQUE_SEU_TOKEN_AQUI`, desde que as regras de teste estejam publicadas.

> As regras abertas são apenas para diagnóstico. Antes de publicar o projeto, configure autenticação por dispositivo e regras restritivas.
