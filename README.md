# CineCompass

Self-hosted React frontend, ASP.NET Core backend, PostgreSQL, and passkey-only accounts. No external identity provider, passwords, email login, or recovery bypass.

## Repository

- `front-end/`: React app. Run all npm commands here.
- `back-end/CineCompass.Api/`: .NET 11 API, Identity passkeys, settings, and PostgreSQL migrations.
- `back-end/CineCompass.Api.Tests/`: authentication, CSRF, ownership, revision, and challenge tests.
- `Dockerfile` and `compose.yaml`: frontend/API image, PostgreSQL, and migration job.

`global.json` pins SDK **11.0.100-rc.1.26425.128**, the latest available .NET 11 release when added. Packages and containers use RC1. Install that SDK first. On this development Mac it is installed separately in `~/.local/share/cinecompass-dotnet`; use `export PATH="$HOME/.local/share/cinecompass-dotnet:$PATH"` in your terminal to use it.

## Local development

Start PostgreSQL with database/user `cinecompass`. Development defaults use port 5432 and password `local-development-only`, for disposable local data. Override `ConnectionStrings__Database` for your database.

From the repository root:

```sh
dotnet tool restore
ASPNETCORE_ENVIRONMENT=Development dotnet run --project back-end/CineCompass.Api -- --migrate
dotnet run --project back-end/CineCompass.Api
```

In another terminal:

```sh
cd front-end
npm ci
npm start
```

Open **http://localhost:3000**. React proxies `/api` to port 5080. Development passkeys use origin `http://localhost:3000` and relying party `localhost`. Localhost supports passkeys without HTTPS; remote origins require HTTPS. Origins include the port: set `Passkeys__Origin` if serving the compiled frontend directly on port 5080.

Open Settings to create an account with a username/passkey or sign in with a discoverable passkey without entering a username. An account is created only after its first passkey is verified and stored. Add a second passkey after signing in.

## Sync behavior

Guest settings remain separately saved on this device and are restored on sign-out. Signing in loads account settings. Settings → Settings on this device → Import guest settings replaces account settings with that guest snapshot. Changes save after a short delay.

Filters, display mode, cinema order, planner preferences, hidden films, saved films, and saved screenings sync. Dates, time windows, search text, API caches, and the OMDb key do not. OMDb credentials stay browser-local. The active account cache is cleared if its session cannot be restored; account data remains on the server.

Saves include the expected account ID and revision. Conflicting edits are rejected rather than silently overwritten. Reload account settings discards unsynced changes and loads the server version. Concurrent list edits are not merged in this initial implementation. Offline changes retry while the page stays open and when connectivity returns; there is no persistent offline upload queue. A session switch in another tab reloads this tab to prevent mixing accounts.

## Self-hosted deployment

Choose the permanent HTTPS domain before registering production passkeys. A localhost passkey does not transfer to your production domain; unrelated domains need separate passkeys.

```sh
cp .env.example .env
# Set PUBLIC_ORIGIN to the exact HTTPS origin, with no path/trailing slash.
# Set POSTGRES_PASSWORD to a long random secret.
docker compose up --build -d
```

Point your HTTPS reverse proxy at `127.0.0.1:5080`. The app serves both React and `/api` on one origin. Only the loopback app port is published; PostgreSQL stays internal. Preserve the browser Origin header. The backend validates it against PUBLIC_ORIGIN and does not trust forwarded headers. Migrations must finish before the app starts.

Back up the database and Data Protection key volumes. Keep the keys/backups private. Losing Data Protection keys invalidates sessions. Passkey private keys stay on the authenticator; only public credentials are stored in PostgreSQL. Pending ceremonies stay in server memory, expire after five minutes, and are consumed once. Restarting the app cancels unfinished ceremonies. This configuration targets one app instance.

GitHub Pages deployment is replaced with build/test CI. Pushing changes does not deploy this self-hosted application.

## Recovery

No password, email, recovery code, or admin bypass login exists. Add another passkey on another device or security key. Losing every passkey means losing access to the account. Passkey removal and account deletion are not included yet.

## Verification

```sh
dotnet test CineCompass.slnx
cd front-end
CI=true npm test -- --watchAll=false --runInBand
npm run build
```

Backend HTTP tests use isolated SQLite databases. Also validate PostgreSQL migrations and browser ceremonies against PostgreSQL for deployment acceptance. Docker builds need a running daemon.

## Film watchlist

Save films from the schedule or film details without choosing a screening. The Watchlist counts films and keeps them after screening times pass or are removed. Find showtimes opens upcoming screenings with independent city, language, cinema, and date filters. Saving a screening also adds its film; removing a film keeps its saved screening times under Other saved screenings. Existing saved screenings populate the film watchlist once on upgrade. Hidden films stay saved and return when restored in Settings. Film watchlists remain device-local for guests and sync with a CineCompass account. On phones, each screening shows IMDb, Watchlist, Tickets, Save screening, and More icons; More contains labelled hiding and evening-planning actions.

## Cineville integration

Public listings continue to work. CineCompass accounts do not authenticate with Cineville. Authenticated Cineville watchlist access is a later integration, pending verification of Cineville's login/session flow. Future Cineville tokens must be stored privately on the backend, outside settings sync.

Movie details offer **Translate to English** for Dutch descriptions, followed by **Show original**. Cineville's own English description takes priority when present. Translation uses the [MyMemory public API](https://mymemory.translated.net/doc/spec.php) directly from the browser, only after clicking the control; only the public description is sent, without account cookies or credentials. Successful translations are cached in memory for the current tab and are excluded from account sync and offline storage. Long descriptions are split at word boundaries within the provider's 500-byte request limit. Anonymous service usage has a [5,000-character daily limit](https://mymemory.translated.net/doc/usagelimits.php); quota and network errors leave the original visible and allow retrying. No API key or backend configuration is required.

### Verified in this change

- Release build and five backend tests passed on .NET 11 RC1.
- Frontend production build and 25 tests passed.
- Initial migration applied successfully to a temporary PostgreSQL 18 instance.
- Chrome with virtual authenticators verified passkey registration, session restoration after reload, logout/login, adding a second authenticator, and signing in using that second passkey.
- A display preference persisted in PostgreSQL and was restored after clearing browser storage and signing in again.
- Settings dialog inspected at 390 × 844 with no horizontal overflow.
- Docker image build and remote HTTPS deployment were not verified: the local Docker daemon was unavailable. No physical authenticator ceremony was performed.

## Gont

The checkout is `/home/dishan/Projects/cine-compass`. Use `compose.yaml` plus `compose.gont.yaml` and a server-only `.env` with `PUBLIC_ORIGIN=https://cinecompass.talesfrom.earth`. The Gont override removes published ports and joins `cinecompass_gateway`, where Caddy reaches `cinecompass-app:8080`. Shared gateway configuration is tracked in the `galenor` infrastructure repository. Run `./deploy-gont.sh` for subsequent updates. The Cloudflare Tunnel hostname routes to the existing gateway at `http://127.0.0.1:8888`.

Deployment builds the shared app/migration image once, then starts the stack with `--no-build`. It prints build, startup, and total elapsed times. BuildKit keeps npm downloads, NuGet packages, and the React compiler cache between builds; production images omit JavaScript source maps. Lint and type checks remain enabled. The first build after these Dockerfile changes warms the new caches; later frontend changes can reuse them. Removing Docker builder caches removes this speedup. Source compilation still runs on Gont.

## Install on iPhone or iPad

Open CineCompass over HTTPS in Safari, open the Share menu, choose **Add to Home Screen**, keep **Open as Web App** enabled if shown, and tap **Add**. The home-screen icon opens CineCompass in its own standalone window. Passkeys use the same configured HTTPS hostname.

Production builds register a service worker. It caches a public offline reconnect page and content-hashed JavaScript/CSS only. Account APIs, settings responses, passkey ceremonies, live Cineville data, and OMDb requests are never cached by the worker. An offline launch shows the reconnect page; live screenings and account sync require an internet connection. Updates activate after existing app windows close; reopening online loads the current app.

App icons use the schedule UI's compass sparkle and paper/wine colors. Regenerate the PNGs with `python3 front-end/scripts/generate-pwa-icons.py` (requires Pillow).
