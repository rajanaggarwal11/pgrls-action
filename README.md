# pgrls-action

Runs the [pgrls](https://github.com/rajanaggarwal11/pgrls) audit against a database in CI and fails the build when a table is not protected by row-level security — not enabled, not forced, or without a policy. The unprotected tables land in the job summary, so a red run is legible without opening a log.

```yaml
- uses: rajanaggarwal11/pgrls-action@v1
  with:
    database-url: ${{ secrets.DATABASE_URL }}
```

It needs pgrls 0.2.0 or newer, the first version with the `audit` command; that is the version the action runs by default.

`@v1` follows the latest v1 release. To run exactly the code you reviewed, pin the full commit SHA of a release tag, with the tag in a comment so Dependabot can update it:

```yaml
- uses: rajanaggarwal11/pgrls-action@<commit-sha> # v1.x.y
```

`git ls-remote https://github.com/rajanaggarwal11/pgrls-action 'refs/tags/v1*'` lists the tags and their SHAs.

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
| `version`              | `0.2.0`    | pgrls version: exact, a dist-tag such as `latest`, or a packed tarball. The audit needs 0.2.0 or newer. |

## Outputs

`tables`, `unprotected`, `no-rls`, `not-forced`, `no-policies`, `role`, `bypasses`, `report` (path to the JSON on the runner).

## Which pgrls runs

Each release of the action runs one exact pgrls version, the one its tests ran against: `0.2.0` for this release. Set `version` to run another (`0.2.1`, or `latest` to follow npm).

## Against a migration in the same workflow

A complete job for a pnpm project that migrates with Drizzle: start Postgres, install, migrate as the owner, create the role the app connects as, and audit as that role.

```yaml
name: RLS
on: pull_request
permissions:
  contents: read

jobs:
  rls:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: ci }
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v7
        with: { persist-credentials: false }
      - uses: pnpm/action-setup@v6 # reads the pnpm version from "packageManager" in package.json
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm drizzle-kit migrate # drizzle.config.ts reads DATABASE_URL
        env: { DATABASE_URL: "postgres://postgres:ci@localhost:5432/postgres" }
      - name: Create the role the app connects as
        run: |
          psql "postgres://postgres:ci@localhost:5432/postgres" -v ON_ERROR_STOP=1 \
            -c "create role app login password 'app'" \
            -c "grant usage on schema public to app" \
            -c "grant select, insert, update, delete on all tables in schema public to app"
      - uses: rajanaggarwal11/pgrls-action@v1
        with:
          database-url: postgres://app:app@localhost:5432/postgres
          exclude: __drizzle_migrations # only needed if your migrations table is in public
```

Every table your migration creates is audited as the app would see it, on every pull request.

## License

[MIT](./LICENSE) © Rajan Aggarwal
