# Comedouro ESP32 — Relé + Motor

## Ligação

- GPIO 32 → IN do módulo relé
- GND do ESP32 → GND do módulo relé
- VCC do módulo relé → alimentação compatível
- Motor → circuito de potência do relé, com fonte adequada

Não alimente o motor pelo GPIO do ESP32.

## Relé ativo em LOW

O padrão é:

```cpp
#define RELAY_ACTIVE_LOW true
```

Se o módulo funcionar ao contrário, use `false`.

## Calibração

```cpp
#define MOTOR_MS_PER_10G 1000
```

É uma estimativa inicial de aproximadamente 10 g por ciclo. Pese a ração e ajuste esse valor.

## Controles

- Site: botão `Liberar X g` → Firebase → ESP32 → relé/motor.
- Site: `Testar relé` → pulso de 1 segundo.
- Blynk V0 → alimentação com a quantidade definida em V1.
- Blynk V2 → pulso de teste de 1 segundo.

O relé é desligado automaticamente ao final da ação e também existe uma proteção no loop para evitar que fique ligado sem uma ação ativa.
