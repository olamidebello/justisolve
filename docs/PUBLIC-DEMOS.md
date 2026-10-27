# Public demo accounts

Deploy and publish the catalog with `ansible/public-demos.yml` through ansible-pull. An active real super administrator must already exist. The public `/demo` page lists every published account's role, category, email and password, with search and sign-in buttons. All 173 catalog roles are supported. The global navigation links to this page.

Publication deliberately rotates the restricted demo accounts to the public training password `JustiSolve-Demo-2026!` and revokes their current sessions. Existing profile/task progress is retained. Emails use `<role_id>@demo.justisolve.invalid`. Rerunning republishes passwords and signs demo testers out. Ordinary accounts are never adopted, promoted or published. No super administrator password is listed.

Demo permissions remain confined by the global access guard to the account's own fictional profile and five practice tasks, sign-in identity and logout. No real case, AI, PACER, phone, payment or administrative service is available. This is a role training demonstration, not a complete interactive demo of every platform feature. Progress is shared between testers using the same role.

The directory returns only deliberately published, active, undeleted, approved demo accounts with system role `user` and matching current password hashes. A private demo-password reset automatically removes its stale public listing. Suspension or deletion hides it too. To unpublish all credentials without deleting accounts, run `DELETE FROM public_demo_logins;` using authorized database administration. Existing password authentication is unchanged; use password rotation/session revocation if access must also end.
