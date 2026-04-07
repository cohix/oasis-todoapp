# Todos and Bundles

Each work area contains a list of todo items. Items can be grouped into colour-coded **bundles** using drag-and-drop.

## Todo Items

### Creating a todo

Type in the **"What needs to be done?"** input at the top of any work area and press **Enter**. New todos are automatically set to the *To Do* status.

### Tracking status

Each todo has one of three statuses, shown as a coloured dot:

| Status | Dot colour | Meaning |
|--------|-----------|---------|
| To Do | Grey (empty) | Not yet started |
| In Progress | Blue | Actively being worked on |
| Done | Green | Completed |

Hover over any todo to reveal action buttons that change its status.

### Deleting a todo

Hover over the todo and click the **✕** button.

---

## Bundles

Bundles group related todos together. Each bundle gets a distinct background colour so groups are easy to tell apart at a glance.

### Creating a bundle

Drag one todo **onto another todo**. A new bundle is created containing both items. A text field appears immediately so you can name the bundle — press **Enter** or click away to save.

### Adding to an existing bundle

Drag any todo onto:
- An **existing bundle's drop zone** (appears at the bottom of each bundle while dragging), or
- Another **todo that is already in the bundle**.

### Moving between bundles

Drag a todo from one bundle and drop it onto a different bundle's drop zone (or a todo within that bundle).

### Removing from a bundle

Drag a bundled todo onto the **"✕ Remove from bundle"** zone that appears at the bottom of the work area while dragging. The todo becomes ungrouped.

> Bundles are automatically deleted when their last todo is moved out or deleted.

### Renaming a bundle

Hover over the bundle header and click the **✏️** (pencil) icon. Edit the name and press **Enter** or click away to save.

---

## REST API Reference

### Todos

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/work-areas/:id/todos` | List all todos for a work area |
| POST | `/api/v1/work-areas/:id/todos` | Create a todo `{"title": "..."}` |
| PUT | `/api/v1/todos/:id` | Full-replacement update (title, status, bundle_id, position) |
| DELETE | `/api/v1/todos/:id` | Delete a todo |

**Status values:** `todo`, `in_progress`, `completed`

**Update body example:**
```json
{
  "title": "Write tests",
  "status": "in_progress",
  "bundle_id": "uuid-or-null",
  "position": 2
}
```

### Bundles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/work-areas/:id/bundles` | List all bundles for a work area |
| POST | `/api/v1/work-areas/:id/bundles` | Create a bundle `{"name": "..."}` |
| PUT | `/api/v1/bundles/:id` | Rename a bundle `{"name": "..."}` |
| DELETE | `/api/v1/bundles/:id` | Delete a bundle (todos become ungrouped) |

---

## Data Model

**bundles table**

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID v4 |
| `work_area_id` | TEXT | FK → work_areas |
| `name` | TEXT | User-supplied label |
| `position` | INTEGER | Sort order |
| `created_at` | TEXT | UTC datetime |
| `updated_at` | TEXT | UTC datetime |

**todos table**

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID v4 |
| `work_area_id` | TEXT | FK → work_areas |
| `bundle_id` | TEXT (nullable) | FK → bundles; NULL = ungrouped |
| `title` | TEXT | Todo description |
| `status` | TEXT | `todo` / `in_progress` / `completed` |
| `position` | INTEGER | Sort order within group |
| `created_at` | TEXT | UTC datetime |
| `updated_at` | TEXT | UTC datetime |
