# JustiSolve automatic repair

Run on the existing JustiSolve host as root:

```sh
ansible-pull -U https://github.com/olamidebello/justisolve.git \
  -C main -d /opt/justisolve-bootstrap -i localhost, -c local \
  ansible/hard-repair.yml
```

The runner prevents overlapping hard-repair runs, makes a private copy of the existing production environment, starts stopped PostgreSQL/Redis services without recreating them, then executes the scoped TLS and connectivity repairs. These back up matching Nginx configuration, obtain/install the JustiSolve certificate, enable renewal, pull/build the application, reload the application gateway, enable credential/phone synchronization timers, and require trusted public HTTPS, actual Next.js HTML, database-backed API health and recovery-worker checks to pass.

Progress and errors are saved in `/var/lib/justisolve-hard-repair/<run>/repair.log`. This log is private and may contain deployment details; review before sharing. The safe summary is `/var/lib/justisolve-hard-repair/report.json`. A failed stage returns failure; it never reports success merely because containers started. The production environment backup is not a database backup. Existing account records, volumes and encryption keys are retained. No volume pruning, database reset, forced Git overwrite or automatic account password reset is performed. There is no automatic rollback of database migrations.

The default existing checkout is `/opt/aicourtsystem`, Compose project `docker`. Override with `-e app_dir=/actual/path -e compose_project=actualproject` when necessary. The wrapper targets a local server, as shown above. Let a running deployment finish before starting this command; its lock coordinates other hard-repair runs only.

DNS pointing to a different machine, certificate-authority rate limits, missing credentials, invalid/shared Nginx vhosts and local tracked Git conflicts require the specific reported issue to be resolved. The script stops rather than guessing DNS, backend ports or changing unrelated domains. It does not promise to repair every external integration.

A phone retaining the previous offline service worker may need a fresh tab or Incognito test after server verification passes. If Incognito works, clearing only JustiSolve site data removes its old browser installation and signs the user out. Server automation cannot force removal from a disconnected client. Never bypass a remaining certificate warning.
