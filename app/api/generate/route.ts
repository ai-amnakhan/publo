/* ============================================================
   PUBLO — Generation route WITH FREE MOCK MODE
   Replace your existing file at:  app/api/generate/route.ts

   HOW IT WORKS:
   - No ANTHROPIC_API_KEY in .env.local?  → MOCK MODE: returns a
     realistic sample content package built from your keyword.
     Costs $0. The whole app works: article, SEO pack, SERP
     preview, schema, 12-point audit, export.
   - Key present? → calls Claude for real. No code changes needed.
   ============================================================ */

import { NextRequest, NextResponse } from "next/server";

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

/* ============================================================
   MOCK GENERATOR — free, instant, deterministic
   ============================================================ */
function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

function mockPackage(f: Brief) {
  const kw = f.keyword.toLowerCase();
  const KW = titleCase(f.keyword);
  const slug = kw
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-");

  const metaTitle = `${KW}: The Complete Guide (2026)`.slice(0, 60);
  const metaDescription =
    `Everything you need to know about ${kw} — practical steps, common mistakes, and expert tips. Read the full guide now.`.slice(0, 158);

  const para = (n: number) =>
    `This is mock paragraph ${n} about ${kw}. In live mode, Claude writes genuinely helpful, specific content here tuned to a ${f.tone.toLowerCase()} tone for ${f.audience || "your audience"}. The mock keeps the exact structure — keyword placement, density, headings — so the 12-point audit scores realistically while you build for free.`;

  const article = `# ${KW}: The Complete Guide

If you're researching ${kw}, this guide covers everything that matters. Understanding ${kw} starts with the fundamentals, and this opening paragraph places the exact keyword in the first 100 words — one of the on-page checks the audit verifies.

${para(1)}

## What Is ${KW} and Why It Matters

${para(2)}

${para(3)}

## How to Get Started With ${KW}

${para(4)}

### Step 1: Understand the basics

${para(5)}

### Step 2: Apply it in practice

${para(6)}

## Common ${KW} Mistakes to Avoid

${para(7)}

- Mistake one: skipping the research phase entirely
- Mistake two: ignoring what currently works for others
- Mistake three: never measuring the results

## Advanced Tips for ${KW}

${para(8)}

## Conclusion

Mastering ${kw} takes structured effort, but the payoff is real. Start with the basics above, avoid the common mistakes, and revisit this guide as you progress. Ready to take the next step? Put one tip into practice today.`;

  return {
    metaTitle,
    metaDescription,
    slug,
    article,
    faqs: [
      { q: `What is ${kw}?`, a: `Mock answer: a concise two-sentence definition of ${kw} appears here in live mode, written to win People-Also-Ask boxes.` },
      { q: `How long does ${kw} take to learn?`, a: `Mock answer with a realistic timeframe and the factors that affect it.` },
      { q: `Is ${kw} worth it in 2026?`, a: `Mock answer weighing the benefits against the effort, ending with a clear verdict.` },
      { q: `What's the biggest mistake with ${kw}?`, a: `Mock answer naming the single most common error and how to avoid it.` },
    ],
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: metaTitle,
        description: metaDescription,
        author: { "@type": "Person", name: "Your Name" },
        datePublished: new Date().toISOString().slice(0, 10),
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `What is ${kw}?`,
            acceptedAnswer: { "@type": "Answer", text: `A concise definition of ${kw}.` },
          },
        ],
      },
    ],
    internalLinks: [
      `Beginner's guide to ${kw}`,
      `${KW} tools compared`,
      `${KW} case study: real results`,
    ],
    keywords: [
      kw,
      ...(f.secondary
        ? f.secondary.split(",").map((s) => s.trim()).filter(Boolean)
        : [`best ${kw}`, `${kw} guide`, `${kw} tips`, `how to ${kw}`]),
    ].slice(0, 8),
    _mock: true,
  };
}

/* ============================================================
   LIVE GENERATOR — used automatically once a key exists
   ============================================================ */
async function livePackage(f: Brief) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Create a complete SEO content package.

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
- Article in Markdown: H1 once, 4+ H2 sections, H3s where useful. Exact target keyword in the first 100 words, naturally throughout (0.5-2.5% density), and in at least one H2. Genuinely helpful, specific content with a conclusion and call to action.
- 4-5 FAQs answering real searcher questions (2-3 sentence answers).
- Valid JSON-LD: Article schema plus FAQPage schema combined in an array.
- 3-4 internal link anchor-text suggestions.
- 5-8 keywords actually used in the article.

Respond with ONLY this JSON structure:
{"metaTitle":"...","metaDescription":"...","slug":"...","article":"markdown string","faqs":[{"q":"...","a":"..."}],"schema":[],"internalLinks":["..."],"keywords":["..."]}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system:
      "You are an expert SEO content strategist. You write content that satisfies search intent, follows Google's helpful content guidelines, and is optimized for on-page SEO without keyword stuffing. You respond ONLY with valid JSON — no markdown fences, no preamble.",
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model returned non-JSON output");
  return JSON.parse(clean.slice(start, end + 1));
}

/* ---------- POST /api/generate ---------- */
export async function POST(req: NextRequest) {
  try {
    const brief = validate(await req.json());
    if (!brief) {
      return NextResponse.json(
        { error: "A target keyword (under 200 characters) is required." },
        { status: 400 }
      );
    }

    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    const pkg = hasKey ? await livePackage(brief) : mockPackage(brief);

    return NextResponse.json({ ok: true, package: pkg, mode: hasKey ? "live" : "mock" });
  } catch (err) {
    console.error("generate error:", err);
    return NextResponse.json(
      { error: "Generation failed — check the terminal for details." },
      { status: 500 }
    );
  }
}
