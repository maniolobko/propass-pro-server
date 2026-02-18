# PROPASS PRO - Integration Guide

Complete guide for integrating PROPASS PRO Server with Electron client application.

## 🎯 Integration Overview

The PROPASS PRO server is designed to work with distributed Electron clients that:
- **Operate offline** with local SQLite database
- **Queue operations** when disconnected
- **Sync automatically** when reconnected
- **Receive real-time updates** via WebSocket
- **Validate quotas** against server data

## 📋 Prerequisites

### Server Requirements
- ✅ PROPASS PRO Server running (see [README.md](README.md))
- ✅ PostgreSQL database accessible
- ✅ WebSocket endpoint available on `/ws`
- ✅ Admin user created for testing

### Client Requirements
- ✅ Electron app with SQLite database
- ✅ Python NFC daemon running on client
- ✅ TypeScript support (tsconfig configured)
- ✅ Network connectivity (WiFi or LAN)

## 🔧 Client-Side Implementation

### 1. Create SyncService

File: `app_source/dist/main/main/services/SyncService.ts`

```typescript
import axios, { AxiosInstance } from 'axios';
import { Database } from 'better-sqlite3';
import * as jwt_decode from 'jwt-decode';

interface SyncQueueItem {
  id?: number;
  type: 'copy' | 'write';
  payload: Record<string, any>;
  status: 'pending' | 'synced' | 'failed';
  created_at?: string;
  error?: string;
}

interface SyncConfig {
  serverUrl: string;
  wsUrl: string;
  deviceId: string;
  jwtToken: string;
  db: Database;
}

export class SyncService {
  private config: SyncConfig;
  private apiClient: AxiosInstance;
  private isOnline: boolean = true;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(config: SyncConfig) {
    this.config = config;
    this.apiClient = axios.create({
      baseURL: config.serverUrl,
      headers: {
        Authorization: `Bearer ${config.jwtToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Detect online/offline
    this.setupConnectivityMonitor();
  }

  /**
   * Queue an operation for later sync
   */
  async queueOperation(
    type: 'copy' | 'write',
    payload: Record<string, any>
  ): Promise<number> {
    const stmt = this.config.db.prepare(`
      INSERT INTO sync_queue (type, payload, status, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(type, JSON.stringify(payload), 'pending');
    return result.lastInsertRowid as number;
  }

  /**
   * Send queued operations to server
   */
  async pushQueue(): Promise<{
    success: boolean;
    synced: number;
    failed: number;
  }> {
    try {
      // Get pending items
      const pending = this.config.db
        .prepare(
          `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`
        )
        .all() as SyncQueueItem[];

      if (pending.length === 0) {
        return { success: true, synced: 0, failed: 0 };
      }

      // Prepare queue
      const queue = pending.map((item) => ({
        id: item.id,
        type: item.type,
        payload: JSON.parse(item.payload as string),
      }));

      // Send to server
      const response = await this.apiClient.post('/api/sync/push', {
        device_id: this.config.deviceId,
        queue,
      });

      // Process results
      let synced = 0;
      let failed = 0;

      if (response.data.data && Array.isArray(response.data.data)) {
        const updateStmt = this.config.db.prepare(
          `UPDATE sync_queue SET status = ?, error = ? WHERE id = ?`
        );

        for (const result of response.data.data) {
          if (result.status === 'synced') {
            updateStmt.run('synced', null, result.id);
            synced++;
          } else {
            updateStmt.run('failed', result.error, result.id);
            failed++;
          }
        }
      }

      return { success: true, synced, failed };
    } catch (error: any) {
      console.error('Push sync failed:', error.message);
      return { success: false, synced: 0, failed: pending.length };
    }
  }

  /**
   * Pull latest data from server
   */
  async pullQuotas(): Promise<any> {
    try {
      const response = await this.apiClient.get('/api/sync/pull');

      if (response.data.success) {
        // Update local quotas
        const updateQuota = this.config.db.prepare(
          `UPDATE quotas SET remaining = ?, updated_at = datetime('now')
           WHERE client_id = ?`
        );

        for (const quota of response.data.quotas || []) {
          updateQuota.run(quota.remaining, quota.client_id);
        }

        return response.data;
      }

      return { success: false };
    } catch (error: any) {
      console.error('Pull sync failed:', error.message);
      return { success: false };
    }
  }

  /**
   * Record copy operation in local queue
   */
  async recordCopy(clientId: number, uid: string): Promise<boolean> {
    try {
      // Check quota locally
      const quota = this.config.db
        .prepare('SELECT remaining FROM quotas WHERE client_id = ?')
        .get(clientId) as any;

      if (!quota || quota.remaining <= 0) {
        console.error('Insufficient quota');
        return false;
      }

      // Decrement locally (optimistic)
      const updateQuota = this.config.db.prepare(
        `UPDATE quotas SET remaining = remaining - 1 WHERE client_id = ?`
      );
      updateQuota.run(clientId);

      // Queue the operation
      await this.queueOperation('copy', {
        client_id: clientId,
        uid,
        status: 'pending',
      });

      return true;
    } catch (error: any) {
      console.error('Record copy failed:', error.message);
      return false;
    }
  }

  /**
   * Auto-sync when online
   */
  private setupConnectivityMonitor(): void {
    // Check every 30 seconds if online
    this.syncInterval = setInterval(async () => {
      const wasOnline = this.isOnline;
      this.isOnline = await this.checkConnectivity();

      // Transitioned online: trigger sync
      if (!wasOnline && this.isOnline) {
        console.log('Connection restored - syncing...');
        await this.pushQueue();
        await this.pullQuotas();
      }
    }, 30000);
  }

  /**
   * Check if server is reachable
   */
  private async checkConnectivity(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.config.serverUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(): number | null {
    try {
      const decoded = jwt_decode.jwtDecode(
        this.config.jwtToken
      ) as any;
      return decoded.exp ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token needs refresh
   */
  isTokenExpiringSoon(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return false;
    const now = Date.now();
    return expiry - now < 24 * 60 * 60 * 1000; // Less than 1 day
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}
```

### 2. Create WebSocketService

File: `app_source/dist/main/main/services/WebSocketService.ts`

```typescript
import { EventEmitter } from 'events';

interface WebSocketConfig {
  wsUrl: string;
  token: string;
  deviceId: string;
}

export class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(config: WebSocketConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.config.wsUrl}?token=${this.config.token}&device_id=${this.config.deviceId}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };

        this.ws.onerror = (event) => {
          console.error('WebSocket error:', event);
          this.emit('error', event);
          reject(event);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.stopHeartbeat();
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    const { type, data } = message;

    switch (type) {
      case 'pong':
        // Heartbeat response
        break;

      case 'quota_updated':
        this.emit('quota_updated', data);
        break;

      case 'sync_completed':
        this.emit('sync_completed', data);
        break;

      case 'copy_completed':
        this.emit('copy_completed', data);
        break;

      default:
        console.warn(`Unknown message type: ${type}`);
    }
  }

  /**
   * Send message to server
   */
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  /**
   * Send heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      console.log(
        `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
      );

      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  /**
   * Disconnect cleanly
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
```

### 3. Create ServerConfig

File: `app_source/dist/main/main/config/server.config.ts`

```typescript
import { Store } from 'electron-store';

interface ServerConfiguration {
  serverUrl: string;
  wsUrl: string;
  deviceId: string;
  jwtToken: string | null;
  lastSyncTime: number;
}

const defaults: ServerConfiguration = {
  serverUrl: 'http://localhost:5000',
  wsUrl: 'ws://localhost:5000',
  deviceId: generateDeviceId(),
  jwtToken: null,
  lastSyncTime: 0,
};

function generateDeviceId(): string {
  const hostname = require('os').hostname();
  const timestamp = Date.now().toString(36);
  return `${hostname}_${timestamp}`.toUpperCase();
}

export class ServerConfig {
  private store: Store<ServerConfiguration>;

  constructor() {
    this.store = new Store<ServerConfiguration>({
      name: 'server-config',
      defaults,
    });
  }

  /**
   * Get full configuration
   */
  getConfig(): ServerConfiguration {
    return {
      serverUrl: this.getServerUrl(),
      wsUrl: this.getWsUrl(),
      deviceId: this.getDeviceId(),
      jwtToken: this.getToken(),
      lastSyncTime: this.getLastSyncTime(),
    };
  }

  /**
   * Set server URL
   */
  setServerUrl(url: string): void {
    this.store.set('serverUrl', url);
    this.store.set('wsUrl', url.replace('http', 'ws'));
  }

  /**
   * Get server URL
   */
  getServerUrl(): string {
    return this.store.get('serverUrl');
  }

  /**
   * Get WebSocket URL
   */
  getWsUrl(): string {
    return this.store.get('wsUrl');
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.store.get('deviceId');
  }

  /**
   * Store JWT token
   */
  setToken(token: string): void {
    this.store.set('jwtToken', token);
  }

  /**
   * Get JWT token
   */
  getToken(): string | null {
    return this.store.get('jwtToken') || null;
  }

  /**
   * Clear token on logout
   */
  clearToken(): void {
    this.store.set('jwtToken', null);
  }

  /**
   * Track last sync time
   */
  setLastSyncTime(time: number): void {
    this.store.set('lastSyncTime', time);
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number {
    return this.store.get('lastSyncTime');
  }
}

export const serverConfig = new ServerConfig();
```

### 4. Integrate into Electron Main

File: `app_source/dist/main/main/index.ts` (update existing)

```typescript
// Add imports
import { SyncService } from './services/SyncService';
import { WebSocketService } from './services/WebSocketService';
import { serverConfig } from './config/server.config';

// In your main Electron process initialization
let syncService: SyncService | null = null;
let wsService: WebSocketService | null = null;

async function initializeServer() {
  const token = serverConfig.getToken();
  
  if (!token) {
    console.log('Not logged in to server');
    return;
  }

  const config = serverConfig.getConfig();

  // Initialize sync service
  syncService = new SyncService({
    serverUrl: config.serverUrl,
    wsUrl: config.wsUrl,
    deviceId: config.deviceId,
    jwtToken: token,
    db: getMainDatabase(), // Your existing database instance
  });

  // Initialize WebSocket service
  wsService = new WebSocketService({
    wsUrl: config.wsUrl,
    token: token,
    deviceId: config.deviceId,
  });

  try {
    await wsService.connect();
    console.log('Connected to server');
  } catch (error) {
    console.error('Failed to connect to server:', error);
  }

  // Listen for real-time events
  wsService.on('quota_updated', (data) => {
    console.log('Quota updated:', data);
    mainWindow?.webContents.send('quota-updated', data);
  });

  wsService.on('copy_completed', (data) => {
    console.log('Copy completed:', data);
    mainWindow?.webContents.send('copy-completed', data);
  });
}

// In your login handler
ipcMain.handle('user:login', async (event, username, password) => {
  try {
    const response = await axios.post(
      serverConfig.getServerUrl() + '/api/auth/login',
      { username, password, device_id: serverConfig.getDeviceId() }
    );

    if (response.data.success) {
      serverConfig.setToken(response.data.token);
      await initializeServer();
      return { success: true, user: response.data.user };
    }
    
    return { success: false, error: 'Login failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// On app quit
app.on('before-quit', () => {
  if (syncService) syncService.destroy();
  if (wsService) wsService.disconnect();
});
```

## 🔌 Integration Checklist

- [ ] SyncService.ts created
- [ ] WebSocketService.ts created
- [ ] ServerConfig class created
- [ ] Electron main process updated with initialization
- [ ] Login handler connected to server
- [ ] IPC handlers setup for quota/copy updates
- [ ] SQLite sync_queue table created
- [ ] Network connectivity detection working
- [ ] JWT token refresh handler added
- [ ] Error handling for offline scenarios

## 🧪 Testing Integration

### 1. Test Server Connection

```javascript
// In DevTools console
const { ipcRenderer } = require('electron');

ipcRenderer.invoke('user:login', 'admin', 'admin123').then(result => {
  console.log('Login result:', result);
});
```

### 2. Test Queue Operation

```javascript
// Simulate NFC read → queue sync
ipcRenderer.invoke('nfc:copy', 1, '04AB12CD34').then(result => {
  console.log('Copy queued:', result);
});
```

### 3. Test Sync

```javascript
// Manually trigger sync
ipcRenderer.invoke('sync:push').then(result => {
  console.log('Sync result:', result);
});
```

### 4. Monitor WebSocket

```javascript
// Real-time event listener
ipcRenderer.on('copy-completed', (event, data) => {
  console.log('Server confirmation:', data);
});
```

## 📊 Troubleshooting Integration

### Issue: WebSocket Connection Refused
```
Error: WebSocket is closed before the connection is established
```

**Solution:**
- Verify server is running: `curl http://localhost:5000/health`
- Check token validity: `serverConfig.getToken()`
- Ensure correct WS URL: `serverConfig.getWsUrl()`

### Issue: Quota Not Updating
```
Quota remains the same after copy
```

**Solution:**
- Check sync_queue table: pending items not synced?
- Verify server received push: check PostgreSQL copies table
- Ensure quota pull is happening: call `pullQuotas()` explicitly

### Issue: Token Expired During Session
```
Error: Invalid token
```

**Solution:**
- Implement refresh handler before expiry
- Use `syncService.isTokenExpiringSoon()` to proactively refresh
- Call `/api/auth/refresh` with old token

## 📈 Performance Tips

1. **Batch Operations**: Queue multiple copies before syncing
2. **Connection Detection**: Don't retry sync if no connectivity
3. **Token Refresh**: Refresh 24 hours before expiry
4. **Database Indexing**: Add index on `sync_queue.status`
5. **WebSocket Backpressure**: Limit message rate to 10/sec

## 🚀 Next Steps

1. Implement UI components to show sync status
2. Add settings page for server URL configuration
3. Create admin dashboard with real-time updates
4. Setup automated sync on schedule
5. Add offline cache for frequently used data
