use std::convert::Infallible;

use serde_json::json;
use sqlx::SqlitePool;
use warp::{http::StatusCode, Filter, Rejection, Reply};

use crate::bundles::{self, BundleError};
use crate::models::{
    CreateBundleRequest, CreateTodoRequest, CreateWorkAreaRequest, ReorderItem,
    UpdateBundleRequest, UpdateTodoRequest, UpdateWorkAreaRequest,
};
use crate::todos::{self, TodoError};
use crate::work_areas::{self, WorkAreaError};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Builds all routes.
/// CORS is not needed here because in the Docker setup nginx proxies /api/ to
/// the backend on the same origin as the frontend.
pub fn all_routes(
    pool: SqlitePool,
) -> impl Filter<Extract = impl Reply, Error = Infallible> + Clone {
    health_route()
        .or(work_area_routes(pool.clone()))
        .or(todo_routes(pool.clone()))
        .or(bundle_routes(pool))
        .recover(handle_rejection)
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

fn health_route() -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::path!("api" / "v1" / "health")
        .and(warp::get())
        .map(|| warp::reply::with_status("OK", StatusCode::OK))
}

// ---------------------------------------------------------------------------
// Work area routes
// ---------------------------------------------------------------------------

fn work_area_routes(
    pool: SqlitePool,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    let base = warp::path("api").and(warp::path("v1")).and(warp::path("work-areas"));
    let with_pool = warp::any().map(move || pool.clone());

    // GET /api/v1/work-areas
    let list = base
        .and(warp::path::end())
        .and(warp::get())
        .and(with_pool.clone())
        .and_then(list_handler);

    // POST /api/v1/work-areas
    let create = base
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json::<CreateWorkAreaRequest>())
        .and(with_pool.clone())
        .and_then(create_handler);

    // PUT /api/v1/work-areas/reorder  — must come before :id to avoid ambiguity
    let reorder = base
        .and(warp::path("reorder"))
        .and(warp::path::end())
        .and(warp::put())
        .and(warp::body::json::<Vec<ReorderItem>>())
        .and(with_pool.clone())
        .and_then(reorder_handler);

    // PUT /api/v1/work-areas/:id
    let update = base
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::put())
        .and(warp::body::json::<UpdateWorkAreaRequest>())
        .and(with_pool.clone())
        .and_then(update_handler);

    list.or(create).or(reorder).or(update)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn list_handler(pool: SqlitePool) -> Result<impl Reply, Rejection> {
    match work_areas::list(&pool).await {
        Ok(areas) => Ok(warp::reply::with_status(
            warp::reply::json(&areas),
            StatusCode::OK,
        )),
        Err(e) => {
            eprintln!("list_handler error: {e}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn create_handler(
    body: CreateWorkAreaRequest,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match work_areas::create(&pool, &body.name).await {
        Ok(area) => Ok(warp::reply::with_status(
            warp::reply::json(&area),
            StatusCode::CREATED,
        )),
        Err(WorkAreaError::DuplicateName) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"error": "a work area with that name already exists"})),
            StatusCode::CONFLICT,
        )),
        Err(e) => {
            eprintln!("create_handler error: {e:?}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn update_handler(
    id: String,
    body: UpdateWorkAreaRequest,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match work_areas::rename(&pool, &id, &body.name).await {
        Ok(area) => Ok(warp::reply::with_status(
            warp::reply::json(&area),
            StatusCode::OK,
        )),
        Err(WorkAreaError::NotFound) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"error": "work area not found"})),
            StatusCode::NOT_FOUND,
        )),
        Err(WorkAreaError::DuplicateName) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"error": "a work area with that name already exists"})),
            StatusCode::CONFLICT,
        )),
        Err(e) => {
            eprintln!("update_handler error: {e:?}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn reorder_handler(
    items: Vec<ReorderItem>,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match work_areas::reorder(&pool, &items).await {
        Ok(()) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"ok": true})),
            StatusCode::OK,
        )),
        Err(e) => {
            eprintln!("reorder_handler error: {e}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// Todo routes
// ---------------------------------------------------------------------------

fn todo_routes(
    pool: SqlitePool,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    let base = warp::path("api").and(warp::path("v1"));
    let with_pool = warp::any().map(move || pool.clone());

    // GET /api/v1/work-areas/:wa_id/todos
    let list = base
        .and(warp::path("work-areas"))
        .and(warp::path::param::<String>())
        .and(warp::path("todos"))
        .and(warp::path::end())
        .and(warp::get())
        .and(with_pool.clone())
        .and_then(list_todos_handler);

    // POST /api/v1/work-areas/:wa_id/todos
    let create = base
        .and(warp::path("work-areas"))
        .and(warp::path::param::<String>())
        .and(warp::path("todos"))
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json::<CreateTodoRequest>())
        .and(with_pool.clone())
        .and_then(create_todo_handler);

    // PUT /api/v1/todos/:id
    let update = base
        .and(warp::path("todos"))
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::put())
        .and(warp::body::json::<UpdateTodoRequest>())
        .and(with_pool.clone())
        .and_then(update_todo_handler);

    // DELETE /api/v1/todos/:id
    let delete = base
        .and(warp::path("todos"))
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::delete())
        .and(with_pool.clone())
        .and_then(delete_todo_handler);

    list.or(create).or(update).or(delete)
}

async fn list_todos_handler(
    work_area_id: String,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match todos::list(&pool, &work_area_id).await {
        Ok(items) => Ok(warp::reply::with_status(
            warp::reply::json(&items),
            StatusCode::OK,
        )),
        Err(e) => {
            eprintln!("list_todos error: {e:?}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn create_todo_handler(
    work_area_id: String,
    body: CreateTodoRequest,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match todos::create(&pool, &work_area_id, &body.title).await {
        Ok(todo) => Ok(warp::reply::with_status(
            warp::reply::json(&todo),
            StatusCode::CREATED,
        )),
        Err(e) => {
            eprintln!("create_todo error: {e:?}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn update_todo_handler(
    id: String,
    body: UpdateTodoRequest,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match todos::update(&pool, &id, &body).await {
        Ok(todo) => Ok(warp::reply::with_status(
            warp::reply::json(&todo),
            StatusCode::OK,
        )),
        Err(TodoError::NotFound) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"error": "todo not found"})),
            StatusCode::NOT_FOUND,
        )),
        Err(TodoError::InvalidStatus) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"error": "invalid status value"})),
            StatusCode::BAD_REQUEST,
        )),
        Err(e) => {
            eprintln!("update_todo error: {e:?}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn delete_todo_handler(id: String, pool: SqlitePool) -> Result<impl Reply, Rejection> {
    match todos::delete(&pool, &id).await {
        Ok(()) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"ok": true})),
            StatusCode::OK,
        )),
        Err(TodoError::NotFound) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"error": "todo not found"})),
            StatusCode::NOT_FOUND,
        )),
        Err(e) => {
            eprintln!("delete_todo error: {e:?}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// Bundle routes
// ---------------------------------------------------------------------------

fn bundle_routes(
    pool: SqlitePool,
) -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    let base = warp::path("api").and(warp::path("v1"));
    let with_pool = warp::any().map(move || pool.clone());

    // GET /api/v1/work-areas/:wa_id/bundles
    let list = base
        .and(warp::path("work-areas"))
        .and(warp::path::param::<String>())
        .and(warp::path("bundles"))
        .and(warp::path::end())
        .and(warp::get())
        .and(with_pool.clone())
        .and_then(list_bundles_handler);

    // POST /api/v1/work-areas/:wa_id/bundles
    let create = base
        .and(warp::path("work-areas"))
        .and(warp::path::param::<String>())
        .and(warp::path("bundles"))
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json::<CreateBundleRequest>())
        .and(with_pool.clone())
        .and_then(create_bundle_handler);

    // PUT /api/v1/bundles/:id
    let update = base
        .and(warp::path("bundles"))
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::put())
        .and(warp::body::json::<UpdateBundleRequest>())
        .and(with_pool.clone())
        .and_then(update_bundle_handler);

    // DELETE /api/v1/bundles/:id
    let delete = base
        .and(warp::path("bundles"))
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::delete())
        .and(with_pool.clone())
        .and_then(delete_bundle_handler);

    list.or(create).or(update).or(delete)
}

async fn list_bundles_handler(
    work_area_id: String,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match bundles::list(&pool, &work_area_id).await {
        Ok(items) => Ok(warp::reply::with_status(
            warp::reply::json(&items),
            StatusCode::OK,
        )),
        Err(e) => {
            eprintln!("list_bundles error: {e}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn create_bundle_handler(
    work_area_id: String,
    body: CreateBundleRequest,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match bundles::create(&pool, &work_area_id, &body.name).await {
        Ok(bundle) => Ok(warp::reply::with_status(
            warp::reply::json(&bundle),
            StatusCode::CREATED,
        )),
        Err(e) => {
            eprintln!("create_bundle error: {e}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn update_bundle_handler(
    id: String,
    body: UpdateBundleRequest,
    pool: SqlitePool,
) -> Result<impl Reply, Rejection> {
    match bundles::update(&pool, &id, &body.name).await {
        Ok(bundle) => Ok(warp::reply::with_status(
            warp::reply::json(&bundle),
            StatusCode::OK,
        )),
        Err(BundleError::NotFound) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"error": "bundle not found"})),
            StatusCode::NOT_FOUND,
        )),
        Err(e) => {
            eprintln!("update_bundle error: {e:?}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn delete_bundle_handler(id: String, pool: SqlitePool) -> Result<impl Reply, Rejection> {
    match bundles::delete(&pool, &id).await {
        Ok(()) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"ok": true})),
            StatusCode::OK,
        )),
        Err(BundleError::NotFound) => Ok(warp::reply::with_status(
            warp::reply::json(&json!({"error": "bundle not found"})),
            StatusCode::NOT_FOUND,
        )),
        Err(e) => {
            eprintln!("delete_bundle error: {e:?}");
            Ok(warp::reply::with_status(
                warp::reply::json(&json!({"error": "internal server error"})),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// Rejection handler
// ---------------------------------------------------------------------------

async fn handle_rejection(err: Rejection) -> Result<impl Reply, Infallible> {
    let (code, message) = if err.is_not_found() {
        (StatusCode::NOT_FOUND, "not found")
    } else if err.find::<warp::filters::body::BodyDeserializeError>().is_some() {
        (StatusCode::BAD_REQUEST, "invalid request body")
    } else if err.find::<warp::reject::MethodNotAllowed>().is_some() {
        (StatusCode::METHOD_NOT_ALLOWED, "method not allowed")
    } else {
        eprintln!("unhandled rejection: {err:?}");
        (StatusCode::INTERNAL_SERVER_ERROR, "internal server error")
    };

    Ok(warp::reply::with_status(
        warp::reply::json(&json!({ "error": message })),
        code,
    ))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db_at_path;
    use uuid::Uuid;

    async fn test_routes() -> impl Filter<Extract = impl Reply, Error = Infallible> + Clone {
        let db_path = std::env::temp_dir()
            .join(format!("todoapp-routes-{}.sqlite", Uuid::new_v4()));
        let pool = init_db_at_path(db_path.to_str().unwrap())
            .await
            .expect("db init");
        all_routes(pool)
    }

    #[tokio::test]
    async fn test_health_returns_200() {
        let routes = test_routes().await;
        let res = warp::test::request()
            .method("GET")
            .path("/api/v1/health")
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 200);
    }

    #[tokio::test]
    async fn test_list_work_areas_initially_empty() {
        let routes = test_routes().await;
        let res = warp::test::request()
            .method("GET")
            .path("/api/v1/work-areas")
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 200);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body, json!([]));
    }

    #[tokio::test]
    async fn test_create_work_area() {
        let routes = test_routes().await;
        let res = warp::test::request()
            .method("POST")
            .path("/api/v1/work-areas")
            .json(&json!({"name": "Design"}))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 201);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body["name"], "Design");
    }

    #[tokio::test]
    async fn test_create_duplicate_returns_409() {
        let routes = test_routes().await;
        warp::test::request()
            .method("POST")
            .path("/api/v1/work-areas")
            .json(&json!({"name": "Alpha"}))
            .reply(&routes)
            .await;
        let res = warp::test::request()
            .method("POST")
            .path("/api/v1/work-areas")
            .json(&json!({"name": "Alpha"}))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 409);
    }

    #[tokio::test]
    async fn test_rename_work_area() {
        let routes = test_routes().await;
        let create_res = warp::test::request()
            .method("POST")
            .path("/api/v1/work-areas")
            .json(&json!({"name": "Old"}))
            .reply(&routes)
            .await;
        let created: serde_json::Value = serde_json::from_slice(create_res.body()).unwrap();
        let id = created["id"].as_str().unwrap();

        let res = warp::test::request()
            .method("PUT")
            .path(&format!("/api/v1/work-areas/{id}"))
            .json(&json!({"name": "New"}))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 200);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body["name"], "New");
    }

    #[tokio::test]
    async fn test_rename_work_area_not_found() {
        let routes = test_routes().await;
        let res = warp::test::request()
            .method("PUT")
            .path("/api/v1/work-areas/no-such-id")
            .json(&json!({"name": "Anything"}))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 404);
    }

    // ---- Todo routes ----

    async fn create_work_area_id(routes: &(impl Filter<Extract = impl Reply, Error = Infallible> + Clone + 'static)) -> String {
        let res = warp::test::request()
            .method("POST")
            .path("/api/v1/work-areas")
            .json(&json!({"name": format!("WA-{}", Uuid::new_v4())}))
            .reply(routes)
            .await;
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        body["id"].as_str().unwrap().to_string()
    }

    #[tokio::test]
    async fn test_list_todos_empty() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;
        let res = warp::test::request()
            .method("GET")
            .path(&format!("/api/v1/work-areas/{wa_id}/todos"))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 200);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body, json!([]));
    }

    #[tokio::test]
    async fn test_create_todo() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;
        let res = warp::test::request()
            .method("POST")
            .path(&format!("/api/v1/work-areas/{wa_id}/todos"))
            .json(&json!({"title": "Write tests"}))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 201);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body["title"], "Write tests");
        assert_eq!(body["status"], "todo");
        assert!(body["bundle_id"].is_null());
    }

    #[tokio::test]
    async fn test_update_todo_status() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;

        let create_res = warp::test::request()
            .method("POST")
            .path(&format!("/api/v1/work-areas/{wa_id}/todos"))
            .json(&json!({"title": "A task"}))
            .reply(&routes)
            .await;
        let todo: serde_json::Value = serde_json::from_slice(create_res.body()).unwrap();
        let todo_id = todo["id"].as_str().unwrap();

        let res = warp::test::request()
            .method("PUT")
            .path(&format!("/api/v1/todos/{todo_id}"))
            .json(&json!({
                "title": "A task",
                "status": "in_progress",
                "bundle_id": null,
                "position": 0
            }))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 200);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body["status"], "in_progress");
    }

    #[tokio::test]
    async fn test_update_todo_invalid_status_returns_400() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;
        let create_res = warp::test::request()
            .method("POST")
            .path(&format!("/api/v1/work-areas/{wa_id}/todos"))
            .json(&json!({"title": "Task"}))
            .reply(&routes)
            .await;
        let todo: serde_json::Value = serde_json::from_slice(create_res.body()).unwrap();
        let todo_id = todo["id"].as_str().unwrap();

        let res = warp::test::request()
            .method("PUT")
            .path(&format!("/api/v1/todos/{todo_id}"))
            .json(&json!({"title": "Task", "status": "done", "bundle_id": null, "position": 0}))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 400);
    }

    #[tokio::test]
    async fn test_delete_todo() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;
        let create_res = warp::test::request()
            .method("POST")
            .path(&format!("/api/v1/work-areas/{wa_id}/todos"))
            .json(&json!({"title": "To delete"}))
            .reply(&routes)
            .await;
        let todo: serde_json::Value = serde_json::from_slice(create_res.body()).unwrap();
        let todo_id = todo["id"].as_str().unwrap();

        let del_res = warp::test::request()
            .method("DELETE")
            .path(&format!("/api/v1/todos/{todo_id}"))
            .reply(&routes)
            .await;
        assert_eq!(del_res.status(), 200);

        // Verify it's gone
        let list_res = warp::test::request()
            .method("GET")
            .path(&format!("/api/v1/work-areas/{wa_id}/todos"))
            .reply(&routes)
            .await;
        let todos: serde_json::Value = serde_json::from_slice(list_res.body()).unwrap();
        assert_eq!(todos.as_array().unwrap().len(), 0);
    }

    // ---- Bundle routes ----

    #[tokio::test]
    async fn test_list_bundles_empty() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;
        let res = warp::test::request()
            .method("GET")
            .path(&format!("/api/v1/work-areas/{wa_id}/bundles"))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 200);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body, json!([]));
    }

    #[tokio::test]
    async fn test_create_bundle() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;
        let res = warp::test::request()
            .method("POST")
            .path(&format!("/api/v1/work-areas/{wa_id}/bundles"))
            .json(&json!({"name": "Sprint 1"}))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 201);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body["name"], "Sprint 1");
    }

    #[tokio::test]
    async fn test_update_bundle() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;
        let create_res = warp::test::request()
            .method("POST")
            .path(&format!("/api/v1/work-areas/{wa_id}/bundles"))
            .json(&json!({"name": "Old"}))
            .reply(&routes)
            .await;
        let bundle: serde_json::Value = serde_json::from_slice(create_res.body()).unwrap();
        let bundle_id = bundle["id"].as_str().unwrap();

        let res = warp::test::request()
            .method("PUT")
            .path(&format!("/api/v1/bundles/{bundle_id}"))
            .json(&json!({"name": "New"}))
            .reply(&routes)
            .await;
        assert_eq!(res.status(), 200);
        let body: serde_json::Value = serde_json::from_slice(res.body()).unwrap();
        assert_eq!(body["name"], "New");
    }

    #[tokio::test]
    async fn test_delete_bundle_unbundles_todos() {
        let routes = test_routes().await;
        let wa_id = create_work_area_id(&routes).await;

        // Create bundle
        let b_res = warp::test::request()
            .method("POST")
            .path(&format!("/api/v1/work-areas/{wa_id}/bundles"))
            .json(&json!({"name": "Bundle"}))
            .reply(&routes)
            .await;
        let bundle: serde_json::Value = serde_json::from_slice(b_res.body()).unwrap();
        let bundle_id = bundle["id"].as_str().unwrap();

        // Create a todo and assign to bundle
        let t_res = warp::test::request()
            .method("POST")
            .path(&format!("/api/v1/work-areas/{wa_id}/todos"))
            .json(&json!({"title": "Bundled task"}))
            .reply(&routes)
            .await;
        let todo: serde_json::Value = serde_json::from_slice(t_res.body()).unwrap();
        let todo_id = todo["id"].as_str().unwrap();

        warp::test::request()
            .method("PUT")
            .path(&format!("/api/v1/todos/{todo_id}"))
            .json(&json!({"title": "Bundled task", "status": "todo", "bundle_id": bundle_id, "position": 0}))
            .reply(&routes)
            .await;

        // Delete the bundle
        let del_res = warp::test::request()
            .method("DELETE")
            .path(&format!("/api/v1/bundles/{bundle_id}"))
            .reply(&routes)
            .await;
        assert_eq!(del_res.status(), 200);

        // Todo should still exist but be ungrouped
        let list_res = warp::test::request()
            .method("GET")
            .path(&format!("/api/v1/work-areas/{wa_id}/todos"))
            .reply(&routes)
            .await;
        let todos: serde_json::Value = serde_json::from_slice(list_res.body()).unwrap();
        let todos_arr = todos.as_array().unwrap();
        assert_eq!(todos_arr.len(), 1);
        assert!(todos_arr[0]["bundle_id"].is_null());
    }
}
