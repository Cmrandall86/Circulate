import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE")!;

const RAW_ALLOWED = Deno.env.get("ALLOW_ORIGINS")
  ?? "http://localhost:5173,https://use-circulate.netlify.app";
const ALLOWED_ORIGINS = RAW_ALLOWED.split(",").map((s) => s.trim());

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith("--circulate.netlify.app")) return true;
  } catch { /* ignore */ }
  return false;
}

function corsHeadersFor(origin: string | null): HeadersInit {
  const allowOrigin = isAllowedOrigin(origin) ? origin! : (ALLOWED_ORIGINS[0] || "*");
  return {
    "content-type": "application/json",
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info, prefer, range",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeadersFor(origin),
  });
}

console.log("admin-items edge function starting:", {
  hasUrl: !!SUPABASE_URL,
  hasAnon: !!ANON_KEY,
  hasService: !!SERVICE_ROLE,
  allowedOrigins: ALLOWED_ORIGINS,
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeadersFor(origin) });
  }

  try {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname.startsWith("/functions/v1/admin-items")) {
      pathname = pathname.replace("/functions/v1/admin-items", "") || "/";
    } else if (pathname.startsWith("/admin-items")) {
      pathname = pathname.replace("/admin-items", "") || "/";
    }

    const authHeader = req.headers.get("Authorization") || "";

    // Verify caller identity via anon client (JWT validation)
    const requester = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: me, error: meErr } = await requester.auth.getUser();
    if (meErr || !me?.user) return json({ error: "Unauthorized" }, 401, origin);

    // Role check — RPC first, direct profile query, service-role fallback
    let role: string | null = null;
    const { data: rpcRole, error: rpcErr } = await requester.rpc("get_my_role");
    if (!rpcErr && rpcRole) {
      role = rpcRole as string;
    } else {
      const { data: prof, error: profErr } = await requester
        .from("profiles")
        .select("role")
        .eq("id", me.user.id)
        .single();
      if (!profErr && prof?.role) {
        role = prof.role as string;
      } else {
        const adminCheck = createClient(SUPABASE_URL, SERVICE_ROLE, {
          auth: { persistSession: false },
        });
        const { data: prof2, error: profErr2 } = await adminCheck
          .from("profiles")
          .select("role")
          .eq("id", me.user.id)
          .single();
        if (!profErr2 && prof2?.role) role = prof2.role as string;
      }
    }

    if (role !== "admin") {
      return json({ error: "Forbidden", details: `role=${role ?? "null"}` }, 403, origin);
    }

    // All privileged operations use the service-role client
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "public" },
      global: { headers: { "x-application-name": "admin-items-function" } },
    });

    // ─── GET "/" → list all items (paginated, optional title search) ───────────
    if (req.method === "GET" && pathname === "/") {
      const q = url.searchParams.get("query") ?? "";
      const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
      const size = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage") ?? "20")));
      const from = (page - 1) * size;
      const to = from + size - 1;

      let query = admin
        .from("items")
        .select("id, title, description, category, status, visibility, created_at, owner_id", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (q) query = query.ilike("title", `%${q}%`);

      const { data: items, error: itemsErr, count } = await query;
      if (itemsErr) return json({ error: itemsErr.message }, 500, origin);

      const rows = items ?? [];
      const ownerIds = [...new Set(rows.map((i) => i.owner_id))];
      const profileMap: Record<string, string | null> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, display_name")
          .in("id", ownerIds);
        for (const p of profiles ?? []) profileMap[p.id] = p.display_name ?? null;
      }

      const itemIds = rows.map((i) => i.id);
      const thumbnailPathMap: Record<string, string | null> = {};
      if (itemIds.length > 0) {
        const { data: images } = await admin
          .from("item_images")
          .select("item_id, path")
          .in("item_id", itemIds)
          .order("sort_order", { ascending: true });
        for (const img of images ?? []) {
          if (!(img.item_id in thumbnailPathMap)) thumbnailPathMap[img.item_id] = img.path;
        }
      }

      const enriched = await Promise.all(
        rows.map(async (item) => {
          const thumbPath = thumbnailPathMap[item.id] ?? null;
          let thumbnail_url: string | null = null;
          if (thumbPath) {
            const { data: signed } = await admin.storage
              .from("images")
              .createSignedUrl(thumbPath, 900);
            thumbnail_url = signed?.signedUrl ?? null;
          }
          return {
            id: item.id,
            title: item.title,
            description: item.description ?? null,
            category: item.category ?? null,
            status: item.status,
            visibility: item.visibility,
            created_at: item.created_at,
            owner_id: item.owner_id,
            display_name: profileMap[item.owner_id] ?? null,
            thumbnail_url,
          };
        })
      );

      return json({ items: enriched, page, size, total: count ?? 0 }, 200, origin);
    }

    // ─── GET "/:id" → single item with images (bypasses RLS) ──────────────────
    if (req.method === "GET" && pathname !== "/") {
      const id = pathname.slice(1);

      const { data: item, error: itemErr } = await admin
        .from("items")
        .select("*")
        .eq("id", id)
        .single();

      if (itemErr || !item) return json({ error: "Item not found" }, 404, origin);

      const { data: profile } = await admin
        .from("profiles")
        .select("id, display_name")
        .eq("id", item.owner_id)
        .single();

      const { data: visGroups } = await admin
        .from("item_visibility_groups")
        .select("item_id, group_id, tier")
        .eq("item_id", id);

      const { data: images } = await admin
        .from("item_images")
        .select("id, item_id, path, sort_order")
        .eq("item_id", id)
        .order("sort_order", { ascending: true });

      const imagesWithUrls = await Promise.all(
        (images ?? []).map(async (img) => {
          const { data: signed } = await admin.storage
            .from("images")
            .createSignedUrl(img.path, 3600);
          return { ...img, signed_url: signed?.signedUrl ?? null };
        })
      );

      return json(
        {
          item: {
            ...item,
            display_name: profile?.display_name ?? null,
            item_visibility_groups: visGroups ?? [],
          },
          images: imagesWithUrls,
        },
        200,
        origin
      );
    }

    // ─── PATCH "/:id" → archive OR update item ─────────────────────────────────
    if (req.method === "PATCH" && pathname !== "/") {
      const id = pathname.slice(1);
      const body = await req.json().catch(() => ({}));

      // action: 'archive' → set status = 'archived'
      if (body.action === "archive") {
        const { error } = await admin.from("items").update({ status: "archived" }).eq("id", id);
        if (error) return json({ error: error.message }, 500, origin);
        return json({ ok: true }, 200, origin);
      }

      // action: 'update' → full item metadata + visibility group replacement
      if (body.action === "update") {
        const { title, description, condition, category, approx_location, visibility, group_ids } =
          body;

        const fields: Record<string, unknown> = {};
        if (title !== undefined) fields.title = title;
        if (description !== undefined) fields.description = description;
        if (condition !== undefined) fields.condition = condition;
        if (category !== undefined) fields.category = category;
        if (approx_location !== undefined) fields.approx_location = approx_location;
        if (visibility !== undefined) fields.visibility = visibility;

        if (Object.keys(fields).length > 0) {
          const { error: updateErr } = await admin.from("items").update(fields).eq("id", id);
          if (updateErr) return json({ error: updateErr.message }, 500, origin);
        }

        // Replace visibility groups
        await admin.from("item_visibility_groups").delete().eq("item_id", id);
        if (visibility === "groups" && Array.isArray(group_ids) && group_ids.length > 0) {
          const { error: visErr } = await admin.from("item_visibility_groups").insert(
            group_ids.map((gid: string) => ({ item_id: id, group_id: gid, tier: 1 }))
          );
          if (visErr) console.error("Error inserting visibility groups:", visErr.message);
        }

        return json({ ok: true, id }, 200, origin);
      }

      return json({ error: "Unsupported action. Expected 'archive' or 'update'." }, 400, origin);
    }

    // ─── DELETE "/:id" → hard delete: storage → related rows → item ───────────
    if (req.method === "DELETE" && pathname !== "/") {
      const id = pathname.slice(1);

      const { data: images } = await admin
        .from("item_images")
        .select("path")
        .eq("item_id", id);

      const paths = (images ?? []).map((img) => img.path);
      if (paths.length > 0) {
        const { error: storageErr } = await admin.storage.from("images").remove(paths);
        if (storageErr) console.error("Storage removal error (continuing):", storageErr.message);
      }

      const dependents: Array<{ table: string; col: string }> = [
        { table: "item_visibility_groups", col: "item_id" },
        { table: "interests", col: "item_id" },
        { table: "reservations", col: "item_id" },
        { table: "item_images", col: "item_id" },
      ];
      for (const { table, col } of dependents) {
        const { error } = await admin.from(table).delete().eq(col, id);
        if (error) console.error(`Error deleting from ${table}:`, error.message);
      }

      const { error: itemErr } = await admin.from("items").delete().eq("id", id);
      if (itemErr) return json({ error: itemErr.message }, 500, origin);

      return json({ ok: true }, 200, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  } catch (e) {
    console.error("Unhandled error in admin-items function:", e);
    return json(
      { error: String(e), stack: e instanceof Error ? e.stack : undefined },
      500,
      req.headers.get("origin")
    );
  }
});
