use anyhow::Result;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::models::Bundle;

#[derive(Debug)]
pub enum BundleError {
    NotFound,
    Db(anyhow::Error),
}

impl From<sqlx::Error> for BundleError {
    fn from(e: sqlx::Error) -> Self {
        BundleError::Db(e.into())
    }
}

/// Returns all bundles for a work area, ordered by position.
pub async fn list(pool: &SqlitePool, work_area_id: &str) -> Result<Vec<Bundle>> {
    let bundles = sqlx::query_as::<_, Bundle>(
        "SELECT id, work_area_id, name, position, created_at, updated_at
         FROM bundles
         WHERE work_area_id = ?
         ORDER BY position ASC",
    )
    .bind(work_area_id)
    .fetch_all(pool)
    .await?;
    Ok(bundles)
}

/// Creates a new bundle at the end of the list for a work area.
pub async fn create(pool: &SqlitePool, work_area_id: &str, name: &str) -> Result<Bundle> {
    let (max_pos,): (i64,) = sqlx::query_as(
        "SELECT COALESCE(MAX(position), -1) FROM bundles WHERE work_area_id = ?",
    )
    .bind(work_area_id)
    .fetch_one(pool)
    .await?;

    let id = Uuid::new_v4().to_string();
    let position = max_pos + 1;

    sqlx::query(
        "INSERT INTO bundles (id, work_area_id, name, position) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(work_area_id)
    .bind(name)
    .bind(position)
    .execute(pool)
    .await?;

    let bundle = sqlx::query_as::<_, Bundle>(
        "SELECT id, work_area_id, name, position, created_at, updated_at
         FROM bundles WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool)
    .await?;

    Ok(bundle)
}

/// Renames a bundle. Returns `BundleError::NotFound` if the id doesn't exist.
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    name: &str,
) -> Result<Bundle, BundleError> {
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM bundles WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    if existing.is_none() {
        return Err(BundleError::NotFound);
    }

    sqlx::query(
        "UPDATE bundles SET name = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(name)
    .bind(id)
    .execute(pool)
    .await?;

    let bundle = sqlx::query_as::<_, Bundle>(
        "SELECT id, work_area_id, name, position, created_at, updated_at
         FROM bundles WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(bundle)
}

/// Deletes a bundle. All todos in the bundle are moved to ungrouped (bundle_id = NULL).
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), BundleError> {
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM bundles WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    if existing.is_none() {
        return Err(BundleError::NotFound);
    }

    let mut tx = pool.begin().await.map_err(|e| BundleError::Db(e.into()))?;

    // Unbundle all todos belonging to this bundle
    sqlx::query("UPDATE todos SET bundle_id = NULL, updated_at = datetime('now') WHERE bundle_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM bundles WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await.map_err(|e| BundleError::Db(e.into()))?;
    Ok(())
}

/// Deletes a bundle if it contains no todos. Used after a todo is removed from a bundle.
pub async fn delete_if_empty(pool: &SqlitePool, bundle_id: &str) -> Result<()> {
    let (count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM todos WHERE bundle_id = ?")
            .bind(bundle_id)
            .fetch_one(pool)
            .await?;

    if count == 0 {
        sqlx::query("DELETE FROM bundles WHERE id = ?")
            .bind(bundle_id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db_at_path;
    use crate::work_areas;

    async fn test_pool() -> SqlitePool {
        let db_path = std::env::temp_dir()
            .join(format!("todoapp-bundles-{}.sqlite", Uuid::new_v4()));
        init_db_at_path(db_path.to_str().unwrap())
            .await
            .expect("db init")
    }

    async fn make_work_area(pool: &SqlitePool) -> String {
        let area = work_areas::create(pool, "Test Area")
            .await
            .expect("create work area");
        area.id
    }

    #[tokio::test]
    async fn test_create_and_list_bundles() {
        let pool = test_pool().await;
        let wa_id = make_work_area(&pool).await;

        let b = create(&pool, &wa_id, "Sprint 1").await.expect("create");
        assert_eq!(b.name, "Sprint 1");
        assert_eq!(b.position, 0);

        let bundles = list(&pool, &wa_id).await.expect("list");
        assert_eq!(bundles.len(), 1);
    }

    #[tokio::test]
    async fn test_update_bundle() {
        let pool = test_pool().await;
        let wa_id = make_work_area(&pool).await;
        let b = create(&pool, &wa_id, "Old").await.expect("create");
        let updated = update(&pool, &b.id, "New").await.expect("update");
        assert_eq!(updated.name, "New");
    }

    #[tokio::test]
    async fn test_update_not_found() {
        let pool = test_pool().await;
        let result = update(&pool, "no-such-id", "Name").await;
        assert!(matches!(result, Err(BundleError::NotFound)));
    }

    #[tokio::test]
    async fn test_delete_unbundles_todos() {
        let pool = test_pool().await;
        let wa_id = make_work_area(&pool).await;
        let b = create(&pool, &wa_id, "Bundle").await.expect("create bundle");

        // Insert a todo directly linked to the bundle
        let todo_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO todos (id, work_area_id, bundle_id, title) VALUES (?, ?, ?, ?)",
        )
        .bind(&todo_id)
        .bind(&wa_id)
        .bind(&b.id)
        .bind("A task")
        .execute(&pool)
        .await
        .expect("insert todo");

        delete(&pool, &b.id).await.expect("delete bundle");

        // Todo should still exist but be unbundled
        let (bundle_id,): (Option<String>,) =
            sqlx::query_as("SELECT bundle_id FROM todos WHERE id = ?")
                .bind(&todo_id)
                .fetch_one(&pool)
                .await
                .expect("fetch todo");
        assert!(bundle_id.is_none());
    }
}
