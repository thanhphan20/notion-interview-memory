export const USE_MOCK = false;

export const mockStats = {
  dueCount: 5,
  draftCount: 3,
  reviewCount: 12,
  mcqReviewCount: 0,
};

export const mockCards = [
  {
    id: 1,
    question: 'Explain the difference between a process and a thread in operating systems.',
    expectedAnswer:
      'A process is an independent program execution unit with its own isolated address space, resources, and process control block (PCB). A thread is the smallest unit of execution within a process, sharing the same address space and resources with sibling threads. Processes are heavyweight with higher creation/context-switch overhead, while threads are lightweight and enable efficient communication via shared memory.',
    rubric: [
      'Memory Isolation: Processes have separate address spaces; threads share within a process (30%)',
      'Overhead: Process creation/context-switch is expensive; threads are cheaper (25%)',
      'Communication: IPC (pipes, sockets) vs shared memory (25%)',
      'Independence: One process crash doesn\'t affect others; one thread crash can bring down the process (20%)',
    ],
    tags: ['Operating Systems', 'Fundamentals'],
  },
  {
    id: 2,
    question: 'How does indexing work in relational databases?',
    expectedAnswer:
      'Database indexing is a data structure technique (typically B+Tree or Hash) that speeds up data retrieval operations on a table. An index creates an ordered mapping of key values to physical row locations, allowing the database engine to find rows without scanning the entire table (full table scan). Trade-offs include slower writes (index must be updated) and additional storage space.',
    rubric: [
      'B+Tree structure and O(log n) search complexity (35%)',
      'Clustered vs non-clustered index differences (25%)',
      'Write performance trade-off — index maintenance on INSERT/UPDATE/DELETE (20%)',
      'Composite indexes and left-prefix rule (20%)',
    ],
    tags: ['Databases', 'System Design'],
  },
  {
    id: 3,
    question: 'What is the CAP theorem and how does it apply to distributed systems?',
    expectedAnswer:
      'The CAP theorem states that a distributed data store can only guarantee at most two of three properties simultaneously: Consistency (every read receives the most recent write), Availability (every request receives a response), and Partition Tolerance (system continues operating despite network failures). In practice, since network partitions are inevitable, systems must choose between CP (sacrifice availability) and AP (sacrifice consistency).',
    rubric: [
      'Define all three properties: Consistency, Availability, Partition Tolerance (30%)',
      'Explain that P is non-negotiable in distributed systems, so the real choice is CP vs AP (30%)',
      'Examples: CP = HBase, ZooKeeper; AP = Cassandra, DynamoDB (20%)',
      'Eventual consistency as a practical compromise (20%)',
    ],
    tags: ['Distributed Systems', 'System Design'],
  },
];

export const mockNotes = [
  {
    id: 1,
    title: 'System Design: Rate Limiting Algorithms',
    content:
      'Rate limiting controls the rate of traffic sent by a client. Common algorithms include: Token Bucket (tokens refill at constant rate, allows bursts), Leaky Bucket (requests processed at constant rate, smooths bursts), Fixed Window (count requests in fixed time window, edge case at boundaries), Sliding Window Log (tracks timestamps, precise but memory-intensive), and Sliding Window Counter (hybrid of fixed window and sliding log). Token bucket is most commonly used in production due to its simplicity and burst tolerance.',
    tags: ['System Design', 'Backend'],
    sourceUrl: 'https://notion.so/rate-limiting',
  },
  {
    id: 2,
    title: 'JavaScript: Event Loop and Async/Await',
    content:
      'JavaScript uses a single-threaded event loop model. The call stack executes synchronous code. Web APIs (setTimeout, fetch) delegate work to the background. When async operations complete, callbacks go to the microtask queue (Promises, queueMicrotask) or macrotask queue (setTimeout, setInterval). The event loop prioritizes microtasks over macrotasks. Async/await is syntactic sugar over Promises — await pauses execution of the async function until the Promise resolves, yielding the thread back to the event loop.',
    tags: ['JavaScript', 'Frontend'],
    sourceUrl: 'https://notion.so/js-event-loop',
  },
  {
    id: 3,
    title: 'Database Sharding Strategies',
    content:
      'Sharding horizontally partitions data across multiple database instances. Common strategies: Range-based (partition by key range, simple but can cause hot spots), Hash-based (hash the shard key, uniform distribution but resharding is painful), Directory-based (lookup table maps key to shard, flexible but introduces a single point of failure). Consistent hashing minimizes reshuffling when nodes are added/removed. Choosing a good shard key is critical — it should distribute data evenly and match query patterns.',
    tags: ['Databases', 'System Design'],
    sourceUrl: 'https://notion.so/sharding',
  },
  {
    id: 4,
    title: 'HTTP Caching Strategies',
    content:
      'HTTP caching improves performance by storing responses. Cache-Control headers: max-age (seconds), no-cache (revalidate with origin), no-store (don\'t cache), public/private. ETag validation: strong validator (byte-for-byte comparison) vs weak validator (semantic equivalence). Cache invalidation strategies: TTL-based, write-through (update cache on write), write-behind (async write to cache). Browser cache hierarchy: memory cache → disk cache → service worker → network.',
    tags: ['Backend', 'Networking'],
    sourceUrl: 'https://notion.so/http-caching',
  },
];

export const mockDrafts = [
  {
    id: 1,
    question: 'How does consistent hashing work and why is it used?',
    expectedAnswer:
      'Consistent hashing maps both nodes and keys to a circular hash ring. Each key is assigned to the next clockwise node. When a node is added or removed, only the keys in that segment need redistribution, not all keys. This minimizes reshuffling in distributed caches and databases.',
    rubric: [
      'Hash ring concept with key and node placement (30%)',
      'Only adjacent keys move on node join/leave (30%)',
      'Virtual nodes for load balancing (20%)',
      'Used in: DynamoDB, Cassandra, Discord (20%)',
    ],
    tags: ['Distributed Systems', 'System Design'],
  },
  {
    id: 2,
    question: 'Explain React reconciliation and the key prop.',
    expectedAnswer:
      'Reconciliation is React\'s diffing algorithm that determines what to update in the DOM when state or props change. It compares the new virtual DOM tree with the previous one using heuristics: same type = update in place, different type = unmount and remount. Keys help identify stable element identities across renders, enabling efficient reordering without destroying and recreating child components.',
    rubric: [
      'Virtual DOM diffing vs real DOM manipulation (30%)',
      'Element type comparison heuristic (20%)',
      'Key prop enables stable identity and list reordering (30%)',
      'Using index as key is an anti-pattern (20%)',
    ],
    tags: ['React', 'Frontend'],
  },
  {
    id: 3,
    question: 'What is the difference between SQL and NoSQL databases?',
    expectedAnswer:
      'SQL databases are relational with fixed schemas, ACID transactions, and powerful JOIN operations. NoSQL databases are non-relational with flexible schemas, designed for horizontal scaling, and often sacrifice ACID for performance. SQL excels at complex queries and data integrity; NoSQL excels at high-throughput, schema-less data, and rapid iteration.',
    rubric: [
      'Schema: fixed vs flexible (20%)',
      'Scaling: vertical vs horizontal (25%)',
      'Transactions: ACID vs BASE (20%)',
      'Use cases: banking (SQL) vs real-time analytics (NoSQL) (20%)',
      'Consistency model differences (15%)',
    ],
    tags: ['Databases', 'System Design'],
  },
];

export const mockReviews = [
  {
    id: 5,
    rating: 'good',
    userAnswer:
      'Consistent hashing places nodes and keys on a ring. Keys are assigned to the next clockwise node. When nodes change, only adjacent keys move. Virtual nodes improve balance.',
    aiFeedback: {
      summary: 'Solid. Mention specific systems like DynamoDB or Cassandra that use it.',
    },
    reviewedAt: '2026-06-22T14:00:00.000Z',
  },
  {
    id: 6,
    rating: 'hard',
    userAnswer:
      'React reconciliation compares virtual DOM trees. Keys help React identify which elements changed.',
    aiFeedback: {
      summary: 'Expand on the heuristics (same type = update, different = remount) and why index as key is problematic.',
    },
    reviewedAt: '2026-06-21T11:30:00.000Z',
  },
  {
    id: 7,
    rating: 'again',
    userAnswer:
      'SQL is relational, NoSQL is not. SQL is better.',
    aiFeedback: {
      summary: 'Too reductive. Explain specific trade-offs: ACID vs BASE, fixed vs flexible schema, vertical vs horizontal scaling.',
    },
    reviewedAt: '2026-06-20T09:00:00.000Z',
  },
  {
    id: 8,
    rating: 'easy',
    userAnswer:
      'HTTP caching uses Cache-Control headers like max-age and ETags. Browser cache hierarchy: memory, disk, service worker, network. Stale-while-revalidate enables background refresh.',
    aiFeedback: {
      summary: 'Excellent coverage. You could add CDN caching layers (reverse proxy, edge) for completeness.',
    },
    reviewedAt: '2026-06-19T16:45:00.000Z',
  },
  {
    id: 9,
    rating: 'good',
    userAnswer:
      'JavaScript event loop: call stack runs sync code, async callbacks go to microtask (Promise) or macrotask (setTimeout) queues. Microtasks run before macrotasks. Async/await is promise sugar.',
    aiFeedback: {
      summary: 'Strong answer. Consider mentioning requestAnimationFrame as part of the event loop cycle.',
    },
    reviewedAt: '2026-06-18T13:15:00.000Z',
  },
  {
    id: 10,
    rating: 'hard',
    userAnswer:
      'Sharding splits data across databases. Range and hash are common strategies.',
    aiFeedback: {
      summary: 'Brief. Explain consistent hashing, resharding challenges, and how to choose a good shard key.',
    },
    reviewedAt: '2026-06-17T10:00:00.000Z',
  },
  {
    id: 1,
    rating: 'good',
    userAnswer:
      'A process is an independent program with its own memory space. A thread is a lightweight unit of execution that shares memory with other threads in the same process. Context switching between threads is faster because they share the same address space.',
    aiFeedback: {
      summary:
        'Good foundational understanding. Consider also mentioning that threads have their own stack and registers, and that IPC mechanisms are needed for process communication vs shared memory for threads.',
    },
    reviewedAt: '2026-06-25T10:30:00.000Z',
  },
  {
    id: 2,
    rating: 'again',
    userAnswer:
      'CAP theorem is about Consistency, Availability, and Partition Tolerance. You can only have two of three.',
    aiFeedback: {
      summary:
        'Too brief. Explain that Partition Tolerance is mandatory in distributed systems, so the real choice is between CP and AP. Provide concrete examples like HBase (CP) vs Cassandra (AP).',
    },
    reviewedAt: '2026-06-25T09:15:00.000Z',
  },
  {
    id: 3,
    rating: 'easy',
    userAnswer:
      'Database indexing uses B+Tree structures to enable O(log n) lookups instead of O(n) full table scans. Clustered indexes store actual row data in leaf nodes, while non-clustered indexes store pointers. The trade-off is slower writes because each index must be updated on INSERT/UPDATE/DELETE.',
    aiFeedback: {
      summary:
        'Excellent. You covered the key points well. Consider adding that composite indexes follow the left-prefix rule, and that covering indexes can eliminate table lookups entirely.',
    },
    reviewedAt: '2026-06-24T22:45:00.000Z',
  },
  {
    id: 4,
    rating: 'hard',
    userAnswer:
      'Rate limiting uses token bucket or fixed window. Token bucket allows bursts.',
    aiFeedback: {
      summary:
        'Surface-level answer. Explain the difference between token bucket and leaky bucket, describe the sliding window counter algorithm, and mention real-world uses like API gateways (Kong, AWS API Gateway).',
    },
    reviewedAt: '2026-06-24T18:00:00.000Z',
  },
];

export const mockSettings = {
  notion: {
    token: 'secret_xxxxxxxxxxxx',
    databaseId: 'abc123def456',
    titleProperty: 'Name',
    topicProperty: 'Topic',
    topics: ['System Design', 'JavaScript', 'Databases', 'Algorithms'],
  },
  ai: {
    provider: 'offline',
    apiKey: '',
    baseUrl: '',
    model: '',
  },
};
