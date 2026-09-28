# Watch: your own shows in Play → 📺 Watch

The Watch tab plays video from **your own media server** and from **links you add**, inside the app:

| Source | What you get |
| --- | --- |
| **Jellyfin** or **Emby** server | Sign in, then browse here: Continue watching, Next up, your libraries, search, shows → seasons → episodes, and a built-in player. Resume points sync with the server, so they follow you to the TV and phone apps. There's also a button for the server's own web app. |
| **Plex**, or any other server or site with a web app | Its web page in a frame (for Plex: `https://app.plex.tv/desktop`), with **Open in a new tab** when the site doesn't allow being framed. |
| **Video link** | YouTube (watch, Shorts, youtu.be, playlists, start times), Vimeo, Twitch (channels, videos, clips), Dailymotion, Archive.org and Google Drive links are turned into their embeddable players automatically. Any other link is shown as a web page. |
| **Video file URL** | `.mp4`, `.webm`, `.m3u8` (HLS) and `.mkv` (when the browser can decode it) in the built-in player, which remembers where you stopped. |
| **A file on this device** | Plays a video from your computer or phone. Nothing is uploaded or saved. |

The built-in player has playback speed, picture-in-picture, full screen and keyboard shortcuts: **Space** play/pause, **← / →** 10 seconds back/forward, **F** full screen, **M** mute. Subtitles from Jellyfin/Emby (text formats such as SRT, ASS, VTT) show up under the CC button.

Sources are saved on this device only (`homework-todo:watch` in localStorage). A server sign-in is kept as a token (never your password) with your other keys, so **Settings → Privacy & security → Lock my keys** encrypts it too.

## What works and what doesn't

- ✅ Your own Jellyfin, Emby or Plex server; Plex through its web app (`app.plex.tv`) or your server's address.
- ✅ Public or unlisted videos on YouTube, Vimeo, Twitch, Dailymotion and Archive.org; Google Drive files shared with you.
- ✅ Video files and HLS streams you have a link to.
- ❌ **Netflix, Hulu, Disney+, Max, Prime Video** and other paid streaming services. They protect video with DRM and refuse to be shown inside other sites, so they can't work here (and the app doesn't try to get around that). Use their own apps.
- Some sites refuse to be framed (they send `X-Frame-Options` or a `frame-ancestors` policy). A page can't detect that from the outside, so after a few seconds the app shows *"Not loading? … Open it in a new tab."*

Only add servers and links you're allowed to watch. The app has no built-in channels or lists of sites.

## Homework rules (optional, off by default)

In **Settings → Economy → Watch** (protected by the parent PIN, like the casino limits):

- **Finish today's ring before watching.** Nothing plays until the day's goal is done.
- **Watch time costs vouchers.** One voucher buys the number of minutes you set (for example 30). Vouchers come from the Shop, bought with coins from homework. Unused minutes carry over.
- **Watch time limit per day**, counted in minutes while a video plays (or an embedded page or server web app is open) and the app is visible.
- **Study-break reminder** after N minutes in one sitting.

These are speed bumps for kids, not locks: "Open in a new tab" still works, and anyone who can edit the browser's storage can get around them.

## Setting up Jellyfin, step by step

1. **Install Jellyfin** on a computer, NAS or server that stays on (see [jellyfin.org/downloads](https://jellyfin.org/downloads)). Finish its setup wizard at `http://<that-computer>:8096` and add your libraries.
2. **Give it an https address** (see the next section). This is the one step that can't be skipped when the app is on GitHub Pages or any https site.
3. **Let this site talk to it** (see [Allowing your server: `VITE_MEDIA_SERVERS`](#allowing-your-server-vite_media_servers)). Without this, the Watch tab explains what's missing and offers the server's own web app in a frame instead.
4. In the app: **Play → 📺 Watch → + Add a source → Jellyfin**, paste the https address (for example `https://jellyfin.example.com`; a path like `/jellyfin` is fine), and **Add**.
5. **Sign in** with your Jellyfin username and password. The password goes only to your server; the app keeps the token it returns.
6. Pick a library, a movie or an episode, and **Play**. If the browser can play the file as it is (for example H.264/AAC in MP4, or VP9/Opus in WebM) it plays directly; otherwise Jellyfin converts it on the fly (HLS, H.264 + AAC), which needs a bit of CPU on the server.

Emby works the same way.

### Why https is needed (mixed content)

This app is served over **https** (GitHub Pages always is). Browsers block an https page from loading anything over plain **http**, so `http://192.168.1.20:8096` can't be used from it, even on your home Wi-Fi. The Watch tab says so as soon as you add such an address. Options:

- **Tailscale** (easiest for private use): install Tailscale on the server and your devices, then `tailscale serve --bg 8096` gives the server `https://<machine>.<tailnet>.ts.net` with a real certificate, reachable from your devices anywhere. `tailscale funnel` makes it reachable from the whole internet instead.
- **Cloudflare Tunnel**: `cloudflared` on the server publishes it as `https://jellyfin.yourdomain.com` without opening ports on your router. Check Cloudflare's terms for video streaming.
- **A reverse proxy with a certificate** (Caddy, Nginx Proxy Manager, Traefik, SWAG) on your own domain, with a Let's Encrypt certificate. Caddy is two lines: `jellyfin.example.com { reverse_proxy localhost:8096 }`. Add the proxy's address to Jellyfin's **Dashboard → Networking → Known proxies**.
- **Run this app yourself on your network over http** (then http servers are fine): `npm run build && npx vite preview --host`, or the Docker image (see [DEPLOY.md](DEPLOY.md)), and open it by its `http://` address.

### Cross-origin requests (CORS)

The app talks to Jellyfin straight from the browser, from another site's address. Jellyfin allows that by default. If requests fail with a network error while the address is right:

- a reverse proxy in front of Jellyfin may be stripping or overriding the `Access-Control-Allow-*` headers: let Jellyfin's own headers through (or add `Access-Control-Allow-Origin` for your app's site, plus `Access-Control-Allow-Headers: Authorization, X-Emby-Authorization, Content-Type`);
- a "login wall" in front of the server (Cloudflare Access, Authelia, basic auth) blocks the app's requests. Exempt the Jellyfin API paths, or use the server's own web app in a new tab.

## Allowing your server: `VITE_MEDIA_SERVERS`

The site ships a Content-Security-Policy (see [DEPLOY.md](DEPLOY.md#content-security-policy)). It lets the page **show** video from any https server and embed any https page, but it only lets the page **connect** (fetch) to hosts it was built with, which limits where data could ever be sent. Signing in to Jellyfin/Emby, browsing, progress reports and HLS streams are fetches, so the server's origin has to be in the build:

```bash
VITE_MEDIA_SERVERS="https://jellyfin.example.com https://emby.example.net:8920" npm run build
```

- Origins only (scheme, host and port); paths are dropped. Space or comma separated. Wildcards work as in CSP, e.g. `https://*.my-tailnet.ts.net`.
- **GitHub Pages:** repository **Settings → Secrets and variables → Actions → Variables → New repository variable**, name `VITE_MEDIA_SERVERS`, value as above. Then re-run the **Deploy to GitHub Pages** workflow (or push). `.github/workflows/deploy.yml` passes it to the build.
- **Docker:** `--build-arg VITE_MEDIA_SERVERS=https://jellyfin.example.com`. Other hosts: set it as a build environment variable.
- The Watch tab checks this up front: for a server that isn't allowed it shows the exact origin to add, with a **Copy** button.

Not needed for: embedded video links, Plex or any server's web app in a frame, direct `.mp4`/`.webm` links (all allowed already), and HLS on Safari (which plays it natively). Needed for `.m3u8` links on other browsers, which download the stream with hls.js.

## Privacy and security

- The Jellyfin/Emby password is sent only to that server, once, to sign in. The token, the sources list and the watch rules stay on this device: they are not synced and not part of backups.
- The server learns this app's name ("Homework To-Do"), a random device id and what you play (that's how resume works). Frames send no referrer, except to YouTube, Vimeo, Twitch and Dailymotion, whose players need to know which site embeds them (they get the site's address only).
- Everything a server returns (titles, overviews) is shown as plain text; only http(s) addresses are accepted; ids are checked before they go into a URL.
- Frames run with `sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"` and can't be pages from this app's own site, so an embedded page can't reach your data.
- hls.js is loaded from jsDelivr only when an HLS stream is played in a browser that needs it.
