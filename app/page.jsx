"use client";

import { useState, useMemo, useEffect, useRef } from "react";

/* ============================================================
   Publo — AI SEO Content Engine
   Generate → Score → Preview → Export
   ============================================================ */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
.rf-display { font-family: 'Archivo', system-ui, sans-serif; }
.rf-body    { font-family: 'Inter', system-ui, sans-serif; }
.rf-mono    { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.rf-fade    { animation: rfFade .35s ease both; }
@keyframes rfFade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
.rf-pulse   { animation: rfPulse 1.4s ease-in-out infinite; }
@keyframes rfPulse { 0%,100%{opacity:.35} 50%{opacity:1} }
@media (prefers-reduced-motion:reduce) { .rf-fade,.rf-pulse { animation:none; } }

.rf-input { transition: border-color .15s, box-shadow .15s; }
.rf-input:focus { outline:none; border-color:#1F4FE0 !important; box-shadow:0 0 0 3px rgba(31,79,224,.13) !important; }

.rf-btn-primary { transition: background .15s, transform .12s, box-shadow .15s; }
.rf-btn-primary:hover:not(:disabled) { background:#1741C8 !important; transform:translateY(-1px); box-shadow:0 6px 18px rgba(31,79,224,.32) !important; }
.rf-btn-primary:active:not(:disabled) { transform:translateY(0); box-shadow:none !important; }

.rf-tab { transition: background .12s, color .12s, border-color .12s; }
.rf-tab:hover:not(.rf-tab-active) { border-color:#C5D0DC !important; color:#101B26 !important; background:#F8FAFC !important; }

.rf-sidebar { position:sticky; top:0; height:100vh; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#E2E8EE transparent; }
.rf-sidebar::-webkit-scrollbar { width:4px; }
.rf-sidebar::-webkit-scrollbar-thumb { background:#E2E8EE; border-radius:2px; }

.rf-copy-btn { transition: background .12s, border-color .12s, color .12s; }
.rf-copy-btn:hover { background:#F4F6F8 !important; }

.rf-export-btn { transition: background .15s; }
.rf-export-btn:hover { background:#1A2B3A !important; }

.rf-faq-row { transition: background .12s; }
.rf-faq-row:hover { background:#F9FAFB !important; }

.rf-check-row { transition: background .1s; }
.rf-check-row:hover { background:#FAFBFC !important; }

.rf-feature-card { transition: box-shadow .2s, transform .2s; }
.rf-feature-card:hover { box-shadow:0 6px 20px rgba(0,0,0,.09) !important; transform:translateY(-2px); }
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

const LOAD_STEPS = [
  "Analyzing search intent…",
  "Writing article content…",
  "Crafting SEO metadata…",
  "Generating schema & audit…",
];

const FEATURES = [
  { icon: "📝", label: "Article", desc: "Full Markdown with H1 / H2 / H3 structure" },
  { icon: "🏷️", label: "SEO Pack", desc: "Meta title, description & clean URL slug" },
  { icon: "🔍", label: "SERP Preview", desc: "Pixel-accurate Google result mockup" },
  { icon: "⚙️", label: "Schema", desc: "JSON-LD ready to paste into your <head>" },
  { icon: "📊", label: "12-point Audit", desc: "On-page SEO score with actionable fixes" },
];

/* ---------------- SEO scoring ---------------- */
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
    let idx = 0;
    while ((idx = plain.indexOf(kw, idx)) !== -1) { kwCount++; idx += kw.length; }
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

/* ---------------- Backend call ---------------- */
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
  if (!response.ok || !data.ok) throw new Error(data.error || `API error ${response.status}`);
  return data.package;
}

/* ---------------- UI atoms ---------------- */
function Field({ label, children, hint }) {
  return (
    <label className="block rf-body" style={{ marginBottom: 16 }}>
      <div className="rf-display" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.sub, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </label>
  );
}

const inputBase = {
  width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 8,
  border: `1.5px solid ${C.line}`, background: "#FAFBFD", color: C.ink,
  fontFamily: "'Inter', system-ui, sans-serif", boxSizing: "border-box",
};

function CopyBtn({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="rf-copy-btn rf-display"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch {
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        setDone(true); setTimeout(() => setDone(false), 1500);
      }}
      style={{
        fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 7,
        border: `1.5px solid ${done ? C.good : C.line}`, cursor: "pointer",
        background: done ? C.goodSoft : "#fff", color: done ? C.good : C.ink,
        whiteSpace: "nowrap",
      }}
    >{done ? "Copied ✓" : label}</button>
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

function CharBar({ value, min, max }) {
  const pct = Math.min(value / max, 1.08);
  const color = value > max ? C.bad : value < min ? C.warn : C.good;
  return (
    <div style={{ height: 3, background: C.line, borderRadius: 99, marginTop: 7, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: color, borderRadius: 99, transition: "width .4s ease" }} />
    </div>
  );
}

function LoadingSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, LOAD_STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ marginTop: 14 }}>
      {LOAD_STEPS.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", opacity: i <= step ? 1 : 0.28, transition: "opacity .5s" }}>
          <span style={{
            flexShrink: 0, width: 20, height: 20, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
            background: i < step ? C.goodSoft : i === step ? C.accentSoft : C.bg,
            color: i < step ? C.good : i === step ? C.accent : C.sub,
          }}>
            {i < step ? "✓" : i + 1}
          </span>
          <span className={i === step ? "rf-pulse" : ""} style={{ fontSize: 12.5, color: i === step ? C.ink : C.sub }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function FaqAccordion({ faqs }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${C.line}`, overflow: "hidden", marginTop: 8 }}>
      {faqs.map((f, i) => (
        <div key={i} className="rf-faq-row" style={{ borderBottom: i < faqs.length - 1 ? `1px solid ${C.line}` : "none", background: "#fff" }}>
          <div
            onClick={() => setOpen(open === i ? null : i)}
            style={{ padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer" }}
          >
            <span style={{ fontWeight: 600, fontSize: 14.5, flex: 1 }}>{f.q}</span>
            <span style={{ fontSize: 14, color: C.sub, transform: open === i ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>⌄</span>
          </div>
          {open === i && (
            <div className="rf-fade" style={{ padding: "0 16px 14px", fontSize: 14, color: "#3A4753", lineHeight: 1.7 }}>
              {f.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Markdown renderer ---------------- */
function renderMarkdown(md) {
  const lines = (md || "").split("\n");
  const out = [];
  let list = null, key = 0;
  const flush = () => {
    if (list) { out.push(<ul key={key++} style={{ paddingLeft: 22, margin: "8px 0" }}>{list}</ul>); list = null; }
  };
  const inline = (t) =>
    t.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
      seg.startsWith("**") ? <strong key={i}>{seg.slice(2, -2)}</strong> : seg
    );
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#\s/.test(line))   { flush(); out.push(<h1  key={key++} className="rf-display" style={{ fontSize: 27, fontWeight: 800, margin: "20px 0 8px",  color: C.ink, lineHeight: 1.25 }}>{inline(line.slice(2))}</h1>); }
    else if (/^##\s/.test(line))  { flush(); out.push(<h2  key={key++} className="rf-display" style={{ fontSize: 20, fontWeight: 700, margin: "24px 0 6px",  color: C.ink }}>{inline(line.slice(3))}</h2>); }
    else if (/^###\s/.test(line)) { flush(); out.push(<h3  key={key++} className="rf-display" style={{ fontSize: 16, fontWeight: 700, margin: "16px 0 4px",  color: C.ink }}>{inline(line.slice(4))}</h3>); }
    else if (/^[-*]\s/.test(line)) { (list = list || []).push(<li key={key++} style={{ margin: "4px 0", fontSize: 15, lineHeight: 1.7 }}>{inline(line.slice(2))}</li>); }
    else if (line === "") { flush(); }
    else { flush(); out.push(<p key={key++} style={{ fontSize: 15, lineHeight: 1.75, margin: "10px 0", color: "#28333E" }}>{inline(line)}</p>); }
  }
  flush();
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
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const run = async () => {
    if (!form.keyword.trim()) { setError("Enter a target keyword to generate content."); return; }
    setLoading(true); setError(null);
    try {
      const res = await generateContent(form);
      setResult(res);
      setTab("article");
      setHistory(h => [{ keyword: form.keyword, at: new Date().toLocaleTimeString() }, ...h].slice(0, 8));
    } catch (e) {
      setError(`Generation failed: ${e.message}. Try again — long articles occasionally exceed limits; pick a shorter length if it repeats.`);
    } finally { setLoading(false); }
  };

  /* Cmd/Ctrl + Enter to generate */
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; });
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runRef.current(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
    { id: "article",  label: "Article" },
    { id: "seopack",  label: "SEO Pack" },
    { id: "serp",     label: "SERP Preview" },
    { id: "schema",   label: "Schema" },
    { id: "audit",    label: `Audit · ${result ? seo.score : "—"}` },
  ];

  return (
    <div className="rf-body" style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <style>{STYLES}</style>

      {/* Header */}
      <header style={{
        background: C.ink, color: "#fff", padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", gap: 14,
        borderBottom: "1px solid rgba(255,255,255,.07)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /><path d="M8 10.5l2 2 3.5-3.5" />
          </svg>
        </div>
        <div>
          <div className="rf-display" style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.2 }}>Publo</div>
          <div style={{ fontSize: 11, color: "#8FA3B2", letterSpacing: ".01em" }}>AI SEO Content Engine</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div className="rf-mono" style={{ fontSize: 11, color: "#5E7687" }}>draft → audit → publish</div>
        </div>
      </header>

      <main style={{ display: "grid", gridTemplateColumns: "minmax(300px, 360px) 1fr", alignItems: "start" }}>

        {/* ====== Left: brief panel ====== */}
        <section className="rf-sidebar" style={{ background: C.panel, borderRight: `1px solid ${C.line}` }}>
          <div style={{ padding: "20px 22px 28px" }}>
            <h2 className="rf-display" style={{ fontSize: 13, fontWeight: 800, margin: "0 0 18px", textTransform: "uppercase", letterSpacing: ".06em", color: C.sub }}>Content brief</h2>

            <Field label="Target keyword *" hint="The exact phrase you want to rank for.">
              <input className="rf-input" style={inputBase} value={form.keyword} onChange={set("keyword")} placeholder="e.g. best running shoes for flat feet" />
            </Field>

            <Field label="Secondary keywords" hint="Comma-separated — or leave blank to auto-derive.">
              <input className="rf-input" style={inputBase} value={form.secondary} onChange={set("secondary")} placeholder="e.g. arch support, overpronation" />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Content type">
                <select className="rf-input" style={inputBase} value={form.type} onChange={set("type")}>
                  {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Tone">
                <select className="rf-input" style={inputBase} value={form.tone} onChange={set("tone")}>
                  {TONES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Length">
              <select className="rf-input" style={inputBase} value={form.length} onChange={e => setForm(f => ({ ...f, length: Number(e.target.value) }))}>
                {LENGTHS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>

            <Field label="Audience">
              <input className="rf-input" style={inputBase} value={form.audience} onChange={set("audience")} placeholder="e.g. beginner runners, 25–40" />
            </Field>

            <Field label="Extra instructions">
              <textarea className="rf-input" style={{ ...inputBase, minHeight: 68, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Brand voice, things to include or avoid…" />
            </Field>

            <Field label="Your domain (for SERP preview)">
              <input className="rf-input" style={inputBase} value={form.domain} onChange={set("domain")} />
            </Field>

            <button
              onClick={run}
              disabled={loading}
              className="rf-display rf-btn-primary"
              style={{
                width: "100%", padding: "13px 16px", fontSize: 14, fontWeight: 800, borderRadius: 9,
                border: "none", cursor: loading ? "wait" : "pointer",
                background: loading ? "#8FA3D9" : C.accent, color: "#fff", letterSpacing: ".02em",
                marginTop: 4,
              }}
            >
              {loading ? "Generating…" : "Generate content package"}
            </button>

            {!loading && (
              <div className="rf-mono" style={{ fontSize: 10.5, color: "#A0B0BC", textAlign: "center", marginTop: 7 }}>
                ⌘ Enter to generate
              </div>
            )}

            {loading && <LoadingSteps />}

            {error && (
              <div style={{ marginTop: 14, padding: "10px 13px", background: C.badSoft, color: C.bad, fontSize: 12.5, borderRadius: 8, border: `1px solid #EFC7C0`, lineHeight: 1.6 }}>
                {error}
              </div>
            )}

            {history.length > 0 && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
                <div className="rf-display" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: C.sub, marginBottom: 10 }}>This session</div>
                {history.map((h, i) => (
                  <div key={i} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${C.line}`, color: C.sub, display: "flex", gap: 8 }}>
                    <span className="rf-mono" style={{ color: C.accent, flexShrink: 0 }}>{h.at}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.keyword}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ====== Right: output ====== */}
        <section style={{ padding: "28px 28px 40px", minWidth: 0 }}>

          {/* Empty state */}
          {!result && !loading && (
            <div className="rf-fade" style={{ maxWidth: 580, margin: "40px auto" }}>
              <div className="rf-display" style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.12, textAlign: "center" }}>
                One keyword in.<br />A <span style={{ color: C.accent }}>publish-ready page</span> out.
              </div>
              <p style={{ fontSize: 14.5, color: C.sub, marginTop: 14, lineHeight: 1.75, textAlign: "center" }}>
                Enter a target keyword on the left. The engine writes the article, meta title, description,
                URL slug, FAQs, JSON-LD schema, and internal-link plan — then audits it against 12 on-page
                SEO checks before you ship it.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 32 }}>
                {FEATURES.map(f => (
                  <div key={f.label} className="rf-feature-card" style={{
                    background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
                    padding: "16px 16px 14px", boxShadow: "0 2px 8px rgba(0,0,0,.04)",
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                    <div className="rf-display" style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.55 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="rf-fade">

              {/* Tab bar + export */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`rf-display rf-tab${tab === t.id ? " rf-tab-active" : ""}`}
                    style={{
                      padding: "7px 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: "pointer",
                      border: `1.5px solid ${tab === t.id ? C.accent : C.line}`,
                      background: tab === t.id ? C.accentSoft : "#fff",
                      color: tab === t.id ? C.accent : C.sub,
                    }}
                  >{t.label}</button>
                ))}
                <button
                  onClick={exportAll}
                  className="rf-display rf-export-btn"
                  style={{ marginLeft: "auto", padding: "7px 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "none", background: C.ink, color: "#fff" }}
                >
                  Export ↓
                </button>
              </div>

              {/* ---- Article ---- */}
              {tab === "article" && (
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "28px 34px", maxWidth: 820, boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
                    <span className="rf-mono" style={{ fontSize: 11.5, color: C.sub }}>{seo.wordCount} words · {seo.h2s} sections · {seo.density}% density</span>
                    <CopyBtn text={result.article} label="Copy Markdown" />
                  </div>
                  <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 20 }}>
                    {renderMarkdown(result.article)}
                  </div>
                  {Array.isArray(result.faqs) && result.faqs.length > 0 && (
                    <div style={{ marginTop: 28 }}>
                      <h2 className="rf-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: C.ink }}>Frequently asked questions</h2>
                      <FaqAccordion faqs={result.faqs} />
                    </div>
                  )}
                </div>
              )}

              {/* ---- SEO Pack ---- */}
              {tab === "seopack" && (
                <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
                  {[
                    { label: "Meta title", value: result.metaTitle, min: 30, max: 60 },
                    { label: "Meta description", value: result.metaDescription, min: 120, max: 160 },
                    { label: "URL slug", value: `/${result.slug}`, min: 1, max: 999 },
                  ].map((row, i) => (
                    <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 6px rgba(0,0,0,.03)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span className="rf-display" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.sub }}>{row.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {row.max < 999 && (
                            <span className="rf-mono" style={{
                              fontSize: 11, padding: "2px 8px", borderRadius: 99,
                              background: row.value.length > row.max ? C.badSoft : row.value.length < row.min ? C.warnSoft : C.goodSoft,
                              color: row.value.length > row.max ? C.bad : row.value.length < row.min ? C.warn : C.good,
                            }}>{row.value.length}/{row.max}</span>
                          )}
                          <CopyBtn text={row.value} />
                        </div>
                      </div>
                      {row.max < 999 && <CharBar value={row.value.length} min={row.min} max={row.max} />}
                      <div style={{ fontSize: 15, marginTop: 10, lineHeight: 1.5 }}>{row.value}</div>
                    </div>
                  ))}

                  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px" }}>
                    <div className="rf-display" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.sub, marginBottom: 10 }}>Keywords used</div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {(result.keywords || []).map((k, i) => (
                        <span key={i} className="rf-mono" style={{ fontSize: 12, padding: "4px 11px", borderRadius: 99, background: i === 0 ? C.accentSoft : C.bg, color: i === 0 ? C.accent : C.sub, border: `1px solid ${i === 0 ? C.accent : C.line}` }}>{k}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px" }}>
                    <div className="rf-display" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.sub, marginBottom: 10 }}>Internal link plan</div>
                    {(result.internalLinks || []).map((l, i) => (
                      <div key={i} style={{ fontSize: 14, padding: "7px 0", borderBottom: i < result.internalLinks.length - 1 ? `1px solid ${C.line}` : "none", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: C.accent, flexShrink: 0 }}>↳</span> {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---- SERP Preview ---- */}
              {tab === "serp" && (
                <div style={{ maxWidth: 680 }}>
                  <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "26px 28px", boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
                    <div className="rf-display" style={{ fontSize: 11, color: C.sub, marginBottom: 20, textTransform: "uppercase", letterSpacing: ".06em" }}>Google search result preview</div>
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
                    {Array.isArray(result.faqs) && result.faqs.length > 0 && (
                      <div style={{ marginTop: 26 }}>
                        <div className="rf-display" style={{ fontSize: 11, color: C.sub, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>People also ask — your FAQs target these boxes</div>
                        {result.faqs.slice(0, 4).map((f, i) => (
                          <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: i === 0 ? "8px 8px 0 0" : i === Math.min(3, result.faqs.length - 1) ? "0 0 8px 8px" : 0, borderTop: i > 0 ? "none" : undefined, padding: "12px 14px", fontSize: 14, fontFamily: "Arial, sans-serif", display: "flex", justifyContent: "space-between" }}>
                            {f.q} <span style={{ color: C.sub }}>⌄</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: C.sub, marginTop: 10, lineHeight: 1.6 }}>
                    Title truncates near 60 characters and descriptions near 160 — the preview shows exactly where Google would cut.
                  </p>
                </div>
              )}

              {/* ---- Schema ---- */}
              {tab === "schema" && (
                <div style={{ maxWidth: 820 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.sub }}>Paste into your page's <span className="rf-mono">&lt;head&gt;</span>. Validate at Google's Rich Results Test.</span>
                    <CopyBtn text={`<script type="application/ld+json">\n${JSON.stringify(result.schema, null, 2)}\n</script>`} label="Copy with script tag" />
                  </div>
                  <pre className="rf-mono" style={{ background: "#0E1822", color: "#C9E3F5", fontSize: 12.5, lineHeight: 1.6, padding: 22, borderRadius: 12, overflow: "auto", maxHeight: 520, margin: 0 }}>
                    {JSON.stringify(result.schema, null, 2)}
                  </pre>
                </div>
              )}

              {/* ---- Audit ---- */}
              {tab === "audit" && (
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, maxWidth: 820, alignItems: "start" }}>
                  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "22px 20px", textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,.04)" }}>
                    <ScoreRing score={seo.score} />
                    <div className="rf-display" style={{ fontSize: 13, fontWeight: 700, marginTop: 10, color: seo.score >= 80 ? C.good : seo.score >= 55 ? C.warn : C.bad }}>
                      {seo.score >= 80 ? "Ready to publish" : seo.score >= 55 ? "Fix warnings first" : "Needs work"}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>12-point on-page audit</div>
                  </div>
                  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.04)" }}>
                    {seo.checks.map((c, i) => (
                      <div key={i} className="rf-check-row" style={{ padding: "11px 16px", borderBottom: i < seo.checks.length - 1 ? `1px solid ${C.line}` : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{
                          flexShrink: 0, width: 22, height: 22, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700,
                          background: c.pass ? C.goodSoft : c.warn ? C.warnSoft : C.badSoft,
                          color: c.pass ? C.good : c.warn ? C.warn : C.bad,
                        }}>{c.pass ? "✓" : c.warn ? "!" : "✕"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.label}</div>
                          {!c.pass && <div style={{ fontSize: 12, color: C.sub, marginTop: 2, lineHeight: 1.55 }}>{c.tip}</div>}
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
