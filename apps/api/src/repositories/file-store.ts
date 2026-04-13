import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type CheckoutPlanCode,
  createEmptyStoreState,
  hydrateStoreState,
  type CreateWatchlistRequest,
  type DeviceIdentity,
  type EventAcceptedResponse,
  type EventRequest,
  type NewsContextStoreState,
  type ProfileResponse,
  type SubscriptionPlanCode,
  type SubscriptionRecord,
  type SubscriptionStatus,
  type WatchlistItem,
  type WatchlistLimitErrorResponse,
  type WatchlistListResponse,
  type WatchlistRecord
} from '@news-context/shared-types';

function getWatchlistLimit(planCode: SubscriptionPlanCode): number {
  return planCode === 'free' ? 1 : 50;
}

function isPaidPlan(planCode: SubscriptionPlanCode): boolean {
  return planCode !== 'free';
}

function resolveEffectiveSubscription(
  subscription: SubscriptionRecord | undefined
): {
  readonly plan_code: SubscriptionPlanCode;
  readonly status: SubscriptionStatus;
  readonly expires_at: string | null;
} {
  if (subscription === undefined) {
    return {
      plan_code: 'free',
      status: 'active',
      expires_at: null
    };
  }

  if (isPaidPlan(subscription.plan_code) && subscription.status !== 'active' && subscription.status !== 'grace_period') {
    return {
      plan_code: 'free',
      status: 'active',
      expires_at: null
    };
  }

  return {
    plan_code: subscription.plan_code,
    status: subscription.status,
    expires_at: subscription.expires_at
  };
}

function sortIsoDescending(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right.localeCompare(left);
}

function getLatestSubscription(
  state: NewsContextStoreState,
  deviceId: string
): SubscriptionRecord | undefined {
  return state.subscriptions
    .filter((subscription) => subscription.device_id === deviceId)
    .sort((left, right) => sortIsoDescending(left.started_at ?? left.created_at, right.started_at ?? right.created_at))[0];
}

function ensureDeviceMutable(
  state: NewsContextStoreState,
  identity: DeviceIdentityInput,
  nowIso: string
): { device_id: string; anon_id: string; user_id: string | null } {
  const existingDevice = state.devices.find((device) => device.id === identity.device_id);

  if (existingDevice === undefined) {
    state.devices.push({
      id: identity.device_id,
      anon_id: identity.anon_id,
      user_id: null,
      platform: 'chrome_extension',
      app_version: identity.app_version ?? null,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso
    });
  } else {
    existingDevice.anon_id = identity.anon_id;
    existingDevice.app_version = identity.app_version ?? existingDevice.app_version;
    existingDevice.last_seen_at = nowIso;
    existingDevice.updated_at = nowIso;
  }

  let subscription = getLatestSubscription(state, identity.device_id);

  if (subscription === undefined) {
    subscription = {
      id: `subscription_${randomUUID()}`,
      user_id: null,
      device_id: identity.device_id,
      plan_code: 'free',
      status: 'active',
      provider: null,
      provider_ref: null,
      started_at: nowIso,
      expires_at: null,
      created_at: nowIso,
      updated_at: nowIso
    };
    state.subscriptions.push(subscription);
  } else if (
    subscription.plan_code === 'free' &&
    subscription.status !== 'active' &&
    subscription.status !== 'grace_period'
  ) {
    subscription.status = 'active';
    subscription.updated_at = nowIso;
  }

  return {
    device_id: identity.device_id,
    anon_id: identity.anon_id,
    user_id: null
  };
}

function getProfileFromState(state: NewsContextStoreState, identity: DeviceIdentity): ProfileResponse {
  const subscription = getLatestSubscription(state, identity.device_id);
  const effectiveSubscription = resolveEffectiveSubscription(subscription);
  const planCode = effectiveSubscription.plan_code;
  const limitCount = getWatchlistLimit(planCode);
  const watchlistsUsed = state.watchlists.filter((watchlist) => watchlist.device_id === identity.device_id).length;

  return {
    anon_id: identity.anon_id,
    user_id: null,
    plan: {
      code: planCode,
      status: effectiveSubscription.status,
      expires_at: effectiveSubscription.expires_at
    },
    limits: {
      watchlists_max: limitCount,
      watchlists_used: watchlistsUsed,
      briefing_enabled: isPaidPlan(planCode)
    }
  };
}

function buildWatchlistItem(
  state: NewsContextStoreState,
  watchlist: WatchlistRecord,
  limitReached: boolean
): WatchlistItem {
  const cluster = state.story_clusters.find((entry) => entry.id === watchlist.cluster_id);
  const newArticleCount = state.cluster_members.filter(
    (member) => member.cluster_id === watchlist.cluster_id && member.created_at > watchlist.created_at
  ).length;

  return {
    id: watchlist.id,
    cluster_id: watchlist.cluster_id,
    label: watchlist.label ?? cluster?.label ?? '저장한 이슈',
    notifications_enabled: watchlist.notifications_enabled,
    last_seen_at: cluster?.last_seen_at ?? watchlist.updated_at,
    new_article_count: newArticleCount,
    plan_limit_reached: limitReached
  };
}

function buildWatchlistListFromState(
  state: NewsContextStoreState,
  identity: DeviceIdentity
): WatchlistListResponse {
  const profile = getProfileFromState(state, identity);
  const limitReached = profile.limits.watchlists_used >= profile.limits.watchlists_max;
  const items = state.watchlists
    .filter((watchlist) => watchlist.device_id === identity.device_id)
    .sort((left, right) => sortIsoDescending(left.updated_at, right.updated_at))
    .map((watchlist) => buildWatchlistItem(state, watchlist, limitReached));

  return { items };
}

export interface DeviceIdentityInput extends DeviceIdentity {
  readonly app_version?: string | null;
}

export interface CreateWatchlistResult {
  readonly item: WatchlistItem;
  readonly profile: ProfileResponse;
}

export interface ActivateSubscriptionInput {
  readonly plan_code: CheckoutPlanCode;
  readonly provider: string;
  readonly provider_ref: string;
}

export class StoreConflictError extends Error {}

export class StoreNotFoundError extends Error {}

export class PlanLimitReachedStoreError extends Error {
  public readonly payload: WatchlistLimitErrorResponse;

  public constructor(payload: WatchlistLimitErrorResponse) {
    super(payload.message);
    this.payload = payload;
  }
}

export function resolveDefaultStorePath(): string {
  const configuredPath = process.env['DEV_STORE_PATH'];

  if (configuredPath !== undefined && configuredPath.trim() !== '') {
    return configuredPath;
  }

  return fileURLToPath(new URL('../../../../infra/dev-data/news-context.store.json', import.meta.url));
}

export class FileNewsContextStore {
  public readonly filePath: string;

  public constructor(filePath: string = resolveDefaultStorePath()) {
    this.filePath = filePath;
  }

  public async readState(): Promise<NewsContextStoreState> {
    try {
      const contents = await readFile(this.filePath, 'utf8');
      return hydrateStoreState(JSON.parse(contents) as unknown);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return createEmptyStoreState();
      }

      throw error;
    }
  }

  public async writeState<T>(mutator: (state: NewsContextStoreState) => Promise<T> | T): Promise<T> {
    const state = await this.readState();
    const result = await mutator(state);
    state.meta.updated_at = new Date().toISOString();

    await mkdir(dirname(this.filePath), { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, this.filePath);

    return result;
  }

  public async ensureDevice(identity: DeviceIdentityInput): Promise<ProfileResponse> {
    return this.writeState((state) => {
      const nowIso = new Date().toISOString();
      const resolvedIdentity = ensureDeviceMutable(state, identity, nowIso);
      return getProfileFromState(state, resolvedIdentity);
    });
  }

  public async getProfile(identity: DeviceIdentityInput): Promise<ProfileResponse> {
    return this.writeState((state) => {
      const nowIso = new Date().toISOString();
      const resolvedIdentity = ensureDeviceMutable(state, identity, nowIso);
      return getProfileFromState(state, resolvedIdentity);
    });
  }

  public async listWatchlists(identity: DeviceIdentityInput): Promise<WatchlistListResponse> {
    return this.writeState((state) => {
      const nowIso = new Date().toISOString();
      const resolvedIdentity = ensureDeviceMutable(state, identity, nowIso);
      return buildWatchlistListFromState(state, resolvedIdentity);
    });
  }

  public async createWatchlist(
    identity: DeviceIdentityInput,
    request: CreateWatchlistRequest
  ): Promise<CreateWatchlistResult> {
    return this.writeState((state) => {
      const nowIso = new Date().toISOString();
      const resolvedIdentity = ensureDeviceMutable(state, identity, nowIso);
      const duplicate = state.watchlists.find(
        (watchlist) =>
          watchlist.device_id === resolvedIdentity.device_id && watchlist.cluster_id === request.cluster_id
      );

      if (duplicate !== undefined) {
        throw new StoreConflictError('This cluster is already saved.');
      }

      const profile = getProfileFromState(state, resolvedIdentity);

      if (profile.limits.watchlists_used >= profile.limits.watchlists_max) {
        throw new PlanLimitReachedStoreError({
          error: 'plan_limit_reached',
          message: 'Free 플랜은 이슈 1개까지만 저장할 수 있습니다.',
          plan_code: profile.plan.code,
          used_count: profile.limits.watchlists_used,
          limit_count: profile.limits.watchlists_max,
          trigger_type: 'watchlist_limit'
        });
      }

      const cluster = state.story_clusters.find((entry) => entry.id === request.cluster_id);

      if (cluster === undefined) {
        throw new StoreNotFoundError('Requested cluster was not found.');
      }

      const nextRecord: WatchlistRecord = {
        id: `watchlist_${randomUUID()}`,
        user_id: null,
        device_id: resolvedIdentity.device_id,
        cluster_id: request.cluster_id,
        label: request.label ?? cluster.label,
        notifications_enabled: request.notifications_enabled ?? true,
        created_at: nowIso,
        last_viewed_at: null,
        updated_at: nowIso
      };

      state.watchlists.push(nextRecord);

      const nextProfile = getProfileFromState(state, resolvedIdentity);

      return {
        item: buildWatchlistItem(
          state,
          nextRecord,
          nextProfile.limits.watchlists_used >= nextProfile.limits.watchlists_max
        ),
        profile: nextProfile
      };
    });
  }

  public async updateWatchlist(
    identity: DeviceIdentityInput,
    watchlistId: string,
    request: {
      readonly label?: string | undefined;
      readonly notifications_enabled?: boolean | undefined;
    }
  ): Promise<WatchlistItem> {
    return this.writeState((state) => {
      const nowIso = new Date().toISOString();
      const resolvedIdentity = ensureDeviceMutable(state, identity, nowIso);
      const watchlist = state.watchlists.find(
        (entry) => entry.id === watchlistId && entry.device_id === resolvedIdentity.device_id
      );

      if (watchlist === undefined) {
        throw new StoreNotFoundError('Requested watchlist was not found.');
      }

      if (request.label !== undefined) {
        watchlist.label = request.label;
      }

      if (request.notifications_enabled !== undefined) {
        watchlist.notifications_enabled = request.notifications_enabled;
      }

      watchlist.updated_at = nowIso;

      const profile = getProfileFromState(state, resolvedIdentity);

      return buildWatchlistItem(
        state,
        watchlist,
        profile.limits.watchlists_used >= profile.limits.watchlists_max
      );
    });
  }

  public async deleteWatchlist(identity: DeviceIdentityInput, watchlistId: string): Promise<void> {
    await this.writeState((state) => {
      const nowIso = new Date().toISOString();
      const resolvedIdentity = ensureDeviceMutable(state, identity, nowIso);
      const index = state.watchlists.findIndex(
        (entry) => entry.id === watchlistId && entry.device_id === resolvedIdentity.device_id
      );

      if (index === -1) {
        throw new StoreNotFoundError('Requested watchlist was not found.');
      }

      state.watchlists.splice(index, 1);
    });
  }

  public async createEvent(
    identity: DeviceIdentityInput,
    request: EventRequest
  ): Promise<EventAcceptedResponse> {
    return this.writeState((state) => {
      const nowIso = new Date().toISOString();
      const resolvedIdentity = ensureDeviceMutable(state, identity, nowIso);

      state.events.push({
        id: `event_${randomUUID()}`,
        anon_id: request.anon_id,
        user_id: request.user_id ?? resolvedIdentity.user_id,
        device_id: resolvedIdentity.device_id,
        event_name: request.event_name,
        event_props: { ...(request.event_props ?? {}) },
        occurred_at: request.ts,
        created_at: nowIso
      });

      return {
        accepted: true,
        event_name: request.event_name
      };
    });
  }

  public async activateSubscription(
    identity: DeviceIdentityInput,
    input: ActivateSubscriptionInput
  ): Promise<ProfileResponse> {
    return this.writeState((state) => {
      const nowIso = new Date().toISOString();
      const resolvedIdentity = ensureDeviceMutable(state, identity, nowIso);
      const existing = state.subscriptions.find(
        (subscription) =>
          subscription.device_id === resolvedIdentity.device_id &&
          subscription.provider_ref === input.provider_ref &&
          subscription.plan_code === input.plan_code
      );

      if (existing !== undefined) {
        existing.status = 'active';
        existing.updated_at = nowIso;
        existing.started_at = existing.started_at ?? nowIso;
        existing.expires_at = null;
        return getProfileFromState(state, resolvedIdentity);
      }

      const latestSubscription = getLatestSubscription(state, resolvedIdentity.device_id);

      if (latestSubscription !== undefined && latestSubscription.plan_code === 'free') {
        latestSubscription.plan_code = input.plan_code;
        latestSubscription.status = 'active';
        latestSubscription.provider = input.provider;
        latestSubscription.provider_ref = input.provider_ref;
        latestSubscription.started_at = nowIso;
        latestSubscription.expires_at = null;
        latestSubscription.updated_at = nowIso;
        return getProfileFromState(state, resolvedIdentity);
      }

      state.subscriptions.push({
        id: `subscription_${randomUUID()}`,
        user_id: null,
        device_id: resolvedIdentity.device_id,
        plan_code: input.plan_code,
        status: 'active',
        provider: input.provider,
        provider_ref: input.provider_ref,
        started_at: nowIso,
        expires_at: null,
        created_at: nowIso,
        updated_at: nowIso
      });

      return getProfileFromState(state, resolvedIdentity);
    });
  }
}
