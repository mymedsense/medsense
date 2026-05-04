# MedSense Frontend

React + Vite frontend for MedSense.

## Local Browser Run

1. Start the backend from `C:\Users\nevil\medsense-backend`:

   ```powershell
   npm start
   ```

2. Start the frontend from this folder:

   ```powershell
   npm run dev -- --host 127.0.0.1
   ```

3. Open:

   ```text
   http://127.0.0.1:5173
   ```

## Environment

Create `.env` from `.env.example` for local development:

```text
VITE_API_URL=http://localhost:5000
```

For production at `mymedsense.co`, set:

```text
VITE_API_URL=https://api.mymedsense.co
```

## Production Domain Plan

- Frontend: `https://www.mymedsense.co`
- Optional redirect: `https://mymedsense.co` to `https://www.mymedsense.co`
- Backend API: `https://api.mymedsense.co`
- Backend `CLIENT_URL`: `https://www.mymedsense.co`
- Backend `CORS_ORIGINS`: `https://mymedsense.co,https://www.mymedsense.co`

## Deploy To Vercel

1. Push this folder to GitHub.
2. In Vercel, create a new project from the GitHub repo.
3. Use these project settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add this environment variable:

   ```text
   VITE_API_URL=https://api.mymedsense.co
   ```

5. Deploy.
6. In Vercel Project Settings > Domains, add:

   ```text
   www.mymedsense.co
   mymedsense.co
   ```

7. In Namecheap DNS, add the DNS records Vercel gives you. Common Vercel records are:

   ```text
   Type   Host   Value
   A      @      76.76.21.21
   CNAME  www    cname.vercel-dns.com
   ```

## Checks

```powershell
npm run lint
npm run build
```
