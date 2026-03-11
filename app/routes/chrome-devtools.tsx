import { data } from 'react-router';
import type { Route } from './+types/chrome-devtools';

export async function loader(_args: Route.LoaderArgs) {
  return data({});
}
