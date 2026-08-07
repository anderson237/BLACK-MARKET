// Netlify Scheduled Function: abandoned-cart reminder pass.
//
// Netlify doesn't support Nitro's native scheduledTasks (that works on Vercel),
// so this scheduled function calls the secured Nuxt endpoint which runs the
// actual scan + email logic (see server/utils/reminders.ts).
//
// The request is authorized with NUXT_TASK_SECRET, which must be set in the
// Netlify environment (same value the Nuxt runtime reads as `taskSecret`).

export const config = {
  schedule: "@hourly",
};

export default async (req) => {
  const secret = process.env.NUXT_TASK_SECRET || "";
  const baseUrl = process.env.URL || process.env.SITE_URL || "";

  console.log("[remind-carts] scheduled run at", new Date().toISOString());

  if (!secret || !baseUrl) {
    console.error("[remind-carts] missing NUXT_TASK_SECRET or URL env; aborting");
    return new Response("missing env", { status: 500 });
  }

  try {
    const res = await fetch(`${baseUrl}/api/admin/reminders/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-task-secret": secret,
      },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    console.log("[remind-carts] endpoint returned", res.status, JSON.stringify(json));
    if (!res.ok) {
      return new Response(`endpoint failed: ${res.status}`, { status: 500 });
    }
    return new Response(JSON.stringify(json), { status: 200 });
  } catch (err) {
    console.error("[remind-carts] fetch failed:", err);
    return new Response("fetch failed", { status: 500 });
  }
};
