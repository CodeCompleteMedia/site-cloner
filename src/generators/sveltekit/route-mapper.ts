import { createScopedLogger } from "../../utils/logger.js";
import type { RouteMapping, FrameworkRouteMap } from "../framework.js";

const log = createScopedLogger("route-mapper");

export function mapRoutesToSvelteKit(routes: RouteMapping[]): FrameworkRouteMap[] {
  const internalRoutes = routes.filter((r) => !r.isExternal);
  const mapped: FrameworkRouteMap[] = [];
  const seen = new Set<string>();

  for (const route of internalRoutes) {
    const urlPath = normalizePath(route.path);
    if (seen.has(urlPath)) continue;
    seen.add(urlPath);

    const filePath = urlPathToSvelteKitRoute(urlPath);
    const componentName = urlPathToComponentName(urlPath);

    mapped.push({ urlPath, filePath, componentName });
  }

  log.info(`Mapped ${mapped.length} routes to SvelteKit file routes`);
  return mapped;
}

function normalizePath(path: string): string {
  // Remove trailing slash, ensure leading slash
  let normalized = path.replace(/\/+$/, "") || "/";
  if (!normalized.startsWith("/")) normalized = "/" + normalized;
  // Remove query params and hash
  normalized = normalized.split("?")[0]!.split("#")[0]!;
  return normalized;
}

function urlPathToSvelteKitRoute(urlPath: string): string {
  if (urlPath === "/") return "src/routes/+page.svelte";

  // Convert URL segments to SvelteKit route directory structure
  const segments = urlPath.split("/").filter(Boolean);
  const routeDir = segments
    .map((seg) => {
      // Detect dynamic segments (e.g., numeric IDs, UUIDs)
      if (/^\d+$/.test(seg) || /^[a-f0-9-]{36}$/.test(seg)) {
        return "[id]";
      }
      return seg;
    })
    .join("/");

  return `src/routes/${routeDir}/+page.svelte`;
}

function urlPathToComponentName(urlPath: string): string {
  if (urlPath === "/") return "HomePage";

  return urlPath
    .split("/")
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase()))
    .join("") + "Page";
}
