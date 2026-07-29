# 210 Robotics Discord voice worker

This always-on worker is the media process behind the `/record` Discord
command. It cannot run as a Vercel Function because Discord voice uses a
persistent Gateway WebSocket and UDP media connection.

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/210Robotics/210robotics-discord-voice-worker)

1. Select **Deploy to Render** and connect this public repository.
2. Enter a newly rotated `DISCORD_BOT_TOKEN`.
3. Generate a shared secret locally:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

4. Enter that value as `DISCORD_VOICE_WORKER_SECRET`, then deploy.
5. Copy the resulting Render URL and the same secret into the website's Vercel
   production environment:

   ```text
   DISCORD_VOICE_WORKER_URL=https://your-service.onrender.com
   DISCORD_VOICE_WORKER_SECRET=the-same-random-secret
   ```

6. Redeploy the website and confirm `https://your-service.onrender.com/health`
   returns an `ok` response.

The worker sends a low-frequency health request through its Render external
URL while a recording is active so a Free web service does not idle out in the
middle of a meeting. It stops the keepalive as soon as finalization finishes.
For the strongest reliability against platform maintenance or arbitrary Free
instance restarts, use an always-on paid instance.

## Required environment

- `DISCORD_BOT_TOKEN`: the same bot token used by the website
- `DISCORD_VOICE_WORKER_SECRET`: a long random shared secret
- `SITE_URL`: `https://210robotics.com`
- `PORT`: supplied by the host, or `8787`

The website needs matching production variables:

- `DISCORD_VOICE_WORKER_URL`: the worker's public HTTPS origin
- `DISCORD_VOICE_WORKER_SECRET`: the same shared secret

## Runtime behavior

1. `/record` sends an authenticated request to `POST /recordings/start`.
2. The bot joins the selected voice or stage channel without self-deafening.
3. Only human member audio is received and recorded.
4. Ten seconds after the last human leaves, the worker mixes the timed audio
   segments into a speech-optimized MP3.
5. The MP3 is uploaded to the private website completion endpoint.
6. The website runs Gemini transcription, archives the MP3 and editable DOCX
   in Internal Documents and Google Drive when configured, and posts links in
   `#Botlog` or `#Botlogs`.
7. If Render requests a shutdown, the worker gets up to five minutes to finish
   rendering and upload any active recording before the instance exits.

The same persistent Gateway connection sends every human-authored message to
the website log endpoint and adds ✅ only after the website confirms the
message was stored. Bot-authored messages are intentionally excluded.

`GET /health` reports whether Discord is connected and how many recordings are
active. `POST /recordings/stop` can finalize an active session manually.

Build this directory's `Dockerfile` on an always-on Docker host with outbound
HTTPS, WebSocket, and UDP access. Use one replica so the in-memory active
session map cannot split across instances.
