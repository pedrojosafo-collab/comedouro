# Direção visual — Comedouro ESP32

## Abordagens consideradas

### Abordagem 1 — Casa Serena
**Very Brief Intro:** Um painel doméstico acolhedor, com tons naturais, tipografia editorial e hierarquia silenciosa. A tecnologia aparece como uma camada confiável sobre a rotina do cuidado.
**Probability:** 0.07

### Abordagem 2 — Oficina de Controle
**Very Brief Intro:** Uma interface instrumental inspirada em painéis de bancada, com alto contraste, telemetria destacada e linguagem objetiva. O foco é precisão operacional e diagnóstico rápido.
**Probability:** 0.04

### Abordagem 3 — Jardim Digital
**Very Brief Intro:** Uma estética clara e orgânica, com módulos que lembram etiquetas de horta, microanimações suaves e um tom mais lúdico. O objetivo é tornar o monitoramento diário mais convidativo.
**Probability:** 0.08

## Abordagem escolhida — Casa Serena

### Design Movement
Soft industrial doméstico, combinando editorial contemporâneo, materiais naturais e instrumentação discreta.

### Core Principles
1. **Calma operacional:** o usuário entende o estado do comedouro antes de agir.
2. **Hierarquia por evidência:** conexão, estoque, próxima refeição e alertas aparecem em ordem de importância.
3. **Materialidade sem excesso:** cartões com textura e sombra macia sugerem objetos reais, sem depender de ornamentos.
4. **Ação reversível e segura:** comandos importantes pedem confirmação visual e registram o resultado.

### Color Philosophy
O creme quente funciona como superfície de casa; o verde sálvia comunica estabilidade e cuidado; o terracota identifica ações físicas do alimentador; o carvão azulado mantém legibilidade técnica. A paleta evita o aspecto de painel industrial frio e evita também a aparência infantilizada.

### Layout Paradigm
Uma composição assimétrica com barra lateral de contexto e área principal em fluxo vertical. O resumo do dispositivo ocupa uma faixa ampla, enquanto ações e telemetria se organizam como uma bancada de trabalho com diferentes profundidades.

### Signature Elements
- Indicador de conexão como um pequeno “selo de pulso”, com linha de tempo recente.
- Medidores de estoque em forma de régua vertical com marca de segurança.
- Microtexturas de papel e ruído muito sutil nas superfícies, sempre subordinadas à leitura.

### Interaction Philosophy
Toda ação deve responder imediatamente com mudança de estado, sem animações longas. Comandos de alimentação manual mostram o volume enviado, o horário e o retorno recebido do Firebase. Estados offline nunca ficam escondidos.

### Animation
Entradas curtas em fade e deslocamento de 8px, com intervalos de 40ms entre blocos. Botões usam compressão de 0.97 no toque. O pulso de conexão é lento e discreto; mudanças de telemetria usam transições de cor e escala, nunca deslocamento estrutural. Respeitar `prefers-reduced-motion`.

### Typography System
Usar **DM Serif Display** para títulos e **Manrope** para interface, números e microcopy. Títulos têm contraste alto e poucas palavras; dados usam peso 700, espaçamento levemente expandido e unidades menores em caixa alta.

### Brand Essence
**Um comedouro conectado que transforma a rotina de alimentar em um cuidado observável, controlável e confiável.** Personalidade: atento, acolhedor, preciso.

### Brand Voice
Headlines são diretas e humanas. CTAs descrevem o efeito da ação, não uma abstração. Microcopy informa sem culpar e sempre deixa claro quando há perda de conexão.

Exemplos:
- “Seu pet está coberto até a próxima refeição.”
- “Liberar 25 g agora”

### Wordmark & Logo
O símbolo é uma tigela vista de cima, com três grãos formando um arco e um pequeno traço de sinal ao lado. O desenho deve funcionar sozinho, em uma única cor, com contorno grosso e cantos levemente orgânicos; o nome textual usa DM Serif Display em caixa baixa.

### Signature Brand Color
**Terracota de alimento — `#C9684A`**, uma cor própria que conecta ação física, calor doméstico e o momento concreto de servir.
