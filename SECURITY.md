# Security

## Reporting a vulnerability

Please report it privately: on this repository, open **Security → Report a vulnerability**. Do not open a public issue.

Include the workflow that shows the problem (or a minimal one), what you expected, and what happened.

## Scope

This repository: the `pgrls-action` GitHub Action — `action.yml`, the files it runs, and its own workflows. Problems in the pgrls library and CLI belong in [rajanaggarwal11/pgrls](https://github.com/rajanaggarwal11/pgrls).

Examples that are in scope: the database password reaching the log, the job summary or the outputs; a report gathered as a role that bypasses RLS being accepted without `allow-bypassing-role`; the action running a different pgrls than the one it pins.

## Supported versions

The latest major version (`v1`). Fixes ship as a new v1 release; older tags are not patched.
