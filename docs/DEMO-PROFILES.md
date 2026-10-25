# Demo profile for every judicial role

Administration > Role Demo Profiles creates and previews one fictional profile
for each of the 173 catalog roles across all 14 role groups. Each has a synthetic
name, non-deliverable `.invalid` email, role, organization, fictional jurisdiction,
credential disclaimer, daily duties, sample matter and five practice tasks.

Demo data lives exclusively in `justice_demo_profiles`. It does not create real
login accounts, grant professional roles, claim verified licenses, create phone
accounts, send email or provision paid services. Only super administrators can
create, view or update the previews. Changing a practice task affects only that
fictional profile and is audited. There is no impersonation or production case
access through a demo profile.

The seed is idempotent: reruns create missing profiles and preserve existing
practice progress. This release provides administrative profile previews rather
than public demo logins or simulated professional credentials in real accounts.

Run on the existing production server as root:

```bash
ansible-pull -U https://github.com/olamidebello/justisolve.git -C main \
  -d /opt/justisolve-bootstrap -i localhost, -c local \
  ansible/demo-profiles.yml
```

This deploys current application resources, migrates the isolated demo table and
seeds all role profiles. Custom installations can override `app_dir` and
`compose_project`. You can also create the missing profiles using the GUI button
after ordinary deployment. No demo passwords are generated or needed.
