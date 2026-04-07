use anyhow::Result;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::bundles;
use crate::models::{Todo, UpdateTodoRequest};

#[derive(Debug)]
pub enum TodoError {
    NotFound,
    InvalidStatus,
    Db(anyhow::Error),
}

impl From<sqlx::Error> for TodoError {
    fn from(e: sqlx::Error) -> Self {
        TodoError::Db(e.into())
    }
}

const VALID_STATUSES: &[&str] = &["todo", "in_progress", "completed"];

/// Returns all todos for a work area, ordered by bundle and then position.
pub async fn list(pool: &SqlitePool, work_area_id: &str) -> Result<Vec<Todo>, TodoError> {
    let todos = sqlx::query_as::<_, Todo>(
        "SELECT id, work_area_id, bundle_id, title, status, position, created_at, updated_at
         FROM todos
         WHERE work_area_id = ?
         ORDER BY
           CASE WHEN bundle_id IS NULL THEN 1 ELSE 0 END,
           bundle_id,
           position ASC",
    )
    .bind(work_area_id)
    .fetch_all(pool)
    .await?;
    Ok(todos)
}

/// Creates a new todo in the given work area with status "todo".
pub async fn create(pool: &SqlitePool, work_area_id: &str, title: &str) -> Result<Todo, TodoError> {
    let title = title.trim();

    let (max_pos,): (i64,) = sqlx::query_as(
        "SELECT COALESCE(MAX(position), -1) FROM todos
         WHERE work_area_id = ? AND bundle_id IS NULL",
    )
    .bind(work_area_id)
    .fetch_one(pool)
    .await?;

    let id = Uuid::new_v4().to_string();
    let position = max_pos + 1;

    sqlx::query(
        "INSERT INTO todos (id, work_area_id, title, status, position) VALUES (?, ?, ?, 'todo', ?)",
    )
    .bind(&id)
    .bind(work_area_id)
    .bind(title)
    .bind(position)
    .execute(pool)
    .await?;

    fetch_one(pool, &id).await
}

/// Full-replacement update for a todo. Automatically cleans up any bundle that
/// becomes empty as a result of the todo being moved out.
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    req: &UpdateTodoRequest,
) -> Result<Todo, TodoError> {
    if !VALID_STATUSES.contains(&req.status.as_str()) {
        return Err(TodoError::InvalidStatus);
    }

    // Fetch the existing record so we know the previous bundle_id
    let existing = fetch_one(pool, id).await?;
    let old_bundle_id = existing.bundle_id.clone();

    sqlx::query(
        "UPDATE todos
         SET title = ?, status = ?, bundle_id = ?, position = ?, updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(&req.title)
    .bind(&req.status)
    .bind(&req.bundle_id)
    .bind(req.position)
    .bind(id)
    .execute(pool)
    .await?;

    // If the todo left a bundle, clean up that bundle if it's now empty
    if let Some(prev_bundle) = old_bundle_id {
        if req.bundle_id.as_deref() != Some(&prev_bundle) {
            bundles::delete_if_empty(pool, &prev_bundle)
                .await
                .map_err(|e| TodoError::Db(e))?;
        }
    }

    fetch_one(pool, id).await
}

/// Deletes a todo and cleans up any bundle that becomes empty as a result.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), TodoError> {
    let existing = fetch_one(pool, id).await?;
    let old_bundle_id = existing.bundle_id.clone();

    sqlx::query("DELETE FROM todos WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if let Some(bundle_id) = old_bundle_id {
        bundles::delete_if_empty(pool, &bundle_id)
            .await
            .map_err(|e| TodoError::Db(e))?;
    }

    Ok(())
}

async fn fetch_one(pool: &SqlitePool, id: &str) -> Result<Todo, TodoError> {
    sqlx::query_as::<_, Todo>(
        "SELECT id, work_area_id, bundle_id, title, status, position, created_at, updated_at
         FROM todos WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or(TodoError::NotFound)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bundles;
    use crate::db::init_db_at_path;
    use crate::work_areas;

    async fn test_pool() -> SqlitePool {
        let db_path = std::env::temp_dir()
            .join(format!("todoapp-todos-{}.sqlite", Uuid::new_v4()));
        init_db_at_path(db_path.to_str().unwrap())
            .await
            .expect("db init")
    }

    async fn make_work_area(pool: &SqlitePool) -> String {
        work_areas::create(pool, "Test Area")
            .await
            .expect("create work area")
            .id
    }

    #[tokio::test]
    async fn test_create_and_list_todos() {
        let pool = test_pool().await;
        let wa_id = make_work_area(&pool).await;

        let todo = create(&pool, &wa_id, "Buy milk").await.expect("create");
        assert_eq!(todo.title, "Buy milk");
        assert_eq!(todo.status, "todo");
        assert!(todo.bundle_id.is_none());

        let todos = list(&pool, &wa_id).await.expect("list");
        assert_eq!(todos.len(), 1);
    }

    #[tokio::test]
    async fn test_update_status() {
        let pool = test_pool().await;
        let wa_id = make_work_area(&pool).await;
        let todo = create(&pool, &wa_id, "Task").await.expect("create");

        let req = UpdateTodoRequest {
            title: todo.title.clone(),
            status: "in_progress".to_string(),
            bundle_id: None,
            position: todo.position,
        };
        let updated = update(&pool, &todo.id, &req).await.expect("update");
        assert_eq!(updated.status, "in_progress");
    }

    #[tokio::test]
    async fn test_invalid_status_rejected() {
        let pool = test_pool().await;
        let wa_id = make_work_area(&pool).await;
        let todo = create(&pool, &wa_id, "Task").await.expect("create");

        let req = UpdateTodoRequest {
            title: todo.title.clone(),
            status: "done".to_string(), // invalid
            bundle_id: None,
            position: 0,
        };
        let result = update(&pool, &todo.id, &req).await;
        assert!(matches!(result, Err(TodoError::InvalidStatus)));
    }

    #[tokio::test]
    async fn test_bundle_auto_deleted_when_last_todo_leaves() {
        let pool = test_pool().await;
        let wa_id = make_work_area(&pool).await;

        let bundle = bundles::create(&pool, &wa_id, "Bundle")
            .await
            .expect("create bundle");
        let todo = create(&pool, &wa_id, "Task").await.expect("create todo");

        // Move todo into bundle
        let req = UpdateTodoRequest {
            title: todo.title.clone(),
            status: "todo".to_string(),
            bundle_id: Some(bundle.id.clone()),
            position: 0,
        };
        update(&pool, &todo.id, &req).await.expect("update");

        // Move todo out of bundle — bundle should be auto-deleted
        let req2 = UpdateTodoRequest {
            title: todo.title.clone(),
            status: "todo".to_string(),
            bundle_id: None,
            position: 0,
        };
        update(&pool, &todo.id, &req2).await.expect("update 2");

        let bundles_remaining = bundles::list(&pool, &wa_id).await.expect("list bundles");
        assert!(bundles_remaining.is_empty());
    }

    #[tokio::test]
    async fn test_delete_todo() {
        let pool = test_pool().await;
        let wa_id = make_work_area(&pool).await;
        let todo = create(&pool, &wa_id, "Task").await.expect("create");
        delete(&pool, &todo.id).await.expect("delete");

        let todos = list(&pool, &wa_id).await.expect("list");
        assert!(todos.is_empty());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = test_pool().await;
        let result = delete(&pool, "no-such-id").await;
        assert!(matches!(result, Err(TodoError::NotFound)));
    }
}
