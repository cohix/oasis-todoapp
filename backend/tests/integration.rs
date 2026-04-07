//! Integration tests that exercise multiple modules working together,
//! verifying full user-story workflows end-to-end at the data layer.

use backend::{bundles, db, models::ReorderItem, todos, work_areas};
use sqlx::SqlitePool;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async fn test_pool() -> SqlitePool {
    let db_path = std::env::temp_dir()
        .join(format!("todoapp-int-{}.sqlite", Uuid::new_v4()));
    db::init_db_at_path(db_path.to_str().unwrap())
        .await
        .expect("db init")
}

// ---------------------------------------------------------------------------
// Work area lifecycle
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_work_area_full_lifecycle() {
    let pool = test_pool().await;

    // Create two work areas
    let wa1 = work_areas::create(&pool, "Frontend").await.expect("create wa1");
    let wa2 = work_areas::create(&pool, "Backend").await.expect("create wa2");
    assert_eq!(wa1.position, 0);
    assert_eq!(wa2.position, 1);

    // List is ordered by position
    let areas = work_areas::list(&pool).await.expect("list");
    assert_eq!(areas.len(), 2);
    assert_eq!(areas[0].id, wa1.id);

    // Rename
    let renamed = work_areas::rename(&pool, &wa1.id, "UI").await.expect("rename");
    assert_eq!(renamed.name, "UI");

    // Reorder: swap them
    work_areas::reorder(
        &pool,
        &[
            ReorderItem { id: wa1.id.clone(), position: 1 },
            ReorderItem { id: wa2.id.clone(), position: 0 },
        ],
    )
    .await
    .expect("reorder");

    let areas = work_areas::list(&pool).await.expect("list after reorder");
    assert_eq!(areas[0].id, wa2.id);
    assert_eq!(areas[1].id, wa1.id);
}

#[tokio::test]
async fn test_work_area_name_uniqueness_enforced() {
    let pool = test_pool().await;
    work_areas::create(&pool, "Shared").await.expect("first");
    let err = work_areas::create(&pool, "Shared").await.unwrap_err();
    assert!(matches!(err, work_areas::WorkAreaError::DuplicateName));
}

#[tokio::test]
async fn test_work_area_rename_to_same_name_succeeds() {
    // Renaming to the existing name of the *same* record must not be rejected
    let pool = test_pool().await;
    let wa = work_areas::create(&pool, "Design").await.expect("create");
    let result = work_areas::rename(&pool, &wa.id, "Design").await;
    assert!(result.is_ok(), "rename to same name should succeed");
}

// ---------------------------------------------------------------------------
// Todo lifecycle within a work area
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_todo_full_lifecycle() {
    let pool = test_pool().await;
    let wa = work_areas::create(&pool, "Work").await.expect("create wa");

    // Create todos — verify positions assigned sequentially
    let t1 = todos::create(&pool, &wa.id, "Task one").await.expect("t1");
    let t2 = todos::create(&pool, &wa.id, "Task two").await.expect("t2");
    assert_eq!(t1.position, 0);
    assert_eq!(t2.position, 1);
    assert_eq!(t1.status, "todo");

    // Update status
    let updated = todos::update(
        &pool,
        &t1.id,
        &backend::models::UpdateTodoRequest {
            title: t1.title.clone(),
            status: "in_progress".to_string(),
            bundle_id: None,
            position: t1.position,
        },
    )
    .await
    .expect("update status");
    assert_eq!(updated.status, "in_progress");

    // List returns both, ungrouped at bottom (both have bundle_id=None)
    let all = todos::list(&pool, &wa.id).await.expect("list");
    assert_eq!(all.len(), 2);

    // Delete one
    todos::delete(&pool, &t1.id).await.expect("delete");
    let remaining = todos::list(&pool, &wa.id).await.expect("list after delete");
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].id, t2.id);
}

#[tokio::test]
async fn test_todo_status_transitions() {
    let pool = test_pool().await;
    let wa = work_areas::create(&pool, "Area").await.expect("create wa");
    let t = todos::create(&pool, &wa.id, "Flip").await.expect("create");

    for status in ["in_progress", "completed", "todo"] {
        let req = backend::models::UpdateTodoRequest {
            title: t.title.clone(),
            status: status.to_string(),
            bundle_id: None,
            position: t.position,
        };
        let updated = todos::update(&pool, &t.id, &req).await.expect(status);
        assert_eq!(updated.status, status);
    }
}

#[tokio::test]
async fn test_todos_isolated_between_work_areas() {
    let pool = test_pool().await;
    let wa1 = work_areas::create(&pool, "Area 1").await.expect("wa1");
    let wa2 = work_areas::create(&pool, "Area 2").await.expect("wa2");

    todos::create(&pool, &wa1.id, "Todo in WA1").await.expect("todo wa1");
    todos::create(&pool, &wa2.id, "Todo in WA2").await.expect("todo wa2");

    let wa1_todos = todos::list(&pool, &wa1.id).await.expect("list wa1");
    let wa2_todos = todos::list(&pool, &wa2.id).await.expect("list wa2");

    assert_eq!(wa1_todos.len(), 1);
    assert_eq!(wa2_todos.len(), 1);
    assert_eq!(wa1_todos[0].title, "Todo in WA1");
    assert_eq!(wa2_todos[0].title, "Todo in WA2");
}

// ---------------------------------------------------------------------------
// Bundle lifecycle
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_bundle_todo_grouping_workflow() {
    let pool = test_pool().await;
    let wa = work_areas::create(&pool, "Project").await.expect("create wa");

    // Create todos ungrouped
    let t1 = todos::create(&pool, &wa.id, "Design UI").await.expect("t1");
    let t2 = todos::create(&pool, &wa.id, "Write tests").await.expect("t2");

    // Create a bundle and group both todos into it
    let bundle = bundles::create(&pool, &wa.id, "Sprint 1").await.expect("bundle");

    let req1 = backend::models::UpdateTodoRequest {
        title: t1.title.clone(),
        status: "todo".to_string(),
        bundle_id: Some(bundle.id.clone()),
        position: 0,
    };
    todos::update(&pool, &t1.id, &req1).await.expect("bundle t1");

    let req2 = backend::models::UpdateTodoRequest {
        title: t2.title.clone(),
        status: "todo".to_string(),
        bundle_id: Some(bundle.id.clone()),
        position: 1,
    };
    todos::update(&pool, &t2.id, &req2).await.expect("bundle t2");

    // List todos — both should have bundle_id set
    let all = todos::list(&pool, &wa.id).await.expect("list");
    assert!(all.iter().all(|t| t.bundle_id == Some(bundle.id.clone())));

    // Rename bundle
    let renamed = bundles::update(&pool, &bundle.id, "Sprint Alpha").await.expect("rename");
    assert_eq!(renamed.name, "Sprint Alpha");

    // Remove t1 from bundle — bundle should survive (t2 still in it)
    let req_unbundle = backend::models::UpdateTodoRequest {
        title: t1.title.clone(),
        status: "todo".to_string(),
        bundle_id: None,
        position: 0,
    };
    todos::update(&pool, &t1.id, &req_unbundle).await.expect("unbundle t1");

    let bundles_after = bundles::list(&pool, &wa.id).await.expect("list bundles");
    assert_eq!(bundles_after.len(), 1, "bundle survives when one todo remains");

    // Remove t2 as well — bundle should auto-delete
    let req_unbundle2 = backend::models::UpdateTodoRequest {
        title: t2.title.clone(),
        status: "todo".to_string(),
        bundle_id: None,
        position: 1,
    };
    todos::update(&pool, &t2.id, &req_unbundle2).await.expect("unbundle t2");

    let bundles_final = bundles::list(&pool, &wa.id).await.expect("list bundles final");
    assert!(bundles_final.is_empty(), "bundle auto-deleted when last todo leaves");
}

#[tokio::test]
async fn test_deleting_todo_auto_removes_empty_bundle() {
    let pool = test_pool().await;
    let wa = work_areas::create(&pool, "Proj").await.expect("wa");
    let bundle = bundles::create(&pool, &wa.id, "One-item bundle").await.expect("bundle");
    let t = todos::create(&pool, &wa.id, "Solo task").await.expect("todo");

    // Add todo to bundle
    todos::update(
        &pool,
        &t.id,
        &backend::models::UpdateTodoRequest {
            title: t.title.clone(),
            status: "todo".to_string(),
            bundle_id: Some(bundle.id.clone()),
            position: 0,
        },
    )
    .await
    .expect("bundle todo");

    // Delete the todo
    todos::delete(&pool, &t.id).await.expect("delete");

    // Bundle should be gone
    let remaining = bundles::list(&pool, &wa.id).await.expect("list");
    assert!(remaining.is_empty(), "bundle should be deleted with its last todo");
}

#[tokio::test]
async fn test_deleting_bundle_preserves_todos_as_ungrouped() {
    let pool = test_pool().await;
    let wa = work_areas::create(&pool, "Proj").await.expect("wa");
    let bundle = bundles::create(&pool, &wa.id, "Bundle").await.expect("bundle");

    let t1 = todos::create(&pool, &wa.id, "Task A").await.expect("t1");
    let t2 = todos::create(&pool, &wa.id, "Task B").await.expect("t2");

    for t in [&t1, &t2] {
        todos::update(
            &pool,
            &t.id,
            &backend::models::UpdateTodoRequest {
                title: t.title.clone(),
                status: "todo".to_string(),
                bundle_id: Some(bundle.id.clone()),
                position: t.position,
            },
        )
        .await
        .expect("bundle todo");
    }

    bundles::delete(&pool, &bundle.id).await.expect("delete bundle");

    let all_todos = todos::list(&pool, &wa.id).await.expect("list todos");
    assert_eq!(all_todos.len(), 2);
    assert!(all_todos.iter().all(|t| t.bundle_id.is_none()), "all todos ungrouped");
}

// ---------------------------------------------------------------------------
// Cross-work-area isolation for bundles
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_bundles_isolated_between_work_areas() {
    let pool = test_pool().await;
    let wa1 = work_areas::create(&pool, "WA-1").await.expect("wa1");
    let wa2 = work_areas::create(&pool, "WA-2").await.expect("wa2");

    bundles::create(&pool, &wa1.id, "Bundle A").await.expect("bundle wa1");
    bundles::create(&pool, &wa2.id, "Bundle B").await.expect("bundle wa2");

    let wa1_bundles = bundles::list(&pool, &wa1.id).await.expect("list wa1");
    let wa2_bundles = bundles::list(&pool, &wa2.id).await.expect("list wa2");

    assert_eq!(wa1_bundles.len(), 1);
    assert_eq!(wa2_bundles.len(), 1);
    assert_eq!(wa1_bundles[0].name, "Bundle A");
    assert_eq!(wa2_bundles[0].name, "Bundle B");
}
