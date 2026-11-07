import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const API = join(process.cwd(), "src", "app", "api");

/** Every route.ts under src/app/api, as an OpenAPI path ("/api/wants/{id}/sellers"). */
function routePaths(dir = API): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return routePaths(p);
    return e.name === "route.ts" ? ["/api/" + relative(API, dir).split(sep).join("/").replace(/\[(\w+)\]/g, "{$1}")] : [];
  });
}

describe("docs/openapi.yaml", () => {
  const spec = readFileSync(join(process.cwd(), "docs", "openapi.yaml"), "utf8");
  const documented = [...spec.matchAll(/^ {2}(\/api\/[^\s:]+):\s*$/gm)].map((m) => m[1]!);

  it("documents every API route, and only routes that exist", () => {
    expect(documented.sort()).toEqual(routePaths().sort());
  });

  it("gives every operation a unique operationId", () => {
    const ids = [...spec.matchAll(/operationId:\s*(\w+)/g)].map((m) => m[1]!);
    expect(ids.length).toBe(documented.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only refers to schemas, responses and parameters that are defined", () => {
    for (const [, kind, name] of spec.matchAll(/\$ref: "#\/components\/(\w+)\/(\w+)"/g)) {
      expect(spec, `${kind}/${name}`).toMatch(new RegExp(`^ {4}${name}:`, "m"));
    }
  });
});
