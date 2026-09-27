# Comedouro — Google OAuth

Esta versão usa o Google OAuth diretamente para autenticação. O portal OAuth do Manus não é usado pelo fluxo de login.

## Configuração

Crie um arquivo `.env` na raiz:

```env
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/callback
JWT_SECRET=gere-um-segredo-longo-e-aleatorio
DATABASE_URL=SUA_DATABASE_URL
FIREBASE_DATABASE_URL=https://comedouro-a8211-default-rtdb.firebaseio.com
FIREBASE_DATABASE_SECRET=SEU_SECRET_FIREBASE
```

No Google Cloud Console:

- Origem JavaScript autorizada: `http://localhost:3000`
- URI de redirecionamento autorizado: `http://localhost:3000/api/oauth/callback`

## Instalação

```bat
npm install --legacy-peer-deps
npm run build
npm run dev
```

Depois abra:

`http://localhost:3000/`

O botão **Entrar com Google** inicia `/api/oauth/login`.

## Importante

Não coloque `GOOGLE_CLIENT_SECRET` ou `JWT_SECRET` no Git, ZIP público ou chat.
