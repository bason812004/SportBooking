/**
 * Minimal in-memory stand-in for the Prisma client, used with `node:test`'s
 * `mock.module("../../config/db.js", ...)` so repository/service unit tests
 * never touch a real database. Pass only the model methods a given test
 * actually exercises; `$transaction` invokes the callback with the same fake
 * client (matching how the codebase always transacts against a single `tx`).
 */
export type FakeModel = Record<string, (...args: any[]) => any>;

export function createFakePrisma(models: Record<string, FakeModel>, options: { queryRaw?: (...args: any[]) => any } = {}) {
  const client: any = { ...models };
  client.$transaction = async (fn: any) => {
    if (typeof fn === "function") return fn(client);
    return Promise.all(fn);
  };
  if (options.queryRaw) client.$queryRaw = options.queryRaw;
  return client;
}

/**
 * Same idea as `createFakePrisma`, but for tests where the module under test
 * is reached through more than one static import hop (service -> repository
 * -> "../../config/db.js"). ESM caches each of those intermediate modules by
 * resolved URL, so `t.mock.module("../../config/db.js", ...)` called fresh
 * per test only reaches whichever repository module happens to load first;
 * every later test would silently keep hitting the first test's stub.
 *
 * This returns one stable client (mocked into "../../config/db.js" a single
 * time for the whole file) whose model methods are resolved lazily via
 * `setModels`, so each `it()` can reconfigure behavior without needing the
 * repository/service modules to be reloaded.
 */
export function createDynamicFakePrisma() {
  let current: Record<string, FakeModel> = {};
  let queryRaw: ((...args: any[]) => any) | undefined;
  const client: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "$transaction") {
          return async (fn: any) => (typeof fn === "function" ? fn(client) : Promise.all(fn));
        }
        if (prop === "$queryRaw" || prop === "$queryRawUnsafe") {
          return (...args: any[]) => {
            if (!queryRaw) throw new Error(`fakePrisma.${String(prop)} is not stubbed for this test -- pass queryRaw to setModels`);
            return queryRaw(...args);
          };
        }
        return new Proxy(
          {},
          {
            get(_inner, method) {
              return (...args: any[]) => {
                const model = current[prop as string];
                const fn = model?.[method as string];
                if (typeof fn !== "function") {
                  throw new Error(`fakePrisma.${String(prop)}.${String(method)} is not stubbed for this test`);
                }
                return fn(...args);
              };
            }
          }
        );
      }
    }
  );
  return {
    client,
    setModels(models: Record<string, FakeModel>, options: { queryRaw?: (...args: any[]) => any } = {}) {
      current = models;
      queryRaw = options.queryRaw;
    }
  };
}
