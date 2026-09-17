# Felixz Blooket + Supabase

## 1. Create the database

Open Supabase Dashboard > SQL Editor, paste all of `supabase-schema.sql`, and run it.

Run the complete file, not only the first table. It also creates the Auth trigger and repairs profiles for accounts created before the schema.

The script creates:

- `profiles`: account progress, coins, stats, locker and equipped blook.
- `chat_messages`: authenticated global chat.
- `games`: global game rooms with six-character codes.
- `game_players`: players inside each room.
- RLS policies and Realtime publication configuration.

## 2. Configure authentication

In Authentication > Providers > Email:

- Enable Email provider.
- For quick local testing, disable Confirm email.
- For a public launch, keep Confirm email enabled.

In Authentication > URL Configuration, add the URL where `index.html` will be hosted to Site URL and Redirect URLs.

## 3. Confirm the database

In Supabase Dashboard > Table Editor, you should see `profiles`, `chat_messages`, `games`, and `game_players`. If `profiles` is missing, the SQL did not run successfully; read the SQL Editor error and run the file again after fixing that error.

## 4. Open the game

Open `index.html` after the SQL has finished. Create an account with an email, username and password.

The frontend uses the publishable key only. Never put a `service_role` key in `index.html`.

## Offline mode

If the browser starts without internet, Felixz Blooket automatically uses a local account store in `localStorage`. Quizzes, coins, packs, locker, stats, and local chat continue to work on that device. Those offline accounts are separate from Supabase accounts and do not sync automatically when internet returns.

## 5. Multiplayer

Choose **Play with friends**:

1. Host clicks **Create game**.
2. Share the six-character code.
3. Other players enter the code and click **Join game**.
4. Host clicks **Start game**.

Supabase Realtime synchronizes the lobby and game start between browsers. The same setup works on Wi-Fi and, once the site is hosted publicly, between players anywhere in the world.

## Current limitation

The lobby and synchronized start are online. The next multiplayer phase should move question answers and score updates into a server-authoritative game state so players cannot modify their own score from the browser.
