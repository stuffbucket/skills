---
name: tauri-plugins-sql
description: Use when wiring a real database into a Tauri v2 app — SQLite / MySQL / Postgres via `sqlx`, `Database.load("sqlite:db.sqlite")`, `execute()` vs `select()`, the per-DB placeholder syntax (`$1` for SQLite/Postgres, `?` for MySQL), migrations registered in Rust with `Builder::default().add_migrations(...)`, the `sqlite-bundled` Cargo feature, and mobile considerations.
---

# Tauri v2: SQL Plugin

A `sqlx` wrapper exposed to JS. Backends:

| Backend  | Cargo feature                                     | Connection string                           |
| -------- | ------------------------------------------------- | ------------------------------------------- |
| SQLite   | `sqlite` (bundled libsqlite via `sqlite-bundled`) | `sqlite:my.db` (relative to app config dir) |
| MySQL    | `mysql`                                           | `mysql://user:pass@host/db`                 |
| Postgres | `postgres`                                        | `postgres://user:pass@host/db`              |

Pick exactly the features you need — the default is none, so the build will fail loud if you forget.

## Install

```sh
npm run tauri add sql
```

Then in `Cargo.toml`:

```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite-bundled"] }
```

`sqlite-bundled` compiles libsqlite into your binary — no system dependency. Drop it if you want to
link the system copy (`sqlite`).

## Migrations — Rust side, not JS

Migrations are an **append-only** array registered on the plugin builder before `.build()`. Each
entry has a monotonic version. The plugin runs unapplied ones inside a transaction at load time.

```rust
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

let migrations = vec![
    Migration {
        version: 1,
        description: "create_todos",
        sql: "CREATE TABLE todos (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "add_created_at",
        sql: "ALTER TABLE todos ADD COLUMN created_at TEXT;",
        kind: MigrationKind::Up,
    },
];

tauri::Builder::default()
    .plugin(
        Builder::default()
            .add_migrations("sqlite:app.db", migrations)
            .build(),
    )
```

Rules:

- **Never** edit a shipped migration. Add a new one.
- Version numbers are integers, must be strictly increasing.
- A failed migration rolls back the whole batch — your db stays at the last known-good version.
- One migrations array per database URL; if you ship multiple DBs, call `.add_migrations(url, …)`
  once per URL.

## JS API

```ts
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:app.db');

// INSERT / UPDATE / DELETE / DDL → execute()
const ins = await db.execute(
  'INSERT INTO todos (title) VALUES ($1) RETURNING id',
  ['buy milk'],
);
console.log(ins.lastInsertId, ins.rowsAffected);

// SELECT → select(), returns rows as plain objects
type Todo = { id: number; title: string; done: number };
const todos = await db.select<Todo[]>(
  'SELECT id, title, done FROM todos WHERE done = $1 ORDER BY id DESC',
  [0],
);

await db.close();
```

`execute` returns `{ rowsAffected, lastInsertId }`. `select` returns an array typed however you cast
it — there's no runtime schema check, so be honest about column names.

## Placeholders per backend

| Backend          | Placeholders  |
| ---------------- | ------------- |
| SQLite, Postgres | `$1`, `$2`, … |
| MySQL            | `?`, `?`, …   |

Bind values are always passed as a positional array. Use them — string-concatenated SQL is the only
way to write a SQL injection in this plugin.

## Preload from config (alternative to JS `load`)

```json
{
  "plugins": {
    "sql": {
      "preload": ["sqlite:app.db"]
    }
  }
}
```

Listed DBs are loaded on app boot and their migrations applied before the first window opens. Useful
when JS code expects the DB to already exist.

## Permissions

```json
{
  "permissions": [
    "sql:default",
    "sql:allow-execute",
    "sql:allow-select",
    "sql:allow-load",
    "sql:allow-close"
  ]
}
```

`sql:default` covers the common reads; add `sql:allow-execute` explicitly to opt in to writes.
Per-database scoping is not currently available — the gate is at the command level.

## Mobile considerations

- **iOS**: SQLite works with `sqlite-bundled`. The DB lands in the app sandbox; no extra
  entitlements needed for the bundled feature.
- **Android**: Same — bundled is required; the system sqlite is not exposed to user code reliably.
- **MySQL / Postgres on mobile**: Possible but rarely a good idea. Mobile networks reset connections
  frequently and `sqlx` will retry — budget for that, and consider an HTTP API in front instead.

## Backend choice

- **SQLite** is the default. Local-first, single-writer, fast. Use it unless you have a specific
  reason.
- **MySQL / Postgres** when you're talking to an existing server. Treat the desktop app as just
  another client; connection strings (and credentials!) should not be hardcoded into the bundle.

## Templates

- `templates/setup.rs` — plugin init with migrations array.
- `templates/usage.ts` — load / execute / select with parameterized queries.
- `templates/capability.json` — sql permissions for the main window.

## Related

- `tauri-plugins-store` — simpler KV alternative for settings-sized state.
- `tauri-commands-state-injection` — for sharing a single `Pool<Sqlite>` across handlers when you
  want to bypass the JS layer.
- `tauri-plugins` — installation flow.
