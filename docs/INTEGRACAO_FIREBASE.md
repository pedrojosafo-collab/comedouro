# Integração Comedouro + Firebase + ESP32

## Firmware simplificado

O arquivo `docs/ESP32_Firebase.ino` foi atualizado para deixar o ESP32 mais independente e profissional.

### O que mudou

- O SSID e a senha do Wi-Fi **não ficam mais gravados no código**.
- Na primeira inicialização, o ESP32 cria o Wi-Fi `COMEDOURO-ESP32` com senha `12345678`.
- Ao acessar `192.168.4.1`, é possível selecionar a rede Wi-Fi e informar a senha.
- As credenciais ficam salvas na memória do ESP32.
- O dispositivo tenta reconectar automaticamente quando a conexão cai.
- O ESP32 disponibiliza uma página local com IP, SSID, RSSI, firmware e horário.
- A página local possui botão para redefinir o Wi-Fi e abrir novamente o portal de configuração.
- O horário é sincronizado via NTP usando o fuso UTC-3.
- `lastSeen`, `lastFeed` e registros do histórico usam timestamp real quando o NTP está disponível.
- Alimentações manuais e agendadas são processadas pelo Firebase.
- O campo `repetitions` dos comandos/agendamentos também é respeitado.
- O status é escrito em `devices/{DEVICE_ID}/status`, sem apagar `commands`, `schedules` ou `history`.

## Estrutura do Firebase

```text
devices/
  esp32-001/
    status/
      status: online | offline
      lastSeen: timestamp
      lastFeed: timestamp
      foodLevel: opcional
      wifi: -dBm
      servo: posição
      firmware: 2.0.0
      ip: endereço local
      ssid: rede conectada
      deviceId: esp32-001

    commands/
      id-do-comando/
        type: feed
        quantity: 50
        repetitions: 1
        source: web
        status: pending | processing | success | failed
        createdAt: timestamp
        processedAt: timestamp

    schedules/
      id-do-agendamento/
        time: "08:00"
        quantity: 50
        repetitions: 1
        enabled: true
        createdAt: timestamp

    history/
      id-do-evento/
        quantity: 50
        type: manual | scheduled
        status: success | failed
        timestamp: timestamp
```

## Instalação na Arduino IDE

Abra `docs/ESP32_Firebase.ino` e instale estas bibliotecas pelo Gerenciador de Bibliotecas:

- **WiFiManager**
- **ArduinoJson**
- **ESP32Servo**

Selecione uma placa ESP32 compatível, como `ESP32 Dev Module`, e faça o upload.

### Primeiro acesso ao Wi-Fi

1. Grave o firmware no ESP32.
2. Abra o Monitor Serial em `115200`.
3. Se não houver Wi-Fi salvo, procure a rede `COMEDOURO-ESP32`.
4. Conecte usando a senha `12345678`.
5. Abra `192.168.4.1`.
6. Selecione sua rede Wi-Fi e informe a senha.
7. Salve a configuração.
8. O ESP32 reiniciará e se conectará automaticamente.

Depois de conectado, o Monitor Serial mostrará o IP local. Acesse esse IP no navegador para abrir o painel local do ESP32.

## Pinos padrão

```text
Servo -> GPIO 13
LED   -> GPIO 2
```

Se o seu circuito usar outros pinos, altere `SERVO_PIN` e `LED_PIN` no firmware.

## Calibração da alimentação

O firmware usa uma estimativa de aproximadamente 10 g por ciclo do mecanismo. O valor real depende do tamanho da saída, do servo, da ração e da mecânica do comedouro.

Os parâmetros principais são:

```cpp
#define SERVO_CLOSED 0
#define SERVO_OPEN 90
#define SERVO_OPEN_MS 550
#define SERVO_PAUSE_MS 180
```

Faça testes com uma pequena quantidade antes de usar o equipamento em produção. Para medição real em gramas, o projeto precisa de um sensor de peso/célula de carga.

## Firebase

O painel usa:

`https://comedouro-a8211-default-rtdb.firebaseio.com`

O firmware atualiza apenas os nós necessários. Isso evita o problema de substituir toda a estrutura do dispositivo ao publicar o status.

Para desenvolvimento, as regras podem permitir o caminho do dispositivo. Em produção, não deixe o banco público: utilize autenticação e regras específicas por usuário/dispositivo.

\n## Comunicação real e heartbeat

O painel considera o ESP32 online somente quando `lastSeen` foi atualizado pelo firmware nos últimos 90 segundos. O valor antigo `status: online` no Firebase não mantém o dispositivo online.

Comandos manuais também possuem confirmação: o painel cria o comando, o ESP32 muda para `processing` e depois `success` ou `failed`. O painel aguarda essa confirmação antes de informar que a alimentação foi realmente executada.

## Observacao

A troca de Wi-Fi pelo painel web foi removida de proposito para manter o projeto simples e mais confiavel. Para trocar a rede, use o portal `COMEDOURO-ESP32` / `192.168.4.1` do WiFiManager.
