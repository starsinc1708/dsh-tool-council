# Как встроить в чекаут харнесса

```
packages/council/tool-council/     → packages/council/tool-council/
packages/client/ui-council/        → packages/client/ui-council/
examples/council/cordis.yml        → examples/council/cordis.yml
```

Затем четыре правки вне пакетов — их дискавери не покрывает:

**1. `tsconfig.base.json`** — новая группа `council` в wildcard:
```jsonc
"@deepseek-ai/dsh-*": [
  "./packages/core/*/src",
  "./packages/council/*/src",   // ← добавить
  …
]
```

**2. `tsconfig.host.json`** → `references`:
```json
{ "path": "./packages/council/tool-council" }
```

**3. `tsconfig.client.json`** → `references`:
```json
{ "path": "./packages/client/ui-council" }
```

**4. `examples/package.json`** → `dependencies` (иначе `verify-cordis-config` уронит `doc-sync`):
```json
"@deepseek-ai/dsh-tool-council": "workspace:*",
"@deepseek-ai/dsh-client-ui-council": "workspace:*"
```

Плюс триплет README (`README.md` / `README.zh.md` / `README.i18n.yaml`) в каждом пакете — гейт `doc-sync` требует их, и в README нужна секция «Known Limitations and Deferred Work».

## Проверка

```sh
pnpm install
pnpm run constraints && pnpm run typecheck && pnpm run lint
pnpm run test:coverage          # per-file 100% на packages/*/*/src
pnpm run doc-sync
pnpm run build && pnpm run hygiene
```

## Запуск

```sh
export DEEPSEEK_API_KEY=sk-...
pnpm dsh web --patch examples/council/cordis.yml
```

Проверить, что жив: спросить агента «run a council bug-hunt over packages/core/tools». В чате появится workflow-run нода с фазами `map` / `verify` / `reduce`, в Settings → Plugins → Plugin configuration — карточка Council.

## Что уже проверено в этом черновике

| Проверка | Как | Итог |
|---|---|---|
| Типы хост-плагина против реального репозитория | `tsc --noEmit` на `src/**` c `tsconfig.base.json` paths, склон `deepseek-ai/deepseek-harness@master` | 0 ошибок |
| Скрипт оркестрации исполняется | `node:vm` + заглушки `agent`/`parallel`/`phase`/`log`, 3 map + 3 verify + 1 reduce | 7 детей, фазы и лог в правильном порядке |
| Дедупликация | `rank.py:521` vs `./rank.py:521`, «Greedy scoring inverted» vs «Inverted greedy scoring» | склеились в `f1`, оба репортера сохранены |
| Кворум | majority по 3 бюллетеням, включая `uncertain` и раскол 1/1/1 | `f1` CONFIRMED, `f2` REJECTED |
| Хост-копия против скриптовой | `assertTallyAgrees(tally(...), result.tally)` | совпали; guard срабатывает на подмене |
| Рендер таблицы | `renderTable` | формат совпадает с исходным скриншотом |

Не проверено: реальный прогон с моделью, клиентский бандл (нужен `pnpm run build:lib:client`), гейты репозитория (нужен `pnpm install`).
