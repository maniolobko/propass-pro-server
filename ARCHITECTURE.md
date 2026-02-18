# PROPASS PRO - Architecture Documentation

Complete technical architecture of the PROPASS PRO distributed NFC badge management system.

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    PROPASS PRO SaaS Platform                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Layer 1: Client Tier                        │
│                    (Distributed - On-Premise)                   │
└─────────────────────────────────────────────────────────────────┘

   ┌──────────────────────────┐
   │   Desktop Application    │
   │   (Electron + React)     │
   │                          │
   ├──────────────────────────┤
   │ Services:                │
   │ • SyncService            │
   │ • WebSocketService       │
   │ • NFC Controller         │
   │ • Auth Manager           │
   └──────────────────────────┘
                 ▲
         ┌───────┴───────┐
         │               │
         ▼               ▼
    ┌────────┐     ┌──────────┐
    │ SQLite │     │ Python   │
    │ Local  │     │ NFC Eng  │
    │  DB    │     │ (ACR122) │
    └────────┘     └──────────┘
         ▲               ▲
         │              USB
         │               │
    sync_queue      NFC Reader
                  (ACR122U Device)

┌─────────────────────────────────────────────────────────────────┐
│                      Layer 2: Network Tier                       │
│                     (REST API + WebSocket)                      │
└─────────────────────────────────────────────────────────────────┘

    HTTPS (TLS 1.3)          WebSocket (Secure)
         │                           │
         ├──────────┬────────────────┤
         │          │                │
    POST /sync/push │         /ws?token=JWT
    GET  /sync/pull │
    REST endpoints  │         Real-time Updates
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    Request: JWT Auth    Message: JWT Validation
    Response: JSON       

┌─────────────────────────────────────────────────────────────────┐
│                      Layer 3: Server Tier                        │
│                    (Central Node.js + Express)                  │
└─────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                    Express Application                         │
│                                                               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Route Handlers:                                     │   │
│   │ • /api/auth/* (JWT gen + refresh)                |   │
│   │ • /api/clients/* (CRUD)                          |   │
│   │ • /api/copies/* (History)                        |   │
│   │ • /api/quotas/* (Limits)                         |   │
│   │ • /api/dumps/* (Backups)                         |   │
│   │ • /api/sync/* (Offline sync)                     |   │
│   └─────────────────────────────────────────────────────┘
│
│   ┌─────────────────────────────────────────────────────┐
│   │ Middleware:                                         │
│   │ • authenticateJWT (all /api routes)                │
│   │ • authorize(...roles) (role-based access)         │
│   │ • errorHandler (500 responses)                     │
│   │ • cors (client communication)                      │
│   └─────────────────────────────────────────────────────┘
│
│   ┌─────────────────────────────────────────────────────┐
│   │ WebSocket Handler (/ws):                            │
│   │ • JWT verification on upgrade                       │
│   │ • Room management (by device_id)                    │
│   │ • Heartbeat (ping-pong every 30s)                  │
│   │ • Message routing (copy_completed → admins)        │
│   │ • Connection cleanup                               │
│   └─────────────────────────────────────────────────────┘
│
│   ┌─────────────────────────────────────────────────────┐
│   │ ORM Layer (Prisma):                                │
│   │ • Type-safe database access                        │
│   │ • Automatic migrations                             │
│   │ • Relation management                              │
│   │ • Transaction support                              │
│   └─────────────────────────────────────────────────────┘
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Layer 4: Storage Tier                       │
│                        (PostgreSQL)                              │
└─────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│              PostgreSQL Relational Database                    │
│                                                               │
│  ┌──────────┐    ┌────────┐    ┌──────────┐                 │
│  │ users    │───█│clients │◄───│quotas    │                 │
│  │          │   │        │    │          │                 │
│  │ id (PK)  │   │ id(PK) │◄───│client_id │                 │
│  │ username │   │ name   │    │ remaining│                 │
│  │ email    │   │ email  │    │ limit    │                 │
│  │ role     │   │active  │    │reset_date                 │
│  │password  │   └────────┘    └──────────┘                 │
│  │          │        │                                      │
│  └──────────┘        │          ┌──────────┐              │
│                      │          │ badges   │              │
│                      │          │          │              │
│                      ├─────────▶│client_id │              │
│                      │          │ uid (UK) │              │
│                      │          │ type     │              │
│                      │          │ active   │              │
│                      │          └──────────┘              │
│                      │                                    │
│                      │          ┌──────────┐             │
│                      │          │ copies   │             │
│                      │          │          │             │
│                      └─────────▶│client_id │             │
│                                 │ uid      │             │
│                                 │ status   │             │
│                                 │ device_id│             │
│                                 │ synced   │             │
│                                 │timestamp │             │
│                                 └──────────┘             │
│                                       │                  │
│                      ┌────────────────┘                  │
│                      │                                   │
│                      ▼                                   │
│                 ┌──────────┐                            │
│                 │ dumps    │                            │
│                 │          │                            │
│                 │client_id │ (backup/audit)            │
│                 │ data(JSON)                            │
│                 │ hash     │ (validation)              │
│                 │timestamp │                            │
│                 └──────────┘                            │
│                                                       │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    External Integrations                         │
└─────────────────────────────────────────────────────────────────┘

   Admin Web UI              Analytics/Monitoring
        │                           │
        └───────────┬───────────────┘
                    │
            WebSocket + REST
                    │
                Redis (optional, for scaling)
```

## 📊 Data Flow Diagrams

### Use Case 1: New Client Card Registration (Online)

```
Sequence: Badge Scan → Copy → Upload → Admin Notified

1. NFC Reader
   │
   └──▶ Python Daemon
        │
        └──▶ Electron App (SyncService.recordCopy)
             │
             ├── Check local quota ✓
             ├── Decrement quota (optimistic)
             └── Queue operation: type='copy', payload={client_id, uid}
       
2. Auto-Sync Triggered (30s interval or manual)
   │
   └──▶ SyncService.pushQueue()
        │
        └──▶ POST /api/sync/push
             {
               "device_id": "POSTE_01",
               "queue": [
                 {
                   "type": "copy",
                   "payload": {
                     "client_id": 1,
                     "uid": "04AB12CD34",
                     "status": "pending"
                   }
                 }
               ]
             }

3. Server Processing
   │
   └──▶ Express Route Handler (/api/sync/push)
        │
        ├─▶ authenticateJWT middleware
        │
        └─▶ For each queue item:
             ├── Validate client exists
             ├── Check quota remaining > 0
             ├── Create copies table record
             ├── Decrement quotas table
             └── Return { id, status: 'synced' }

4. Server Broadcast
   │
   └──▶ WebSocket Handler
        │
        ├── Find all ADMIN role connections
        └── Send: {type: 'copy_completed', data: {client_id, uid, timestamp}}

5. Admin Dashboard
   │
   └──▶ Receives WebSocket message
        │
        ├── Update UI: "Badge 04AB12CD34 copied"
        ├── Decrement quota counter
        └── Log to dashboard

6. Client Confirmation
   │
   └──▶ Response received from server
        │
        ├── Mark queue items as synced
        ├── Local quota now matches server
        └── Clear queue (success path)
```

### Use Case 2: Offline Operation → Delayed Sync

```
Sequence: Offline Copy → Reconnect → Sync → Confirm

1. Offline - No Server Connection
   │
   └──▶ Client performs copy
        │
        ├── NFC read successful
        ├── Check offline quota cache
        ├── Write to local SQLite (sync_queue table)
        │   {
        │     "type": "copy",
        │     "payload": {client_id, uid},
        │     "status": "pending"
        │   }
        ├── Decrement local quotas table
        └── Show UI: "Saved locally, will sync when online"
   
   Queue stored:
   ┌─────────────────────────────────────────┐
   │ sync_queue table (local SQLite)         │
   ├─────────────────────────────────────────┤
   │ id │ type │ payload      │ status │ err │
   ├────┼──────┼──────────────┼────────┼─────┤
   │ 1  │copy  │{cli:1,u:"04"}│pending │null │
   │ 2  │copy  │{cli:1,u:"05"}│pending │null │
   │ 3  │copy  │{cli:2,u:"06"}│pending │null │
   └─────────────────────────────────────────┘

2. Network Reconnected
   │
   └──▶ SyncService.checkConnectivity() = true
        │
        └──▶ Automatically trigger SyncService.pushQueue()

3. Send Entire Queue
   │
   └──▶ Batch all pending items
        │
        └──▶ POST /api/sync/push
             {
               "device_id": "POSTE_01",
               "queue": [
                 {id: 1, type: "copy", payload: {...}},
                 {id: 2, type: "copy", payload: {...}},
                 {id: 3, type: "copy", payload: {...}}
               ]
             }

4. Server Validates All Items
   │
   └──▶ For each:
        ├── Check if client still exists
        ├── Check current server quota (not local cache!)
        ├── If valid:
        │   ├── CREATE copies row
        │   ├── UPDATE quotas.remaining
        │   └── RETURN {id, status: 'synced'}
        └── If invalid:
             └── RETURN {id, status: 'failed', error: 'Insufficient quota'}

5. Process Results
   │
   └──▶ Response: {data: [{id: 1, status: 'synced'}, {id: 2, status: 'synced'}, {id: 3, status: 'failed', error: '...'}]}
        │
        └──▶ Client updates local queue:
             ├── UPDATE sync_queue SET status='synced' WHERE id IN (1, 2)
             └── UPDATE sync_queue SET status='failed', error='...' WHERE id = 3

6. Local Quota Correction
   │
   └──▶ If server rejected some items, pull updated quotas
        │
        └──▶ GET /api/sync/pull
             ├── Receive all client quotas from server
             └── UPDATE local quotas table to match
```

### Use Case 3: Multi-Site Admin Dashboard Monitoring

```
Sequence: Real-time Copy Notifications to Admin Dashboard

1. Multiple Electron Clients Connected (different locations)
   │
   ├─▶ POSTE_01 @ Paris (device_id=PARIS_01)
   ├─▶ POSTE_02 @ Lyon (device_id=LYON_01)
   └─▶ POSTE_03 @ Marseille (device_id=MARSEILLE_01)

2. Each Client Performs Copy
   │
   ├─▶ PARIS_01: Copy uid="04AB001" for client_id=5
   │   └──▶ Queue + Send to server
   │
   ├─▶ LYON_01: Copy uid="04AB002" for client_id=7
   │   └──▶ Queue + Send to server
   │
   └─▶ MARSEILLE_01: Copy uid="04AB003" for client_id=5
       └──▶ Queue + Send to server

3. Server Receives 3 Copy Requests
   │
   └──▶ Express processes each
        │
        ├─▶ Save to PostgreSQL copies table
        │   ├── Record with device_id field
        │   ├── Record with recorded_by field
        │   └── With timestamp
        │
        └─▶ Emit WebSocket broadcasts

4. WebSocket Broadcasting
   │
   └──▶ For each copy_completed event:
        │
        ├── Find all admin clients connected via WebSocket
        ├── Each admin in their own room
        └── Broadcast: {
               type: 'copy_completed',
               data: {
                 device_id: 'PARIS_01',
                 client_id: 5,
                 uid: '04AB001',
                 timestamp: '2026-02-17T14:30:45Z',
                 recorded_by: 'admin_user'
               }
             }

5. Real-time Admin Dashboard Updates
   │
   ├─▶ Admin 1 (Global View)
   │   ├── Receives 3 messages (one per location)
   │   ├── Shows in Activity Log:
   │   │   "PARIS_01: Badge 04AB001 copied for Client 5"
   │   │   "LYON_01: Badge 04AB002 copied for Client 7"
   │   │   "MARSEILLE_01: Badge 04AB003 copied for Client 5"
   │   └── Updates quota counters for each client
   │
   └─▶ Admin 2 (Same benefits - sees same stream)

6. Admin Actions
   │
   └──▶ Can filter by:
        ├── Device/Location
        ├── Client
        ├── Time range
        ├── Status (success/failed)
        └── User who recorded
```

## 🔄 Offline Sync Strategy

### Queue State Machine

```
┌──────────┐
│ Pending  │ ◄──────┐ Operation queued
└─────┬────┘        │ (offline or queued)
      │
      ▼ (Server processes)
┌──────────────┐
│ Attempting.. │ ◄────┐ Sending to server
└─────┬────────┘      │
      │               │
      ├─▶ Success ────┼──▶ Synced
      │               │
      └─▶ Failure ────┘──▶ Failed
                           (user can retry)
```

### Sync Queue Durability

```
Local SQLite:
┌────────────────────────────────────────────────┐
│ sync_queue                                     │
├─────┬─────┬────────────────┬──────────┬───────┤
│ id  │type │ payload (JSON) │ status   │ error │
├─────┼─────┼────────────────┼──────────┼───────┤
│ 1   │copy │{...}           │ pending  │ null  │ ◄─── Pending sync
│ 2   │copy │{...}           │ synced   │ null  │ ◄─── Synced (keep for audit)
│ 3   │copy │{...}           │ failed   │"Quota"| ◄─── Failed (can retry)
└─────┴─────┴────────────────┴──────────┴───────┘

Durability guarantees:
✓ Local operations committed to SQLite before reply
✓ Queue survives app restart
✓ Server processes are idempotent (duplicate submission safe)
✓ Failed items retained for manual retry
```

## 🔐 Authentication & Authorization Flow

```
1. Initial Login (Electron Client)
   │
   └──▶ POST /api/auth/login
        {
          "username": "tech_paris",
          "password": "redacted",
          "device_id": "PARIS_01"
        }
        │
        ├── Verify username exists
        ├── Hash provided password with SHA256
        ├── Compare with stored hash
        ├── Check if user is active
        └── ALL CHECKS PASS:
             │
             └──▶ Generate JWT token:
                  {
                    "header": {"typ": "JWT", "alg": "HS256"},
                    "payload": {
                      "id": 3,
                      "username": "tech_paris",
                      "role": "commercial",
                      "device_id": "PARIS_01",
                      "iat": 1676547000,
                      "exp": 1676547000 + (7 * 24 * 60 * 60)  // 7 days
                    },
                    "signature": "HMAC256(header.payload, JWT_SECRET)"
                  }
                  │
                  └──▶ Response:
                       {
                         "success": true,
                         "token": "eyJ0eXA...",
                         "user": {
                           "id": 3,
                           "username": "tech_paris",
                           "role": "commercial"
                         }
                       }

2. Subsequent API Calls
   │
   └──▶ Header: Authorization: Bearer eyJ0eXA...
        │
        └──▶ Server authenticateJWT middleware:
             ├── Extract token from header
             ├── Verify signature (using JWT_SECRET)
             ├── Check expiration (exp > now)
             ├── Decode payload
             └── Attach decoded user to req.user
                  │
                  └──▶ Route handler accesses req.user:
                       {
                         id: 3,
                         username: "tech_paris",
                         role: "commercial",
                         device_id: "PARIS_01"
                       }

3. Role-Based Access Control
   │
   └──▶ Route protection: app.delete('/api/clients/:id', authorize('admin'))
        │
        ├── authenticateJWT extracts user
        └── authorize('admin') checks: req.user.role === 'admin'
             ├── If admin ✓ → Proceed
             └── If not admin ✗ → 403 Forbidden

4. Token Refresh (7-day expiry)
   │
   └──▶ Before expiry, call: POST /api/auth/refresh
        │
        ├── Client sends old token
        ├── Server verifies it's still valid (not expired yet)
        ├── Extracts claims from old token
        └── Issues NEW token with fresh exp
             │
             └──▶ Client stores new token, uses for next 7 days
```

## 💾 Database Transactions & Consistency

### Copy Operation Transaction

```
POST /api/sync/push receives:
{
  "device_id": "POSTE_01",
  "queue": [
    {
      "type": "copy",
      "payload": {"client_id": 5, "uid": "04AB001", "status": "pending"}
    }
  ]
}

Server executes:
┌─────────────────────────────────────────────────┐
│ BEGIN TRANSACTION                               │
│                                                 │
│ 1. SELECT quotas WHERE client_id = 5            │
│    → remaining = 45                             │
│                                                 │
│ 2. IF remaining > 0 THEN                        │
│      INSERT INTO copies (                       │
│        client_id, uid, status, device_id,       │
│        recorded_by, synced, created_at          │
│      ) VALUES (5, '04AB001', 'success',         │
│        'POSTE_01', 'tech_paris', false, now)    │
│      → returns id = 1234                        │
│                                                 │
│ 3. UPDATE quotas WHERE client_id = 5            │
│    SET remaining = remaining - 1,               │
│        updated_at = now                         │
│    → remaining = 44                             │
│                                                 │
│ 4. INSERT INTO audit_log (action, user_id, ...) │
│    VALUES ('copy', 3, ...)                      │
│                                                 │
│ COMMIT TRANSACTION                              │
│                                                 │
│ Result: {                                       │
│   "id": 1234,                                   │
│   "status": "synced"                            │
│ }                                               │
└─────────────────────────────────────────────────┘

If ANY step fails → ROLLBACK all changes
→ Client receives error → Can retry safely
→ No partial updates to database
→ Quota consistency guaranteed
```

## 🚀 Performance Optimization

### Indexing Strategy

```sql
-- Primary keys (automatic)
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_badges_uid ON badges(uid);  -- Most searches

-- Foreign keys (for joins)
CREATE INDEX idx_badges_client_id ON badges(client_id);
CREATE INDEX idx_quotas_client_id ON quotas(client_id);
CREATE INDEX idx_copies_client_id ON copies(client_id);
CREATE INDEX idx_dumps_client_id ON dumps(client_id);

-- Time-based queries
CREATE INDEX idx_copies_created_at ON copies(created_at);
CREATE INDEX idx_dumps_created_at ON dumps(created_at);

-- Sync status
CREATE INDEX idx_copies_synced ON copies(synced);

-- Multi-column for common queries
CREATE INDEX idx_copies_client_synced ON copies(client_id, synced);
CREATE INDEX idx_badges_client_active ON badges(client_id, active);
```

### Query Optimization

```typescript
// ❌ Bad: N+1 query problem
const copies = await prisma.copies.findMany({ take: 100 });
for (const copy of copies) {
  const client = await prisma.clients.findUnique({ where: { id: copy.client_id } });
  // 101 queries total!
}

// ✅ Good: Single query with include
const copies = await prisma.copies.findMany({
  include: { client: true },
  take: 100,
  orderBy: { created_at: 'desc' },
});
// 1 query with JOIN

// ✅ Better: Select only needed fields
const copies = await prisma.copies.findMany({
  select: {
    id: true,
    uid: true,
    created_at: true,
    client: { select: { id: true, name: true } },
  },
  take: 100,
  orderBy: { created_at: 'desc' },
});
```

### Connection Pooling

```
PostgreSQL connections: 20 max
Prisma pool size: 10

Electron Clients:
├─ PARIS_01 → Connection 1
├─ LYON_01 → Connection 2
├─ MARSEILLE_01 → Connection 3
│
Admin Dashboards:
├─ Admin1 → Connection 4
├─ Admin2 → Connection 5
│
Server processes:
├─ User auth → Connection 6
├─ Sync push → Connection 7
├─ Copy recording → Connection 8
└─ Background jobs → Connection 9-10 (reserved)
```

## 🔄 Error Handling & Recovery

### Error Categories

```
1. Authentication Errors (4xx)
   ├── 401 Unauthorized (no token, invalid token)
   ├── 403 Forbidden (insufficient role)
   └── Action: Redirect to login

2. Validation Errors (4xx)
   ├── 400 Bad Request (invalid data)
   ├── 409 Conflict (duplicate UID)
   └── Action: Show user error, allow retry

3. Business Logic Errors (4xx)
   ├── 402 Payment Required (insufficient quota)
   ├── 404 Not Found (client doesn't exist)
   └── Action: Proper message to user

4. Server Errors (5xx)
   ├── 500 Internal Server Error
   ├── 503 Service Unavailable (db down)
   └── Action: Log error, retry with backoff

5. Network Errors (0 = client side)
   ├── Connection refused
   ├── Timeout
   └── Action: Queue offline, auto-retry when online
```

### Retry Strategy

```
Client-side automatic retry (exponential backoff):

Attempt 1: Immediate
   │
   └──▶ Fail? Wait 1s (2^0)

Attempt 2: +1 second
   │
   └──▶ Fail? Wait 2s (2^1)

Attempt 3: +2 seconds
   │
   └──▶ Fail? Wait 4s (2^2)

Attempt 4: +4 seconds
   │
   └──▶ Fail? Wait 8s (2^3)

Attempt 5: +8 seconds
   │
   └──▶ Fail? Persist queue + manual retry

Max: 5 attempts = ~16 seconds total before giving up
```

## 📐 Scalability Considerations

### Vertical Scaling (Single Server)

```
Small Deployment:
├─ 1 Electron Client
├─ 1 Server Instance
├─ PostgreSQL on same machine
└─ Suitable for: Testing, Single location

Grow to:
├─ 5 Electron Clients
├─ 1 Server Instance (2GB RAM, 2 CPUs)
├─ PostgreSQL on dedicated machine
└─ Suitable for: 500+ badges/month
```

### Horizontal Scaling (Multiple Servers)

```
Large Deployment:
├─ 20+ Electron Clients
├─ 3 Server Instances (load balanced)
│  ├─ Server 1 (port 5001)
│  ├─ Server 2 (port 5002)
│  └─ Server 3 (port 5003)
├─ Load Balancer (Nginx/HAProxy)
├─ PostgreSQL (dedicated, replicated)
├─ Redis (session + WebSocket adapter)
└─ Suitable for: SaaS with 100+ locations

Challenges addressed:
✓ JWT tokens valid across all servers (shared secret)
✓ WebSocket broadcast via Redis adapter
✓ Database connections pooled (Prisma handles)
✓ Session data in JWT (stateless servers)
```

## 📋 Deployment Topology

### Development

```
Developer Machine
├─ Docker Desktop
├─ docker-compose (postgres + server + pgadmin)
├─ localhost:5000
└─ Hot reload enabled
```

### Staging

```
Staging Server
├─ Ubuntu 20.04 LTS
├─ Docker + Docker Compose
├─ Let's Encrypt SSL
├─ api.staging.propass.com
└─ Backup: hourly snapshots
```

### Production

```
Multi-Region Setup
├─ Primary Server (EU)
│  ├─ Node.js Server (x3 instances)
│  ├─ PostgreSQL (replicated)
│  └─ Backup: daily + 30-day retention
│
└─ Clients worldwide
   ├─ All point to api.propass.com (CDN)
   └─ Failover to backup server on primary outage
```

---

This architecture provides enterprise-grade reliability, scalability, and offline-first capabilities for distributed NFC badge operations.
