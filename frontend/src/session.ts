import type { QueryClient } from "@tanstack/react-query";

export async function clearSession(client: QueryClient) {
  // Stop in-flight responses before they can restore the previous user's data.
  await client.cancelQueries();
  // Keep the observed auth query and notify subscribers explicitly.
  client.setQueryData(["me"], null);
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
  client.getMutationCache().clear();
}
