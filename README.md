# CineCompass

Self-hosted React frontend, ASP.NET Core backend, PostgreSQL, and Heimdall Keycloak sign-in. CineCompass stores account preferences and saved items in its own database.

## Repository

- `front-end/`: React app. Run all npm commands here.
- `back-end/CineCompass.Api/`: .NET 11 API, Keycloak sign-in, settings, and PostgreSQL migrations.
- `back-end/CineCompass.Api.Tests/`: authentication, CSRF, ownership, revision, and challenge tests.
- `Dockerfile` and `compose.yaml`: frontend/API image, PostgreSQL, and migration job.

`global.json` pins stable SDK **11.0.100**. Docker uses the corresponding stable .NET 11 SDK and ASP.NET runtime. The PostgreSQL provider's published 11.0 RC3 package currently requires the matching EF Core and Identity EF packages.

## Local development

Start PostgreSQL with database/user `cinecompass`. Development defaults use port 5432 and password `local-development-only`, for disposable local data. Override `ConnectionStrings__Database` for your database.

Configure a confidential Keycloak client with **Standard flow**, PKCE **S256**, and redirect URI `http://localhost:3000/api/auth/callback`. Set `Keycloak__Issuer`, `Keycloak__ClientId`, and `Keycloak__ClientSecret` via the environment or .NET user secrets. Use a development client separate from the production client.

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

Open **http://localhost:3000**. React proxies `/api` to port 5080. Open Settings and select **Sign in with Heimdall**. The first sign-in creates a CineCompass profile for that Keycloak identity unless the identity is already linked to a local account. Set `App__Origin` and register its exact callback URI if you serve the frontend on another origin.

Watched films are matched by their Cineville ID, with a normalized title and original release-year fallback for older catalogue IDs and re-releases. A different-year remake remains separate. Restoring a film in Settings puts its matching catalogue listings back. The account database migration renames the old hidden-movie setting to watched movies. The web app moves existing browser and guest settings when it loads.

## Now showing

Both film catalogues offer **List** and **Poster grid** views, with the shared choice saved in account preferences. Select a poster to open the same film-details modal used by the schedule, with the full synopsis, credits, watchlist actions, and published showtimes. Screening actions can save a time or open the evening planner. Coming soon keeps its collapsible release-week groups in either view.


The **Now showing** tab lists films with published, non-hidden screenings in the next seven days. Its city filter is independent of the schedule; title search filters the loaded catalogue. It queries Cineville's `POST /productions/search` with screening dates and city venue IDs, follows pagination, and shares the movie cards, watchlist, hidden-film settings, synopsis translation, and showtime lookup with Coming soon. Saving a movie does not save a screening. **Find showtimes** starts with the catalogue's selected city and supports its own date and language filters.

Both Now showing and Coming soon support ascending and descending sorting by title, release date, release year, runtime, and catalogue date added. Each catalogue saves its own sort in account preferences. Coming soon defaults to earliest releases; release-date sorting orders the week sections, while other sorts order movies within each chronological week. Open **Filters** to select inclusive From/To ranges from dropdowns populated by the full loaded catalogue for release date, release year, runtime in minutes, and date added. Ranges combine with title search in both views and with city selection in Now showing; unknown metadata is excluded only when its range is active. Filter choices stay available when search or another range narrows the results. Date-added filters use Amsterdam dates. **Clear filters** resets the ranges and title search.

## Coming soon

The **Coming soon** tab loads Cineville's upcoming catalogue from `POST /productions/search`, follows pagination, and groups films by release week. Search titles, read the full synopsis directly on each card, or use **Find showtimes** to check actual published screenings with independent city and language filters. Expected release dates are catalogue dates, not confirmation of a screening at a particular cinema.

Save an upcoming film to the existing Movies watchlist before any screenings are published. This saves the film only; individual screenings remain separate in Saved showtimes. Films marked watched are excluded from Coming soon. Upcoming catalogue data loads live and uses the same English-first, Dutch-fallback metadata normalization as the programme.

## Movie lists

Open **Lists → New list** to create a collection. Use **Add to list** on a search result, in film details, or on a saved film to select its lists. You can rename or delete custom lists, and a film can belong to several lists. Each entry keeps the Cineville ID, title, poster and any film metadata available when you add it.

Watchlist and Watched use permanent list IDs. Marking a film watched still hides it from the programme and Watchlist views. Each custom list has its own **Hide watched** option. Restore a watched film from Lists or Settings. Earlier account and browser lists are carried forward automatically.

## Screening notifications

Sign in and choose **Notify me** on a film or **Notify for this list** in Lists. A list reminder includes films added later and follows that list’s watched visibility. Individual reminders follow the selected film independently.

Open **More pages → Notifications** to set your look-ahead window from 1 to 365 days. The backend checks published Cineville screenings across all cities daily at 08:00 Amsterdam time, or after startup if that day’s check is due. Each screening appears once per account, even if multiple reminders match it. The page keeps the history of past screenings and their read status.

## Sync behavior

Guest settings remain separately saved on this device and are restored on sign-out. Signing in loads account settings. Settings → Settings on this device → Import guest settings replaces account settings with that guest snapshot. Changes save after a short delay.

Filters, display mode, cinema order, planner preferences, movie lists, screening reminders, and saved screenings sync. Dates, time windows, search text, API caches, and the OMDb key do not. OMDb credentials stay browser-local. The active account cache is cleared if its session cannot be restored; account data remains on the server.

Saves include the expected account ID and revision. Conflicting edits are rejected rather than silently overwritten. Reload account settings discards unsynced changes and loads the server version. Concurrent list edits are not merged in this initial implementation. Offline changes retry while the page stays open and when connectivity returns; there is no persistent offline upload queue. A session switch in another tab reloads this tab to prevent mixing accounts.

## Cineville REST and MCP

Use **Search** in the header to look up titles across the Cineville catalogue
and find showtimes or add a film to your watchlist. Search includes films
without upcoming screenings and labels watched films.

The backend is the Cineville API client for both the frontend and MCP. The
frontend reads the following same-origin GET endpoints:

| Path | Data |
| --- | --- |
| `/api/cineville/cinemas` | Participating cinemas grouped by city |
| `/api/cineville/screenings` | Screenings grouped by film |
| `/api/cineville/films/search?q=Aftersun` | Catalogue films ranked by title relevance. Pass the returned `nextCursor` as `cursor` with the same query to fetch more. |
| `/api/cineville/films/{id}/showtimes` | A film with upcoming screenings, or JSON `null` |
| `/api/cineville/now-showing` | Films with a screening in the next seven days |
| `/api/cineville/upcoming-films` | Films with a premiere date after today |
| `/api/cineville/specials` | Categories found in the matching programme |

Use `city` to filter by city. Screening endpoints accept repeated `cinema`,
`language`, `subtitle`, and `special` parameters. Values within each parameter
match any selection, and different parameters must all match. Use
`startDate` and `endDate` (inclusive, `YYYY-MM-DD`) and optional `startTime`
and `endTime` (`HH:mm`) in Europe/Amsterdam. With no dates, the programme
defaults to the rest of today; a film lookup defaults to all published future
showtimes. A date without an end date searches that day, except for a film
lookup, which stays open-ended. REST returns 400 for invalid date ranges and
502 when the upstream catalogue is unavailable.

Connect to `https://leyline.talesfrom.earth/cineville` and sign in with Heimdall through the MCP client's OAuth flow. The official C# MCP SDK serves the internal Streamable HTTP endpoint at `/mcp`, which requires the separate `Cineville__McpGatewaySecret` shared with Leyline and is disabled when that secret is unset. The programme tools are
`list_cinemas`, `search_screenings`, `find_films`, `get_film_showtimes`,
`now_showing`, `upcoming_films` and `get_specials`.

- **Personal movie lists.** `list_watched_movies` and `list_watchlist` show the
  signed-in account's watched films and visible Movies watchlist. Use a Cineville
  `filmId` from a programme tool with `mark_movie_watched` or `add_to_watchlist`.
  Both return the film and whether the list changed. Repeating an addition is
  safe. Sign in to the web app once with the same Heimdall account to create
  the account link. Reload the web app to see MCP changes in an open tab.
- **Gateway identity.** Personal tools require the Leyline adapter that forwards
  the verified Heimdall issuer and subject over the authenticated internal hop.
  The issuer must match `Keycloak__Issuer`. Deploy the updated adapter and
  CineCompass backend together to enable personal tools.
- **Language filters.** `search_screenings` defaults to `language: "en"` and
  `subtitles: "en"`, with `languageMatch: "or"`. A screening that matches
  either or both appears once. Set `languageMatch: "and"` to require both
  active filters. Omit a language field to use its default or supply a language
  code to override it. Pass `"any"` to clear a filter. For example,
  `{"subtitles":"any"}` requires English audio in either mode, and setting
  both fields to `"any"` clears all language filtering.
- **Language evidence.** Use `audioLanguages` to describe screening audio.
  `audioSource` is `screening` for explicit screening information, `film`
  for an inference from the film’s spoken languages, or `unknown`. The
  `subtitleStatus` of `listed` comes with `subtitleLanguages`. A status of
  `none` means Cineville explicitly marked the screening as unsubtitled.
  `unlisted` means subtitle availability is unknown.
- **Time windows.** Both screening tools accept `startTime` and `endTime` in
  Amsterdam local time, using `HH:mm`. These constrain screening starts in
  a continuous interval. On a multi-day search they apply to the first and
  last day respectively. The final minute is inclusive. `endTimeSource`
  tells whether a screening’s finish is `scheduled`, `estimated`, or
  `unknown`. When unknown, the end timestamp equals the start.
- **Empty searches.** Read `details.effectiveFilters` for the applied language
  filters and local time interval, and `details.emptyReason` for the reason.
  The tool distinguishes an unknown city, an unknown cinema, a cinema outside
  the requested city, and no screening, title, or language matches. If
  `details.relaxationOptions` contains alternatives, present them to the user
  with their match counts and let the user choose whether to broaden the search.
- **Film lookup.** Use `find_films` with a title fragment and optionally
  `releaseYear`. If several titles match, present the candidates and their
  original release years. Pass the chosen Cineville ID to `get_film_showtimes`.
- **Pagination.** Send the returned `nextCursor` as `cursor` to the same
  tool. Omit the initial filters and optionally pass `limit`. For
  `get_specials`, look for `nextCursor` under `screenings`. Each cursor
  continues the original snapshot. Snapshots expire after five minutes and
  are held in a bounded in-process cache. Start a new search if the cursor
  expires or the server restarts. `offset` and `nextOffset` still work for
  clients paging against the current programme. The default page size is
  25 and the maximum is 100.

These conventions are also published in the MCP instructions for agents.

The backend follows Cineville's cursor links on the original HTTPS origin and
endpoint. The in-process cache coalesces concurrent reads of the same request.
Default freshness is 60 seconds for screenings, 120 for film catalogues and
900 for cinemas. Override with `Cineville__CacheSeconds__events`,
`Cineville__CacheSeconds__productions` or `Cineville__CacheSeconds__venues`.
Set a value to zero to disable caching that collection. An alternate upstream
uses `Cineville__BaseUrl` and must be an HTTPS origin. A separately hosted MCP
gateway can set its trusted browser origin with `Cineville__McpOrigin`.

## Self-hosted deployment

Register the exact public callback URL `https://<your-app-host>/api/auth/callback` for the confidential Keycloak client. Enable authorization code with PKCE S256 and configure the issuer, client ID and client secret in `.env`.

```sh
cp .env.example .env
# Set PUBLIC_ORIGIN to the exact HTTPS origin, with no path/trailing slash.
# Set POSTGRES_PASSWORD to a long random secret.
docker compose up --build -d
```

Point your HTTPS reverse proxy at `127.0.0.1:5080`. The app serves both React and `/api` on one origin. Only the loopback app port is published; PostgreSQL stays internal. Preserve the browser Origin header. The backend validates it against PUBLIC_ORIGIN and does not trust forwarded headers. Migrations must finish before the app starts.

Back up the database and Data Protection key volumes. Keep the keys/backups private. Losing Data Protection keys invalidates sessions. Keycloak manages credentials and recovery. CineCompass keeps an issuer-and-subject link to its local account so that changes to the Keycloak username do not affect saved settings.

GitHub Pages deployment is replaced with build/test CI. Pushing changes does not deploy this self-hosted application.

## Recovery

Manage sign-in and recovery in Heimdall. Legacy CineCompass account data can be linked by an operator to a verified Keycloak subject. Matching usernames alone never links an account.

## Verification

Run `dotnet test`, the frontend tests and the frontend build. Backend tests exercise the OIDC callback, PKCE, account linking and settings isolation. On a deployment, sign in through Heimdall to verify that saved settings load, and connect an MCP client through Leyline to verify OAuth discovery and a tool call.

## Gont

The source checkout is `/home/dishan/Projects/cine-compass`. The active deployment lives in `/srv/services/cinecompass/`: `compose.json` defines the stack, root-only `runtime.private.json` holds the server settings, `postgres/` holds the database, and `keys/` holds Data Protection keys. Run `./deploy-gont.sh` for subsequent updates. It builds from the source checkout, pins the app and migration services to the new image in the centralized Compose file, and starts that stack using passwordless sudo. It preserves the database image, data mounts, and private settings; the old checkout's `.env` and named volumes are no longer used by this script.

The app has no published port and joins `cinecompass_gateway`, where Caddy reaches `cinecompass-app:8080`. Shared gateway configuration and centralized deployment snapshots are tracked in the `galenor` infrastructure repository; refresh its CineCompass image pins after a release. The Cloudflare Tunnel hostname routes to the existing gateway at `http://127.0.0.1:8888`. The deployment script checks app health through that gateway after startup.

Deployment builds the shared app/migration image once, then starts the stack with `--no-build`. It prints build, startup, and total elapsed times. BuildKit keeps npm downloads, NuGet packages, and the React compiler cache between builds; production images omit JavaScript source maps. Lint and type checks remain enabled. The first build after these Dockerfile changes warms the new caches; later frontend changes can reuse them. Removing Docker builder caches removes this speedup. Source compilation still runs on Gont.

## Install on iPhone or iPad

Open CineCompass over HTTPS in Safari, open the Share menu, choose **Add to Home Screen**, keep **Open as Web App** enabled if shown, and tap **Add**. The home-screen icon opens CineCompass in its own standalone window. Heimdall handles sign-in when you open the app.

Production builds register a service worker. It caches a public offline reconnect page, content-hashed JavaScript/CSS, and up to 100 movie posters from Cineville's public image CDN. Posters are fetched on demand and reused across views and reloads without another network request; simultaneous requests share one download. The oldest cached posters are removed when the limit is reached. Changed image URLs fetch new artwork, and the poster cache survives app updates. Browser storage eviction or clearing site data can remove cached posters. Account APIs, settings responses, sign-in requests, live Cineville data, and OMDb requests are never cached by the worker. An offline launch shows the reconnect page; live screenings and account sync require an internet connection. Updates activate after existing app windows close; reopening online loads the current app.

App icons use the schedule UI's compass sparkle and paper/wine colors. Regenerate the PNGs with `python3 front-end/scripts/generate-pwa-icons.py` (requires Pillow).
