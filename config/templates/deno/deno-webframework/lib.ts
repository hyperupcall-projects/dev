import * as v from "valibot";

const routes = {};

export async function f<
  T extends keyof typeof routes,
  U extends (typeof routes)[T]["request"],
  V extends (typeof routes)[T]["response"],
>(url: T, params?: v.InferInput<U>): Promise<v.InferInput<V>> {
  const result1 = v.safeParse(routes[url].request, params);
  if (!result1.success) {
    throw result1.issues;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(result1.output, null, "\t"),
  });
  const output = await res.json();
  const result2 = v.safeParse(routes[url].response, output);
  if (!result2.success) {
    throw result2.issues;
  }
  return result2.output;
}

export function throwBadMeta(property: string): never {
  throw new Error(`Bad value for "import.meta.${property}"`);
}
