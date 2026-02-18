# PROPASS PRO - Central Server

Production-ready NFC badge management system with Electron clients, centralized PostgreSQL, JWT authentication, and WebSocket real-time sync.

## 🏗️ Architecture

```
┌───────────────────────────────────────────┐
│         Admin Web Dashboard               │
└────────────────┬────────────────────────┘
                 │ HTTPS
                 ▼
        ┌────────────────────┐
        │   Express Server   │
        │  (Node.js + WS)    │
        └────────┬───────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
   PostgreSQL         File Upload
   (Central DB)       (Dumps)

        ▲
        │ HTTPS + WebSocket
        │
   ┌────┴─────────────────┐
   │  Electron Clients    │
   │  (Offline-capable)   │ (x N)
   └────┬─────────────────┘
        │ USB
        ▼
   ACR122U NFC Reader
```

## 🚀 Quick Start

### Docker (Recommended)

```bash
# Clone and setup
git clone <repo>
cd propass-pro-server

# Create environment file
cp .env.example .env

# Start with Docker Compose
docker-compose up -d

# Run migrations
docker-compose exec server npx prisma migrate deploy

# Create admin user
docker-compose exec server npm run db:seed
```

Server runs on `http://localhost:5000`  
pgAdmin available at `http://localhost:5050`

### Local Development

```bash
# Install dependencies
npm install

# Setup PostgreSQL locally
# Create database: createdb propass_db

# Setup environment
cp .env.example .env

# Run migrations
npx prisma migrate dev

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

## 📡 API Endpoints

### Authentication

```
POST   /api/auth/login      - Login with username/password
POST   /api/auth/refresh    - Refresh JWT token
GET    /api/auth/me         - Get current user info
```

### Clients

```
GET    /api/clients              - List all clients
GET    /api/clients/:id          - Get single client
POST   /api/clients              - Create new client
PUT    /api/clients/:id          - Update client
DELETE /api/clients/:id          - Delete client
```

### Quotas

```
GET    /api/quotas/:client_id    - Get client quota
PUT    /api/quotas/:client_id    - Update quota
```

### Copies (Badge Operations)

```
POST   /api/copies          - Record badge copy
GET    /api/copies/history  - Get copy history
```

### Dumps (Backups)

```
GET    /api/dumps           - List all dumps
POST   /api/dumps/upload    - Upload dump file
```

### Sync (Offline Support)

```
POST   /api/sync/push       - Sync offline queue to server
GET    /api/sync/pull       - Pull latest data from server
```

## 🔐 Authentication

JWT-based authentication with 7-day token expiry.

### Login Example

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "device_id": "POSTE_01"
  }'

# Returns:
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "email": "admin@example.com"
  }
}
```

### Using Token

All protected routes require:
```
Authorization: Bearer <token>
```

## 🔄 Sync Logic

### Offline Mode (Client)

1. Client writes to local SQLite
2. Updates `sync_queue` table
3. When offline: copies stored locally

### Online Mode (Sync)

1. Client sends `/api/sync/push` with queue
2. Server validates and processes
3. Server broadcasts to admins via WebSocket
4. Client receives confirmation
5. Client marks queue items as `synced`

### WebSocket Messages

```javascript
// Client → Server (copy completed)
{
  "type": "copy_completed",
  "payload": {
    "client_id": 1,
    "uid": "04AB12CD34",
    "status": "success",
    "device_id": "POSTE_01"
  }
}

// Server → Admin (broadcast)
{
  "type": "copy_completed",
  "data": {
    // full copy record with timestamp
  }
}
```

## 📊 Database Schema

### Users Table
```sql
users:
  - id (PK)
  - username (UNIQUE)
  - email (UNIQUE)
  - password_hash (SHA256)
  - role (admin|commercial|client)
  - active (boolean)
  - created_at, updated_at
```

### Clients Table
```sql
clients:
  - id (PK)
  - name
  - email (UNIQUE)
  - phone
  - balance
  - active
  - created_at, updated_at
```

### Quotas Table
```sql
quotas:
  - id (PK)
  - client_id (FK)
  - monthly_limit (default: 100)
  - remaining
  - reset_date
  - created_at, updated_at
```

### Copies Table
```sql
copies:
  - id (PK)
  - client_id (FK)
  - uid (badge UID)
  - status (pending|success|failed)
  - device_id
  - recorded_by
  - synced (boolean)
  - created_at, updated_at
```

### Dumps Table
```sql
dumps:
  - id (PK)
  - client_id (FK)
  - data (JSON)
  - hash
  - uploaded_by
  - created_at
```

### Badges Table
```sql
badges:
  - id (PK)
  - client_id (FK)
  - uid (UNIQUE)
  - type (MIFARE_CLASSIC, etc)
  - active
  - created_at, updated_at
```

## 🧪 Testing

```bash
# Run tests
npm test

# With coverage
npm test -- --coverage
```

## 🐛 Debugging

### Enable Debug Logs

```bash
DEBUG=* npm run dev
```

### PostgreSQL Direct Access

```bash
# Via Docker
docker-compose exec postgres psql -U propass -d propass_db

# Query examples
SELECT * FROM users;
SELECT * FROM clients;
SELECT * FROM copies ORDER BY created_at DESC LIMIT 10;
SELECT COUNT(*) as total_copies FROM copies WHERE synced = false;
```

## 📦 Deployment

### Docker Production

```bash
# Build image
docker build -t propass-pro-server:latest .

# Run with custom database
docker run -d \
  -e DATABASE_URL="postgresql://user:pass@db-host/db" \
  -e JWT_SECRET="your-production-secret" \
  -p 5000:5000 \
  propass-pro-server:latest
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 5000 | Server port |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | Secret for JWT tokens |
| `NODE_ENV` | No | development | Environment mode |

### SSL/TLS

Use a reverse proxy (Nginx, CloudFlare) for HTTPS in production.

## 🔄 Workflow Example

### 1. Admin Creates Client

```bash
curl -X POST http://localhost:5000/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ACME Corp",
    "email": "contact@acme.com",
    "phone": "+1234567890",
    "balance": 5000
  }'
```

### 2. Client (Electron) Boots with Queue

Local SQLite contains:
```sql
sync_queue:
  1 | copy | {"client_id": 1, "uid": "04AB12CD34"} | pending
  2 | copy | {"client_id": 1, "uid": "04AB12CD35"} | pending
```

### 3. When Connection Available

Client sends:
```bash
POST /api/sync/push
{
  "device_id": "POSTE_01",
  "queue": [
    {
      "id": 1,
      "type": "copy",
      "payload": {"client_id": 1, "uid": "04AB12CD34"}
    },
    {
      "id": 2,
      "type": "copy",
      "payload": {"client_id": 1, "uid": "04AB12CD35"}
    }
  ]
}
```

### 4. Server Validates & Processes

Checks:
- Client exists
- Quota available
- Badge not duplicate

Returns:
```json
{
  "success": true,
  "data": [
    {"id": 1, "status": "synced"},
    {"id": 2, "status": "synced"}
  ]
}
```

### 5. Broadcast to Admin

WebSocket to all admin clients:
```json
{
  "type": "copy_completed",
  "data": {
    "client_id": 1,
    "uid": "04AB12CD34",
    "timestamp": "2026-02-17T12:00:00Z"
  }
}
```

## 🛠️ Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ Ensure PostgreSQL is running: `docker-compose ps`

### JWT Token Expired
```
Error: Invalid token
```
→ Client must call `/api/auth/refresh` before expiry (7 days)

### Sync Queue Stuck
```
SELECT COUNT(*) FROM copies WHERE synced = false;
```
→ Check network connection and retry `/api/sync/push`

## 📝 License

PROPRIETARY - DJOUGOO Engineering

## 👥 Support

For issues or questions, contact: support@djougoo.com
