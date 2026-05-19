// src-tauri/src/lib.rs
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Append-only. Never edit a shipped migration; add a new one with a higher version.
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_todos",
            sql: "CREATE TABLE todos (\
                    id INTEGER PRIMARY KEY,\
                    title TEXT NOT NULL,\
                    done INTEGER NOT NULL DEFAULT 0\
                  );",
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
            SqlBuilder::default()
                .add_migrations("sqlite:app.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Cargo.toml:
// [dependencies]
// tauri-plugin-sql = { version = "2", features = ["sqlite-bundled"] }
//
// Other backends: features = ["mysql"] or ["postgres"].
