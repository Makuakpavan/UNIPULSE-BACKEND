# UniPulse Backend API

The Heartbeat of Campus Life — Production-ready Express.js backend for the UniPulse campus social platform.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js with TypeScript
- **Database:** MongoDB (Mongoose ODM)
- **Cache:** Redis (ioredis)
- **Real-time:** Socket.IO
- **Media:** Cloudinary
- **Auth:** JWT with refresh token rotation, optional 2FA (Speakeasy)
- **Security:** Helmet, CORS, Rate Limiting, RBAC, Audit Logging
- **Email:** Nodemailer (SMTP)

## Project Structure

```
unipulse-backend/
├── src/
│   ├── config/         # Environment, DB, Redis, Cloudinary config
│   ├── controllers/    # Route handlers
│   ├── middleware/     # Auth, RBAC, rate limiting, error handling
│   ├── models/         # Mongoose schemas
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic (auth, email, sockets)
│   ├── sockets/        # Socket.IO event handlers
│   ├── types/          # TypeScript interfaces & enums
│   ├── utils/          # Helpers, validators, logger
│   ├── app.ts          # Express app configuration
│   └── server.ts       # Server bootstrap with Socket.IO
├── uploads/            # Temporary upload directory
├── .env.example        # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- MongoDB (local or MongoDB Atlas)
- Redis (local or Redis Cloud)

### 1. Install Dependencies

```bash
cd unipulse-backend
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173

MONGODB_URI=mongodb://localhost:27017/unipulse
# OR MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/unipulse

REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=your-random-64-char-secret
JWT_REFRESH_SECRET=another-random-64-char-secret

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 3. Generate JWT Secrets

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run this twice and paste the outputs into `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

### 4. Run in Development

```bash
npm run dev
```

The server starts at `http://localhost:5000`.

### 5. Seed Initial Data (Optional)

```bash
npm run seed
```

This creates sample institutions and a super admin account.

---

## Testing Locally

### Health Check
```bash
curl http://localhost:5000/health
```

### Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@unilag.edu.ng",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "institution": "INSTITUTION_ID_HERE"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@unilag.edu.ng",
    "password": "SecurePass123!"
  }'
```

### Create a Post (with Bearer token)
```bash
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello UniPulse! This is my first post.",
    "visibility": "public",
    "tags": ["intro", "campus"]
  }'
```

### Get Campus Feed
```bash
curl http://localhost:5000/api/posts/feed \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/2fa/verify` | No | Verify 2FA |
| POST | `/api/auth/refresh` | No | Refresh tokens |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/users/institutions` | No | List institutions |
| GET | `/api/users/profile/:id` | Yes | View profile |
| PATCH | `/api/users/profile` | Yes | Update profile |
| POST | `/api/users/follow/:id` | Yes | Follow/unfollow |
| GET | `/api/posts/feed` | Yes | Campus feed |
| POST | `/api/posts` | Yes | Create post |
| POST | `/api/posts/:id/like` | Yes | Like/unlike |
| POST | `/api/posts/:id/comment` | Yes | Add comment |
| GET | `/api/posts/pending` | Admin | Anonymous queue |
| PATCH | `/api/posts/:id/moderate` | Admin | Approve/reject |
| GET | `/api/events` | Yes | List events |
| POST | `/api/events` | Yes | Create event |
| POST | `/api/events/:id/attend` | Yes | Attend event |
| GET | `/api/marketplace` | Yes | Browse items |
| POST | `/api/marketplace` | Yes | List item |
| GET | `/api/communities` | Yes | List communities |
| POST | `/api/communities` | Yes | Create community |
| POST | `/api/communities/:id/join` | Yes | Join community |
| GET | `/api/chat/conversations` | Yes | Get conversations |
| GET | `/api/chat/:userId` | Yes | Get messages |
| POST | `/api/chat` | Yes | Send message |
| GET | `/api/notifications` | Yes | Get notifications |
| GET | `/api/admin/dashboard` | Admin | Dashboard stats |
| GET | `/api/admin/verifications` | Admin | Pending verifications |
| POST | `/api/admin/verify/:id` | Admin | Verify student |
| GET | `/api/search?q=query` | Yes | Global search |

---

## Connecting Frontend to Backend

### 1. Axios Configuration (Frontend)

```typescript
// src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 2. Socket.IO Client (Frontend)

```typescript
// src/lib/socket.ts
import { io } from 'socket.io-client';

const token = localStorage.getItem('accessToken');

export const socket = io(import.meta.env.VITE_API_URL, {
  auth: { token },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to UniPulse real-time server');
});

socket.on('new_message', (data) => {
  console.log('New message:', data);
});

export const sendSocketMessage = (receiverId: string, content: string) => {
  socket.emit('send_message', { receiverId, content });
};
```

### 3. Environment Variables (Frontend `.env`)

```env
VITE_API_URL=http://localhost:5000
```

---

## Hosting on Cloud (Production)

### Recommended Stack

| Service | Provider | Free Tier |
|---------|----------|-----------|
| Backend | Render / Railway / Fly.io | Yes |
| Frontend | Vercel / Netlify | Yes |
| Database | MongoDB Atlas | 512MB |
| Cache | Redis Cloud / Upstash | Yes |
| Media | Cloudinary | 25GB/mo |
| Domain | Namecheap / GoDaddy | ~$10/yr |

### Deploy to Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your repo
4. Set environment variables
5. Build command: `npm run build`
6. Start command: `npm start`

### Deploy to Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### MongoDB Atlas Setup

1. Create cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create database user
3. Whitelist IP `0.0.0.0/0` (or specific IPs)
4. Copy connection string to `MONGODB_URI`

### Redis Cloud Setup

1. Sign up at [redis.com](https://redis.com)
2. Create free subscription
3. Get Redis URL: `redis://default:password@host:port`

### Cloudinary Setup

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Get Cloud Name, API Key, API Secret from Dashboard
3. Paste into `.env`

---

## Security Checklist

- [x] JWT access + refresh token rotation
- [x] Bcrypt password hashing (salt rounds: 12)
- [x] RBAC (4 role levels)
- [x] Rate limiting per endpoint
- [x] Input validation (express-validator)
- [x] XSS protection (content sanitization)
- [x] Helmet security headers
- [x] CORS configured
- [x] Audit logging
- [x] Optional 2FA (TOTP)

---

## License

MIT (c) UniPulse Team

## Staging & Hosting (quick guide)

To host a staging backend using containers, follow these steps:

1. Create a `.env.staging` file from `.env.staging.example` and fill in staging credentials (MongoDB URI, Redis URL, Cloudinary, SMTP, JWT secrets). Do NOT commit this file.

2. Build and run with Docker Compose locally for verification:

```bash
docker compose -f docker-compose.staging.yml build
docker compose -f docker-compose.staging.yml up -d
```

3. Verify health endpoint (default port `5001` in `docker-compose.staging.yml`):

```bash
curl http://localhost:5001/health
```

4. To publish a staging image automatically, push your changes to the `staging` branch. The included GitHub Actions workflow (`.github/workflows/ci-cd-staging.yml`) builds and pushes the image to `ghcr.io`.

5. Deployment options:
- Pull the published image on your staging host and run it (Docker/Compose/Kubernetes).
- Or configure your PaaS (Render, Railway, Fly, DigitalOcean App Platform) to build directly from the repo using the provided `Dockerfile`.

If you want, I can prepare provider-specific deployment manifests (Render/Heroku/Fly/Railway/AWS ECS) next—tell me which host you prefer.
