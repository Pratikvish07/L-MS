import { router, type Href } from 'expo-router';

/**
 * Back button that also works when there is no history to return to, for
 * example after a browser reload or opening a page by its URL: it then
 * replaces the screen with a sensible parent.
 */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
