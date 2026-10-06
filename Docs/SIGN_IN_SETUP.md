# Sign-in setup: Google, Play Games and email

Every option is off until it is configured. With nothing set, the app shows no sign-in buttons and guest play works as before.

| Value | Where it goes | Secret? |
|---|---|---|
| Web OAuth client ID | `app/.env` `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, server `.env` `GOOGLE_CLIENT_IDS` and `PLAY_GAMES_CLIENT_ID` | No |
| Web OAuth client secret | server `.env` `PLAY_GAMES_CLIENT_SECRET` | **Yes** |
| Play Games project ID (numeric) | `app/.env` `PLAY_GAMES_APP_ID` | No |
| SMTP login | server `.env` `SMTP_*`, `MAIL_FROM`, `MAIL_BACKEND=smtp` | **Yes** (password) |

The server `.env` is `/srv/tashzone/.env` in production (`backend/deploy/.env.example`), or `backend/api/.env` locally. Never commit either.

## 1. Signing key fingerprints

Google matches the app by package name and the SHA-1 of the key that signed the APK.

```bash
keytool -list -v -keystore app/credentials/tashzone-release.keystore -alias tashzone
```

- Release key (sideloaded APKs from `build-apk.ps1`): `00:B4:FB:47:37:E6:12:D1:D5:0F:A2:90:48:39:ED:E2:AD:AE:C9:3D`
- If the app is published on Google Play with Play App Signing, also add the **app signing key** SHA-1 from Play Console → Test and release → App integrity → App signing. Play re-signs the app with that key.

## 2. Google Cloud project and OAuth clients

1. Open <https://console.cloud.google.com>. Create a project named `TashZone`. Use this one project for everything below.
2. Go to **Google Auth Platform** (APIs & Services → OAuth consent screen).
   - **Branding:** app name `TashZone`, support email, and a link to the privacy policy.
   - **Audience:** set it to External. While it is in Testing, only listed test users can sign in. Publish it to production when you launch. The only scopes used are `openid`, `email` and `profile`, which need no Google verification.
3. Go to **Clients → Create client → Web application**.
   - Name it `TashZone server`. It needs no redirect URIs.
   - Copy the **Client ID** and **Client secret**.
4. Go to **Clients → Create client → Android**.
   - Package name: `com.tashzone.app`
   - SHA-1: the release key from step 1.
   - Create one more Android client for each additional SHA-1 (the Play app signing key, or a debug key).
   - Android clients have no secret. They only authorise the app to ask for tokens that are issued to the web client.

The app asks Credential Manager for an ID token for the **web** client ID. The server accepts only tokens whose audience is in `GOOGLE_CLIENT_IDS`.

## 3. Play Games Services

This needs the app to exist in Play Console. A draft or internal-testing release is enough.

1. In Play Console, select TashZone and open **Play Games Services → Setup and management → Configuration**.
2. Create a Play Games Services project and link it to the `TashZone` Cloud project from step 2.
3. Note the numeric **Project ID** shown on the Configuration page. That is `PLAY_GAMES_APP_ID`.
4. Under **Credentials**, add two credentials:
   - **Android:** choose the Android OAuth client from step 2.4.
   - **Game server:** choose the web client from step 2.3. This is what lets the server exchange the player's one-time code.
5. Check that the Cloud project has **Google Play Game Services** enabled (APIs & Services → Library).
6. Until the configuration is published (**Review and publish**), only accounts listed under **Testers** can sign in.

## 4. Email (SMTP)

The server emails 6-digit codes for sign-up, code sign-in and password reset.

- **Production:** use a transactional provider on your own domain, for example Brevo, Amazon SES, Mailgun or Postmark. Add the SPF, DKIM and DMARC DNS records the provider gives you. Without them, codes land in spam.
- **Quick start:** a Gmail account with 2-Step Verification and an App password (<https://myaccount.google.com/apppasswords>).
  - Host `smtp.gmail.com`, port `587`.
  - `MAIL_FROM` must be that Gmail address.
  - Gmail caps sending at about 500 messages a day.

```
MAIL_BACKEND=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_USE_SSL=false          # true only for port 465
MAIL_FROM=TashZone <no-reply@example.com>
```

For local development, set `MAIL_BACKEND=console` in `backend/api/.env`. Codes are then printed in the API log instead of emailed. Production refuses to start with `console`.

## 5. Put the values in place

**App** (`app/.env`, copied from `app/.env.example`):

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
PLAY_GAMES_APP_ID=123456789012
```

Then build as usual. The build script notices the changed `.env` and regenerates `android\`.

**Server** (`/srv/tashzone/.env`):

```
GOOGLE_CLIENT_IDS=1234567890-abc.apps.googleusercontent.com
PLAY_GAMES_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
PLAY_GAMES_CLIENT_SECRET=...
MAIL_BACKEND=smtp
SMTP_HOST=...  SMTP_USERNAME=...  SMTP_PASSWORD=...  MAIL_FROM=...
```

Then recreate the API: `docker compose -f docker-compose.prod.yml up -d api room-maintenance`.

## 6. Check it

- `GET https://<API_DOMAIN>/api/v1/app-config` should show `"sign_in_providers": ["google", "play_games"]` and `"email_accounts": true`.
- In the app, Settings → Account should show **Sign in**, **Create account** and the Google and Play Games rows.

| Symptom | Cause |
|---|---|
| Google returns "No Google account" or fails at once | SHA-1 or package name missing from the Android client, or the app's web client ID is wrong |
| Server answers `INVALID_PROVIDER_TOKEN` for Google | `GOOGLE_CLIENT_IDS` doesn't contain the web client ID the app used |
| Play Games fails with `NOT_CONFIGURED` | `PLAY_GAMES_APP_ID` wasn't set when the APK was built |
| Play Games is refused by the server | Game server credential missing, or the wrong client secret |
| No email arrives | SMTP login or port wrong (check the `auth_mail_failed` log line), or the mail is in spam (DNS records) |

## 7. Before launch

- **Play Console:**
  - Update the Data Safety form: email addresses are now collected for account management.
  - Update the privacy policy to match.
  - Add a web page or form where people can request account deletion. In-app deletion is Settings → Account → Delete everything.
- Publish the Google Auth Platform audience and the Play Games Services configuration.
