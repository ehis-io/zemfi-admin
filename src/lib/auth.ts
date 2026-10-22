/**
 * The admin session lives in localStorage. The key is namespaced so a ZemFi
 * Admin tab and another admin console on the same origin during local
 * development never read each other's token.
 *
 * The key keeps the project's former name (Railz) on purpose: renaming it
 * would sign every admin out, since their token is stored under it.
 */
const TOKEN_KEY = 'railz_admin_token';

const hasStorage = (): boolean => typeof window !== 'undefined';

export const getToken = (): string | null =>
  hasStorage() ? localStorage.getItem(TOKEN_KEY) : null;

export const setToken = (token: string): void => {
  if (hasStorage()) localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  if (hasStorage()) localStorage.removeItem(TOKEN_KEY);
};

/** Drop the session and land on /login (a hard navigation, so no state survives). */
export const signOut = (): void => {
  clearToken();
  if (!hasStorage()) return;
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login');
  }
};
