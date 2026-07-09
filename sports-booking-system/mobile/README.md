# SportBooking Mobile

Expo mobile app for the SportBooking user experience.

## Run

```bash
npm install
cp .env.example .env
npm run start
```

## Run without Expo Go

If Expo Go cannot be updated or is incompatible with this SDK, install a development build instead.

Android with local Android SDK:

```bash
npm run android:dev
npm run start:dev
```

Android APK through EAS:

```bash
npx eas-cli build -p android --profile development
```

Install the generated APK on the phone, then run:

```bash
npm run start:dev
```

Use these API URLs:

- Android emulator: `http://10.0.2.2:8080/api`
- iOS simulator: `http://localhost:8080/api`
- Physical device: `http://<your-lan-ip>:8080/api`

## Scripts

```bash
npm run typecheck
npm run android
npm run ios
```
