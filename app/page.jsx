"use client";

import { useState, useMemo } from "react";

/* ============================================================
   Publo — AI SEO Content Engine
   Generate → Score → Preview → Export
   ============================================================ */

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
.rf-display { font-family: 'Archivo', system-ui, sans-serif; }
.rf-body { font-family: 'Inter', system-ui, sans-serif; }
.rf-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.rf-fade { animation: rfFade .35s ease both; }
@keyframes rfFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.rf-pulse { animation: rfPulse 1.4s ease-in-out infinite; }
@keyframes rfPulse { 0%,100% { opacity:.35 } 50% { opacity:1 } }
@media (prefers-reduced-motion: reduce) { .rf-fade, .rf-pulse { animation: none; } }
`;

const C = {
  bg: "#F4F6F8",
  panel: "#FFFFFF",
  ink: "#101B26",
  sub: "#5A6B7A",
  line: "#E2E8EE",
  accent: "#1F4FE0",
  accentSoft: "#EBF0FE",
  good: "#0E8A5F",
  goodSoft: "#E7F5EF",
  warn: "#B8860B",
  warnSoft: "#FBF3DC",
  bad: "#C0392B",
  badSoft: "#FBEAE7",
  serpLink: "#1A0DAB",
  serpUrl: "#006621",
};

const CONTENT_TYPES = ["Blog Article", "Product Description", "Landing Page", "Comparison Post", "How-To Guide", "Listicle"];
const TONES = ["Professional", "Conversational", "Authoritative", "Friendly", "Persuasive"];
const LENGTHS = [
  { label: "Short (~600 words)", value: 600 },
  { label: "Standard (~1,200 words)", value: 1200 },
  { label: "Long-form (~2,000 words)", value: 2000 },
];

/* ---------------- SEO scoring (client-side, transparent rules) ---------------- */
function analyzeSEO(result, keyword) {
  if (!result) return { score: 0, checks: [] };
  const kw = (keyword || "").trim().toLowerCase();
  const article = result.article || "";
  const plain = article.replace(/[#*_>`\[\]()]/g, " ").toLowerCase();
  const words = plain.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const kwTokens = kw.split(/\s+/).filter(Boolean);
  let kwCount = 0;
  if (kwTokens.length) {
    const joined = plain;
    let idx = 0;
    while ((idx = joined.indexOf(kw, idx)) !== -1) { kwCount++; idx += kw.length; }
  }
  const density = wordCount ? (kwCount * kwTokens.length / wordCount) * 100 : 0;
  const h2s = (article.match(/^##\s/gm) || []).length;
  const h3s = (article.match(/^###\s/gm) || []).length;
  const titleLen = (result.metaTitle || "").length;
  const descLen = (result.metaDescription || "").length;
  const firstPara = plain.slice(0, 600);

  const checks = [
    { label: "Keyword in meta title", pass: (result.metaTitle || "").toLowerCase().includes(kw), tip: "Put the exact target keyword in the title tag, ideally near the front." },
    { label: `Meta title length (${titleLen}/60)`, pass: titleLen >= 30 && titleLen <= 60, warn: titleLen > 60 && titleLen <= 70, tip: "Aim for 30–60 characters so it doesn't truncate in search results." },
    { label: `Meta description length (${descLen}/160)`, pass: descLen >= 120 && descLen <= 160, warn: descLen > 160 && descLen <= 180, tip: "120–160 characters reads fully on desktop and mobile SERPs." },
    { label: "Keyword in first 100 words", pass: firstPara.includes(kw), tip: "Early keyword placement helps search engines confirm topical relevance." },
    { label: `Keyword density (${density.toFixed(1)}%)`, pass: density >= 0.5 && density <= 2.5, warn: density > 2.5 && density <= 4, tip: "0.5–2.5% is a healthy range. Above ~3% risks reading as keyword stuffing." },
    { label: `H2 subheadings (${h2s})`, pass: h2s >= 3, warn: h2s === 2, tip: "3+ H2 sections improve scannability and featured-snippet eligibility." },
    { label: `H3 depth (${h3s})`, pass: h3s >= 1, tip: "H3s under H2s create the hierarchy crawlers and readers both like." },
    { label: `Word count (${wordCount})`, pass: wordCount >= 500, tip: "Thin content under ~500 words rarely competes for informational queries." },
    { label: "FAQ section included", pass: Array.isArray(result.faqs) && result.faqs.length >= 3, tip: "FAQs target People-Also-Ask boxes and power FAQPage schema." },
    { label: "URL slug is clean", pass: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(result.slug || ""), tip: "Lowercase words separated by hyphens, no stop-word clutter." },
    { label: "Schema markup generated", pass: !!result.schema, tip: "JSON-LD structured data helps search engines understand the page." },
    { label: "Internal link suggestions", pass: Array.isArray(result.internalLinks) && result.internalLinks.length >= 2, tip: "Internal links distribute authority and keep readers on your site." },
  ];

  const earned = checks.reduce((s, c) => s + (c.pass ? 1 : c.warn ? 0.5 : 0), 0);
  const score = Math.round((earned / checks.length) * 100);
  return { score, checks, wordCount, density: density.toFixed(1), h2s };
}

/* ---------------- Generation call (via YOUR backend) ----------------
   In local/production builds the browser never talks to Anthropic
   directly — it calls /api/generate (app/api/generate/route.ts),
   which holds the API key server-side and returns { ok, package }. */
async function generateContent(form) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword: form.keyword,
      secondary: form.secondary,
      type: form.type,
      tone: form.tone,
      length: form.length,
      audience: form.audience,
      notes: form.notes,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `API error ${response.status}`);
  }
  return data.package;
}

/* ---------------- Small UI atoms ---------------- */
function Field({ label, children, hint }) {
  return (
    <label className="block rf-body" style={{ marginBottom: 16 }}>
      <div className="rf-display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>{hint}</div>}
    </label>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 8,
  border: `1px solid ${C.line}`, background: "#FBFCFD", color: C.ink, outline: "none",
  fontFamily: "'Inter', system-ui, sans-serif",
};

function CopyBtn({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch (e) {
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        setDone(true); setTimeout(() => setDone(false), 1500);
      }}
      className="rf-display"
      style={{
        fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 7,
        border: `1px solid ${done ? C.good : C.line}`, cursor: "pointer",
        background: done ? C.goodSoft : "#fff", color: done ? C.good : C.ink,
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

function ScoreRing({ score }) {
  const r = 52, circ = 2 * Math.PI * r;
  const color = score >= 80 ? C.good : score >= 55 ? C.warn : C.bad;
  return (
    <div style={{ position: "relative", width: 128, height: 128 }}>
      <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={`SEO score ${score} out of 100`}>
        <circle cx="64" cy="64" r={r} fill="none" stroke={C.line} strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          transform="rotate(-90 64 64)" style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span className="rf-display" style={{ fontSize: 34, fontWeight: 800, color }}>{score}</span>
        <span className="rf-body" style={{ fontSize: 11, color: C.sub }}>/ 100</span>
      </div>
    </div>
  );
}

/* ---------------- Markdown-ish renderer (headings, bold, lists, paras) ---------------- */
function renderMarkdown(md) {
  const lines = (md || "").split("\n");
  const out = [];
  let list = null, key = 0;
  const flushList = () => {
    if (list) { out.push(<ul key={key++} style={{ paddingLeft: 22, margin: "8px 0" }}>{list}</ul>); list = null; }
  };
  const inline = (t) =>
    t.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
      seg.startsWith("**") ? <strong key={i}>{seg.slice(2, -2)}</strong> : seg
    );
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#\s/.test(line)) { flushList(); out.push(<h1 key={key++} className="rf-display" style={{ fontSize: 26, fontWeight: 800, margin: "18px 0 8px", color: C.ink }}>{inline(line.slice(2))}</h1>); }
    else if (/^##\s/.test(line)) { flushList(); out.push(<h2 key={key++} className="rf-display" style={{ fontSize: 20, fontWeight: 700, margin: "20px 0 6px", color: C.ink }}>{inline(line.slice(3))}</h2>); }
    else if (/^###\s/.test(line)) { flushList(); out.push(<h3 key={key++} className="rf-display" style={{ fontSize: 16, fontWeight: 700, margin: "14px 0 4px", color: C.ink }}>{inline(line.slice(4))}</h3>); }
    else if (/^[-*]\s/.test(line)) { (list = list || []).push(<li key={key++} style={{ margin: "3px 0", fontSize: 14.5, lineHeight: 1.65 }}>{inline(line.slice(2))}</li>); }
    else if (line === "") { flushList(); }
    else { flushList(); out.push(<p key={key++} style={{ fontSize: 14.5, lineHeight: 1.7, margin: "8px 0", color: "#28333E" }}>{inline(line)}</p>); }
  }
  flushList();
  return out;
}

/* ---------------- Main App ---------------- */
export default function App() {
  const [form, setForm] = useState({
    keyword: "", secondary: "", type: CONTENT_TYPES[0], tone: TONES[0],
    length: 1200, audience: "", notes: "", domain: "yoursite.com",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("article");
  const [history, setHistory] = useState([]);

  const seo = useMemo(() => analyzeSEO(result, form.keyword), [result, form.keyword]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = async () => {
    if (!form.keyword.trim()) { setError("Enter a target keyword to generate content."); return; }
    setLoading(true); setError(null);
    try {
      const res = await generateContent(form);
      setResult(res);
      setTab("article");
      setHistory((h) => [{ keyword: form.keyword, title: res.metaTitle, at: new Date().toLocaleTimeString() }, ...h].slice(0, 8));
    } catch (e) {
      setError(`Generation failed: ${e.message}. Try again — long articles occasionally exceed limits; pick a shorter length if it repeats.`);
    } finally { setLoading(false); }
  };

  const exportAll = () => {
    if (!result) return;
    const pkg = [
      `META TITLE:\n${result.metaTitle}`,
      `META DESCRIPTION:\n${result.metaDescription}`,
      `URL SLUG:\n/${result.slug}`,
      `KEYWORDS:\n${(result.keywords || []).join(", ")}`,
      `ARTICLE (Markdown):\n${result.article}`,
      `FAQs:\n${(result.faqs || []).map(f => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}`,
      `INTERNAL LINK IDEAS:\n${(result.internalLinks || []).map(l => `• ${l}`).join("\n")}`,
      `SCHEMA (JSON-LD):\n<script type="application/ld+json">\n${JSON.stringify(result.schema, null, 2)}\n</script>`,
    ].join("\n\n" + "—".repeat(40) + "\n\n");
    const blob = new Blob([pkg], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.slug || "seo-content"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs = [
    { id: "article", label: "Article" },
    { id: "seopack", label: "SEO Pack" },
    { id: "serp", label: "SERP Preview" },
    { id: "schema", label: "Schema" },
    { id: "audit", label: `Audit · ${result ? seo.score : "—"}` },
  ];

  return (
    <div className="rf-body" style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <style>{FONTS}</style>

      {/* Header */}
      <header style={{ background: C.ink, color: "#fff", padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 L21 21" /><path d="M8 10.5 l2 2 l3.5 -3.5" />
          </svg>
        </div>
        <div>
          <div className="rf-display" style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em" }}>Publo</div>
          <div style={{ fontSize: 12, color: "#9FB0BF" }}>AI SEO Content Engine — generate, score, ship</div>
        </div>
        <div className="rf-mono" style={{ marginLeft: "auto", fontSize: 11, color: "#7E919F" }}>
          draft → audit → publish
        </div>
      </header>

      <main style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 0, alignItems: "start" }}>
        {/* ============ Left: brief panel ============ */}
        <section style={{ background: C.panel, borderRight: `1px solid ${C.line}`, padding: 24, minHeight: "calc(100vh - 73px)" }}>
          <h2 className="rf-display" style={{ fontSize: 15, fontWeight: 800, margin: "0 0 16px", textTransform: "uppercase", letterSpacing: ".05em" }}>Content brief</h2>

          <Field label="Target keyword *" hint="The exact phrase you want to rank for.">
            <input style={inputStyle} value={form.keyword} onChange={set("keyword")} placeholder="e.g. best running shoes for flat feet" />
          </Field>

          <Field label="Secondary keywords" hint="Comma-separated. Leave blank and the engine derives them.">
            <input style={inputStyle} value={form.secondary} onChange={set("secondary")} placeholder="e.g. arch support, overpronation" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Content type">
              <select style={inputStyle} value={form.type} onChange={set("type")}>
                {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Tone">
              <select style={inputStyle} value={form.tone} onChange={set("tone")}>
                {TONES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Length">
            <select style={inputStyle} value={form.length} onChange={(e) => setForm({ ...form, length: Number(e.target.value) })}>
              {LENGTHS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>

          <Field label="Audience">
            <input style={inputStyle} value={form.audience} onChange={set("audience")} placeholder="e.g. beginner runners, 25–40" />
          </Field>

          <Field label="Extra instructions">
            <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Brand voice, things to include or avoid…" />
          </Field>

          <Field label="Your domain (for SERP preview)">
            <input style={inputStyle} value={form.domain} onChange={set("domain")} />
          </Field>

          <button
            onClick={run}
            disabled={loading}
            className="rf-display"
            style={{
              width: "100%", padding: "13px 16px", fontSize: 15, fontWeight: 800, borderRadius: 9,
              border: "none", cursor: loading ? "wait" : "pointer",
              background: loading ? "#8FA3D9" : C.accent, color: "#fff", letterSpacing: ".02em",
            }}
          >
            {loading ? "Forging content…" : "Generate content package"}
          </button>
          {loading && <div className="rf-pulse" style={{ fontSize: 12.5, color: C.sub, marginTop: 10, textAlign: "center" }}>Researching intent, writing, optimizing — 20–40s for long-form…</div>}
          {error && <div style={{ marginTop: 12, padding: "10px 12px", background: C.badSoft, color: C.bad, fontSize: 13, borderRadius: 8, border: `1px solid #EFC7C0` }}>{error}</div>}

          {history.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="rf-display" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.sub, marginBottom: 8 }}>This session</div>
              {history.map((h, i) => (
                <div key={i} style={{ fontSize: 12.5, padding: "7px 0", borderBottom: `1px solid ${C.line}`, color: C.sub }}>
                  <span className="rf-mono" style={{ color: C.accent }}>{h.at}</span> — {h.keyword}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ============ Right: output ============ */}
        <section style={{ padding: 24, minWidth: 0 }}>
          {!result && !loading && (
            <div className="rf-fade" style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
              <div className="rf-display" style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                One keyword in.<br />A <span style={{ color: C.accent }}>publish-ready page</span> out.
              </div>
              <p style={{ fontSize: 15, color: C.sub, marginTop: 16, lineHeight: 1.7 }}>
                Enter a target keyword on the left. The engine writes the article, meta title and description,
                URL slug, FAQs, JSON-LD schema, and internal-link plan — then audits it against 12 on-page
                SEO checks before you ship it.
              </p>
              <div className="rf-mono" style={{ fontSize: 12, color: C.sub, marginTop: 20 }}>
                brief → generate → audit → fix → export
              </div>
            </div>
          )}

          {result && (
            <div className="rf-fade">
              {/* Tabs + export */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} className="rf-display"
                    style={{
                      padding: "8px 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${tab === t.id ? C.accent : C.line}`,
                      background: tab === t.id ? C.accentSoft : "#fff",
                      color: tab === t.id ? C.accent : C.sub,
                    }}>{t.label}</button>
                ))}
                <button onClick={exportAll} className="rf-display"
                  style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "none", background: C.ink, color: "#fff" }}>
                  Export package ↓
                </button>
              </div>

              {/* ---- Article tab ---- */}
              {tab === "article" && (
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "28px 32px", maxWidth: 820 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
                    <span className="rf-mono" style={{ fontSize: 12, color: C.sub }}>{seo.wordCount} words · {seo.h2s} sections · {seo.density}% keyword density</span>
                    <CopyBtn text={result.article} label="Copy Markdown" />
                  </div>
                  {renderMarkdown(result.article)}
                  {Array.isArray(result.faqs) && result.faqs.length > 0 && (
                    <>
                      <h2 className="rf-display" style={{ fontSize: 20, fontWeight: 700, margin: "24px 0 10px" }}>Frequently asked questions</h2>
                      {result.faqs.map((f, i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ fontWeight: 600, fontSize: 14.5 }}>{f.q}</div>
                          <div style={{ fontSize: 14, color: "#3A4753", lineHeight: 1.65, marginTop: 3 }}>{f.a}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ---- SEO pack tab ---- */}
              {tab === "seopack" && (
                <div style={{ display: "grid", gap: 14, maxWidth: 820 }}>
                  {[
                    { label: `Meta title — ${result.metaTitle.length} chars`, value: result.metaTitle, ok: result.metaTitle.length <= 60 },
                    { label: `Meta description — ${result.metaDescription.length} chars`, value: result.metaDescription, ok: result.metaDescription.length <= 160 },
                    { label: "URL slug", value: `/${result.slug}`, ok: true },
                  ].map((row, i) => (
                    <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span className="rf-display" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: row.ok ? C.sub : C.bad }}>{row.label}{row.ok ? "" : " — too long"}</span>
                        <CopyBtn text={row.value} />
                      </div>
                      <div style={{ fontSize: 15, marginTop: 8 }}>{row.value}</div>
                    </div>
                  ))}
                  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
                    <div className="rf-display" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.sub, marginBottom: 10 }}>Keywords used</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(result.keywords || []).map((k, i) => (
                        <span key={i} className="rf-mono" style={{ fontSize: 12.5, padding: "5px 11px", borderRadius: 99, background: i === 0 ? C.accentSoft : C.bg, color: i === 0 ? C.accent : C.sub, border: `1px solid ${i === 0 ? C.accent : C.line}` }}>{k}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
                    <div className="rf-display" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.sub, marginBottom: 10 }}>Internal link plan</div>
                    {(result.internalLinks || []).map((l, i) => (
                      <div key={i} style={{ fontSize: 14, padding: "6px 0", borderBottom: i < result.internalLinks.length - 1 ? `1px solid ${C.line}` : "none" }}>
                        <span style={{ color: C.accent }}>↳</span> {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---- SERP preview tab ---- */}
              {tab === "serp" && (
                <div style={{ maxWidth: 680 }}>
                  <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "26px 28px" }}>
                    <div style={{ fontSize: 12, color: C.sub, marginBottom: 18 }} className="rf-display">How your page will appear on Google</div>
                    {/* Desktop SERP card */}
                    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 99, background: C.bg, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🌐</div>
                        <div>
                          <div style={{ fontSize: 13, color: "#202124" }}>{form.domain}</div>
                          <div style={{ fontSize: 12, color: "#4D5156" }}>https://{form.domain} › {result.slug}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 20, color: C.serpLink, marginTop: 6, lineHeight: 1.3, cursor: "pointer" }}>
                        {result.metaTitle.length > 60 ? result.metaTitle.slice(0, 60) + "…" : result.metaTitle}
                      </div>
                      <div style={{ fontSize: 14, color: "#4D5156", lineHeight: 1.58, marginTop: 4 }}>
                        {result.metaDescription.length > 160 ? result.metaDescription.slice(0, 160) + "…" : result.metaDescription}
                      </div>
                    </div>
                    {/* PAA-style FAQ preview */}
                    {Array.isArray(result.faqs) && result.faqs.length > 0 && (
                      <div style={{ marginTop: 26 }}>
                        <div style={{ fontSize: 13, color: C.sub, marginBottom: 8 }} className="rf-display">People also ask — your FAQs target these boxes</div>
                        {result.faqs.slice(0, 4).map((f, i) => (
                          <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: i === 0 ? "8px 8px 0 0" : i === Math.min(3, result.faqs.length - 1) ? "0 0 8px 8px" : 0, borderTop: i > 0 ? "none" : undefined, padding: "12px 14px", fontSize: 14, fontFamily: "Arial, sans-serif", display: "flex", justifyContent: "space-between" }}>
                            {f.q} <span style={{ color: C.sub }}>⌄</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 12.5, color: C.sub, marginTop: 12, lineHeight: 1.6 }}>
                    Title truncates near 60 characters and descriptions near 160 — the preview shows the cut exactly where Google would make it.
                  </p>
                </div>
              )}

              {/* ---- Schema tab ---- */}
              {tab === "schema" && (
                <div style={{ maxWidth: 820 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13.5, color: C.sub }}>Paste this into your page's <span className="rf-mono">&lt;head&gt;</span>. Validate at schema.org or Google's Rich Results Test.</span>
                    <CopyBtn text={`<script type="application/ld+json">\n${JSON.stringify(result.schema, null, 2)}\n</script>`} label="Copy with script tag" />
                  </div>
                  <pre className="rf-mono" style={{ background: "#0E1822", color: "#C9E3F5", fontSize: 12.5, lineHeight: 1.6, padding: 20, borderRadius: 12, overflow: "auto", maxHeight: 520 }}>
                    {JSON.stringify(result.schema, null, 2)}
                  </pre>
                </div>
              )}

              {/* ---- Audit tab ---- */}
              {tab === "audit" && (
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, maxWidth: 820, alignItems: "start" }}>
                  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
                    <ScoreRing score={seo.score} />
                    <div className="rf-display" style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>
                      {seo.score >= 80 ? "Ready to publish" : seo.score >= 55 ? "Fix warnings first" : "Needs work"}
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>12-point on-page audit</div>
                  </div>
                  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                    {seo.checks.map((c, i) => (
                      <div key={i} style={{ padding: "12px 16px", borderBottom: i < seo.checks.length - 1 ? `1px solid ${C.line}` : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{
                          flexShrink: 0, width: 22, height: 22, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700,
                          background: c.pass ? C.goodSoft : c.warn ? C.warnSoft : C.badSoft,
                          color: c.pass ? C.good : c.warn ? C.warn : C.bad,
                        }}>{c.pass ? "✓" : c.warn ? "!" : "✕"}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</div>
                          {!c.pass && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2, lineHeight: 1.55 }}>{c.tip}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
