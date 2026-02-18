# PROPASS PRO - API Reference

Complete REST API and WebSocket documentation with examples.

## 🔑 Base URL

```
Production: https://api.propass.com
Development: http://localhost:5000
```

All endpoints require authentication via JWT token in `Authorization` header:

```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

## 📋 Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Use returned data |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate UID or username |
| 500 | Server Error | Report to support |

## 🔐 Authentication Endpoints

### POST /api/auth/login

Authenticate user and receive JWT token.

**Request:**
```json
{
  "username": "tech_paris",
  "password": "your_password",
  "device_id": "PARIS_01"
}
```

**cURL:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tech_paris",
    "password": "your_password",
    "device_id": "PARIS_01"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 3,
    "username": "tech_paris",
    "email": "tech@paris.example.com",
    "role": "commercial",
    "active": true
  }
}
```

**Response (401):**
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

**Notes:**
- Token expires in 7 days
- Store token securely (LocalStorage for web, Electron secure store)
- Device ID helps track which device is syncing

---

### POST /api/auth/refresh

Refresh an expiring JWT token.

**Request:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**cURL:**
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJ0eXAiOiJKV1QiLCJhbGc..."}'
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "exp": 1709306400
}
```

**Notes:**
- Call before token expires
- Use if token expires in < 24 hours
- Returns new token with fresh 7-day expiry

---

### GET /api/auth/me

Get current authenticated user profile.

**Request:**
```
Authorization: Bearer <token>
```

**cURL:**
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "id": 3,
  "username": "tech_paris",
  "email": "tech@paris.example.com",
  "role": "commercial",
  "active": true,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-02-15T14:22:15Z"
}
```

**Notes:**
- Password never returned
- Verify token validity
- Check role for UI permissions

---

## 👥 Clients Endpoints

All endpoints require `authenticateJWT`. Admin-only endpoints marked with 🔒.

### GET /api/clients

List all clients. 🔒 (Admin only)

**Query Parameters:**
| Name | Type | Optional | Default |
|------|------|----------|---------|
| skip | number | Yes | 0 |
| take | number | Yes | 50 |
| active | boolean | Yes | (all) |

**cURL:**
```bash
curl -X GET "http://localhost:5000/api/clients?take=10&active=true" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "ACME Corp",
      "email": "contact@acme.com",
      "phone": "+33123456789",
      "balance": 5000,
      "active": true,
      "created_at": "2026-01-10T09:00:00Z",
      "updated_at": "2026-02-15T11:30:00Z",
      "quotas": [
        {
          "id": 1,
          "client_id": 1,
          "monthly_limit": 100,
          "remaining": 76,
          "reset_date": "2026-03-01T00:00:00Z"
        }
      ]
    },
    {
      "id": 2,
      "name": "TechCorp",
      "email": "ops@techcorp.com",
      "phone": "+33987654321",
      "balance": 10000,
      "active": true,
      "created_at": "2026-01-12T14:20:00Z",
      "updated_at": "2026-02-16T09:15:00Z",
      "quotas": [
        {
          "id": 2,
          "client_id": 2,
          "monthly_limit": 200,
          "remaining": 142,
          "reset_date": "2026-03-01T00:00:00Z"
        }
      ]
    }
  ],
  "total": 2
}
```

---

### GET /api/clients/:id

Get single client with quotas.

**cURL:**
```bash
curl -X GET http://localhost:5000/api/clients/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "ACME Corp",
    "email": "contact@acme.com",
    "phone": "+33123456789",
    "balance": 5000,
    "active": true,
    "badges_count": 42,
    "copies_count": 156,
    "quotas": [
      {
        "id": 1,
        "monthly_limit": 100,
        "remaining": 76,
        "reset_date": "2026-03-01T00:00:00Z"
      }
    ]
  }
}
```

---

### POST /api/clients

Create new client. 🔒 (Admin only)

**Request:**
```json
{
  "name": "NewCorp",
  "email": "contact@newcorp.com",
  "phone": "+33555666777",
  "balance": 15000,
  "monthly_quota": 150
}
```

**cURL:**
```bash
curl -X POST http://localhost:5000/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NewCorp",
    "email": "contact@newcorp.com",
    "phone": "+33555666777",
    "balance": 15000,
    "monthly_quota": 150
  }'
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "NewCorp",
    "email": "contact@newcorp.com",
    "phone": "+33555666777",
    "balance": 15000,
    "active": true,
    "created_at": "2026-02-17T15:45:00Z",
    "quotas": [
      {
        "id": 5,
        "monthly_limit": 150,
        "remaining": 150,
        "reset_date": "2026-03-01T00:00:00Z"
      }
    ]
  }
}
```

---

### PUT /api/clients/:id

Update client. 🔒 (Admin only)

**Request:**
```json
{
  "name": "NewCorp Updated",
  "phone": "+33555888999",
  "balance": 20000,
  "active": true
}
```

**cURL:**
```bash
curl -X PUT http://localhost:5000/api/clients/5 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NewCorp Updated",
    "phone": "+33555888999",
    "balance": 20000,
    "active": true
  }'
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "NewCorp Updated",
    "email": "contact@newcorp.com",
    "phone": "+33555888999",
    "balance": 20000,
    "active": true,
    "updated_at": "2026-02-17T16:00:00Z"
  }
}
```

---

### DELETE /api/clients/:id

Delete client. 🔒 (Admin only)

**cURL:**
```bash
curl -X DELETE http://localhost:5000/api/clients/5 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Client deleted",
  "deleted_id": 5
}
```

**Notes:**
- Deletes client, quotas, and copy history
- Cannot undo operation
- Confirm with user before delete

---

## 📊 Quotas Endpoints

### GET /api/quotas/:client_id

Get quota for specific client.

**cURL:**
```bash
curl -X GET http://localhost:5000/api/quotas/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "client_id": 1,
    "monthly_limit": 100,
    "remaining": 76,
    "reset_date": "2026-03-01T00:00:00Z",
    "created_at": "2026-01-10T09:00:00Z",
    "updated_at": "2026-02-17T14:30:00Z"
  }
}
```

---

### PUT /api/quotas/:client_id

Update quota. 🔒 (Admin only)

**Request:**
```json
{
  "monthly_limit": 150,
  "remaining": 75
}
```

**cURL:**
```bash
curl -X PUT http://localhost:5000/api/quotas/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthly_limit": 150,
    "remaining": 75
  }'
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "client_id": 1,
    "monthly_limit": 150,
    "remaining": 75,
    "reset_date": "2026-03-01T00:00:00Z",
    "updated_at": "2026-02-17T14:40:00Z"
  }
}
```

---

## 📝 Copies Endpoints

### POST /api/copies

Record a badge copy operation.

**Request:**
```json
{
  "client_id": 1,
  "uid": "04AB12CD34",
  "status": "success",
  "device_id": "PARIS_01"
}
```

**cURL:**
```bash
curl -X POST http://localhost:5000/api/copies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "uid": "04AB12CD34",
    "status": "success",
    "device_id": "PARIS_01"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "client_id": 1,
    "uid": "04AB12CD34",
    "status": "success",
    "device_id": "PARIS_01",
    "recorded_by": "tech_paris",
    "synced": false,
    "created_at": "2026-02-17T14:45:30Z",
    "updated_at": "2026-02-17T14:45:30Z"
  }
}
```

---

### GET /api/copies/history

Get copy history. 🔒 (Admin only)

**Query Parameters:**
| Name | Type | Optional | Default |
|------|------|----------|---------|
| limit | number | Yes | 100 |
| offset | number | Yes | 0 |
| client_id | number | Yes | (all) |
| device_id | string | Yes | (all) |
| since | ISO8601 | Yes | (all time) |

**cURL:**
```bash
curl -X GET "http://localhost:5000/api/copies/history?limit=50&client_id=1" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "client_id": 1,
      "uid": "04AB12CD34",
      "status": "success",
      "device_id": "PARIS_01",
      "recorded_by": "tech_paris",
      "synced": true,
      "created_at": "2026-02-17T14:45:30Z"
    },
    {
      "id": 455,
      "client_id": 1,
      "uid": "04AB12CD35",
      "status": "success",
      "device_id": "PARIS_01",
      "recorded_by": "tech_paris",
      "synced": true,
      "created_at": "2026-02-17T14:40:15Z"
    }
  ],
  "total": 156
}
```

---

## 💾 Dumps Endpoints

### GET /api/dumps

List all backup dumps. 🔒 (Admin only)

**cURL:**
```bash
curl -X GET http://localhost:5000/api/dumps \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "client_id": 1,
      "data": "{...}",
      "hash": "sha256:a1b2c3d4...",
      "uploaded_by": "tech_paris",
      "created_at": "2026-02-17T12:00:00Z"
    }
  ]
}
```

---

### POST /api/dumps/upload

Upload badge data dump.

**Request (multipart/form-data):**
```
file: <binary JSON file>
client_id: 1
```

**cURL:**
```bash
curl -X POST http://localhost:5000/api/dumps/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "client_id=1" \
  -F "file=@dumps/client_1_backup.json"
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 11,
    "client_id": 1,
    "hash": "sha256:e1f2g3h4...",
    "uploaded_by": "tech_paris",
    "created_at": "2026-02-17T15:50:00Z"
  }
}
```

---

## 🔄 Sync Endpoints

### POST /api/sync/push

Send offline queue to server for processing.

**Request:**
```json
{
  "device_id": "PARIS_01",
  "queue": [
    {
      "id": 1,
      "type": "copy",
      "payload": {
        "client_id": 1,
        "uid": "04AB001",
        "status": "pending"
      }
    },
    {
      "id": 2,
      "type": "copy",
      "payload": {
        "client_id": 1,
        "uid": "04AB002",
        "status": "pending"
      }
    }
  ]
}
```

**cURL:**
```bash
curl -X POST http://localhost:5000/api/sync/push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "PARIS_01",
    "queue": [
      {
        "id": 1,
        "type": "copy",
        "payload": {
          "client_id": 1,
          "uid": "04AB001"
        }
      }
    ]
  }'
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "status": "synced"
    },
    {
      "id": 2,
      "status": "failed",
      "error": "Insufficient quota"
    }
  ]
}
```

---

### GET /api/sync/pull

Fetch snapshot of all clients, quotas, and badges.

**cURL:**
```bash
curl -X GET http://localhost:5000/api/sync/pull \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "success": true,
  "clients": [
    {
      "id": 1,
      "name": "ACME Corp",
      "email": "contact@acme.com",
      "active": true
    }
  ],
  "quotas": [
    {
      "id": 1,
      "client_id": 1,
      "monthly_limit": 100,
      "remaining": 76,
      "reset_date": "2026-03-01T00:00:00Z"
    }
  ],
  "badges": [
    {
      "id": 1,
      "client_id": 1,
      "uid": "04AB12CD34",
      "active": true
    }
  ]
}
```

---

## 🔌 WebSocket (Real-time)

### Connection

Connect with JWT token:

```javascript
const token = 'eyJ0eXAiOiJKV1QiLCJhbGc...';
const deviceId = 'PARIS_01';
const ws = new WebSocket(
  `ws://localhost:5000/ws?token=${token}&device_id=${deviceId}`
);

ws.onopen = () => {
  console.log('Connected to server');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Server message:', message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from server');
};
```

---

### Message Types

#### Heartbeat (Ping-Pong)

Server sends every 30 seconds:

```json
{
  "type": "ping"
}
```

Client must respond with:

```json
{
  "type": "pong"
}
```

---

#### Copy Completed

Server broadcasts to all admin clients:

```json
{
  "type": "copy_completed",
  "data": {
    "id": 456,
    "client_id": 1,
    "uid": "04AB12CD34",
    "device_id": "PARIS_01",
    "status": "success",
    "recorded_by": "tech_paris",
    "created_at": "2026-02-17T14:45:30Z"
  }
}
```

---

#### Quota Updated

When quota is manually adjusted:

```json
{
  "type": "quota_updated",
  "data": {
    "client_id": 1,
    "remaining": 75,
    "updated_at": "2026-02-17T14:50:00Z"
  }
}
```

---

#### Sync Completed

After push queue is processed:

```json
{
  "type": "sync_completed",
  "data": {
    "device_id": "PARIS_01",
    "synced_count": 5,
    "failed_count": 0,
    "completed_at": "2026-02-17T14:55:00Z"
  }
}
```

---

## 🧪 Testing Examples

### Test Full Flow

```bash
#!/bin/bash

SERVER="http://localhost:5000"

# 1. Login
echo "=== LOGIN ==="
LOGIN_RESPONSE=$(curl -s -X POST "$SERVER/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "device_id": "TEST_01"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# 2. Get clients
echo -e "\n=== LIST CLIENTS ==="
curl -s -X GET "$SERVER/api/clients" \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Record copy
echo -e "\n=== RECORD COPY ==="
curl -s -X POST "$SERVER/api/copies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "uid": "04AB12CD34",
    "status": "success",
    "device_id": "TEST_01"
  }' | jq

# 4. Get history
echo -e "\n=== COPY HISTORY ==="
curl -s -X GET "$SERVER/api/copies/history?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 🐛 Error Responses

### Example 401 (Unauthorized)

```json
{
  "success": false,
  "error": "No token provided"
}
```

### Example 403 (Forbidden)

```json
{
  "success": false,
  "error": "Insufficient permissions (required role: admin)"
}
```

### Example 409 (Conflict)

```json
{
  "success": false,
  "error": "Duplicate email address"
}
```

### Example 500 (Server Error)

```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 📚 Rate Limiting

- General API: 100 requests per 15 minutes per IP
- Auth endpoints: 5 attempts per 15 minutes per IP
- WebSocket: No limit (persistent connection)

If rate limited:

```
HTTP/429 Too Many Requests

Retry-After: 60
X-RateLimit-Reset: 1676550000
```

---

## 🔗 Webhook Integration (Future)

When implemented, events sent to configured webhook URL:

```json
POST https://your-domain.com/webhooks/propass

{
  "event": "copy_completed",
  "timestamp": "2026-02-17T14:45:30Z",
  "data": {...}
}
```

---

## 📞 Support

For API issues or questions:
- Email: api-support@djougoo.com
- Slack: #propass-eng (enterprise only)
- Docs: https://docs.propass.com (coming soon)
