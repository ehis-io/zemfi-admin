import { getToken, signOut } from './auth';

const BASE_URL =
  process.env.NEXT_PUBLIC_ZEMFI_API_URL ||
  'https://app.zemfi.ng/api/v1';

/** Every successful zemfi-backend response: the payload is under `data`. */
interface Envelope<T> {
  status: string;
  message: string;
  data: T;
}

/** The global error filter's shape. Only `message` is written for a reader. */
interface ErrorBody {
  success?: false;
  statusCode?: number;
  code?: string;
  message?: string | string[];
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string | null;

  constructor(message: string, statusCode: number, code: string | null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * A message safe to show the user. `ApiError` carries the backend's own text;
 * a bare fetch() failure (offline, DNS, CORS) throws a TypeError whose message
 * was never written for anyone, so it gets a generic one.
 */
export const friendlyErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof TypeError) return 'Check your connection and try again.';
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

const errorMessage = (body: unknown, fallback: string): string => {
  if (typeof body !== 'object' || body === null) return fallback;
  const { message } = body as ErrorBody;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' && message ? message : fallback;
};

const errorCode = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null) return null;
  const { code } = body as ErrorBody;
  return typeof code === 'string' ? code : null;
};

async function request<T>(endpoint: string, init: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...init, headers });

  // A 204 or a non-JSON error page must not blow up as a parse error.
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }

  if (response.status === 401) {
    signOut();
    throw new ApiError(
      errorMessage(body, 'Session expired. Please sign in again.'),
      401,
      errorCode(body),
    );
  }

  if (!response.ok) {
    throw new ApiError(
      errorMessage(body, `Request failed (${response.status})`),
      response.status,
      errorCode(body),
    );
  }

  return (body as Envelope<T>).data;
}

/** Build a query string, skipping empty values so `?q=&cursor=` never goes out. */
export const query = (params: Record<string, string | number | null | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
};

export const api = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'GET' });
  },
  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
};
