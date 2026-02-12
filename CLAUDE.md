# CLAUDE.md

## Deployment

- **Do not push directly to Heroku.** Push to `origin` (GitHub) and let the CI pipeline run first. Deploy to Heroku separately after CI passes.
- Heroku app: `community-notes-everywhere`
- Custom domain: `notes.blmc.dev`
- Heroku runs `db:migrate` automatically on deploy via the `release` command in the Procfile.
- Solid Cache, Queue, and Cable all share a single Postgres database (named databases in `database.yml` all point to `DATABASE_URL`).
