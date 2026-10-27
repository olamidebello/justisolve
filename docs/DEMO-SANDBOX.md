# User feature sandbox

Demo accounts now land on a sandbox with navigation for role practice, workspaces, invitations, professional-role/license review, intake, cases/access instructions, dockets, documents/evidence/transcript metadata, tasks, deadlines, research, AI/model previews, trials/hearings/appeals, PACER, phone/PBX, wallet/marketplace, alerts/news examples, activity and preferences.

These are interactive previews, not live integration access. Sandbox records, status changes, settings and simulated credit are held in React memory and reset on reload. Role profile and its original five practice tasks still use the shared demo profile API. No live records or external integrations are exposed. AI/research outputs are clearly marked preset examples; no actual legal research, provider model or professional registry is called. File selection reads filename/size only. Phone controls do not access media devices or SIP. PACER uses fictional results and simulated credit, including an illustrative 30% system markup.

Live payment, top-up, purchase and checkout buttons are disabled. The existing server-side demo access guard remains restrictive, so manually calling live checkout or any other production service with demo credentials is rejected. No administrator preview is included: these are user tools. Case-access and team inputs are simulations, not actual permission grants. Some previews use generic record forms rather than the production module UI.

Deploy the current web application with `ansible/justice-platform.yml`. To publish or republish demo credentials as well, run `ansible/public-demos.yml`; this rotates demo passwords and revokes demo sessions. The `/demo` page lists public accounts. An active real administrator is required for provisioning.
