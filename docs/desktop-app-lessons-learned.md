# Desktop App Lessons Learned

This document captures the general engineering lessons learned while building and packaging a local-first Electron application with Next.js, Express, SQLite, Prisma, and optional Google Drive integration.

The goal is not to document one-off fixes. The goal is to extract reusable rules that should reduce repeated packaging, runtime, and deployment mistakes in future projects.

## 1. Treat Packaged Desktop Runtime as a Separate Environment

A development environment that works on macOS or in `npm run dev` does not prove that a packaged Windows desktop build will work.

General rule:

- Always assume there are at least three separate runtime environments:
  - local development
  - local production build
  - packaged desktop installer on the target OS

What to do:

- Test the packaged app path, not just the dev server.
- Verify startup on the real target OS as early as possible.
- Add checks that exercise the compiled output, not just source code.

## 2. Do Not Trust “Build Succeeded” as Proof of Runtime Safety

Several failures only appeared after installation, even though TypeScript, linting, and packaging all passed.

General rule:

- A successful build is a compilation result, not a runtime guarantee.

What to do:

- Add targeted runtime smoke tests against compiled output.
- For desktop apps, test:
  - startup
  - database initialization
  - server boot
  - route registration
  - local API calls
  - backup path creation

## 3. Avoid Hidden Runtime Dependencies in `node_modules`

Prisma failed inside the packaged app because the generated client depended on hidden runtime structure under `node_modules/.prisma`.

General rule:

- Avoid relying on generated runtime assets hidden under `node_modules` when packaging desktop applications.

What to do:

- Generate runtime clients into a project-controlled path.
- Import from that explicit generated path.
- Copy generated runtime assets into the compiled desktop output intentionally.
- Verify the packaged app can resolve those assets without `node_modules` assumptions.

## 4. Make Environment Initialization Happen Before Module Loading

One of the startup crashes happened because Prisma loaded before `DATABASE_URL` was set.

General rule:

- If a module depends on environment variables, do not import it before those variables are initialized.

What to do:

- Move env-sensitive imports behind initialization steps when needed.
- Prefer lazy loading for server modules that depend on:
  - database paths
  - app data directories
  - credentials paths
  - OS-specific storage locations

## 5. Local-Only Apps Still Need Security Boundaries

The app was not internet-facing, but the localhost API was still reachable from the browser. That created real security risk.

General rule:

- “Runs locally” does not mean “safe by default.”

What to do:

- Restrict CORS aggressively.
- Add a local API session/auth barrier even for localhost-only tools.
- Do not expose secrets to renderer responses.
- Treat browsers, local apps, and local APIs as separate trust zones.

## 6. Never Return Secrets to the Frontend Unless Strictly Required

Google Drive secrets were initially being returned from settings APIs.

General rule:

- The frontend should only receive the minimum state needed to render UI.

What to do:

- Return booleans such as “configured” instead of secret values.
- Keep access tokens, refresh tokens, and client secrets out of UI payloads.
- Store sensitive secrets outside normal app settings tables when possible.

## 7. Separate Business Data from Machine-Specific Integration State

Moving the main SQLite database between machines also moved Google Drive integration state. That caused confusion and stale account references.

General rule:

- Core business data should not be tightly coupled to machine-specific or user-specific integration state.

What to do:

- Keep accounting data separate from local auth state when possible.
- Treat OAuth connection state as device-specific unless there is a strong reason not to.
- Add explicit reset actions for integrations.

## 8. OAuth for Desktop Apps May Still Require “Web Application” Clients

The app itself was a desktop app, but the Google OAuth flow used a localhost callback URL. That required a web-style OAuth client.

General rule:

- Choose OAuth client type based on the actual auth flow, not the packaging format of the app.

What to do:

- If the flow uses a localhost redirect URI, it often belongs to a web-style OAuth configuration.
- Document this explicitly so future maintainers do not switch client type incorrectly.

## 9. Test Users and Consent Screen State Matter in Google OAuth

Some Google login errors were caused by the OAuth app being in testing mode or using the wrong project.

General rule:

- Cloud auth failures are often configuration problems, not application code problems.

What to do:

- Verify:
  - correct project
  - correct OAuth client
  - correct redirect URI
  - consent screen state
  - test users
- Do not debug app code before confirming those basics.

## 10. Force Account Selection When Multiple Google Accounts Are Common

Users on shared or admin machines often have multiple Google accounts already active in the browser.

General rule:

- If account switching matters, make the auth flow force explicit account selection.

What to do:

- Use OAuth prompts that avoid silently reusing the wrong logged-in account.
- Provide a full integration reset path inside the app.

## 11. Express Major Versions Can Break Common Routing Patterns

The desktop build failed because an Express 4 style wildcard route was not valid under Express 5 and `path-to-regexp`.

General rule:

- Framework major version upgrades can invalidate long-standing routing shortcuts.

What to do:

- Check routing syntax against the exact framework version in use.
- Avoid legacy catch-all route patterns without validating them under the current parser.
- Add runtime startup tests for route registration.

## 12. Hostname Consistency Matters for Local Cookies and Sessions

Mixing `localhost` and `127.0.0.1` caused local session issues and made data appear missing.

General rule:

- Localhost networking should be treated as a real origin problem, not as a cosmetic difference.

What to do:

- Keep frontend and backend hostnames aligned.
- Generate API base URLs from the actual current host when possible.
- Do not assume `localhost` and `127.0.0.1` are interchangeable once cookies or sessions are involved.

## 13. CI Packaging Should Be Explicit About Publishing Behavior

The GitHub Action built the installer successfully, then failed because `electron-builder` attempted an automatic GitHub release publish.

General rule:

- CI pipelines should separate “build artifact” from “publish release.”

What to do:

- Use explicit publish flags.
- Disable release publishing unless it is intentionally configured.
- Keep the first automation goal simple: produce a downloadable installer artifact.

## 14. File Extensions Are Not File Validation

The Windows icon packaging failed because an `.ico` file was actually a renamed JPEG.

General rule:

- Never assume an asset is valid based on its file extension alone.

What to do:

- Validate binary assets before release.
- Generate platform-specific assets from a trusted source image.
- Add icon generation as a repeatable build step, not a manual file rename.

## 15. Ignore Sensitive Local Artifacts in Git from Day One

Local databases, backups, tokens, and credentials were all candidates for accidental commits.

General rule:

- Local-first apps create many sensitive artifacts outside normal source files.

What to do:

- Ignore:
  - local databases
  - journals
  - backups
  - generated credentials
  - local session tokens
- Review `.gitignore` early, not only after the first accidental leak risk.

## 16. Add Reset Paths for Integrations, Not Just “Disconnect”

A disconnect action that only deletes tokens may still leave stale UI state, upload history, folder IDs, or cached account information.

General rule:

- “Disconnect” and “reset integration state” are not always the same action.

What to do:

- Either make disconnect fully clear all relevant state, or provide a separate hard reset action.
- When building internal tools, prefer more explicit reset behavior over hidden stale state.

## 17. Package Validation Should Include Real Startup Paths

The most useful validations were not generic tests. They were targeted checks against the exact compiled startup path.

General rule:

- Validate the exact code path that the packaged app will execute.

What to do:

- For Electron apps, test:
  - main process boot
  - database setup
  - local server startup
  - static route fallback
  - compiled Prisma load path
- When possible, run these checks against built output, not TypeScript source.

## 18. Keep a Shipping Checklist for Desktop Apps

A reliable release process needs a checklist, not memory.

Recommended release checklist:

- Confirm local secrets and databases are ignored by Git.
- Confirm installer icons are valid binary assets.
- Confirm CI build disables unintended publishing.
- Confirm generated runtime assets are copied into the packaged app.
- Confirm environment variables are set before loading database-dependent modules.
- Confirm startup on the target OS.
- Confirm static routes register under the exact server framework version.
- Confirm OAuth redirect URI and consent screen settings.
- Confirm disconnect/reset behavior for cloud integrations.

## Final Principle

For desktop apps, the dangerous mistakes are usually not in the visible UI. They are in:

- packaging assumptions
- runtime asset resolution
- environment initialization order
- local security boundaries
- third-party auth configuration

Future projects should treat those concerns as first-class engineering work, not post-build cleanup.
