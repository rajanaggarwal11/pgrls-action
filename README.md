# pgrls-action

Runs the [pgrls](https://github.com/rajanaggarwal11/pgrls) audit against a database in CI and fails the build when a table is not protected by row-level security — not enabled, not forced, or without a policy. The unprotected tables land in the job summary, so a red run is legible without opening a log.

```yaml
- uses: rajanaggarwal11/pgrls-action@v1
  with:
    database-url: ${{ secrets.DATABASE_URL }}
```

Run it as the role your **application** connects with. A superuser or `BYPASSRLS` role is never subject to RLS, so a report gathered as one proves nothing — the action refuses it unless you say `allow-bypassing-role: true`.

## The connection URL never reaches the log

It is passed to the CLI through the environment, not `argv`; everything the CLI prints goes through a filter that replaces the password (raw and URL-encoded) before it can reach the console; the JSON report carries host, database and role but never credentials; and a test in this repo runs the action with a wrong password and a wrong host and greps the captured log, the summary and the outputs for it.

## Inputs

| Input                  | Default    | What it does                                                                                          |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `database-url`         | _required_ | Connection URL for the application's role. Pass a secret.                                             |
| `schema`               | `public`   | Schemas to inspect, comma-separated.                                                                  |
| `exclude`              |            | Tables to skip, comma-separated, as `name` or `schema.name` — migrations tables, usually.             |
| `allow-unforced`       | `false`    | Count RLS-enabled-but-not-forced as protected. (The table owner bypasses unforced RLS.)               |
| `allow-bypassing-role` | `false`    | Accept a report gathered as a superuser / `BYPASSRLS` role.                                           |
| `fail-on-findings`     | `true`     | `false` reports without blocking. A failed connection or a refused role still fails the step.         |
| `version`              | `latest`   | pgrls version or dist-tag, or the path of a packed tarball. The audit command needs 0.2.0 or newer. |

## Outputs

`tables`, `unprotected`, `no-rls`, `not-forced`, `no-policies`, `role`, `bypasses`, `report` (path to the JSON on the runner).

## Against a migration in the same workflow

```yaml
services:
  postgres:
    image: postgres:17
    env: { POSTGRES_PASSWORD: ci }
    ports: ["5432:5432"]
steps:
  - uses: actions/checkout@v7
  - run: pnpm drizzle-kit migrate
    env: { DATABASE_URL: postgres://postgres:ci@localhost:5432/postgres }
  - run: psql postgres://postgres:ci@localhost:5432/postgres -c "create role app login password 'app'; grant usage on schema public to app; grant select on all tables in schema public to app"
  - uses: rajanaggarwal11/pgrls-action@v1
    with:
      database-url: postgres://app:app@localhost:5432/postgres
      exclude: __drizzle_migrations
```

Every table your migration creates is audited as the app would see it, on every pull request.

## License

[MIT](./LICENSE) © Rajan Aggarwal
