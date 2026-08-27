# Integração Comedouro + Firebase + ESP32 + Blynk

O firmware `docs/ESP32_Firebase.ino` desta versão usa **Firebase e Blynk ao mesmo tempo**.

## O que funciona

- Wi-Fi configurado pelo WiFiManager.
- Site envia alimentação pelo Firebase.
- ESP32 confirma `processing` → `success`/`failed`.
- Agendamentos são executados pelo ESP32.
- Histórico e última alimentação são gravados no Firebase.
- Heartbeat a cada 15 segundos.
- Blynk funciona em paralelo com o site.
- Relé no **GPIO 32**.
- Proteção para o relé ficar desligado quando não existe uma ação ativa.
- Alimentação não bloqueia o `loop()`, então Firebase e Blynk continuam respondendo durante a alimentação.
- Botão de alimentação do site e botão de alimentação do Blynk usam o mesmo relé.
- Botão de teste do relé existe no site e no Blynk e faz somente um pulso de 1 segundo.

## Arduino IDE

Instale:

- WiFiManager
- ArduinoJson
- Blynk

Placa:

- ESP32 Dev Module

No começo de `ESP32_Firebase.ino`, preencha os dados do seu template Blynk:

```cpp
#define BLYNK_TEMPLATE_ID "SEU_TEMPLATE_ID"
#define BLYNK_TEMPLATE_NAME "Comedouro ESP32"
#define BLYNK_AUTH_TOKEN "SEU_TOKEN_BLYNK"
```

Não publique o token Blynk no GitHub.

## Blynk

Crie estes Datastreams/Virtual Pins:

| Virtual Pin | Uso | Configuração |
|---|---|---|
| V0 | Alimentar | Button / PUSH |
| V1 | Quantidade | Integer, 10–500 |
| V2 | Testar relé | Button / PUSH |
| V3 | ESP32 online | Integer |
| V4 | Wi-Fi RSSI | Integer |
| V5 | Última alimentação | Integer |

No Blynk:

1. Coloque um botão em V0 como `PUSH`.
2. Coloque um campo/slider em V1 de 10 a 500.
3. Coloque um botão em V2 como `PUSH`.
4. V3, V4 e V5 podem ser indicadores.

**V0** libera a quantidade definida em V1.

**V2** liga o relé por 1 segundo apenas para teste.

## Relé

O firmware usa:

```text
ESP32 GPIO 32 -> IN do módulo relé
ESP32 GND     -> GND do módulo relé
VCC do relé   -> alimentação compatível com o módulo
Motor         -> circuito de potência do relé
```

O motor deve ter sua própria alimentação adequada. Não ligue o motor diretamente ao GPIO do ESP32.

Se o relé funcionar invertido, altere:

```cpp
#define RELAY_ACTIVE_LOW true
```

para:

```cpp
#define RELAY_ACTIVE_LOW false
```

## Primeiro uso do Wi-Fi

1. Grave o firmware.
2. Abra o Monitor Serial em 115200.
3. Conecte na rede `COMEDOURO-ESP32`.
4. Senha: `12345678`.
5. Acesse `192.168.4.1`.
6. Escolha o Wi-Fi do local.
7. Salve.

Depois disso o ESP32 usa automaticamente a rede salva.

## Calibração da ração

O padrão é:

```cpp
#define MOTOR_MS_PER_10G 1000
```

Isso é apenas uma estimativa. Pese a ração liberada e ajuste o tempo conforme seu motor e mecanismo.

Por exemplo, se 1000 ms estiver liberando 15 g, diminua o tempo para aproximar de 10 g.

## Firebase

Banco usado pelo projeto:

`https://comedouro-a8211-default-rtdb.firebaseio.com`

O dispositivo é:

`devices/esp32-001`

O site e o ESP32 precisam usar o mesmo `DEVICE_ID`.

## Importante

O firmware usa `PATCH` no heartbeat para não apagar `lastFeed` e outros dados do status.

O site considera o ESP32 online somente quando existe heartbeat recente. Portanto, desligar o ESP32 faz o site passar para offline após o tempo de atualização.

Em produção, configure regras de segurança/autenticação no Firebase em vez de deixar o banco público.
