# Bohemia Photo Booth

MVP da cabine de fotos touchscreen (modo CABINE).

## Rodar localmente

```bash
bun install
bun run dev
```

Abra http://localhost:8080 em tela cheia (F11).

> A câmera (getUserMedia) só funciona em **localhost** ou **HTTPS**. Em outros endereços o navegador bloqueia o acesso.

## Estrutura

- `src/modes/cabine` — fluxo da cabine (futuro: `src/modes/loja`)
- `src/features/camera` — hook da webcam
- `src/features/session` — tipos e `SessionService` (implementação local em memória; trocar por Supabase depois)
- `src/components/kiosk` — componentes touch reutilizáveis
