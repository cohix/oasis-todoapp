use anyhow::{anyhow, Result};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::models::{ReorderItem, WorkArea};

/// Errors specific to work area operations.
#[derive(Debug)]
pub enum WorkAreaError {
    DuplicateName,
    NotFound,
    Db(anyhow::Error),
}

impl From<sqlx::Error> for WorkAreaError {
    fn from(e: sqlx::Error) -> Self {
        WorkAreaError::Db(e.into())
    }
}

/// Returns all work areas ordered by position ascending.
pub async fn list(pool: &SqlitePool) -> Result<Vec<WorkArea>> {
    let areas = sqlx::query_as::<_, WorkArea>(
        "SELECT id, name, position, created_at, updated_at
         FROM work_areas
         ORDER BY position ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(areas)
}

/// Creates a new work area at the end of the list.
/// Returns `WorkAreaError::DuplicateName` if a work area with that name already exists.
pub async fn create(pool: &SqlitePool, name: &str) -> Result<WorkArea, WorkAreaError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(WorkAreaError::Db(anyhow!("name must not be empty")));
    }

    // Duplicate name check
    let exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM work_areas WHERE name = ?")
            .bind(name)
            .fetch_optional(pool)
            .await?;
    if exists.is_some() {
        return Err(WorkAreaError::DuplicateName);
    }

    // Place at the end
    let (max_pos,): (i64,) =
        sqlx::query_as("SELECT COALESCE(MAX(position), -1) FROM work_areas")
            .fetch_one(pool)
            .await?;

    let id = Uuid::new_v4().to_string();
    let position = max_pos + 1;

    sqlx::query(
        "INSERT INTO work_areas (id, name, position) VALUES (?, ?, ?)",
    )
    .bind(&id)
    .bind(name)
    .bind(position)
    .execute(pool)
    .await?;

    let area = sqlx::query_as::<_, WorkArea>(
        "SELECT id, name, position, created_at, updated_at FROM work_areas WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool)
    .await?;

    Ok(area)
}

/// Renames an existing work area.
/// Returns `WorkAreaError::NotFound` or `WorkAreaError::DuplicateName` as appropriate.
pub async fn rename(
    pool: &SqlitePool,
    id: &str,
    new_name: &str,
) -> Result<WorkArea, WorkAreaError> {
    let new_name = new_name.trim();
    if new_name.is_empty() {
        return Err(WorkAreaError::Db(anyhow!("name must not be empty")));
    }

    // Make sure the target record exists
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM work_areas WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    if existing.is_none() {
        return Err(WorkAreaError::NotFound);
    }

    // Duplicate name check (excluding this record)
    let conflict: Option<(String,)> =
        sqlx::query_as("SELECT id FROM work_areas WHERE name = ? AND id != ?")
            .bind(new_name)
            .bind(id)
            .fetch_optional(pool)
            .await?;
    if conflict.is_some() {
        return Err(WorkAreaError::DuplicateName);
    }

    sqlx::query(
        "UPDATE work_areas SET name = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(new_name)
    .bind(id)
    .execute(pool)
    .await?;

    let area = sqlx::query_as::<_, WorkArea>(
        "SELECT id, name, position, created_at, updated_at FROM work_areas WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(area)
}

/// Updates the position of each work area in a single transaction.
pub async fn reorder(pool: &SqlitePool, items: &[ReorderItem]) -> Result<()> {
    let mut tx = pool.begin().await?;
    for item in items {
        sqlx::query(
            "UPDATE work_areas SET position = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(item.position)
        .bind(&item.id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db_at_path;

    async fn test_pool() -> SqlitePool {
        let db_path = std::env::temp_dir()
            .join(format!("todoapp-wa-{}.sqlite", Uuid::new_v4()));
        init_db_at_path(db_path.to_str().unwrap())
            .await
            .expect("db init")
    }

    #[tokio::test]
    async fn test_create_and_list() {
        let pool = test_pool().await;
        let area = create(&pool, "Design").await.expect("create");
        assert_eq!(area.name, "Design");
        assert_eq!(area.position, 0);

        let areas = list(&pool).await.expect("list");
        assert_eq!(areas.len(), 1);
        assert_eq!(areas[0].id, area.id);
    }

    #[tokio::test]
    async fn test_create_duplicate_name_is_rejected() {
        let pool = test_pool().await;
        create(&pool, "Alpha").await.expect("first create");
        let result = create(&pool, "Alpha").await;
        assert!(matches!(result, Err(WorkAreaError::DuplicateName)));
    }

    #[tokio::test]
    async fn test_rename() {
        let pool = test_pool().await;
        let area = create(&pool, "Old Name").await.expect("create");
        let updated = rename(&pool, &area.id, "New Name").await.expect("rename");
        assert_eq!(updated.name, "New Name");
    }

    #[tokio::test]
    async fn test_rename_duplicate_rejected() {
        let pool = test_pool().await;
        create(&pool, "Alpha").await.expect("create alpha");
        let beta = create(&pool, "Beta").await.expect("create beta");
        let result = rename(&pool, &beta.id, "Alpha").await;
        assert!(matches!(result, Err(WorkAreaError::DuplicateName)));
    }

    #[tokio::test]
    async fn test_rename_not_found() {
        let pool = test_pool().await;
        let result = rename(&pool, "nonexistent-id", "Anything").await;
        assert!(matches!(result, Err(WorkAreaError::NotFound)));
    }

    #[tokio::test]
    async fn test_reorder() {
        let pool = test_pool().await;
        let a = create(&pool, "A").await.expect("A");
        let b = create(&pool, "B").await.expect("B");

        // Swap positions
        let items = vec![
            ReorderItem { id: a.id.clone(), position: 1 },
            ReorderItem { id: b.id.clone(), position: 0 },
        ];
        reorder(&pool, &items).await.expect("reorder");

        let areas = list(&pool).await.expect("list");
        assert_eq!(areas[0].id, b.id);
        assert_eq!(areas[1].id, a.id);
    }
}
