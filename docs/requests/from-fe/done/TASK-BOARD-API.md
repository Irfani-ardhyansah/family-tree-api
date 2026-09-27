# Task Board API Contract

**Module:** Task Board
**Requested by:** Frontend Team
**Date:** 2024-01-27
**Priority:** High

## Overview

Task Board adalah modul untuk mencatat dan memonitor task development (bugfixing/feature/refactor). Ini adalah tool personal untuk tracking pekerjaan development.

## Data Models

### Task

```typescript
interface Task {
  id: string;
  type: 'Bugfixing' | 'Feature' | 'Refactor';
  title: string;
  branchName: string;
  status: 'To-Do' | 'In Progress' | 'Merged' | 'Done';
  links: Array<{
    type: 'discord' | 'notion' | 'mr';
    url: string;
  }>;
  description: string; // HTML from TipTap editor
  deployNotes: string; // HTML from TipTap editor
  images: string[]; // Array of image URLs
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}
```

## API Endpoints

### 1. List Tasks

**Endpoint:** `GET /api/tasks`

**Query Parameters:**
- `type` (optional): Filter by task type (`Bugfixing` | `Feature` | `Refactor`)
- `status` (optional): Filter by status (`To-Do` | `In Progress` | `Merged` | `Done`)
- `search` (optional): Search in title, description, and deployNotes (case-insensitive)

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "1",
      "type": "Bugfixing",
      "title": "Fix login redirect loop",
      "branchName": "fix/login-redirect",
      "status": "Done",
      "links": [
        { "type": "mr", "url": "https://gitlab.com/..." },
        { "type": "discord", "url": "https://discord.com/..." }
      ],
      "description": "<p>Fixed the redirect loop...</p>",
      "deployNotes": "<p>Deployed on 2024-01-15</p>",
      "images": ["https://example.com/uploads/1/image1.png"],
      "createdAt": "2024-01-10T10:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ]
}
```

**Sorting:** Default sort by `updatedAt` descending (newest first)

---

### 2. Get Task Detail

**Endpoint:** `GET /api/tasks/:id`

**Response:** `200 OK`

```json
{
  "data": {
    "id": "1",
    "type": "Bugfixing",
    "title": "Fix login redirect loop",
    "branchName": "fix/login-redirect",
    "status": "Done",
    "links": [
      { "type": "mr", "url": "https://gitlab.com/..." },
      { "type": "discord", "url": "https://discord.com/..." }
    ],
    "description": "<p>Fixed the redirect loop...</p>",
    "deployNotes": "<p>Deployed on 2024-01-15</p>",
    "images": ["https://example.com/uploads/1/image1.png"],
    "createdAt": "2024-01-10T10:00:00Z",
    "updatedAt": "2024-01-15T14:30:00Z"
  }
}
```

**Error:** `404 Not Found` if task doesn't exist

---

### 3. Create Task

**Endpoint:** `POST /api/tasks`

**Request Body:**

```json
{
  "type": "Feature",
  "title": "Add dark mode toggle",
  "branchName": "feature/dark-mode",
  "status": "To-Do",
  "links": [
    { "type": "notion", "url": "https://notion.so/..." }
  ],
  "description": "<p>Implement dark mode...</p>",
  "deployNotes": ""
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "id": "2",
    "type": "Feature",
    "title": "Add dark mode toggle",
    "branchName": "feature/dark-mode",
    "status": "To-Do",
    "links": [
      { "type": "notion", "url": "https://notion.so/..." }
    ],
    "description": "<p>Implement dark mode...</p>",
    "deployNotes": "",
    "images": [],
    "createdAt": "2024-01-27T10:00:00Z",
    "updatedAt": "2024-01-27T10:00:00Z"
  }
}
```

**Validation:**
- `type`: Required, must be one of `Bugfixing`, `Feature`, `Refactor`
- `title`: Required, min 1 character
- `branchName`: Required, min 1 character
- `status`: Required, must be one of `To-Do`, `In Progress`, `Merged`, `Done`
- `links`: Optional, array of link objects
- `description`: Optional, HTML string
- `deployNotes`: Optional, HTML string

---

### 4. Update Task

**Endpoint:** `PUT /api/tasks/:id`

**Request Body:** (all fields optional, only send fields to update)

```json
{
  "status": "In Progress",
  "description": "<p>Updated description...</p>"
}
```

**Response:** `200 OK`

```json
{
  "data": {
    "id": "2",
    "type": "Feature",
    "title": "Add dark mode toggle",
    "branchName": "feature/dark-mode",
    "status": "In Progress",
    "links": [],
    "description": "<p>Updated description...</p>",
    "deployNotes": "",
    "images": [],
    "createdAt": "2024-01-27T10:00:00Z",
    "updatedAt": "2024-01-27T11:00:00Z"
  }
}
```

**Error:** `404 Not Found` if task doesn't exist

---

### 5. Delete Task

**Endpoint:** `DELETE /api/tasks/:id`

**Response:** `204 No Content`

**Error:** `404 Not Found` if task doesn't exist

---

### 6. Upload Task Image

**Endpoint:** `POST /api/tasks/:id/images`

**Request:** `multipart/form-data`

- `file`: Image file (JPEG, PNG, GIF, WebP)

**Response:** `201 Created`

```json
{
  "data": {
    "url": "https://example.com/uploads/tasks/1/image-1234567890.png"
  }
}
```

**Behavior:**
- Validates file type (image/*)
- Validates file size (max 5MB recommended)
- Stores image and returns public URL
- URL should be added to task's `images` array automatically by the frontend

**Error:**
- `400 Bad Request` - Invalid file type or size
- `404 Not Found` - Task doesn't exist

---

## Authentication

All endpoints require authentication. Use the existing auth system (JWT/session from Family Suite).

## Authorization

- Task Board is a **personal tool** - no multi-user assignment or collaboration
- User can only access their own tasks
- No RBAC needed for this module

## Additional Notes

### Image Handling

- Images are uploaded via the TipTap editor paste event
- Frontend will call `POST /api/tasks/:id/images` when user pastes an image
- Backend should return a public URL that can be used in `<img>` tags
- Consider using CDN or object storage (S3, Cloudflare R2, etc.)

### HTML Content

- `description` and `deployNotes` store HTML from TipTap editor
- Backend should sanitize HTML to prevent XSS attacks
- Allowed tags: `p`, `br`, `strong`, `em`, `u`, `ul`, `ol`, `li`, `code`, `pre`, `a`, `img`
- Allowed attributes: `href`, `src`, `alt`, `class`

### Database Schema Suggestion

```sql
CREATE TABLE tasks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('Bugfixing', 'Feature', 'Refactor') NOT NULL,
  title VARCHAR(255) NOT NULL,
  branch_name VARCHAR(255) NOT NULL,
  status ENUM('To-Do', 'In Progress', 'Merged', 'Done') NOT NULL,
  description TEXT,
  deploy_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_updated_at (updated_at)
);

CREATE TABLE task_links (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  type ENUM('discord', 'notion', 'mr') NOT NULL,
  url VARCHAR(2048) NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE task_images (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

## Questions for Backend Team

1. Should we implement soft delete for tasks?
2. Is there a preferred storage solution for images (local filesystem, S3, etc.)?
3. Should we add task history/audit log for status changes?
4. Any specific file size limits for image uploads?

## Frontend Implementation Status

- ✅ Types and interfaces defined
- ✅ Dummy API service created
- ✅ Layout component created
- ✅ List view with filters created
- ✅ Form page with TipTap editor created
- ✅ Detail view with status quick actions created
- ✅ Routes configured with lazy loading (code-splitting)
- ✅ Module added to launcher catalog
- ✅ Simplified layout (removed redundant navigation bar)

### Performance Notes

- All Task Board components are lazy-loaded using React's `lazy()` and `Suspense`
- This ensures the module is only loaded when user navigates to `/task-board`
- Reduces initial bundle size and improves app startup time
- Loading fallback component shows "Loading Task Board..." during chunk load
- Vite automatically code-splits the module into separate chunks:
  - TaskBoardLayout: ~4.2 kB
  - TaskListPage: ~4.9 kB
  - TaskFormPage: ~12 kB
  - TaskDetailPage: ~8 kB
  - taskBoardApi: ~4.1 kB
  - TaskStatusBadge: ~1.2 kB

## Backend Implementation Status

- ✅ Database migration created (20260927100000_create_task_board.ts)
- ✅ Tables added to shared database constants (tb_tasks, tb_task_links, tb_task_images)
- ✅ Types and interfaces defined (task-board.types.ts)
- ✅ Repository created with CRUD operations (task-board.repository.ts)
- ✅ Service created with validation and business logic (task-board.service.ts)
- ✅ Controller created with request handling (task-board.controller.ts)
- ✅ Routes created with multer image upload (task-board.routes.ts)
- ✅ Routes added to app.ts (/api/v1/tasks)
- ✅ Build successful

### Implementation Details

**Database Tables:**
- `tb_tasks` - Main task table with person_id, type, title, branch_name, status, description, deploy_notes
- `tb_task_links` - Related links (discord, notion, mr) with foreign key to tb_tasks
- `tb_task_images` - Image URLs with foreign key to tb_tasks

**API Endpoints:**
- `GET /api/v1/tasks` - List tasks with optional filters (type, status, search)
- `GET /api/v1/tasks/:id` - Get task by ID
- `POST /api/v1/tasks` - Create new task
- `PUT /api/v1/tasks/:id` - Update task
- `DELETE /api/v1/tasks/:id` - Delete task
- `POST /api/v1/tasks/:id/images` - Upload image for task (multipart/form-data)

**Features:**
- Authentication required via requireAuth middleware
- Personal scope - users can only access their own tasks
- Image upload with 5MB max size, image/* filter
- Validation for all enum values (type, status, link type)
- URL validation for links
- Automatic timestamp management (created_at, updated_at)
- Cascade delete for links and images when task is deleted
