# Putting Daily in the cloud (phone + PC in sync)

Free. Two services: **Supabase** (the database and email sign-in) and **Vercel** (the web address your phone opens).
You sign in with your email and a one-time code; there's no Google setup.

> **First:** in Daily on your PC → **Settings → Download JSON backup**, and keep the file. Once the cloud keys
> are in `.env.local`, the PC app reads from the cloud instead of Chrome, so this backup is how your current
> habits, ticks and notes move over.

## 1. Supabase (done)

Project created, `supabase/setup-all.sql` run, and the three keys saved in `.env.local`.

## 2. Supabase email sign-in settings

In your Supabase project:

1. **Authentication → Emails → Templates** (or **Email Templates**). In both **Confirm signup** and **Magic Link**,
   add this line to the message body and **Save**:
   ```
   Your Daily code: {{ .Token }}
   ```
   (The app asks for this code. It works inside the installed phone app, where tapping a link would open the browser.)
2. **Authentication → URL Configuration**: set **Site URL** to your Vercel address (step 3), and add
   `https://YOUR-APP.vercel.app/auth/callback` and `http://localhost:3000/auth/callback` under **Redirect URLs**.
3. After you've signed in once (step 4): **Authentication → Sign In / Providers → Email** (or **Settings**) →
   turn **off "Allow new users to sign up"**. Your account keeps working; nobody else can create one.

Supabase's built-in email sender allows a few emails per hour. That's plenty for signing in on two devices.

## 3. Vercel (the web address)

1. Sign up at **vercel.com** (GitHub is easiest).
2. Claude deploys from your PC with `npx vercel` (you approve the login in your browser) and copies the three
   Supabase settings from `.env.local` into Vercel without showing them.
3. You get an address like `https://daily-xxxx.vercel.app`. Put it in the Supabase URL Configuration (step 2.2).

## 4. Move your data

1. Open your Vercel address, enter your email, type the code from the email. This creates your account.
2. Claude runs `npx tsx --env-file=.env.local scripts/push-to-cloud.ts <backup.json> <your-email>`
   (habits, ticks, notes and pasted images).
3. Turn off new sign-ups (step 2.3).

## 5. Phone

Open your Vercel address on the phone → sign in with email + code →
- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** menu → **Install app**

The Desktop icon on your PC keeps working and uses the same cloud data (sign in once there too).

---

### Rules the database enforces

- Only **today's** habits can be ticked (India time). Past and future days are locked on every device.
- If you move timezones, change `Asia/Kolkata` in `app_today` (`supabase/migrations/0002_levels_and_locks.sql`).
