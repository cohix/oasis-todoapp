use serde::{Deserialize, Serialize};

/// A work area row as stored in SQLite.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WorkArea {
    pub id: String,
    pub name: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Request body for creating a work area.
#[derive(Debug, Deserialize)]
pub struct CreateWorkAreaRequest {
    pub name: String,
}

/// Request body for renaming a work area.
#[derive(Debug, Deserialize)]
pub struct UpdateWorkAreaRequest {
    pub name: String,
}

/// One entry in a reorder request.
#[derive(Debug, Deserialize)]
pub struct ReorderItem {
    pub id: String,
    pub position: i64,
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Bundle {
    pub id: String,
    pub work_area_id: String,
    pub name: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBundleRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBundleRequest {
    pub name: String,
}

// ---------------------------------------------------------------------------
// Todo
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Todo {
    pub id: String,
    pub work_area_id: String,
    pub bundle_id: Option<String>,
    pub title: String,
    /// One of: "todo", "in_progress", "completed"
    pub status: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTodoRequest {
    pub title: String,
}

/// Full-replacement update. Send all fields; `bundle_id: null` means ungrouped.
#[derive(Debug, Deserialize)]
pub struct UpdateTodoRequest {
    pub title: String,
    pub status: String,
    pub bundle_id: Option<String>,
    pub position: i64,
}
