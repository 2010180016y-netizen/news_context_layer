import { randomUUID } from 'node:crypto';

import type {
  ClusterMemberRecord,
  PersistedArticleFeature,
  ResolvedArticleFeatureView,
  ScoredRelatedArticle,
  StoryClusterRecord,
  StoryClusterStatus
} from '@news-context/shared-types';

import type { FileNewsContextStore } from '../repositories/file-store.js';

const CLUSTER_MEMBER_THRESHOLD = 0.62;
const ACTIVE_CLUSTER_WINDOW_HOURS = 72;
const WARM_CLUSTER_WINDOW_HOURS = 24 * 7;

export interface ClusterSnapshot {
  readonly cluster: StoryClusterRecord;
  readonly members: readonly ResolvedArticleFeatureView[];
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function resolveClusterStatus(lastSeenAt: string, nowIso: string): StoryClusterStatus {
  const deltaHours = Math.max(0, Date.parse(nowIso) - Date.parse(lastSeenAt)) / (1000 * 60 * 60);

  if (deltaHours <= ACTIVE_CLUSTER_WINDOW_HOURS) {
    return 'active';
  }

  if (deltaHours <= WARM_CLUSTER_WINDOW_HOURS) {
    return 'warm';
  }

  return 'archived';
}

function countTopItems(values: readonly string[], limit: number): string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function buildClusterLabel(
  sourceFeature: PersistedArticleFeature,
  memberFeatures: readonly PersistedArticleFeature[]
): string {
  const topEntities = countTopItems(
    memberFeatures.flatMap((feature) => feature.entities_json),
    2
  );

  if (topEntities.length > 0) {
    return topEntities.join(' / ');
  }

  return sourceFeature.title_tokens.slice(0, 3).join(' / ') || 'news-cluster';
}

function publishedOrCreatedAt(member: ResolvedArticleFeatureView): string {
  return member.article.published_at ?? member.article.created_at;
}

function sortMembers(left: ResolvedArticleFeatureView, right: ResolvedArticleFeatureView): number {
  const leftPublished = Date.parse(publishedOrCreatedAt(left));
  const rightPublished = Date.parse(publishedOrCreatedAt(right));

  return rightPublished - leftPublished;
}

function getClusterArticleViews(
  clusterId: string,
  state: Awaited<ReturnType<FileNewsContextStore['readState']>>
): ResolvedArticleFeatureView[] {
  const members = state.cluster_members.filter((member) => member.cluster_id === clusterId);

  return members
    .map((member) => {
      const article = state.canonical_articles.find((entry) => entry.id === member.article_id);
      const feature = state.article_features.find((entry) => entry.article_id === member.article_id);

      if (article === undefined || feature === undefined) {
        return undefined;
      }

      const publisher =
        article.publisher_id === null
          ? null
          : state.publishers.find((entry) => entry.id === article.publisher_id)?.name ?? null;

      return {
        article,
        feature,
        publisher_name: publisher
      } satisfies ResolvedArticleFeatureView;
    })
    .filter((entry): entry is ResolvedArticleFeatureView => entry !== undefined)
    .sort(sortMembers);
}

export class ClusterService {
  public constructor(private readonly store: FileNewsContextStore) {}

  public async syncCluster(params: {
    sourceArticleId: string;
    sourceFeature: PersistedArticleFeature;
    sourceView: ResolvedArticleFeatureView;
    scoredCandidates: readonly ScoredRelatedArticle[];
    nowIso?: string | undefined;
  }): Promise<ClusterSnapshot> {
    const nowIso = params.nowIso ?? new Date().toISOString();

    return this.store.writeState((state) => {
      const joinableCandidates = params.scoredCandidates.filter(
        (candidate) => candidate.score >= CLUSTER_MEMBER_THRESHOLD
      );
      const existingSourceMember = state.cluster_members.find(
        (member) => member.article_id === params.sourceArticleId
      );
      const candidateMembers = state.cluster_members.filter((member) =>
        joinableCandidates.some((candidate) => candidate.article.id === member.article_id)
      );

      let cluster =
        existingSourceMember === undefined
          ? undefined
          : state.story_clusters.find((entry) => entry.id === existingSourceMember.cluster_id);

      if (cluster === undefined && candidateMembers.length > 0) {
        const rankedClusterIds = candidateMembers
          .map((member) => {
            const scoredCandidate = joinableCandidates.find((candidate) => candidate.article.id === member.article_id);

            return {
              cluster_id: member.cluster_id,
              score: scoredCandidate?.score ?? 0
            };
          })
          .sort((left, right) => right.score - left.score);

        cluster = state.story_clusters.find((entry) => entry.id === rankedClusterIds[0]?.cluster_id);
      }

      if (cluster === undefined) {
        cluster = {
          id: randomUUID(),
          label: buildClusterLabel(params.sourceFeature, [params.sourceFeature]),
          status: 'active',
          first_seen_at: params.sourceView.article.published_at ?? params.sourceView.article.created_at,
          last_seen_at: params.sourceView.article.published_at ?? params.sourceView.article.created_at,
          article_count: 1,
          top_entities_json: params.sourceFeature.entities_json.slice(0, 3),
          top_numbers_json: params.sourceFeature.numbers_json.slice(0, 2),
          created_at: nowIso,
          updated_at: nowIso
        };
        state.story_clusters.push(cluster);
      }

      const membershipMap = new Map<string, ClusterMemberRecord>();

      for (const member of state.cluster_members.filter((entry) => entry.cluster_id === cluster.id)) {
        membershipMap.set(member.article_id, member);
      }

      const sourceMember = membershipMap.get(params.sourceArticleId);

      if (sourceMember === undefined) {
        state.cluster_members.push({
          id: randomUUID(),
          cluster_id: cluster.id,
          article_id: params.sourceArticleId,
          score: 1,
          rank_in_cluster: null,
          is_primary: true,
          created_at: nowIso
        });
      } else {
        sourceMember.score = 1;
        sourceMember.is_primary = true;
      }

      for (const candidate of joinableCandidates) {
        const existingMember = membershipMap.get(candidate.article.id);

        if (existingMember === undefined) {
          state.cluster_members.push({
            id: randomUUID(),
            cluster_id: cluster.id,
            article_id: candidate.article.id,
            score: round(candidate.score),
            rank_in_cluster: null,
            is_primary: false,
            created_at: nowIso
          });
          continue;
        }

        existingMember.score = round(Math.max(existingMember.score, candidate.score));
      }

      const memberViews = getClusterArticleViews(cluster.id, state);
      const memberFeatureMap = new Map(memberViews.map((view) => [view.article.id, view.feature]));
      const clusterMembers = state.cluster_members
        .filter((entry) => entry.cluster_id === cluster.id)
        .sort((left, right) => right.score - left.score);

      clusterMembers.forEach((member, index) => {
        member.rank_in_cluster = index + 1;
      });

      const firstSeenAt = memberViews.reduce(
        (earliest, member) => {
          const candidate = publishedOrCreatedAt(member);
          return Date.parse(candidate) < Date.parse(earliest) ? candidate : earliest;
        },
        publishedOrCreatedAt(memberViews[0] ?? params.sourceView)
      );
      const lastSeenAt = memberViews.reduce(
        (latest, member) => {
          const candidate = publishedOrCreatedAt(member);
          return Date.parse(candidate) > Date.parse(latest) ? candidate : latest;
        },
        publishedOrCreatedAt(memberViews[0] ?? params.sourceView)
      );
      const features = memberViews
        .map((member) => memberFeatureMap.get(member.article.id))
        .filter((feature): feature is PersistedArticleFeature => feature !== undefined);

      cluster.label = buildClusterLabel(params.sourceFeature, features);
      cluster.status = resolveClusterStatus(lastSeenAt, nowIso);
      cluster.first_seen_at = firstSeenAt;
      cluster.last_seen_at = lastSeenAt;
      cluster.article_count = clusterMembers.length;
      cluster.top_entities_json = countTopItems(
        features.flatMap((feature) => feature.entities_json),
        3
      );
      cluster.top_numbers_json = countTopItems(
        features.flatMap((feature) => feature.numbers_json),
        2
      );
      cluster.updated_at = nowIso;

      return {
        cluster,
        members: getClusterArticleViews(cluster.id, state)
      } satisfies ClusterSnapshot;
    });
  }
}
