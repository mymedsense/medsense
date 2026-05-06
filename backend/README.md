# MedSense Backend

Express + MongoDB API for MedSense.

## Local Run

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to your MongoDB Atlas connection string.
3. Start the API:

   ```powershell
   npm start
   ```

4. Check:

   ```text
   http://localhost:5000/health
   ```

## Production Environment

For the live browser app, set:

```text
PORT=5000
JWT_SECRET=use_a_long_random_secret
CLIENT_URL=https://www.mymedsense.co
CORS_ORIGINS=https://mymedsense.co,https://www.mymedsense.co
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/medsense
MONGODB_DB_NAME=medsense
ADMIN_EMAIL=admin@mymedsense.co
ADMIN_PASSWORD=use_a_private_admin_password
ADMIN_NAME=MedSense Admin
```

Recommended public URLs:

- Frontend: `https://www.mymedsense.co`
- Backend API: `https://api.mymedsense.co`

## Deploy To Render

1. Push this folder to GitHub.
2. Deploy from the repository root.
3. The frontend calls the API on the same Vercel deployment under `/api`.
4. Add the production environment variables above in Vercel.

## Database Checks

Use these after deployment:

```text
https://mymedsense.co/api/health
https://mymedsense.co/api/health/db
```

`/api/health/db` pings MongoDB and returns `database: "connected"` when the backend can read from MongoDB.

On a fresh database, MongoDB creates the required collections as the app writes data. If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, the backend also creates or updates that admin account.
