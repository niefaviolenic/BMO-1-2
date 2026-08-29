import { fetch as expoFetch } from 'expo/fetch';

import { API_V1_BASE_URL } from './config';
import { createRequestId } from './request-id';
import { ApiError, type ApiErrorEnvelope } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpAuthBridge = {
  getAccessToken(): string | null;
  refreshAccessToken(): Promise<string | null>;
};

export type HttpRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
};

let authBridge: HttpAuthBridge | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function configureHttpAuth(bridge: HttpAuthBridge | null): void {
  authBridge = bridge;
}

async function readError(response: Response): Promise<ApiError> {
  const fallback = new ApiError('INTERNAL_ERROR', response.status);

  try {
    const payload = (await response.json()) as ApiErrorEnvelope;
    if (payload && typeof payload.error === 'string') {
      return new ApiError(payload.error, response.status, payload.message);
    }
  } catch {
    return fallback;
  }

  return fallback;
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function resolveAccessToken(auth: boolean): Promise<string | null> {
  if (!auth) {
    return null;
  }

  return authBridge?.getAccessToken() ?? null;
}

async function refreshOnce(): Promise<string | null> {
  if (!authBridge) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = authBridge
      .refreshAccessToken()
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const auth = options.auth ?? true;
  const requestId = createRequestId();
  const url = path.startsWith('http') ? path : `${API_V1_BASE_URL}${path}`;

  const isFormData = isFormDataBody(options.body);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': requestId,
  };

  if (options.body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const resolveBody = (): BodyInit | undefined => {
    if (options.body === undefined) {
      return undefined;
    }
    if (isFormData) {
      return options.body as FormData;
    }
    return JSON.stringify(options.body);
  };

  const send = async (accessToken: string | null): Promise<Response> => {
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else {
      delete headers.Authorization;
    }

    const requestInit = {
      method,
      headers,
      body: resolveBody(),
    };

    // expo/fetch is required for Blob/File multipart bodies on native.
    const response = isFormData
      ? await expoFetch(url, requestInit)
      : await fetch(url, requestInit);
    return response as Response;
  };

  try {
    let accessToken = await resolveAccessToken(auth);
    let response = await send(accessToken);

    if (response.status === 401 && auth && !options.skipRefresh && authBridge) {
      const nextToken = await refreshOnce();
      if (nextToken && nextToken !== accessToken) {
        response = await send(nextToken);
      }
    }

    if (!response.ok) {
      const apiError = await readError(response);
      throw apiError;
    }

    return parseBody<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new ApiError('INTERNAL_ERROR', 0, 'Unable to save. Try again.');
    }

    throw new ApiError('NETWORK_ERROR', 0, 'Unable to reach Joy. Check your connection and try again.');
  }
}

function isFormDataBody(body: unknown): body is FormData {
  if (body == null || typeof FormData === 'undefined') {
    return false;
  }
  if (body instanceof FormData) {
    return true;
  }
  return Object.prototype.toString.call(body) === '[object FormData]';
}
