# Super administrator user management

Open Administration > Users. The account total on the administration overview
opens the same screen. Search by name, email, organization or ID; filter active,
suspended, pending, super-admin and demo accounts.

- Create users or super administrators with a name, email, initial password
  (14–200 characters) and optional phone, organization, jurisdiction, country,
  time zone and biography. These accounts are explicitly administrator-approved;
  creation does not assert verified email ownership or professional authority.
  The usual personal phone provisioning job is queued when integration is enabled.
- Edit name, login email, password, system role, active/approved status and profile.
  Blank password keeps the current password. Changing email clears verification.
  Password/email/role changes, suspension and removal of administrator approval
  revoke sessions, recovery tokens and API keys. A user must sign in again.
- Approve pending accounts; suspend and activate users; generate private,
  single-use 30-minute password-recovery links without SMTP.
- Credit a selected wallet in USD, $0.01–$10,000 per action, with a mandatory
  reason/payment reference. Amounts are sent as integer cents. A request UUID
  prevents duplicate credits when retrying failed responses. This is spendable
  credit, not a gateway charge, bank deposit or refund. Balance and recent manual
  credit history are shown beside the selected user. Suspended accounts can still
  be credited; deleted and demo accounts cannot.
- Delete an account by entering its email and a reason. This permanently disables
  and anonymizes the login/profile, clears credentials, revokes sessions/tokens/
  keys and professional roles, removes active team access, revokes pending invites,
  disables PACER access and schedules phone deactivation. Transfer ownership of
  active workspaces first. The current administrator cannot delete or remove their
  own administrator access; at least one active real super administrator remains.

Deletion retains an inactive database identifier with a random non-deliverable
email so linked case, financial and audit records remain consistent. It is not a
purge of historical documents, audit events or payment records. Wallet balances
and linked records are retained; deletion does not issue refunds or transfer
private case ownership. Deleted users are excluded from user lists and cannot be
reactivated through the account editor. Phone authorization is denied locally
immediately; remote SIP access follows its existing deactivation worker/lease
(maximum ten minutes), and an already established call is not forcibly ended.

Demo logins retain their restricted role, email and global demo-only access even
when edited. Professional title selection and license approvals are separate from
system roles. Stored password hashes, recovery token hashes and API key hashes
are never included in the account list or audit metadata.

Deploy schema and GUI using the existing playbook:

```bash
ansible-pull -U https://github.com/olamidebello/justisolve.git -C main \
  -d /opt/justisolve-bootstrap -i localhost, -c local \
  ansible/justice-platform.yml
```

## Grouped user inventory and role descriptions

Users are grouped by professional role category by default, with separate demo
categories and an unassigned category. Use **Group users by** to switch to system
role, workspace, profile organization, account status or an ungrouped list. Search
also matches role names, categories, role organizations/jurisdictions and workspace
names. Each group shows its user count; the overall total counts unique accounts.
Multi-role users appear in every matching category but once per category, and
multi-workspace members appear in every workspace group.

Every card explains the system role, each requested professional title and its
catalog duties, approval status and applicable platform credential-review state.
Workspace memberships show the role description and whether the membership and
workspace are active. Synthetic demo titles are labeled as training only. These
are inventory views; grouping and descriptions grant no new permissions and do
not assert professional credentials or authority. No password hashes, credential
claims, license evidence or private case contents are returned by this view.
