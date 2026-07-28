/**
 * Graph export for knowledge graph JSON (used by knowledge-graph-auto-trigger).
 */

export interface GraphNode {
  id: string;
  label: string;
  type: "keyword" | "entity" | "concept" | "cluster";
  wordpress_posts?: string[];
  post_count?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: "semantic" | "cooccurrence" | "gsc" | "ai";
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    site_id: string;
    generated_at: string;
    total_keywords?: number;
    total_clusters?: number;
    total_posts: number;
    total_edges?: number;
  };
}

export interface GraphExportData {
  metadata: {
    site_id: string;
    generated_at: string;
    total_keywords: number;
    total_connections: number;
    total_posts: number;
  };
  keywords: Array<{
    keyword: string;
    post_count: number;
    connections: string[];
    connection_count: number;
  }>;
  connections: Array<{
    source: string;
    target: string;
    strength: number;
  }>;
}

export function exportGraphToJSON(graph: KnowledgeGraph): GraphExportData {
  const nodeMap = new Map<string, string>();
  graph.nodes.forEach((node) => {
    nodeMap.set(node.id, node.label);
  });

  const connectionCounts = new Map<string, number>();
  const connectionsByKeyword = new Map<string, Set<string>>();

  graph.edges.forEach((edge) => {
    const sourceLabel = nodeMap.get(edge.source);
    const targetLabel = nodeMap.get(edge.target);

    if (sourceLabel && targetLabel) {
      connectionCounts.set(sourceLabel, (connectionCounts.get(sourceLabel) || 0) + 1);
      connectionCounts.set(targetLabel, (connectionCounts.get(targetLabel) || 0) + 1);

      if (!connectionsByKeyword.has(sourceLabel)) {
        connectionsByKeyword.set(sourceLabel, new Set());
      }
      if (!connectionsByKeyword.has(targetLabel)) {
        connectionsByKeyword.set(targetLabel, new Set());
      }
      connectionsByKeyword.get(sourceLabel)!.add(targetLabel);
      connectionsByKeyword.get(targetLabel)!.add(sourceLabel);
    }
  });

  const keywords = graph.nodes.map((node) => ({
    keyword: node.label,
    post_count: node.post_count || node.wordpress_posts?.length || 0,
    connections: Array.from(connectionsByKeyword.get(node.label) || []),
    connection_count: connectionCounts.get(node.label) || 0,
  }));

  const connections = graph.edges
    .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
    .map((edge) => ({
      source: nodeMap.get(edge.source)!,
      target: nodeMap.get(edge.target)!,
      strength: edge.weight,
    }));

  const totalPosts = graph.nodes.reduce((sum, node) => {
    return sum + (node.post_count || node.wordpress_posts?.length || 0);
  }, 0);

  return {
    metadata: {
      site_id: graph.metadata.site_id,
      generated_at: graph.metadata.generated_at,
      total_keywords: graph.nodes.length,
      total_connections: graph.edges.length,
      total_posts: totalPosts,
    },
    keywords,
    connections,
  };
}
