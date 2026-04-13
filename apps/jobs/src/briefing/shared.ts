import type {
  CanonicalArticleRecord,
  ClusterMemberRecord,
  NewsContextStoreState,
  StoryClusterRecord
} from '@news-context/shared-types';

export interface ClusterArticleSnapshot {
  readonly cluster: StoryClusterRecord;
  readonly members: readonly ClusterMemberRecord[];
  readonly articles: readonly CanonicalArticleRecord[];
  readonly publisher_names: readonly string[];
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

export function getArticleTimestamp(article: CanonicalArticleRecord): string {
  return article.published_at ?? article.updated_at ?? article.created_at;
}

export function isVisibleOperationalArticle(article: CanonicalArticleRecord): boolean {
  return new URL(article.canonical_url).hostname !== 'demo.news';
}

export function sortArticlesByRecency(left: CanonicalArticleRecord, right: CanonicalArticleRecord): number {
  return sortIsoDescending(getArticleTimestamp(left), getArticleTimestamp(right));
}

export function findClusterSnapshot(
  state: NewsContextStoreState,
  clusterId: string
): ClusterArticleSnapshot | null {
  const cluster = state.story_clusters.find((entry) => entry.id === clusterId);

  if (cluster === undefined) {
    return null;
  }

  const members = state.cluster_members
    .filter((entry) => entry.cluster_id === clusterId)
    .sort((left, right) => {
      if (left.rank_in_cluster !== null && right.rank_in_cluster !== null) {
        return left.rank_in_cluster - right.rank_in_cluster;
      }

      return right.score - left.score;
    });
  const articles = members
    .map((member) => state.canonical_articles.find((entry) => entry.id === member.article_id))
    .filter((article): article is CanonicalArticleRecord => article !== undefined)
    .sort(sortArticlesByRecency);
  const publisherNames = Array.from(
    new Set(
      articles.map((article) => {
        if (article.publisher_id === null) {
          return new URL(article.canonical_url).hostname;
        }

        return state.publishers.find((entry) => entry.id === article.publisher_id)?.name ?? new URL(article.canonical_url).hostname;
      })
    )
  );

  return {
    cluster,
    members,
    articles,
    publisher_names: publisherNames
  };
}

export function listClusterSnapshots(state: NewsContextStoreState): ClusterArticleSnapshot[] {
  return state.story_clusters
    .map((cluster) => findClusterSnapshot(state, cluster.id))
    .filter((entry): entry is ClusterArticleSnapshot => entry !== null);
}
