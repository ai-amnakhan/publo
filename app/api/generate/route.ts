/* ============================================================
   Publo — Production API route
   File location in your Next.js project:  app/api/generate/route.ts

   Why this exists: the artifact version calls the Anthropic API
   from the browser, which only works inside Claude. In production
   you must NEVER ship your API key to the client. This route keeps
   the key on the server, checks the user's plan, enforces quotas,
   and returns the parsed content package to your frontend.

   Setup:
   1. npm install @anthropic-ai/sdk
   2. Add to .env.local:   ANTHROPIC_API_KEY=sk-ant-...
      (Get a key at console.anthropic.com — pay-as-you-go.)
   3. Deploy on Vercel; add the same env var in Project Settings.

   Frontend change: in the artifact code, replace the fetch to
   https://api.anthropic.com/v1/messages with a fetch to /api/generate
   sending { keyword, secondary, type, tone, length, audience, notes }.
   ============================================================ */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* ---------- Plan quotas (wire these to Stripe later) ---------- */
const PLAN_LIMITS: Record<string, number> = {
  free: 3,      // 3 content packages / month
  pro: 50,      // 50 / month
  agency: 300,  // 300 / month
};

/* ---------- Simple in-memory rate limit (per-IP, per-minute) ----------
   Good enough for launch on a single region. When you add a database
   (Supabase/Postgres), move quota tracking there: a `usage` table with
   user_id, month, count — increment on each successful generation. */
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string, perMinute = 5): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  rec.count++;
  return rec.count > perMinute;
}

/* ---------- Request validation ---------- */
interface Brief {
  keyword: string;
  secondary?: string;
  type: string;
  tone: string;
  length: number;
  audience?: string;
  notes?: string;
}

function validate(body: unknown): Brief | null {
  const b = body as Partial<Brief>;
  if (!b || typeof b.keyword !== "string" || !b.keyword.trim()) return null;
  if (b.keyword.length > 200) return null;
  return {
    keyword: b.keyword.trim(),
    secondary: (b.secondary || "").slice(0, 300),
    type: (b.type || "Blog Article").slice(0, 50),
    tone: (b.tone || "Professional").slice(0, 50),
    length: Math.min(Math.max(Number(b.length) || 1200, 300), 2500),
    audience: (b.audience || "").slice(0, 200),
    notes: (b.notes || "").slice(0, 500),
  };
}

/* ---------- The generation prompt (same contract as the app) ---------- */
function buildPrompt(f: Brief): string {
  return `Create a complete SEO content package.

TARGET KEYWORD: ${f.keyword}
SECONDARY KEYWORDS: ${f.secondary || "derive 4-6 relevant LSI/secondary keywords yourself"}
CONTENT TYPE: ${f.type}
TONE: ${f.tone}
TARGET LENGTH: approximately ${f.length} words
TARGET AUDIENCE: ${f.audience || "general audience searching this keyword"}
${f.notes ? `EXTRA INSTRUCTIONS: ${f.notes}` : ""}

Requirements:
- Meta title: 50-60 characters, exact target keyword near the front, compelling.
- Meta description: 130-158 characters, includes the keyword, has a call to action.
- Slug: lowercase, hyphen-separated, 3-6 words, no stop words.
- Article in Markdown: H1 once, 4+ H2 sections, H3s where useful. Exact target
  keyword in the first 100 words, naturally throughout (0.5-2.5% density), and
  in at least one H2. Genuinely helpful, specific, non-fluffy content with a
  conclusion and call to action.
- 4-5 FAQs answering real searcher questions (2-3 sentence answers).
- Valid JSON-LD: Article schema plus FAQPage schema combined in an array.
- 3-4 internal link anchor-text suggestions.
- 5-8 keywords actually used in the article.

Respond with ONLY this JSON structure:
{"metaTitle":"...","metaDescription":"...","slug":"...","article":"markdown string","faqs":[{"q":"...","a":"..."}],"schema":[],"internalLinks":["..."],"keywords":["..."]}`;
}

/* ---------- POST /api/generate ---------- */
export async function POST(req: NextRequest) {
  try {
    // 1. Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Wait a minute and try again." },
        { status: 429 }
      );
    }

    // 2. Auth + quota check — REPLACE with your auth provider.
    //    With Clerk:   const { userId } = auth(); look up plan + usage in DB.
    //    With Supabase: const { data: { user } } = await supabase.auth.getUser();
    //    Then:
    //    const used = await getMonthlyUsage(userId);
    //    if (used >= PLAN_LIMITS[plan]) return 402 "Upgrade to continue".
    const plan = "free"; // placeholder until auth is wired
    void PLAN_LIMITS[plan]; // (referenced so TS doesn't flag it; remove later)

    // 3. Validate input
    const brief = validate(await req.json());
    if (!brief) {
      return NextResponse.json(
        { error: "A target keyword (under 200 characters) is required." },
        { status: 400 }
      );
    }

    // 4. Call Claude — server-side, key never leaves this process
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5", // use the latest Sonnet available to you
      max_tokens: 4096,
      system:
        "You are an expert SEO content strategist. You write content that satisfies search intent, follows Google's helpful content guidelines, and is optimized for on-page SEO without keyword stuffing. You respond ONLY with valid JSON — no markdown fences, no preamble.",
      messages: [{ role: "user", content: buildPrompt(brief) }],
    });

    // 5. Parse the JSON contract
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Model returned non-JSON output");
    const pkg = JSON.parse(clean.slice(start, end + 1));

    // 6. (Later) incrementMonthlyUsage(userId) here — only after success,
    //    so failed generations never burn a user's quota.

    return NextResponse.json({ ok: true, package: pkg });
  } catch (err) {
    console.error("generate error:", err);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}
