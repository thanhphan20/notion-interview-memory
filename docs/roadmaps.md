# Interview Memory — Roadmaps

Study roadmaps for the interview runway. `scripts/seed-roadmaps.ts` turns every
`# R<n> — ...` heading below into a **local note** (`notion_page_id = local:roadmap-r<n>`),
which the app then treats like any other note: generate drafts → approve → open-recall,
plus MCQs for the diagnostic.

These notes are not synced from Notion and carry no `sourceUrl`, so they show no
"Open Notion" button. Re-running the script updates them in place.

**A topic is done when you can explain it out loud, without notes, and answer one
follow-up question on it.** Reading is not done.

# R1 — 7-day sprint: close the four red items

Highest value per hour. All four are already open and blocking.

- **Day 1–2 · Node event loop** — the six phases (timers, pending callbacks, idle/prepare,
  poll, check, close), where microtasks drain, `process.nextTick` vs `Promise.then` vs
  `setTimeout(0)` vs `setImmediate`. Write the ordering of a mixed snippet and verify by running it.
- **Day 2 · Event-loop bug story** — one concrete production bug caused by ordering or a blocked
  loop, with what you changed. Add it to the story bank.
- **Day 3 · MongoDB aggregation pipeline** — `$match` → `$group` → `$lookup` → `$project` → `$sort`.
  Write one real query against the LifeHub content-service shape.
- **Day 3 · Mongo vs Postgres** — say out loud when a document store is right and when it is not,
  using your own two projects.
- **Day 4 · DDD vocabulary** — bounded context, aggregate, entity vs value object, repository,
  domain event. Map each to the 18-service decomposition, the strategy engine, and the outbox boundary.
- **Day 5 · RxJS** — Observable vs Promise, Subject vs BehaviorSubject, `mergeMap` vs `switchMap`
  vs `concatMap`, `catchError` / `retry` / `takeUntil`. Explain why a NestJS codebase is RxJS-shaped.
- **Day 6 · Story gaps** — outbox ordering and republish-on-mark-failure; the idempotency loser path
  on unique violation; idempotency of the compensating action in a saga.
- **Day 6 · Metric ownership** — write down how each number was measured: 40% idle time,
  sub-second latency, 60–70% content deployments, 900ms to 300ms, 500+ events/day.
- **Day 7 · Mock drill** — run the practice mode on Node + Mongo + DDD, out loud, and record yourself.

Done when: all four red items can be answered cold.

# R2 — Java core

The primary depth claim. An interviewer pushes hardest here.

- **OOP** — four pillars with a concrete example each; overloading vs overriding (compile-time vs
  runtime); abstract class vs interface; composition over inheritance.
- **Equality** — `==` vs `.equals()`, the `equals`/`hashCode` contract, immutability, the `String`
  pool and `intern()`, why a mutable field breaks a `HashMap` key.
- **Collections** — `ArrayList` vs `LinkedList` (real trade-offs, not dogma); `LinkedHashMap` as an
  LRU cache; `TreeMap` and `Comparable` vs `Comparator`; `HashSet` is a `HashMap`; `ConcurrentHashMap`
  vs `Collections.synchronizedMap`; fail-fast vs fail-safe iterators; why `Stack` is legacy.
- **HashMap internals** — hashing and spread, buckets, collision chains, treeify at 8 and untreeify
  at 6, load factor 0.75, resize by doubling, why capacity is a power of two.
- **Generics** — type erasure and what it breaks (no `new T[]`, no `instanceof T`); bounded type
  params; wildcards and PECS (`? extends` producer, `? super` consumer).
- **Exceptions** — checked vs unchecked, `finally` semantics, try-with-resources and `AutoCloseable`,
  suppressed exceptions, custom exceptions.
- **Streams** — laziness, intermediate vs terminal operations, `map` / `filter` / `flatMap` / `reduce`
  / `collect`, why `parallelStream` is usually a trap, `Optional` as a return type only.
- **JDK features** — `var`, records, sealed types, switch expressions, text blocks, pattern matching
  for `instanceof` and `switch`.

Done when: you can defend every collection and language choice you list on the CV.

# R3 — Java concurrency and the JVM

- **Threads** — lifecycle, `Runnable` vs `Callable`, `ExecutorService`, thread-pool sizing, why an
  unbounded queue hides overload, rejection policies.
- **Visibility vs atomicity** — `synchronized`, `volatile`, happens-before, `AtomicInteger`, CAS,
  and why `i++` is not atomic.
- **CompletableFuture** — `thenApply` vs `thenCompose` vs `thenCombine`, `allOf`, `exceptionally`,
  `handle`, and which thread runs the callback. Anchor this to the OPC UA control layer.
- **Virtual threads** — what they fix (blocking I/O at scale), what they do not (CPU-bound work), pinning.
- **Deadlock** — the four conditions, diagnosing from a thread dump, avoiding by lock ordering.
- **ThreadLocal** — correct use and the leak risk.
- **JVM** — class loading phases, runtime memory areas (heap, stack, metaspace), GC roots, minor vs
  full GC, `OutOfMemoryError` kinds vs `StackOverflowError`.
- **Leaks** — static collections, unclosed resources, `ThreadLocal`, unremoved listeners.

Done when: you can explain the `CompletableFuture` path in the robot control layer without notes.

# R4 — Spring core

- **IoC container** — `BeanFactory` vs `ApplicationContext`.
- **Bean lifecycle** — instantiate, populate, `*Aware`, `BeanPostProcessor`, `@PostConstruct`, ready,
  `@PreDestroy`. Place `@Autowired` and AOP proxies on this timeline.
- **Scopes** — singleton, prototype, request, session; the singleton-injecting-prototype trap and its
  three fixes (`ObjectProvider`, `@Lookup`, proxy).
- **Circular dependencies** — the three-level singleton cache, why constructor injection breaks it.
- **`@Configuration` proxying** — CGLIB, and why `@Bean` in a proxied config returns a singleton.
- **Auto-configuration** — `@ConditionalOnClass` / `@ConditionalOnMissingBean`,
  `AutoConfiguration.imports`, how to override a default bean.
- **Configuration** — externalized precedence, `@Value` vs `@ConfigurationProperties`, profiles.
- **AOP** — JDK dynamic proxy vs CGLIB, what cannot be advised (final, private).
- **`@Transactional` is AOP** — the self-invocation trap, proxy mode, propagation levels, isolation
  levels, `rollbackFor`, read-only, and never wrapping a broker publish or HTTP call in a transaction.
- **Spring MVC** — filter, `DispatcherServlet`, `HandlerMapping`, `HandlerAdapter`, argument resolvers,
  `HttpMessageConverter`; filters vs interceptors vs AOP; `@ControllerAdvice`; RFC 7807 problem details.
- **Validation** — Bean Validation, `@Valid` vs `@Validated`, custom validators.
- **Security** — filter chain, JWT resource server, method security, 401 vs 403, when CSRF matters.

Done when: you can walk the bean lifecycle and the `@Transactional` proxy path on a whiteboard.

# R5 — JPA, Hibernate and messaging

- **Persistence context** — entity states (transient, managed, detached, removed), dirty checking,
  flush modes, first-level cache, why two `findById` calls hit the database once.
- **Fetching** — `LAZY` vs `EAGER`, the real causes of `LazyInitializationException`, `@EntityGraph`,
  join fetch, `@BatchSize`, and the N+1 problem (how to detect it, three ways to fix it).
- **Mapping** — owning side, cascade types, orphan removal, bidirectional sync helpers,
  `equals`/`hashCode` on entities and the generated-id trap.
- **Locking** — `@Version` optimistic locking vs `@Lock(PESSIMISTIC_WRITE)` and `SELECT ... FOR UPDATE`.
  Anchor to the transactional booking workflow that prevents double reservations.
- **Queries** — derived queries, `@Query` JPQL vs native, projections, `Specification`, `Pageable`,
  `@Modifying` and the stale-context trap.
- **Schema** — `ddl-auto=validate` in production, migrations over `ddl-auto=update`.
- **AMQP** — connection/channel, exchange types (direct, topic, fanout, headers), bindings, routing
  keys, queues, vhost.
- **Delivery** — publisher confirms, manual vs auto ack, prefetch/QoS, DLX, TTL, retry queues,
  poison messages, and the fact that ordering is per-queue, not global.
- **Exactly-once** — at-least-once plus idempotent consumers plus the Outbox pattern, and why a broker
  cannot actually give you exactly-once.

Done when: the N+1 fix and the outbox delivery story both come out without hesitation.

# R6 — Node, NestJS and TypeScript

- **Event loop, again** — this time explaining it as if the interviewer will interrupt.
- **libuv** — thread pool size, which APIs use it and which do not.
- **Blocking** — what actually blocks the loop, and the fixes: `worker_threads`, `cluster`.
- **Streams** — readable/writable/transform, backpressure, `highWaterMark`, `.pipe` vs `pipeline`.
- **Modules** — CommonJS vs ESM, the `require` cache, circular dependencies, resolution algorithm.
- **Promises** — `all` vs `allSettled` vs `race` vs `any`, `AbortController`, unhandled rejections,
  and the special `'error'` event on `EventEmitter`.
- **Shutdown** — signals, draining, closing pools, `exitCode`.
- **Memory** — heap snapshots, `--max-old-space-size`, the four common leak sources.
- **NestJS modules** — a module as a dependency boundary, `@Global` and why to avoid it, dynamic
  modules (`forRoot` / `forRootAsync`).
- **NestJS DI** — custom providers (`useClass`, `useValue`, `useFactory`, `useExisting`), injection
  tokens, `forwardRef`; provider scopes and scope bubbling.
- **NestJS request lifecycle** — middleware, guards, interceptors, pipes, handler, interceptors,
  exception filters; `next.handle()` returns an Observable, not a Promise.
- **NestJS transport** — gateways and namespaces vs rooms; microservice transports,
  `@MessagePattern` vs `@EventPattern`, `send` vs `emit`, hybrid apps.
- **TypeScript** — `type` vs `interface`, utility types, `unknown` vs `any` vs `never`, decorators
  and `reflect-metadata`, and type erasure as the reason DTOs need runtime validation.

Done when: the Node and NestJS halves of the CV can be defended to the same depth as the Java half.

# R7 — Databases

- **Normalization** — 1NF to BCNF with one violation example each; denormalization justified by a
  read pattern or a historical snapshot.
- **Joins** — inner, left, right, full, self, and join cardinality pitfalls.
- **Aggregation** — `GROUP BY` vs `HAVING`, `COUNT(*)` vs `COUNT(column)`, NULL semantics.
- **Window functions** — `ROW_NUMBER` vs `RANK` vs `DENSE_RANK`, `PARTITION BY`, `LAG`/`LEAD`.
- **Duplicates** — business key, `GROUP BY ... HAVING COUNT(*) > 1`, `ROW_NUMBER() OVER (PARTITION BY ...)`.
- **Pagination** — `OFFSET` cost at depth vs keyset pagination.
- **Composite indexes** — column order (equality, then range, then sort); why `(a, b)` does not serve
  a query on `b` alone; covering, partial, unique and functional indexes; selectivity.
- **Index cost** — extra write work, storage, bloat, and when the planner ignores an index.
- **EXPLAIN ANALYZE** — node types, seq scan vs index scan vs bitmap, nested loop vs hash join vs
  merge join, estimated vs actual rows, `ANALYZE` for statistics.
- **Sargability** — never wrap the indexed column in a function; avoid `SELECT *`.
- **Materialized views** — refresh strategy and the staleness tradeoff.
- **Transactions** — ACID precisely; isolation levels and every anomaly (dirty read, non-repeatable
  read, phantom, lost update, write skew); MVCC; why long transactions hurt.
- **Locking** — shared vs exclusive, `FOR UPDATE` vs `FOR SHARE`, lock ordering, deadlock and retry,
  optimistic vs pessimistic.
- **Distributed** — why a local transaction cannot span two services, and why 2PC is avoided.
- **MongoDB** — compound index ESR rule, multikey/TTL/text indexes, the aggregation pipeline end to
  end, multi-document transactions and their cost.
- **Redis** — data types, eviction policies, RDB vs AOF, cache-aside, stampede, invalidation,
  `SET NX PX` locking, and what you actually cached and invalidated in the 900ms-to-300ms work.

Done when: the PostgreSQL performance story has grown into a full database round you can steer.

# R8 — CS fundamentals

A required-list item on a role already applied to.

- **Big-O applied to your own systems** — the 10,000-record aggregation, the scheduling loop over
  device state, index lookup, sort.
- **Data structures** — array, linked list, stack, queue, hash table, heap/priority queue, BST, graph,
  trie — and when each is the right tool.
- **Algorithms** — BFS/DFS, binary search, two pointers, sliding window, sorting and stability,
  recursion with memoization, dynamic programming basics, greedy.
- **Concurrency fundamentals** — race conditions, mutex vs semaphore, the four deadlock conditions.
- **Framing** — access-pattern reasoning from the PostgreSQL work, and scheduling optimization from
  the warehouse control system. Never imply coursework or competitive programming.

Done when: "walk me through how you would find X in this dataset" is answered from a real system.

# R9 — System design drills

Practise these out loud, one per week.

- **Email send pipeline at 1B events** — rate-limited producers, queue, idempotent workers, DLQ.
- **Webhook ingestion** — signature verification, replay protection, duplicate delivery, retries with
  backoff.
- **Order lifecycle across services** — saga, compensation, and idempotency of the compensating action.
- **A rate limiter** — token bucket vs leaky bucket vs fixed window, and why distributed rate limiting
  needs shared state.
- **Observability** — structured logs, correlation IDs, RED/USE metrics, health checks, alerting.
- **Resilience** — circuit breaker, bulkhead, timeout budgets, backpressure, graceful shutdown.

Done when: you can narrate a design and name its trade-offs without notes.

# R10 — Ongoing habits and open decisions

- **Never repeat a story twice** in the same session — build a second example per theme.
- **Answer the second half.** Restate the second part of a two-part question before finishing. This
  is the logged habit gap and it cost a round.
- **Re-read your own stories before a real round.** One internal contradiction has already been
  caught on transcript.
- **State tenure plainly** — 2 years 9 months, never rounded up.
- **English** — quote all three TOEIC figures separately (880 Listening & Reading, 100 Speaking,
  140 Writing). Never "fluent".
- **LifeHub** — always name it as a personal project, unprompted.
- **Open decision · the AWS claim** — the skills line lists `Cloud: AWS` with no supporting bullet,
  against three cloud-heavy live postings. Ground it with a real bullet, or cut the word.
- **Open decision · metric ownership** — one written line per number on how it was measured.

Done when: none of these surprises you in a round.
