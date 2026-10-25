# Demo profile and login for every judicial role

Administration > Role Demo Profiles previews all 173 fictional profiles across
14 role groups. Each profile includes a synthetic name and email, role, fictional
organization/jurisdiction/address, language/time zone, professional summary,
specializations, training/education, explicit credential disclaimer, daily duties,
a fictional sample matter and five practice tasks. No real professional licenses,
qualifications, phone numbers or appointments are asserted.

## Create login accounts

The **Create missing demo logins** button creates one unique ordinary `user`
account per role with a cryptographically random 32-character password, stored
only as a salted scrypt hash. These accounts use the profile email, for example
`judiciary_1@demo.justisolve.invalid`. The `.invalid` address is a login identifier,
not a working mailbox. Accounts are administrator-approved for training sign-in;
they are not marked email-verified and no professional role is approved.

Passwords appear once in the admin page and can be downloaded as JSON. Save them
before clearing or leaving the page; they cannot be retrieved from the database.
Select a profile and use **Reset this demo password** to generate a new password
and revoke its current sessions and recovery tokens. Reset preserves account
suspension. Existing accounts with conflicting emails are never adopted or reset.
No credentials are committed to GitHub or written to audit events.

Sign in at https://justisolve.com/ with the exported email and password. Demo
accounts see **My demo workspace**, their completed profile, fictional matter and
practice tasks. Task changes persist and are audited. Each account can read and
update only its own demo workflow; the server denies all other authenticated
endpoints, including other demos, real cases, organizations, AI, PACER, payment,
phone and administration. API keys cannot be used by demo accounts. The server
enforces this restriction even if someone changes a demo account's system role.
No phone identities, real matters, tenant memberships, professional role grants,
paid credits or email messages are provisioned.

## Deploy and export all credentials on the server

Run as root on the existing production server:

```bash
ansible-pull -U https://github.com/olamidebello/justisolve.git -C main \
  -d /opt/justisolve-bootstrap -i localhost, -c local \
  ansible/demo-logins.yml
```

This deploys current resources, migrates the schema, completes missing profile
fields, creates the missing login accounts and saves their email/password pairs
in `/etc/justisolve/demo-logins.json` (root, mode 0600). View that file privately on
the server; do not paste its contents in public logs. The Ansible credential tasks
use `no_log`. Custom installations can override `app_dir`, `compose_project` and
`demo_credentials_path`.

Reruns preserve existing passwords and training progress, retaining earlier
exports while appending newly created logins. If credentials were first created
through the GUI, they will not be exported again by Ansible. GUI resets supersede
the corresponding older export entry. If an export is lost or a deployment is
interrupted after account creation, reset the affected login in the GUI. Suspend
an account through Administration > Accounts to disable its login.

`ansible/demo-profiles.yml` still seeds administrative profile previews without
creating logins. The profile seed and login provisioning use a transaction and
advisory lock. Demo data stays in `justice_demo_profiles`; login accounts carry
an immutable-through-user-APIs `demo_role_id` marker used by the global access
guard. Normal account registration and permissions are unchanged.
