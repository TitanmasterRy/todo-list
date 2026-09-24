# Deploying

The app is a static site: `npm run build` writes everything to `dist/`, and any static host can serve it. It needs no server, database or secrets. Pick one below; all have free tiers.

| Host | Free tier | Easiest path | Config in this repo |
| --- | --- | --- | --- |
| GitHub Pages | yes | push to `main` | `.github/workflows/deploy.yml` |
| Vercel | yes | Deploy button | `vercel.json` |
| Netlify | yes | Deploy button | `netlify.toml`, `public/_headers` |
| Cloudflare Pages | yes | connect repo | `wrangler.toml`, `public/_headers` |
| Render | yes (static sites) | Deploy button | `render.yaml` |
| Replit | yes (dev), static deploys | Import from GitHub | `.replit`, `replit.nix` |
| Firebase Hosting | yes (Spark) | CLI | `firebase.json` |
| Surge.sh | yes | CLI | `npm run deploy:surge` |
| Fly.io, Railway, Koyeb, Cloud Run, a VPS | varies | Docker | `Dockerfile`, `docker/nginx.conf`, `fly.toml` |

## One-click buttons

Replace `TitanmasterRy/todo-list` with your fork if you forked it.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/TitanmasterRy/todo-list)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/TitanmasterRy/todo-list)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/TitanmasterRy/todo-list)
[![Run on Replit](https://replit.com/badge/github/TitanmasterRy/todo-list)](https://replit.com/github/TitanmasterRy/todo-list)

## Base path

Every host except GitHub Pages serves the site from the domain root, which is the default (`/`). The GitHub Pages workflow sets `GITHUB_PAGES=true`, which switches the base to `/<repo>/`. To serve from any other sub-path, set `VITE_BASE`, e.g. `VITE_BASE=/homework/`.

## Environment variables (all optional, set at build time)

| Variable | What it does |
| --- | --- |
| `VITE_BASE` | Base path (see above). |
| `VITE_ARCADE_MANIFEST` | URL of a `games.json` to load arcade games from instead of the bundled `games/games.json`. Lets you change games without redeploying. The URL must allow CORS. |

## Step by step

### GitHub Pages
1. Repository **Settings → Pages → Source: GitHub Actions** (once).
2. Push to `main`. The workflow tests, builds and publishes to `https://<owner>.github.io/<repo>/`.

### Vercel
1. Click the button, or **Add New → Project** and import the repo. The framework is detected as Vite; `vercel.json` sets the build and output.
2. Every push deploys; pull requests get preview URLs.
3. CLI: `npm run deploy:vercel`.

### Netlify
1. Click the button, or **Add new site → Import an existing project**. `netlify.toml` sets `npm run build` and `dist`.
2. CLI: `npm run deploy:netlify`.

### Cloudflare Pages
1. Dashboard → **Workers & Pages → Create → Pages → Connect to Git**. Build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=22`.
2. CLI: `npm run deploy:cloudflare` (runs `wrangler pages deploy`).
3. Tip: the Schoology relay in `docs/cors-proxy-worker.js` can live in the same Cloudflare account.

### Render
1. Click the button, or **New → Blueprint** and pick the repo. `render.yaml` defines a free static site.

### Replit
1. **Create Repl → Import from GitHub** and paste the repo URL (or click the badge).
2. Press **Run** for a live dev server (hot reload) in the Webview.
3. To publish: **Deploy → Static**. `.replit` already sets the build command and `dist` folder.

### Firebase Hosting
1. `npx firebase-tools login` and `npx firebase-tools init hosting` (choose an existing project; keep the existing `firebase.json`).
2. `npm run deploy:firebase`.

### Surge.sh
1. `npm run deploy:surge`. The first run asks for an email and a domain like `my-homework.surge.sh`.

### Docker (Fly.io, Railway, Koyeb, Cloud Run, any VPS)
```bash
docker build -t homework-todo .
docker run -p 8080:8080 homework-todo   # http://localhost:8080
```
- **Fly.io:** `fly launch --copy-config --no-deploy`, then `fly deploy`.
- **Railway / Koyeb:** create a service from the repo; the Dockerfile is detected. Expose port 8080.
- Build args: `--build-arg VITE_BASE=/sub/ --build-arg VITE_ARCADE_MANIFEST=https://…/games.json`.

## After deploying

- **Arcade games:** put `.html` files in `public/games/` and list them in `public/games/games.json` (see `public/games/README.md`), then redeploy. Or host a `games.json` elsewhere and point `VITE_ARCADE_MANIFEST` at it.
- **Google sign-in:** add your new domain to the OAuth client's *Authorized JavaScript origins*.
- **Spotify:** add `https://<your-domain>/` to the app's redirect URIs.
- **Schoology relay:** nothing changes; the relay URL is set per user in Settings.
