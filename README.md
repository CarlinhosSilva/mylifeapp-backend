# MyLifeApp Backend

API REST do MyLifeApp, construída com Node.js, Express e PostgreSQL. A API controla autenticação, usuários, contas a pagar, receitas e os resumos financeiros individuais e familiares.

## Requisitos

- Node.js 18 ou superior
- PostgreSQL 13 ou superior

## Configuração

Na pasta `back/`, instale as dependências e crie o arquivo `.env` a partir do exemplo:

```bash
npm install
copy .env.example .env
```

Configure `PORT`, `FRONTEND_URL`, `JWT_SECRET`, `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD` e `PG_DATABASE`.

O banco precisa existir antes da inicialização. O servidor cria e atualiza automaticamente as tabelas necessárias, índices, categorias padrão e campos de compatibilidade do schema legado.

## Execução

```bash
npm run dev
```

Para executar sem o modo de desenvolvimento, use `npm start`. A API ficará disponível em `http://localhost:3000`.

## Endpoints

`GET /health` não exige autenticação.

Autenticação:

- `POST /api/login`
- `POST /api/register`
- `PUT /api/profile`

Usuários e categorias:

- `GET /api/users`
- `GET /api/categories`

Contas, usando `Authorization: Bearer <token>`:

- `GET /api/accounts`
- `POST /api/accounts`
- `PUT /api/accounts/:id`
- `DELETE /api/accounts/:id`
- `PATCH /api/accounts/:id/payment`

O pagamento recebe `paymentDate` no formato `YYYY-MM-DD` e `paymentMethod` como `PIX`, `DINHEIRO` ou `CARTAO`. O pagamento só é aceito quando o saldo disponível do usuário cobre o valor da conta.

Receitas e resumos, usando token:

- `GET /api/incomes`
- `POST /api/incomes`
- `DELETE /api/incomes/:id`
- `GET /api/incomes/balance`
- `GET /api/incomes/monthly-summary`
- `GET /api/incomes/family-summary`
- `GET /api/incomes/financial-status`
- `GET /api/incomes/financial-status?scope=family`

Uma receita recebe `description`, `value` e `receivedDate`. O saldo é calculado como entradas menos contas pagas; contas pendentes não são descontadas.

## Organização

- `src/server.js`: inicialização do banco e servidor HTTP.
- `src/app.js`: Express, CORS, rotas e tratamento de erros.
- `src/routes/`: endpoints protegidos por recurso.
- `src/services/`: regras de autenticação.
- `src/repositories/`: consultas PostgreSQL e mapeamento de dados.
- `src/middleware/`: autenticação, handlers assíncronos e erros.
- `src/db.js`: pool PostgreSQL e inicialização/migração do schema.

## Segurança
- Senhas são armazenadas com hash bcrypt.
- Tokens JWT expiram em 8 horas.
- Rotas financeiras filtram os dados pelo usuário autenticado.
- O pagamento usa transação e bloqueio da conta para evitar pagamento duplicado ou corrida de saldo.
