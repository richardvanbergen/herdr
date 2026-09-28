# Assignment permission regression harness

Run against an explicitly selected Nix package output, never a live database:

```sh
bash tests/paperclip-assignment/run-tests.sh /nix/store/<candidate>-paperclip-2026.916.1 --browser
```

Set `PAPERCLIP_RUN_SCRATCH_DIR` to an existing disposable parent directory first. Requires Node 24, PostgreSQL 17 `initdb`/`pg_ctl`, and Chromium for `--browser`. The runner initializes its own database on a private scratch Unix socket, applies the shipped migrations, and stops the database on exit. It preserves evidence under the printed directory. It does not deploy, switch a system generation, or connect to the live Paperclip database.

The eleven tests use the actual shipped Express route handlers, services and PostgreSQL schema. Actor identities are injected test fixtures; this is not a login/JWT middleware test. Fixtures have no responsible user or active adapters; task wake dispatch cannot execute a real agent. A logged missing-responsible-user wake warning is expected for allowed fixture assignments.

The browser check serves the unmodified shipped UI with real permission routes and database writes. Identity and unrelated navigation endpoints are fixture responses. Chromium uses a disposable profile; CDP blocks requests outside the loopback fixture. A simulated permission PATCH rejection proves that the existing UI reports save failure. No production session, token or browser profile is used.

Covered: false with/without stale grant; assignment creation without persistence; missing/true compatibility; CEO/creator exceptions; cross-company and terminated-identity denials; off/on/off persistence; unauthorized permission edits; reassignment; child creation; read/comment/complete own issue; receiving a head assignment; task-bridge veto; protected/private targets; invalid-parent visibility; low trust; checkout; accepted-plan decomposition; suggested-task acceptance denial with a true-setting positive control.

The original package reproduces the defect with HTTP 201 on forbidden delegation and an enabled display after storing false. The candidate must pass; zero tests or a failing browser assertion is failure.
