use anyhow::Result;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::fs;

/// Initialises the SQLite database.
/// Creates `$HOME/.todoapp/` if it doesn't exist, opens (or creates)
/// `db.sqlite` inside it, enables WAL mode, and runs schema migrations.
pub async fn init_db() -> Result<SqlitePool> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_string());
    let data_dir = format!("{}/.todoapp", home);
    fs::create_dir_all(&data_dir)?;

    let db_path = format!("{}/db.sqlite", data_dir);
    let db_url = format!("sqlite://{}?mode=rwc", db_path);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Enable WAL mode for better concurrent read/write performance
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await?;

    run_migrations(&pool).await?;

    Ok(pool)
}

/// Creates an isolated pool at an explicit file path and runs migrations.
/// Used by tests to avoid any dependency on the `HOME` environment variable.
pub async fn init_db_at_path(db_path: &str) -> Result<SqlitePool> {
    if let Some(parent) = std::path::Path::new(db_path).parent() {
        fs::create_dir_all(parent)?;
    }
    let db_url = format!("sqlite://{}?mode=rwc", db_path);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await?;
    run_migrations(&pool).await?;
    Ok(pool)
}

/// Applies schema migrations in order.
async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS work_areas (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            position    INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS bundles (
            id           TEXT PRIMARY KEY,
            work_area_id TEXT NOT NULL REFERENCES work_areas(id),
            name         TEXT NOT NULL DEFAULT '',
            position     INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS todos (
            id           TEXT PRIMARY KEY,
            work_area_id TEXT NOT NULL REFERENCES work_areas(id),
            bundle_id    TEXT REFERENCES bundles(id),
            title        TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'todo',
            position     INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_init_db_creates_pool() {
        let db_path = std::env::temp_dir()
            .join(format!("todoapp-db-test-{}.sqlite", uuid::Uuid::new_v4()));
        let pool = init_db_at_path(db_path.to_str().unwrap())
            .await
            .expect("db init should succeed");
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM work_areas")
            .fetch_one(&pool)
            .await
            .expect("query should succeed");
        assert_eq!(row.0, 0);
    }
}
