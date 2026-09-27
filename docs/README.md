# COMEDOURO

Sistema responsivo para controle de comedouro automático conectado a ESP32.

## Funcionalidades implementadas

- Sessão web protegida pelo OAuth do projeto.
- Dashboard com status online/offline calculado a partir de `lastSeen`.
- Cadastro de dispositivo com chave de instalação.
- Alimentação manual com quantidade, registro e publicação de comando.
- Programação de vários horários, ativação/desativação e exclusão.
- Histórico separado por alimentação manual e automática.
- Colaboradores com papéis de administrador e colaborador.
- Código `.ino` copiável e baixável.
- Guia de instalação do ESP32.
- Área institucional com campos configuráveis para instituição, curso e integrantes.
- Interface responsiva e alternância visual disponível na barra superior.

## Desenvolvimento

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

## Persistência

O banco principal usa as tabelas `users`, `devices`, `schedules`, `feedings` e `collaborators`. O Realtime Database é uma ponte de hardware opcional configurada por variáveis de servidor. Consulte [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) antes da publicação.

## Observação importante

O ESP32 precisa de credenciais próprias e de uma política Firebase fechada. O arquivo `.ino` contém somente placeholders. Não publique tokens, senhas de Wi-Fi ou segredos administrativos.
