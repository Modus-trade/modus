import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

const source = await readFile(
  new URL("../src/session.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { clearSession } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("logout notifies the mounted auth observer and removes private data", async () => {
  const client = new QueryClient();
  client.setQueryData(["me"], { id: 1 });
  client.setQueryData(["tickets"], [{ id: 12 }]);
  client.setQueryData(["users"], [{ id: 1 }]);
  const observer = new QueryObserver(client, {
    queryKey: ["me"],
    enabled: false,
  });
  const notifications = [];
  const unsubscribe = observer.subscribe((state) =>
    notifications.push(state.data),
  );
  await clearSession(client);
  assert.equal(observer.getCurrentResult().data, null);
  assert.equal(notifications.at(-1), null);
  assert.equal(client.getQueryData(["tickets"]), undefined);
  assert.equal(client.getQueryData(["users"]), undefined);
  client.setQueryData(["me"], { id: 2 });
  assert.equal(observer.getCurrentResult().data.id, 2);
  assert.equal(client.getQueryData(["tickets"]), undefined);
  unsubscribe();
  client.clear();
});

test("a delayed auth response cannot restore the logged-out account", async () => {
  const client = new QueryClient();
  client.setQueryData(["me"], { id: 1 });
  let resolveRequest;
  const request = client
    .fetchQuery({
      queryKey: ["me"],
      queryFn: () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    })
    .catch(() => {});
  await clearSession(client);
  resolveRequest({ id: 1 });
  await request;
  assert.equal(client.getQueryData(["me"]), null);
  client.clear();
});
