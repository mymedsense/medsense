# MedSense Backend

Express + MySQL API for MedSense.

## Local Run

1. Copy `.env.example` to `.env`.
2. Confirm MySQL is running and the database credentials are correct.
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
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=medsense
DB_SSL=true
ADMIN_EMAIL=admin@mymedsense.co
ADMIN_PASSWORD=use_a_private_admin_password
ADMIN_NAME=MedSense Admin
```

You can also use one hosted MySQL URL instead of the individual DB fields:

```text
DATABASE_URL=mysql://user:password@host:3306/medsense
DB_SSL=true
```

Recommended public URLs:

- Frontend: `https://www.mymedsense.co`
- Backend API: `https://api.mymedsense.co`

## Deploy To Render

1. Push this folder to GitHub.
2. In Render, create a new Web Service from the GitHub repo.
3. Use:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/health`
4. Add the production environment variables above.
5. Add a custom domain in Render:

   ```text
   api.mymedsense.co
   ```

6. In Namecheap DNS, add the CNAME record Render gives you for `api`.

## Database Checks

Use these after deployment:

```text
https://api.mymedsense.co/health
https://api.mymedsense.co/health/db
```

`/health/db` runs a simple MySQL query and returns `database: "connected"` when the backend can read from MySQL.

On a fresh database, the backend creates the required tables on startup. If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, it also creates or updates that admin account.
