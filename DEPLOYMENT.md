# PROPASS PRO - Deployment Guide

Production deployment instructions for PROPASS PRO server infrastructure.

## 📋 Pre-Deployment Checklist

### Infrastructure Requirements
- [ ] Server with 2GB+ RAM (Docker host)
- [ ] 20GB+ disk space (PostgreSQL data)
- [ ] Docker and Docker Compose installed
- [ ] Domain name (custom or IP address)
- [ ] SSL certificate (for HTTPS)
- [ ] Network connectivity (all clients must reach server)

### Configuration Ready
- [ ] `.env` file configured with production values
- [ ] JWT_SECRET changed from default
- [ ] DATABASE_URL pointing to target PostgreSQL
- [ ] LOG_LEVEL set appropriately
- [ ] Firewall rules allow port 5000 (or proxy port)

## 🚀 Deployment Options

### Option 1: Docker Compose (Recommended)

#### Step 1: Prepare Server

```bash
# SSH into server
ssh user@your-server.com

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify installation
docker --version
docker-compose --version
```

#### Step 2: Deploy Application

```bash
# Clone repository
git clone <your-repo> propass-pro
cd propass-pro

# Copy configuration
cp .env.example .env

# Edit for production
nano .env
# Set:
# PORT=5000
# DATABASE_URL=postgresql://propass:your-password@postgres:5432/propass_db
# JWT_SECRET=your-very-secret-key-min-32-chars
# NODE_ENV=production
```

#### Step 3: Start Services

```bash
# Build and start
docker-compose up -d

# Check status
docker-compose ps
# Should show:
# postgres    | Up
# server      | Up
# pgadmin     | Up

# View logs
docker-compose logs -f server

# Run migrations
docker-compose exec server npx prisma migrate deploy

# Seed admin user
docker-compose exec server npm run db:seed
```

#### Step 4: Verify Deployment

```bash
# Health check
curl http://localhost:5000/health

# Response should be:
# {"status":"ok","timestamp":"2026-02-17T12:00:00Z"}

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "device_id": "TEST"
  }'
```

### Option 2: Manual Installation

#### Prerequisites

```bash
# Install Node.js (v18+)
nvm install 18
nvm use 18

# Install PostgreSQL
brew install postgresql  # macOS
# OR
sudo apt install postgresql  # Linux

# Verify
node --version
npm --version
psql --version
```

#### Setup Application

```bash
# Clone and install
git clone <your-repo> propass-pro
cd propass-pro
npm install

# Create database
createdb propass_db

# Configure environment
cp .env.example .env
# Edit .env with your values
```

#### Run Migrations

```bash
npx prisma migrate deploy
npm run db:seed
```

#### Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Option 3: Kubernetes Deployment

#### Create Deployment File

File: `k8s/propass-deployment.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: propass

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: propass-config
  namespace: propass
data:
  NODE_ENV: "production"
  JWT_SECRET: "your-secret-key-here"
  DATABASE_URL: "postgresql://propass:password@postgres:5432/propass_db"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: propass-server
  namespace: propass
spec:
  replicas: 2
  selector:
    matchLabels:
      app: propass-server
  template:
    metadata:
      labels:
        app: propass-server
    spec:
      containers:
      - name: server
        image: propass-pro-server:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: propass-config
              key: NODE_ENV
        - name: JWT_SECRET
          valueFrom:
            configMapKeyRef:
              name: propass-config
              key: JWT_SECRET
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: propass-config
              key: DATABASE_URL
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: propass-service
  namespace: propass
spec:
  selector:
    app: propass-server
  ports:
  - protocol: TCP
    port: 5000
    targetPort: 5000
  type: LoadBalancer
```

#### Deploy

```bash
kubectl apply -f k8s/propass-deployment.yaml
kubectl get pods -n propass
kubectl logs -n propass -l app=propass-server
```

## 🌐 Reverse Proxy Setup (Nginx)

For production, use Nginx as reverse proxy with SSL:

```nginx
# /etc/nginx/sites-available/propass

upstream propass_backend {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name api.propass.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.propass.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.propass.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.propass.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy settings
    client_max_body_size 10M;

    location / {
        proxy_pass http://propass_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Gzip compression
    gzip on;
    gzip_types application/json text/plain;
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/propass /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 Security Hardening

### 1. Environment Variables

```bash
# Generate strong JWT secret
openssl rand -base64 32

# Store securely (never in Git)
export JWT_SECRET="your-generated-secret"
export DATABASE_URL="postgresql://user:password@host:5432/db"
```

### 2. Database Security

```sql
-- Create restricted user
CREATE USER propass WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE propass_db TO propass;
GRANT USAGE ON SCHEMA public TO propass;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO propass;

-- Restrict default user
REVOKE ALL ON DATABASE propass_db FROM postgres;
```

### 3. Network Security

```bash
# Firewall rules (UFW)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 5432/tcp    # PostgreSQL (internal only)
sudo ufw enable

# Alternatively, restrict to specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 5432
```

### 4. API Rate Limiting

Add to server.ts:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // strict for auth
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
```

## 📊 Monitoring & Logging

### 1. Application Logs

```bash
# View server logs
docker-compose logs -f server

# Export logs
docker-compose logs server > server.log

# Structured logging with Winston
npm install winston

# Configure in server.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}
```

### 2. Database Monitoring

```sql
-- Monitor connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Monitor slow queries
SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Health Monitoring

```bash
# Continuous health check
watch -n 5 'curl -s http://localhost:5000/health | jq'
```

### 4. Prometheus Metrics (Optional)

```typescript
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path, res.statusCode)
      .observe(duration);
  });
  next();
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
});
```

## 🔄 Database Backup Strategy

### Automated Backups

```bash
# Create backup script
cat > /opt/propass/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/propass/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/propass_db_$DATE.sql"

mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T postgres pg_dump -U propass propass_db > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
EOF

chmod +x /opt/propass/backup.sh

# Schedule daily
0 2 * * * /opt/propass/backup.sh
```

### Restore Backup

```bash
# List backups
ls -lah /opt/propass/backups/

# Restore
gunzip propass_db_20260217_021500.sql.gz
docker-compose exec -T postgres psql -U propass propass_db < propass_db_20260217_021500.sql
```

## 📈 Scaling Strategy

### Horizontal Scaling

```yaml
# docker-compose.yml with load balancer
version: '3.8'
services:
  # ... existing services ...
  
  nginx:
    image: nginx:latest
    ports:
      - "5000:5000"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - server1
      - server2
      - server3

  server1:
    build: .
    environment:
      - PORT=5001
      - INSTANCE_ID=1

  server2:
    build: .
    environment:
      - PORT=5001
      - INSTANCE_ID=2

  server3:
    build: .
    environment:
      - PORT=5001
      - INSTANCE_ID=3
```

### WebSocket Failover

For WebSocket support across multiple instances, use Redis:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const io = new Server(httpServer, {
  adapter: createAdapter(
    createClient({ host: 'redis', port: 6379 }),
    createClient({ host: 'redis', port: 6379 })
  ),
});
```

## 🚨 Troubleshooting Deployment

### Issue: Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

### Issue: PostgreSQL Connection Failed
```bash
# Check if service is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U propass -d propass_db -c "SELECT 1"
```

### Issue: Out of Disk Space
```bash
# Check disk usage
docker system df

# Clean up
docker system prune -a
docker volume prune
```

### Issue: Memory Leak
```bash
# Monitor memory
docker stats

# Check for pending database connections
SELECT COUNT(*) FROM pg_stat_activity;

# Restart service
docker-compose restart server
```

## 📞 Post-Deployment

1. **Update Electron Clients**
   - Point to new server URL: `serverConfig.setServerUrl('https://api.propass.com')`

2. **Test End-to-End**
   - Login from client
   - Perform NFC read/write
   - Verify sync to server
   - Check admin dashboard

3. **Monitor Metrics**
   - Setup log aggregation
   - Configure alerts for errors
   - Monitor quota usage

4. **Communicate to Users**
   - Document new server URL
   - Provide migration guide
   - Setup support channel

## 📚 References

- Docker: https://docs.docker.com/
- PostgreSQL: https://www.postgresql.org/docs/
- Nginx: https://nginx.org/en/docs/
- Prisma: https://www.prisma.io/docs/
- Let's Encrypt: https://letsencrypt.org/docs/
