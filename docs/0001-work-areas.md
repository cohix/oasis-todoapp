# Work Areas

Work areas are the top-level organisational concept in todoapp. They appear as tabs across the top of the UI, letting you group unrelated sets of todo items into separate spaces.

## Using Work Areas

### Creating a work area

Click the **+** button on the right of the tab bar. A new tab appears with an inline text field. Type a name and press **Enter** to save it. The new tab becomes active immediately.

Press **Escape** to cancel without creating a work area.

### Switching between work areas

Click any tab to make it active. The main content area refreshes to show todo items belonging to that work area.

### Renaming a work area

Hover over any tab. A **···** button appears. Click it to open the options menu, then choose **Rename**. The tab label turns into a text field — edit the name and press **Enter** to save, or **Escape** to cancel.

Duplicate names are not allowed; you will see an error message if you try to use a name that already exists.

### Reordering work areas

Drag any tab left or right and drop it in the desired position. The order is saved to the backend immediately.

## REST API Reference

All endpoints are under `/api/v1/work-areas`.

| Method | Path                        | Description                     |
|--------|-----------------------------|---------------------------------|
| GET    | `/api/v1/work-areas`        | List all work areas (ordered)   |
| POST   | `/api/v1/work-areas`        | Create a work area              |
| PUT    | `/api/v1/work-areas/:id`    | Rename a work area              |
| PUT    | `/api/v1/work-areas/reorder`| Bulk-update tab positions       |

### Create — request body

```json
{ "name": "My Work Area" }
```

Returns **201 Created** with the new work area object, or **409 Conflict** if the name is already taken.

### Rename — request body

```json
{ "name": "New Name" }
```

Returns **200 OK** with the updated work area object, **404 Not Found**, or **409 Conflict**.

### Reorder — request body

```json
[
  { "id": "uuid-a", "position": 0 },
  { "id": "uuid-b", "position": 1 }
]
```

Returns **200 OK**.

## Data Model

Work areas are stored in the `work_areas` table in SQLite (`$HOME/.todoapp/db.sqlite`).

| Column       | Type    | Notes                          |
|--------------|---------|--------------------------------|
| `id`         | TEXT PK | UUID v4                        |
| `name`       | TEXT    | Unique, non-empty              |
| `position`   | INTEGER | Sort order, 0-indexed          |
| `created_at` | TEXT    | UTC datetime                   |
| `updated_at` | TEXT    | UTC datetime, updated on write |
