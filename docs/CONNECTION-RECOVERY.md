# Repairing the connection recovery screen

The old “You’re offline” page appeared whenever the browser's navigation fetch
failed. That cannot distinguish a phone/network failure from DNS, TLS or an
unavailable server. An online indicator alone does not establish server reachability.
The screenshot therefore does not establish that the user's mobile data is off.

The revised public recovery page reports the distinction, checks the real Next.js
application HTML without using the navigation fallback, retries every 15 seconds
while visible, and returns to sign-in only when actual application HTML responds.
Retry and online/visibility events also trigger a check. Probes do not send account
credentials or delete cookies, storage, sessions or user data. They do not replay
form submissions or API writes. Navigation timeouts and 5xx responses show a
no-store 503 recovery page. Genuine 4xx responses are preserved. Only public
recovery assets are cached; private API responses, pages and records are not.

Deployment previously recreated API/web containers without reloading the app's
Nginx gateway. Nginx can retain the old resolved container addresses. The updated
commerce deployment starts the app gateway, validates its configuration, reloads
it after API readiness, and verifies actual Next.js HTML and database-backed API
health through it. This addresses that failure path; it is not proof that it was
the sole cause of a particular external outage. No host virtual hosts, DNS records,
TLS certificates, other domains, database volumes or account credentials are reset.

Run on the existing JustiSolve server as root:

```bash
ansible-pull -U https://github.com/olamidebello/justisolve.git -C main \
  -d /opt/justisolve-bootstrap -i localhost, -c local \
  ansible/repair-connectivity.yml
```

The playbook deploys current resources and tests local gateway and public HTTPS
application/API paths. If the local tests pass but public HTTPS fails, inspect the
host's JustiSolve virtual host, DNS and TLS routing; the playbook reports failure
rather than declaring a repair complete. Existing application settings and volumes
are retained. After success, tap Try again or reload an old fallback page. A browser
with the old worker can still fetch the now-healthy origin; the updated worker
claims future requests and the application checks for worker updates without a
cached script. No general-purpose site-data clearing is needed.
