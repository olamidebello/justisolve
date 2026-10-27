# Repairing “Your connection is not private” on JustiSolve

This browser warning establishes that certificate validation failed. The screenshot
alone does not distinguish an expired certificate, wrong hostname, untrusted chain,
incorrect device clock or traffic reaching a different host. Do not enter account
credentials through the warning. The earlier offline recovery screen can also be
shown when TLS prevents the browser from reaching the application.

Run on the existing JustiSolve Nginx server as root:

```bash
ansible-pull -U https://github.com/olamidebello/justisolve.git -C main \
  -d /opt/justisolve-bootstrap -i localhost, -c local \
  ansible/repair-https.yml
```

The combined playbook repairs TLS first, then performs application/gateway recovery
and verifies public HTTPS HTML, database-backed API health and the recovery worker.
It reports success only after those checks. It retains the existing application
path, environment, keys, users and database volumes. It never disables certificate
validation, changes DNS or assumes that an old server IP is still correct.

The TLS stage requires a syntax-valid existing host Nginx configuration with an
exact `server_name justisolve.com`. It detects duplicate-name Nginx warnings and
refuses a block that shares the JustiSolve names with unrelated domains. It backs
up matching active files under `/var/lib/justisolve-tls-repair`, then uses Certbot's
Nginx plugin to obtain/install a dedicated `justisolve-tls-repair` lineage. If www
is also configured, it is included. Every requested name must resolve to this
server and permit the ACME HTTP challenge on port 80. Issuance failures must be
resolved from the task output; no alternate hostname or backend port is guessed.

The preflight does not rewrite vhosts. Certbot performs installation using its
normal configuration checkpoints; existing proxy routes are retained. Certificate
hostname and seven-day validity checks precede installation. After reload, a real
local TLS handshake validates the hostname and trusted chain using SNI for each
name. Set `-e tls_probe_address=LOCAL_LISTEN_ADDRESS` only if Nginx is deliberately
bound to a particular local address rather than loopback/wildcard. The system
Certbot renewal timer and a lineage-specific Nginx reload hook are enabled.

An optional `-e tls_email=ADMIN_EMAIL` sets the ACME contact. The default registers
without an email; this does not send recovery emails or change user accounts.
Backups/checkpoints contain privileged configuration and should remain private.
If Certbot or routing verification fails, retain the task output and inspect it
before another attempt; repeated issuance attempts can encounter CA rate limits.
The playbook has not repaired a live server until its final checks actually pass.

If the server reports successful verification but the phone still warns, check the
phone's automatic date/time and the specific browser certificate error. Reload
only after the certificate is valid. Do not select a bypass/unsafe continuation.

Certbot's documented Nginx installation and rollback procedures:
https://eff-certbot.readthedocs.io/en/stable/using.html#nginx
