# PigSync — Fase 2: App base

App móvel (Expo + TypeScript) para contagem e controle de suínos em galpões
de terminação. Fase 2: 100% online, sem PowerSync/offline e sem IA — isso
entra em fases posteriores.

Backend: projeto Supabase já existente (tabelas `galpoes`, `silos`, `lotes`,
`eventos_lote`, `perfis`, e a view `saldo_lotes`).

## Configurar

```bash
cp .env.example .env
# preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY
# com os valores do painel do Supabase (Settings → API)

npm install
npm start
```

Abra no Expo Go (celular) ou `npm run ios` / `npm run android` / `npm run web`.

## Telas

1. Login (email/senha via Supabase Auth)
2. Lista de galpões — saldo total (soma dos 2 silos) em cada card
3. Lista de silos de um galpão — lote ativo e saldo atual de cada um
4. Detalhe do lote — quantidade inicial, saldo atual, data de entrada e
   histórico de eventos
5. Registrar baixa — quantidade + motivo (opcional)
6. Registrar contagem manual — quantidade contada

## Estrutura

```
src/app/            Rotas (expo-router, file-based) — grupo (app) é protegido por sessão
src/hooks/use-auth.tsx   Contexto de autenticação (sessão Supabase)
src/lib/supabase.ts      Cliente Supabase (lê EXPO_PUBLIC_* do .env)
src/types/database.ts    Tipos das tabelas/view do Supabase
```
