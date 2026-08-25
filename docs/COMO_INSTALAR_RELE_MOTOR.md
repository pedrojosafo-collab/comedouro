# Comedouro ESP32 — Relé + Motor

O firmware desta versão foi ajustado para usar um módulo relé no lugar do servo.

## Ligação do ESP32

- GPIO 13 → entrada de sinal do módulo relé (IN)
- GND do ESP32 → GND do módulo relé
- VCC do módulo relé → alimentação compatível com o módulo
- Motor → circuito de potência do relé, usando uma fonte adequada ao motor

**Não alimente o motor diretamente pelo GPIO do ESP32.** O relé deve apenas comandar o circuito de potência.

## Ajuste da quantidade

No firmware existe:

```cpp
#define MOTOR_MS_PER_10G 1000
```

Esse valor é uma calibração inicial. Significa aproximadamente 10 g para cada 1000 ms de motor ligado.

Faça um teste, pese a ração liberada e ajuste esse valor. A quantidade real depende do motor e do mecanismo do comedouro.

## Relé ativo em LOW

O firmware começa com:

```cpp
#define RELAY_ACTIVE_LOW true
```

Isso é comum em módulos relé. Se o seu módulo funcionar ao contrário, altere para `false`.
