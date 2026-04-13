import type { IncomingMessage } from 'node:http';

import type {
  CreateWatchlistRequest,
  DeviceIdentity,
  UpdateWatchlistRequest
} from '@news-context/shared-types';

import type {
  CreateWatchlistResult,
  FileNewsContextStore
} from '../repositories/file-store.js';
import {
  PlanLimitReachedStoreError,
  StoreConflictError,
  StoreNotFoundError
} from '../repositories/file-store.js';
import { readJsonBody } from './resolve.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseDeviceIdentity(
  request: IncomingMessage,
  bodyAnonId?: string,
  options: {
    readonly allowUserTokenAlias?: boolean | undefined;
  } = {}
): DeviceIdentity & { readonly app_version: string | null } {
  const deviceIdHeader = request.headers['x-device-id'];
  const appVersionHeader = request.headers['x-app-version'];
  const anonIdHeader = request.headers['x-anon-id'];
  const userTokenHeader = request.headers['x-user-token'];
  const userToken =
    typeof userTokenHeader === 'string' && userTokenHeader.trim() !== '' ? userTokenHeader.trim() : null;

  const device_id =
    typeof deviceIdHeader === 'string' && deviceIdHeader.trim() !== ''
      ? deviceIdHeader.trim()
      : options.allowUserTokenAlias
        ? userToken
        : null;
  const anon_id =
    typeof anonIdHeader === 'string' && anonIdHeader.trim() !== ''
      ? anonIdHeader.trim()
      : bodyAnonId ?? (options.allowUserTokenAlias ? userToken : null);

  if (device_id === null) {
    throw new Error('X-Device-Id header is required.');
  }

  if (anon_id === null) {
    throw new Error('anon_id is required.');
  }

  return {
    device_id,
    anon_id,
    app_version: typeof appVersionHeader === 'string' && appVersionHeader.trim() !== '' ? appVersionHeader.trim() : null
  };
}

export function parseCreateWatchlistRequest(value: unknown): CreateWatchlistRequest {
  if (!isRecord(value)) {
    throw new Error('Create watchlist payload must be an object.');
  }

  const clusterId = value['cluster_id'];

  if (typeof clusterId !== 'string' || clusterId.trim() === '') {
    throw new Error('cluster_id is required.');
  }

  const notificationsEnabled = value['notifications_enabled'];

  if (notificationsEnabled !== undefined && typeof notificationsEnabled !== 'boolean') {
    throw new Error('notifications_enabled must be a boolean when provided.');
  }

  const label = value['label'];

  if (label !== undefined && typeof label !== 'string') {
    throw new Error('label must be a string when provided.');
  }

  return {
    cluster_id: clusterId,
    ...(typeof label === 'string' ? { label } : {}),
    ...(typeof notificationsEnabled === 'boolean' ? { notifications_enabled: notificationsEnabled } : {})
  };
}

export async function readCreateWatchlistRequest(request: IncomingMessage): Promise<CreateWatchlistRequest> {
  return parseCreateWatchlistRequest(await readJsonBody(request));
}

export function parseUpdateWatchlistRequest(value: unknown): UpdateWatchlistRequest {
  if (!isRecord(value)) {
    throw new Error('Update watchlist payload must be an object.');
  }

  const label = value['label'];
  const notificationsEnabled = value['notifications_enabled'];

  if (label !== undefined && typeof label !== 'string') {
    throw new Error('label must be a string when provided.');
  }

  if (notificationsEnabled !== undefined && typeof notificationsEnabled !== 'boolean') {
    throw new Error('notifications_enabled must be a boolean when provided.');
  }

  if (label === undefined && notificationsEnabled === undefined) {
    throw new Error('At least one watchlist field must be provided.');
  }

  return {
    ...(typeof label === 'string' ? { label } : {}),
    ...(typeof notificationsEnabled === 'boolean' ? { notifications_enabled: notificationsEnabled } : {})
  };
}

export async function readUpdateWatchlistRequest(request: IncomingMessage): Promise<UpdateWatchlistRequest> {
  return parseUpdateWatchlistRequest(await readJsonBody(request));
}

export async function listWatchlistsForRequest(
  request: IncomingMessage,
  store: FileNewsContextStore
) {
  const identity = parseDeviceIdentity(request);
  return store.listWatchlists(identity);
}

export async function createWatchlistForRequest(
  request: IncomingMessage,
  store: FileNewsContextStore
): Promise<CreateWatchlistResult> {
  const payload = await readCreateWatchlistRequest(request);
  const identity = parseDeviceIdentity(request);
  return store.createWatchlist(identity, payload);
}

export async function updateWatchlistForRequest(
  request: IncomingMessage,
  store: FileNewsContextStore,
  watchlistId: string
) {
  const payload = await readUpdateWatchlistRequest(request);
  const identity = parseDeviceIdentity(request);
  return store.updateWatchlist(identity, watchlistId, payload);
}

export async function deleteWatchlistForRequest(
  request: IncomingMessage,
  store: FileNewsContextStore,
  watchlistId: string
): Promise<void> {
  const identity = parseDeviceIdentity(request);
  await store.deleteWatchlist(identity, watchlistId);
}

export function mapWatchlistError(error: unknown): {
  readonly statusCode: number;
  readonly payload: unknown;
} {
  if (error instanceof PlanLimitReachedStoreError) {
    return {
      statusCode: 402,
      payload: error.payload
    };
  }

  if (error instanceof StoreConflictError) {
    return {
      statusCode: 409,
      payload: {
        error: 'Conflict',
        message: error.message
      }
    };
  }

  if (error instanceof StoreNotFoundError) {
    return {
      statusCode: 404,
      payload: {
        error: 'Not Found',
        message: error.message
      }
    };
  }

  return {
    statusCode: 400,
    payload: {
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Invalid watchlist request.'
    }
  };
}
