# Guia rápido de edição do COMEDOURO

## Requisitos

- Node.js 22 ou superior
- pnpm 10 ou superior
- Conta Firebase para a integração real do ESP32

## Instalar e executar

```bash
cd comedouro
pnpm install
pnpm dev
```

Depois, abra a URL local exibida pelo servidor.

## Validar alterações

```bash
pnpm check   # TypeScript
pnpm test    # testes unitários
pnpm build   # build de produção
```

## Onde editar

- `client/src/pages/Home.tsx`: páginas, navegação e componentes principais.
- `client/src/index.css`: identidade visual, responsividade e tema.
- `server/routers.ts`: operações de dispositivos, alimentação, agenda e colaboradores.
- `server/db.ts`: consultas e persistência.
- `drizzle/schema.ts`: tabelas do banco.
- `firebase/database.rules.json`: regras de segurança do Realtime Database.
- `docs/FIREBASE_SETUP.md`: configuração do Firebase.

## Banco de dados

Quando alterar `drizzle/schema.ts`, gere uma nova migração:

```bash
pnpm drizzle-kit generate
```

Revise o SQL gerado antes de aplicá-lo ao banco. Não coloque senhas ou tokens no código.

## Firebase

No ambiente de produção, configure no servidor:

```bash
FIREBASE_DATABASE_URL=https://comedouro-a8211-default-rtdb.firebaseio.com
FIREBASE_DATABASE_SECRET=SEU_TOKEN_DO_SERVIDOR
```

Mantenha esse token fora do frontend, do firmware e do Git. Para detalhes, consulte `docs/FIREBASE_SETUP.md`.

## Firmware

O código do ESP32 é mantido na constante `esp32Code` em `client/src/pages/Home.tsx`. Depois de alterá-lo, confirme que o botão **Copiar código** e o download `.ino` continuam funcionando.

## Melhorias sugeridas

1. Separar as páginas de `Home.tsx` em arquivos menores dentro de `client/src/pages/`.
2. Adicionar testes de integração para autorização de proprietário e colaboradores.
3. Adicionar autenticação Firebase dedicada para o ESP32 em produção.
