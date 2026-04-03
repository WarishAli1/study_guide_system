# Quick Deploy (Vercel Frontend + Render Backend)

This setup is optimized for easy portfolio/demo deployment with minimal steps.

## 1. Backend on Render (free)

1. Push this repository to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Select your GitHub repo and deploy using `render.yaml`.
4. After service creation, open backend service -> **Environment** and set:
   - `CORS_ORIGINS=https://YOUR_VERCEL_DOMAIN`
   - `GOOGLE_CLIENT_ID=...`
   - `JWT_SECRET_KEY=...`
   - `GROQ_API_KEY=...`
5. Redeploy the backend service.

Notes:
- For free tier, data under `/tmp/study-guide` is ephemeral and may reset after restart/redeploy.
- This is acceptable for demo/portfolio use.

## 2. Frontend on Vercel

1. Import this repo in Vercel.
2. Set Root Directory to `frontend`.
3. Add env var:
   - `NEXT_PUBLIC_API_URL=https://YOUR_RENDER_SERVICE_URL`
4. Deploy.

## 3. Verify

- Backend health: open `https://YOUR_RENDER_SERVICE_URL/`
- Frontend should load and call backend without CORS errors.

## 4. Optional demo-safe settings

- Keep uploads small (PDF preferred).
- Expect first API call delay after inactivity on free Render (cold start).
- If image OCR fails on free hosts, use text-based PDFs for demo.
