# Render deployment setup (staging)

Follow these steps to set up staging on Render and enable automatic deploys from the `staging` branch.

1. Create a new Web Service on Render
   - Dashboard -> New -> Web Service
   - Connect your GitHub repo and select the `staging` branch
   - Environment: Docker
   - Dockerfile Path: `/Dockerfile`
   - Build Command: leave empty (Dockerfile handles build)
   - Start Command: leave empty (Dockerfile CMD used)
   - Health Check Path: `/health`

2. Create a Redis instance (optional)
   - Dashboard -> New -> Redis
   - Note the Redis URL and paste it into the Web Service environment variables as `REDIS_URL`.

3. Set environment variables (Render service -> Environment)
   Required (set actual values here):
   - NODE_ENV=staging
   - MONGODB_URI=<staging MongoDB URI>
   - REDIS_URL=<staging Redis URL>
   - JWT_ACCESS_SECRET=<staging JWT access secret>
   - JWT_REFRESH_SECRET=<staging JWT refresh secret>
   - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
   - CLOUDINARY_FOLDER_PREFIX=staging
   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
   - FROM_EMAIL, FROM_NAME
   - KEY_PREFIX=staging:
   - ADMIN_EMAIL, ADMIN_PASSWORD (for seeding if you plan to run seed via the app)

   Mark these as secrets in Render; do NOT commit them to the repo.

4. Optional: configure automatic deploy via GitHub Actions
   - Add two GitHub repository secrets: `RENDER_API_KEY` and `RENDER_SERVICE_ID` (get service ID from Render service settings)
   - The included workflow `.github/workflows/deploy-to-render.yml` will POST to Render's deploy API when you push to `staging`.

5. Seed database
   - Preferred: Run seed locally against the staging DB (safer): set your local `.env` to staging values and run `npm run seed`.
   - Alternative: Create a one-off shell on Render and run `npm run seed` (not recommended for secrets management).

6. Verify
   - Visit the Render service URL and `GET /health` to confirm `environment: staging` and database/redis connectivity.
   - Try signup/login/upload/email flows to confirm isolation.

If you want, I can create a small script to fetch the Render Service ID and set up GH secrets automatically (you must provide `RENDER_API_KEY`).
