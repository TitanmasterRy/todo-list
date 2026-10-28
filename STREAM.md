# Stream: games from your PC in Play → 🎮 Stream

The Stream tab plays games (or the whole desktop) from a gaming PC at home, in the browser, from anywhere. The picture comes in at your screen's own resolution and refresh rate, and your keyboard, mouse and gamepads control the PC.

## How it fits together

```
browser (this site)  ──HTTPS / WSS──▶  gateway (play.example.com, server/stream-gateway)  ──▶  MoonlightWeb  ──▶  Apollo on the PC
        │                                                                                         ▲
        └────────────── WebRTC media through TURN (coturn: UDP 3478, TCP 3478, TLS 5349) ──────────┘
```

- **Apollo** (a Sunshine fork) runs on the Windows PC and encodes the screen. Its virtual display matches the size and refresh rate the browser asks for.
- **MoonlightWeb** (`linckosz/moonlight-web`) turns Apollo's GameStream protocol into WebRTC. It only listens on a private Docker network.
- **The gateway** (`server/stream-gateway/`, contract in its [API.md](server/stream-gateway/API.md)) is the only thing the page talks to. It signs you in, hands out TURN credentials that last ten minutes, and relays the WebRTC setup to MoonlightWeb. It is MoonlightWeb's one paired "browser": it checks MoonlightWeb's signed offer (MW-BIND-v1) and signs your browser's answer, so nothing can slip into the middle of the connection.
- **coturn** relays the media. The PC's ports aren't open to the internet, so the browser always connects through the relay (`iceTransportPolicy: "relay"`). On networks that block the relay but allow normal web traffic, the stream goes over a WebSocket through the gateway instead (slower, but it works).

## Using it

1. **Play → 🎮 Stream.** The header shows whether the gaming PC is online.
2. **Sign in** with the stream password. The very first time, leave the code empty: the tab shows a **QR code** to scan with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Aegis…) and **ten backup codes**. Save the codes (each works once, for when your phone isn't around), tick *I saved my backup codes*, type the code your app shows and **Finish**. After that, every sign-in is the password plus the current code.
3. Pick an app: **Desktop**, **Steam Big Picture**, or any other app set up in Apollo.
4. While streaming, the bar above the picture has **Full screen**, **Lock mouse** (for games that turn the camera with the mouse; Esc gives it back), **Quality**, **Stats**, **Disconnect** (stops streaming; the game keeps running on the PC so you can come back to it) and **Quit the game**.

If another app is already running on the PC, the tab asks whether to **resume** it or **quit it and start** the one you picked. If a stream is still running from another tab or device, it offers to end that one first.

The sign-in lasts up to 12 hours. **Sign out everywhere** ends every sign-in on every device and stops any stream. The sign-in is saved with your other keys, so **Settings → Privacy & security → Lock my keys** encrypts it too.

### Quality

**⚙️ Quality** (before a stream) or the **Quality** menu (during one):

- **Resolution:** *This screen* is your display in device pixels (for example 2880×1800 on a 1440×900 laptop with a Retina screen), up to 4096×2304; or a custom size.
- **Frame rate:** *This screen* is your display's refresh rate, measured by the browser; or a fixed rate.
- **Bitrate:** automatic is about 20 Mbps for 1080p at 60 fps, scaled to the size and rate (5–80 Mbps); or a fixed one. Lower it on slow Wi-Fi.
- **Connection:** automatic follows the connection test; or force WebRTC or the WebSocket mode.
- **Show stats while streaming:** resolution, frame rate, bitrate, delay (round trip) and the path (relay over UDP, TCP or TLS, or WebSocket).

### Keyboard, mouse and gamepads

- Keys are sent by **position**, like a real keyboard plugged into the PC, so games see the right keys whatever your keyboard layout. In full screen, Chrome and Edge also pass Esc, Alt+Tab and similar shortcuts to the PC (Keyboard Lock); other browsers keep them.
- The mouse points at the desktop normally; **Lock mouse** switches to relative movement for games.
- Up to four gamepads (Xbox, PlayStation, Switch Pro and other standard controllers). Press a button once so the browser lets the page see the pad.

## The connection test

**🩺 Connection test** runs automatically before the first stream of a visit, and any time from the button. Each step gets a plain answer:

| Step | What it checks |
| --- | --- |
| This site may contact the stream server | The site's security policy lists the gateway (`VITE_STREAM_SERVER`). |
| Stream server reachable (HTTPS) | The gateway answers, and whether the bridge and the PC are up. |
| Secure WebSocket (signaling) | WebSockets get through (setting up a stream needs one). |
| Relay over UDP 3478 / TCP 3478 / TLS 5349 | The TURN relay can be reached each way (needs you to be signed in). |
| WebSocket stream on port 443 | The WebSocket fallback gets through. |

The verdict says what will happen: the fast UDP relay, TCP or TLS with a little more delay, the WebSocket mode when only port 443 gets out, or that the network blocks streaming. When a network deliberately blocks streaming the tab says so; it doesn't try to hide the traffic.

## Running your own

The site side is one build variable. The server side is the gateway next to MoonlightWeb, coturn and a reverse proxy.

1. **Build variable:** `VITE_STREAM_SERVER=https://play.example.com` adds the gateway's `https://` and `wss://` origins to the page's Content-Security-Policy (TURN isn't governed by it). The GitHub Pages workflow sets it to `https://play.levitica.duckdns.org` unless the repository variable `VITE_STREAM_SERVER` says otherwise. See [DEPLOY.md](DEPLOY.md).
2. **Gateway:** `server/stream-gateway/` has a `Dockerfile`, `compose.example.yml` and `.env.example`. It joins the Docker network MoonlightWeb is on and the one your reverse proxy is on, listens on 8080, and keeps its state in `/data`. Settings (names only; values stay on the server): `GATEWAY_PASSWORD_HASH`, `GATEWAY_SIGNING_KEY`, `TURN_SECRET`, `TURN_HOST`, `MW_URL`, `MW_CERT_SHA256` (MoonlightWeb's certificate is self-signed, so the gateway pins it), optional `MW_HOST_ID`, and `ALLOWED_ORIGIN` (the site's origin; every other origin is refused).
3. **First run:**

   ```bash
   docker exec -i stream-gateway node dist/cli.js hash-password
   ```

   reads the password on stdin and prints `GATEWAY_PASSWORD_HASH` (argon2id). Then, with a one-time PIN from `moonlightweb --new-pin`:

   ```bash
   docker exec -i stream-gateway node dist/cli.js link-mw
   ```

   `/health` says `"mw": "up"` once it's linked. If the phone with the authenticator app is lost and the backup codes are gone, `docker exec stream-gateway node dist/cli.js reset-totp` makes the next sign-in show a new QR code.
4. **Reverse proxy:** forward `https://play.example.com` to `stream-gateway:8080` with WebSockets allowed, and let it set `X-Forwarded-For` (the gateway's sign-in lockout counts by that address, trusting one proxy hop). No login wall in front of it: the page signs in with its own tokens.
5. **coturn:** `use-auth-secret` with the same secret as `TURN_SECRET`, listening on 3478 (UDP and TCP) and 5349 (TLS), and allowed to relay to MoonlightWeb's address only.

## Security notes

- The password is checked against an argon2id hash; a code from the authenticator app (or a backup code) is needed too, and a code can't be used twice. Five wrong tries from one address lock it out for 15 minutes, and 20 from anywhere lock everyone out for 15 minutes.
- Access tokens last 15 minutes and stay in the page's memory; the refresh token (12 hours, replaced on every use) is kept with your other keys. A refresh token that is used twice ends that sign-in, because it means someone copied it. Tokens never go in a URL and the gateway never logs them.
- The gateway refuses requests and WebSockets from any other site (`Origin`), and talks to MoonlightWeb only after checking its certificate fingerprint.
- MoonlightWeb's session and the gateway's pairing key are in the gateway's `/data` volume (readable by its own user only). Treat a copy of that volume like a password.
- Media goes from the PC to your browser through the TURN relay, encrypted end to end by WebRTC (DTLS); the gateway only sees it in the WebSocket mode.

## Limits

- One stream at a time.
- H.264 only, up to 4096 pixels wide.
- The browser needs WebCodecs (Chrome, Edge, Safari 17+ and recent Firefox).
- The WebSocket mode has more delay than WebRTC.
- GeForce NOW isn't part of this; the tab links out to it.
