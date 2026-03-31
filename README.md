# Momentum

Momentum is a React Native habit and personal finance app built with Expo and Supabase.

The app combines:

- habit tracking
- personal budgeting
- savings goals
- onboarding-driven setup
- biometric unlock
- a unified mobile-first design system

The repository still uses the original Expo project name `Aequilibrium` in some native/config files, while the in-app product name is now `Momentum`.

## Tech Stack

- Expo SDK 55
- React Native 0.83
- React Navigation
- Supabase Auth + Postgres + RLS
- AsyncStorage for local draft/session support
- Expo Local Authentication for biometrics

## Current Status

The project is already past the foundation stage. Core schema, authentication, navigation, habits, and most of the main app shell are in place.

### What already works

- Supabase database schema is set up with RLS, indexes, constraints, `updated_at` triggers, and automatic profile creation
- authentication flow supports sign up, login, logout, and persistent session restore
- onboarding saves a local draft and attempts to apply it after sign up or login
- root navigation is based on real Supabase session state instead of fragile local flags
- habit tracking runs against Supabase, including completion logs and streak calculation from real data
- main tab structure is implemented: Home, Habits, Finance, Insights, Profile
- Home, Finance, and Profile have already been migrated away from the old SQLite stores to Supabase services
- biometric setup and session-gated unlock flow are implemented
- reminder notifications and reusable UI components are in place

### What is partially done

- onboarding draft application now has stricter error handling, but still needs end-to-end validation with fresh users
- account deletion UI is wired, but full deletion depends on deploying the Supabase Edge Function in `supabase/functions/delete-account`
- the app can be installed on a real iPhone through a development build, but local environment setup still matters

## Remaining Work

### 1. Validate onboarding persistence end to end

The biggest short-term check is confirming that selected onboarding habits, categories, budget, and goals are consistently applied to new users.

### 2. Finish real insights

`InsightsScreen` is still mostly static. The MVP version should generate a few real rule-based insights, such as:

- budget alerts
- consistency of expense logging
- habit vs spending correlations
- weekly summary of habits and finance behavior

### 3. Complete account deletion backend rollout

The repository already includes a first version of the Edge Function:

- [supabase/functions/delete-account/index.ts](/Users/pedroprimo/Desktop/Aequilibrium/Aequilibrium/supabase/functions/delete-account/index.ts)

It still needs to be deployed to the linked Supabase project before the delete-account flow will work in production/dev testing.

### 4. Remove remaining legacy SQLite code

Some old files still exist in `src/store` and should be removed once every active flow is confirmed on Supabase:

- `store/database.js`
- `store/habits.js`
- `store/finance.js`
- `store/goals.js`
- `store/supabase.js`

### 5. Strengthen empty states

Once seed data and old local-store assumptions are fully removed, Home, Profile, and Insights need stronger empty states for brand-new accounts.

## Project Structure

```text
src/
  components/    Reusable UI pieces and modals
  lib/           Shared clients such as Supabase
  navigation/    Root navigator and tab/stack setup
  screens/       Main app screens
  services/      Supabase-backed domain services
  store/         Legacy local/SQLite code still pending cleanup
  theme/         Colors, spacing, radius, shadows
  utils/         Biometrics, notifications, animations, helpers
supabase/
  functions/     Edge Functions
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` with:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Start the development server

```bash
npx expo start
```

For a local development build:

```bash
npx expo start --dev-client --host lan
```

## iOS Notes

Testing on a physical iPhone may require:

- Xcode iOS platform installed
- Developer Mode enabled on the device
- Apple Development certificate configured in Xcode
- signing configured for the iOS target

If Expo Go is incompatible with the current SDK on device, use a development build instead.

## Supabase Edge Function Deployment

The delete-account flow requires deploying the `delete-account` function.

Typical flow:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy delete-account
```

## Known Limitations

- account deletion is not complete until the Edge Function is deployed
- biometric auth currently protects an existing session; it is not a replacement for a fresh login after explicit logout
- `monthlyIncome` collected during onboarding is not yet surfaced in the product
- Insights are still mostly placeholder content

## Next Recommended Milestone

The best next milestone is:

1. validate onboarding with a fresh test account
2. deploy and test delete-account end to end
3. implement real Insights
4. remove leftover SQLite code

## License

No license has been defined yet.
