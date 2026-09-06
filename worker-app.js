const allowedOrigins = new Set([
  "https://gym-app.boscokwok7.workers.dev"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = allowedOrigins.has(origin) || origin.endsWith(".boscokwok7.workers.dev")
    ? origin
    : "https://gym-app.boscokwok7.workers.dev";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request)
    }
  });
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getUserId(request, env, ctx) {
  if (ctx.access) {
    const identity = await ctx.access.getIdentity();
    const email = String(identity?.email || "").trim().toLowerCase();
    if (email) return `access:${email}`;
  }

  if (env.ALLOW_UNAUTHENTICATED_DEV === "true") {
    const url = new URL(request.url);
    return url.searchParams.get("user_id") || "dev-user";
  }

  return "";
}

async function ensureSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    profile_json TEXT NOT NULL,
    selected_gym_id TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS workout_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    record_date TEXT,
    gym_id TEXT,
    gym_name TEXT,
    record_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS workout_items (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS body_weight_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    log_date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_records_user_date ON workout_records(user_id, record_date)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_items_record ON workout_items(record_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_body_weight_user_date ON body_weight_logs(user_id, log_date)").run();
}

async function readState(request, env, userId) {
  const profileRow = await env.DB.prepare(
    "SELECT profile_json, selected_gym_id FROM profiles WHERE user_id = ?"
  ).bind(userId).first();

  const recordRows = await env.DB.prepare(
    "SELECT record_json FROM workout_records WHERE user_id = ? ORDER BY record_date DESC, created_at DESC"
  ).bind(userId).all();

  const weightRows = await env.DB.prepare(
    "SELECT log_date, weight_kg FROM body_weight_logs WHERE user_id = ? ORDER BY log_date ASC"
  ).bind(userId).all();

  return json(request, {
    ok: true,
    profile: profileRow ? JSON.parse(profileRow.profile_json) : null,
    selectedGymId: profileRow?.selected_gym_id || "",
    records: (recordRows.results || []).map((row) => JSON.parse(row.record_json)),
    weights: (weightRows.results || []).map((row) => ({ date: row.log_date, value: row.weight_kg }))
  });
}

async function writeState(request, env, userId) {
  const payload = await request.json();
  const profile = payload.profile || {};
  const selectedGymId = payload.selectedGymId || "";
  const records = Array.isArray(payload.records) ? payload.records : [];
  const weights = Array.isArray(payload.weights) ? payload.weights : [];

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO profiles (user_id, profile_json, selected_gym_id, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        profile_json = excluded.profile_json,
        selected_gym_id = excluded.selected_gym_id,
        updated_at = CURRENT_TIMESTAMP`).bind(userId, JSON.stringify(profile), selectedGymId),
    env.DB.prepare("DELETE FROM workout_items WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM workout_records WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM body_weight_logs WHERE user_id = ?").bind(userId)
  ]);

  for (const record of records) {
    const recordId = record.id || makeId("record");
    await env.DB.prepare(`INSERT INTO workout_records
      (id, user_id, record_date, gym_id, gym_name, record_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(
      recordId,
      userId,
      record.date || "",
      record.gymId || "",
      record.gymName || "",
      JSON.stringify({ ...record, id: recordId })
    ).run();

    const items = Array.isArray(record.items) ? record.items : [];
    for (const item of items) {
      await env.DB.prepare(`INSERT INTO workout_items
        (id, record_id, user_id, item_json)
        VALUES (?, ?, ?, ?)`).bind(
        item.id || makeId("item"),
        recordId,
        userId,
        JSON.stringify(item)
      ).run();
    }
  }

  for (const weight of weights) {
    if (!weight.date || Number(weight.value) <= 0) continue;
    await env.DB.prepare(`INSERT INTO body_weight_logs
      (id, user_id, log_date, weight_kg)
      VALUES (?, ?, ?, ?)`).bind(
      makeId("weight"),
      userId,
      weight.date,
      Number(weight.value)
    ).run();
  }

  return json(request, { ok: true });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    try {
      await ensureSchema(env);
      const url = new URL(request.url);
      const userId = await getUserId(request, env, ctx);

      if (url.pathname === "/health") {
        const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
        return json(request, {
          ok: true,
          accessEnabled: Boolean(ctx.access),
          userAuthenticated: Boolean(userId),
          tables: (tables.results || []).map((row) => row.name)
        });
      }

      if (!userId) {
        return json(request, { ok: false, error: "Access login required" }, 401);
      }

      if (url.pathname === "/api/me") {
        return json(request, { ok: true, userId });
      }

      if (url.pathname === "/api/state" && request.method === "GET") {
        return readState(request, env, userId);
      }

      if (url.pathname === "/api/state" && request.method === "POST") {
        return writeState(request, env, userId);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return json(request, { ok: false, error: error.message || "Server error" }, 500);
    }
  }
};

