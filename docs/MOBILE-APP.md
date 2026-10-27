# JustiSolve mobile installation

The public `/install` page and the top “Install JustiSolve app” link provide:

- An Android preview APK, package `com.justisolve.mobile.preview`, version 0.1.0,
  minimum Android 8 (API 26), target SDK 35. It is a dedicated HTTPS website
  client using Android System WebView, not a new offline legal backend.
- A browser-installable app for Android, iPhone/iPad and supported desktops.
  Chrome can show an installation prompt; Safari users use Share > Add to Home
  Screen. The manifest defines standalone display and branded app icons.

Both use the existing live website and account permissions. The Android client
supports file selection through the system picker, local app cookie storage,
first-party foreground microphone access after Android permission, Home/Reload/
Browser controls and back navigation. External HTTPS/payment links open the
browser. Downloads (including exports), camera/video and unsupported flows may
require signing in using Browser. There is no native background calling, push
notification service, offline case storage, native PACER account or embedded AI
key. Connectivity and enabled server integrations are required. No mobile device
or emulator execution has been claimed from build/signature verification alone.

## Data and transport

The Android app rejects invalid TLS, cleartext in-app transport, mixed content,
third-party cookies, arbitrary file access and non-approved URL schemes. Only
`justisolve.com` and `www.justisolve.com` stay in the app. It exposes no JavaScript
native bridge. The microphone is granted only to the first-party site and only
while the activity has focus; camera capture is not granted. APKs have no user
passwords, server API keys or administrative privileges.

The browser service worker caches only a generic offline notice and public icons.
It never caches API responses, authenticated pages, case files or AI output.
Without network, navigation shows the generic offline notice.

## Development build and signing

The checked-in APK is explicitly a development preview. Its checksum, certificate
fingerprint, package and size are recorded in `services/web/public/mobile/release.json`.
It has a separate package/signing identity from the generic African Apps Store
fleet placeholder. It is not Google Play or Apple App Store publication.

Rebuild with Java 17 JDK and Android platform 35/build-tools 35.0.0:

```bash
python3 mobile/android/build.py --sdk /path/to/android-sdk \
  --signing /private/persistent/justisolve-preview-signing
```

Back up that signing directory privately for compatible rebuilds. Development
keystore password `android` is intentional; do not reuse this development key for
production. Keys are never committed. A build with another key may require
uninstalling the previous preview, which clears its local app storage. The CI
workflow creates independently signed build artifacts for testing; it does not
replace the checked-in download or claim update-compatible production releases.
Keep the shipped APK/signature stable until a deliberate new preview is published.
Use a secured persistent release key and increasing version codes for production.

## Deploy JustiSolve

```bash
ansible-pull -U https://github.com/olamidebello/justisolve.git -C main \
  -d /opt/justisolve-bootstrap -i localhost, -c local ansible/mobile-app.yml
```

This deploys the source and verified committed APK with the existing services,
then checks the public install and download URLs. Website/API data and credentials
remain on the existing server. It does not create new user logins.

## Publish the African Apps Store listing

The companion `olamidebello/africanappsstore` repository includes the same APK,
checksum and listing, plus `ansible/deploy-justisolve-mobile.yml`. Run that playbook
on the store server to update the existing service and upsert the JustiSolve
listing while retaining other apps and administrator visibility preferences.
A repository push alone does not change either live server.

## Preview 0.2.0

Adds direct Demo and Install navigation. A new preview signing certificate requires uninstalling 0.1.0 before installing 0.2.0. Uninstall clears local sign-in state but retains server accounts and records. The private development signing backup is separate from this repository. Physical device testing is pending.
