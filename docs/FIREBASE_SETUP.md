# Configuração real do Firebase

O COMEDOURO usa o Realtime Database informado no projeto:

`https://comedouro-a8211-default-rtdb.firebaseio.com`

O painel funciona com o banco relacional do projeto para autenticação, permissões e histórico. A ponte Firebase é usada para que o backend publique comandos e leia o heartbeat do ESP32. Essa separação evita expor credenciais administrativas no navegador.

## Variáveis do servidor

Configure no ambiente de produção:

```bash
FIREBASE_DATABASE_URL=https://comedouro-a8211-default-rtdb.firebaseio.com
FIREBASE_DATABASE_SECRET=<token administrativo do Firebase, somente no servidor>
```

`FIREBASE_DATABASE_SECRET` não deve ser colocado em `client/`, no código do ESP32, em screenshots ou em repositórios. A ausência dessa variável não quebra o painel: ele continua registrando as ações no banco do app e mostra que a sincronização externa está aguardando configuração.

Em produção, prefira um token de serviço com escopo mínimo ou um mecanismo de autenticação Firebase para o dispositivo. Nunca deixe o Realtime Database público.

## Estrutura esperada

```text
devices/{DEVICE_ID}/
  ownerUid: "UID_FIREBASE_DO_PROPRIETARIO"
  firebaseUid: "UID_FIREBASE_DO_DISPOSITIVO"
  command: null
  lastCommandId: ""
  schedules/{id}/
    hour: 6
    minute: 0
    quantity: 1
    active: true
  lastSeen: 0
  lastFeeding: 0
  lastEvent/
  wifi: "Minha rede"
  collaborators/{FIREBASE_UID}: "administrator"
```

## Regras

O arquivo [`firebase/database.rules.json`](../firebase/database.rules.json) está permissivo **somente para o teste de comunicação atual**. Publique-o no Firebase Console em **Realtime Database → Rules** para validar o ESP32 primeiro.

Depois que o fluxo estiver funcionando, troque essas regras por regras autenticadas por usuário/dispositivo. Não mantenha o banco público em produção.

## Firebase Authentication

Ative no Firebase Console os provedores necessários para os dispositivos e para a operação escolhida. Para um ESP32 em produção, use um usuário de dispositivo com UID dedicado ou um fluxo de token customizado. Não salve senha de Wi-Fi ou senha de Firebase no Realtime Database.

O scaffold do painel utiliza a autenticação segura do projeto para sessão web. Se a instituição precisar que a sessão web seja também Firebase Authentication, configure o provedor de e-mail/senha e uma conta de serviço para validar os ID tokens no backend antes de trocar o provedor de sessão.

## Fluxo de teste

1. Cadastre um dispositivo em **Meu dispositivo**.
2. Copie o código em **Código ESP32**.
3. Preencha Wi-Fi, `FIREBASE_AUTH_TOKEN` e o mesmo `DEVICE_ID`.
4. Publique as regras e faça o upload do firmware.
5. Ligue o ESP32 e abra o Serial Monitor em 115200 baud. Aguarde os logs `Firebase PUT` e o heartbeat de `lastSeen`.
6. Use **Alimentar agora** e confirme que `devices/{DEVICE_ID}/command` recebe um objeto com `requestId`, `feed`, `type` e `quantity`.
7. Após a execução, o firmware grava `lastFeeding`, `lastEvent`, `history/{timestamp}` e `lastCommandId`, e limpa `command` para `null`.
8. O firmware publica `status=online`, `lastSeen` e `wifi` a cada 10 segundos. O painel considera o dispositivo online por até 30 segundos sem novo heartbeat.
