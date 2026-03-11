import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  route('.well-known/appspecific/com.chrome.devtools.json', 'routes/chrome-devtools.tsx'),
  index('routes/_index.tsx'),
  route('history', 'routes/history.tsx'),
  route('settings', 'routes/settings.tsx'),
  route('auth/google', 'routes/auth.google.tsx'),
  route('auth/google/callback', 'routes/auth.google.callback.tsx'),
  route('onboarding/spreadsheet', 'routes/onboarding.spreadsheet.tsx'),
  route('logout', 'routes/logout.tsx'),
  route('login', 'routes/login.tsx'),
  route('offline', 'routes/offline.tsx'),
  route('api/sync', 'routes/api.sync.tsx'),
  route('api/scan-receipt', 'routes/api.scan-receipt.tsx'),
] satisfies RouteConfig;
