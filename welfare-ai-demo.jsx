import React, { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "face-api.js";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import {
  Shield, Bell, LayoutDashboard, ClipboardList, Camera as CameraIcon,
  BarChart3, FileText, Users, LogOut, ChevronRight, Moon, Briefcase,
  Smile, HeartHandshake, CheckCircle2, AlertTriangle, TrendingUp,
  Download, Printer, Lock, ArrowLeft, ArrowRight, Info, RefreshCcw,
  Stethoscope, Calendar, MapPin, Video, Phone, PhoneCall,
  Brain, ShieldCheck, Siren, Target, Compass, X, TrendingDown, Minus,
} from "lucide-react";

/* ---------------------------------------------------------------
   Design tokens
   Base: deep navy field, quiet steel-blue accent, muted status hues.
   Type: IBM Plex Sans throughout — one family, weight does the work.
----------------------------------------------------------------- */
const T = {
  bg: "#0E1621",
  surface: "#141F2E",
  surfaceRaised: "#1B2838",
  border: "#26374B",
  borderSoft: "#1E2C3D",
  text: "#E9EEF4",
  textDim: "#93A6BC",
  textFaint: "#5E7188",
  accent: "#4C93C7",
  accentDim: "#2E4A61",
  good: "#4F9E72",
  goodDim: "#20362A",
  warn: "#C79A48",
  warnDim: "#3A2F1A",
  bad: "#C15A52",
  badDim: "#3A2320",
};

const fontLink = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap";
const FACE_API_MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

/* ---------------------------------------------------------------
   Mock data
----------------------------------------------------------------- */
const QUESTIONS = {
  "Sleep & Recovery": {
    icon: Moon,
    items: [
      "How well did you sleep over the past week?",
      "How rested do you feel after waking?",
      "Have irregular duty hours affected your sleep?",
    ],
  },
  Workload: {
    icon: Briefcase,
    items: [
      "How manageable is your current workload?",
      "How often do you feel mentally exhausted after duty?",
      "How difficult is it to concentrate during tasks?",
    ],
  },
  Mood: {
    icon: Smile,
    items: [
      "How would you describe your overall mood this week?",
      "How often have you felt unusually worried or tense?",
      "How connected do you feel with your colleagues?",
    ],
  },
  "Social & Family": {
    icon: HeartHandshake,
    items: [
      "How often do you get to communicate with family?",
      "Do you feel supported by the people around you?",
      "Do you have enough time for personal recovery?",
    ],
  },
};

const OPTIONS = [
  { v: 5, label: "Very good", emoji: "😊" },
  { v: 4, label: "Good", emoji: "🙂" },
  { v: 3, label: "Okay", emoji: "😐" },
  { v: 2, label: "Difficult", emoji: "😟" },
  { v: 1, label: "Very difficult", emoji: "😔" },
];

const VOICE_HINTS = [
  { pattern: "(very good|excellent|great|amazing|really good|super good|very well|option five|choose five|pick five|number five)", value: 5 },
  { pattern: "(good|fine|better|okayish|all right|pretty good|well enough|option four|choose four|pick four|number four)", value: 4 },
  { pattern: "(okay|ok|average|moderate|fair|alright|so so|not bad|option three|choose three|pick three|number three)", value: 3 },
  { pattern: "(difficult|hard|poor|not easy|tough|struggling|challenging|option two|choose two|pick two|number two)", value: 2 },
  { pattern: "(very difficult|very hard|bad|awful|extremely difficult|really hard|terrible|option one|choose one|pick one|number one)", value: 1 },
];

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function detectVoiceScore(text) {
  if (!text) return null;
  const normalized = text.toLowerCase().trim();
  const directNumber = Number(normalized.replace(/[^0-9]/g, ""));
  if (Number.isInteger(directNumber) && directNumber >= 1 && directNumber <= 5) return directNumber;

  const plainText = normalized
    .replace(/\b(?:option|select|choose|pick|number)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = plainText.split(/\s+/);
  if (words.includes("ok") || words.includes("okay")) return 3;

  for (const w of words) {
    if (NUMBER_WORDS[w] >= 1 && NUMBER_WORDS[w] <= 5) return NUMBER_WORDS[w];
  }

  for (const option of VOICE_HINTS) {
    if (new RegExp(option.pattern, "i").test(normalized)) return option.value;
  }
  return null;
}

const TREND_HISTORY = [
  { day: "Mon", score: 63 }, { day: "Tue", score: 66 }, { day: "Wed", score: 61 },
  { day: "Thu", score: 70 }, { day: "Fri", score: 68 }, { day: "Sat", score: 74 },
  { day: "Sun", score: 72 },
];

const ROSTER = [
  { id: "PN-2201", name: "Personnel A", score: 81, risk: "low", last: "Today" },
  { id: "PN-2242", name: "Personnel B", score: 58, risk: "moderate", last: "1 day ago" },
  { id: "PN-2260", name: "Personnel C", score: 38, risk: "high", last: "2 days ago" },
  { id: "PN-2277", name: "Personnel D", score: 76, risk: "low", last: "Today" },
  { id: "PN-2301", name: "Personnel E", score: 64, risk: "moderate", last: "3 days ago" },
];

function resolveLoggedInProfile(email, role) {
  const cleanedEmail = (email || "").trim().toLowerCase();
  const localPart = cleanedEmail.split("@")[0] || "";
  const sanitized = localPart.replace(/[^a-z]/g, "");

  const emailName = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const match = ROSTER.find((person) => {
    const personKey = person.name.toLowerCase().replace(/\s+/g, "");
    return personKey.includes(sanitized) || sanitized.includes(personKey);
  });

  if (match) return { ...match, email: cleanedEmail, name: emailName || match.name };

  if (role === "doctor") return { id: "DR-1001", email: cleanedEmail, name: emailName ? `Dr. ${emailName}` : "Dr. Asha Verma", score: 86, risk: "low", last: "Today" };
  if (role === "admin") return { id: "WO-1001", email: cleanedEmail, name: emailName ? `Welfare Officer ${emailName}` : "Welfare Officer Nisha", score: 82, risk: "low", last: "Today" };

  return {
    id: `PN-${Math.abs(hashStr(cleanedEmail)) % 9000 + 1000}`,
    email: cleanedEmail,
    name: emailName || "Personnel User",
    score: 74,
    risk: "moderate",
    last: "Today",
  };
}

const EXPRESSIONS = [
  { key: "happy", label: "Happy", emoji: "😊", color: T.good },
  { key: "neutral", label: "Neutral", emoji: "😐", color: T.accent },
  { key: "sad", label: "Sad", emoji: "😢", color: "#7AA2C9" },
  { key: "angry", label: "Angry", emoji: "😠", color: T.bad },
  { key: "fearful", label: "Fearful", emoji: "😨", color: T.warn },
  { key: "disgusted", label: "Disgusted", emoji: "🤢", color: "#8E7CC3" },
  { key: "surprised", label: "Surprised", emoji: "😮", color: "#D3A3FF" },
];

function riskOf(score) {
  if (score >= 72) return { key: "low", label: "Low concern", color: T.good, dim: T.goodDim };
  if (score >= 50) return { key: "moderate", label: "Moderate concern", color: T.warn, dim: T.warnDim };
  return { key: "high", label: "High concern", color: T.bad, dim: T.badDim };
}

/* ---------------------------------------------------------------
   Consultation recommendation data (mock — demo scheduling only)
----------------------------------------------------------------- */
const LOCATIONS = [
  { id: "base-clinic", name: "Base Medical Center", distance: "On-site", query: "Base Medical Center" },
  { id: "station-clinic", name: "Station Wellness Clinic", distance: "12 km away", query: "Station Wellness Clinic" },
  { id: "civil-hospital", name: "Nearby Civil Hospital (referral)", distance: "18 km away", query: "Nearby Civil Hospital" },
];

const REMOTE_OPTIONS = [
  { id: "video", label: "Video consultation", icon: Video },
  { id: "phone", label: "Phone consultation", icon: PhoneCall },
];

const CONSULT_PHONE = "8208528296";

const TIME_SLOTS = [
  "Today, 4:30 PM", "Today, 6:00 PM", "Tomorrow, 9:00 AM",
  "Tomorrow, 11:30 AM", "Wed, 10:00 AM", "Wed, 3:00 PM",
];

function consultationRecommendationFor(score) {
  const risk = riskOf(score);
  if (risk.key === "high") {
    return {
      type: "Priority consultation", professional: "Unit Medical Officer / Counsellor",
      urgency: "Within 24–48 hours", color: T.bad, dim: T.badDim,
      note: "Elevated concern signals were detected — a prompt check-in is recommended, in person where possible.",
    };
  }
  if (risk.key === "moderate") {
    return {
      type: "Routine consultation", professional: "Welfare Counsellor",
      urgency: "Within 1–2 weeks", color: T.warn, dim: T.warnDim,
      note: "A routine check-in is suggested to review workload and recovery.",
    };
  }
  return {
    type: "Optional wellness check-in", professional: "Welfare Counsellor",
    urgency: "At your convenience", color: T.good, dim: T.goodDim,
    note: "No urgent concerns from current signals — a check-in remains available anytime you'd like to talk.",
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
// Deterministic per-person mock trend + category breakdown, so each
// roster member gets their own distinct 7-day graph and category mix.
function personSeries(person) {
  const rnd = seededRandom(hashStr(person.id) + 1);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let base = Math.max(20, person.score - 8);
  const trend = days.map((day, i) => {
    base = Math.max(20, Math.min(95, base + Math.round((rnd() - 0.4) * 6)));
    return { day, score: i === days.length - 1 ? person.score : base };
  });
  const categories = {};
  Object.keys(QUESTIONS).forEach((cat) => {
    categories[cat] = Math.max(30, Math.min(95, Math.round(person.score + (rnd() - 0.5) * 30)));
  });
  return { trend, categories };
}

/* ---------------------------------------------------------------
   NEW: Mission-Aware Stress Prediction
   Combines the existing wellness score with operational/mission
   context. This is additive — it does not change how `overall` or
   `riskOf()` are computed anywhere else in the app.
----------------------------------------------------------------- */
const MISSION_FIELDS = {
  deployment: {
    label: "Deployment Duration", icon: "🪖",
    options: [
      { v: "short", label: "Short (< 1 month)", penalty: 0 },
      { v: "medium", label: "Medium (1–3 months)", penalty: 8 },
      { v: "long", label: "Long (3+ months)", penalty: 16 },
    ],
  },
  dutyHours: {
    label: "Duty Hours", icon: "🕐",
    options: [
      { v: "normal", label: "Normal", penalty: 0 },
      { v: "extended", label: "Extended", penalty: 10 },
      { v: "very-extended", label: "Very extended", penalty: 18 },
    ],
  },
  nightShifts: {
    label: "Night Shifts", icon: "🌙",
    options: [
      { v: "none", label: "None", penalty: 0 },
      { v: "some", label: "Some", penalty: 6 },
      { v: "frequent", label: "Frequent", penalty: 12 },
    ],
  },
  restHours: {
    label: "Rest Hours", icon: "😴",
    options: [
      { v: "adequate", label: "Adequate", penalty: 0 },
      { v: "reduced", label: "Reduced", penalty: 10 },
      { v: "minimal", label: "Minimal", penalty: 18 },
    ],
  },
  workload: {
    label: "Workload Level", icon: "📈",
    options: [
      { v: "normal", label: "Normal", penalty: 0 },
      { v: "high", label: "High", penalty: 10 },
      { v: "very-high", label: "Very high", penalty: 16 },
    ],
  },
  leave: {
    label: "Leave Status", icon: "🗓️",
    options: [
      { v: "recent", label: "Recent leave taken", penalty: 0 },
      { v: "overdue", label: "Leave overdue", penalty: 8 },
    ],
  },
  training: {
    label: "Recent Training Load", icon: "🎯",
    options: [
      { v: "normal", label: "Normal", penalty: 0 },
      { v: "high", label: "High", penalty: 8 },
    ],
  },
};

const MISSION_DEFAULTS = {
  deployment: "short", dutyHours: "normal", nightShifts: "none",
  restHours: "adequate", workload: "normal", leave: "recent", training: "normal",
};

function missionOptionLabel(fieldKey, value) {
  const opt = MISSION_FIELDS[fieldKey].options.find((o) => o.v === value);
  return opt ? opt.label : value;
}

/** Mission-aware stress risk = base stress (inverse of wellness) + mission-context penalties. */
function missionAwareRisk(overall, mission) {
  const baseStress = 100 - (overall ?? 70);
  let stress = baseStress;
  const reasons = [];
  Object.entries(mission || MISSION_DEFAULTS).forEach(([key, value]) => {
    const field = MISSION_FIELDS[key];
    if (!field) return;
    const opt = field.options.find((o) => o.v === value);
    if (opt && opt.penalty > 0) {
      stress += opt.penalty;
      reasons.push(`${field.label}: ${opt.label}`);
    }
  });
  stress = Math.max(0, Math.min(100, Math.round(stress)));
  let level;
  if (stress < 40) level = { key: "low", label: "Low", emoji: "🟢", color: T.good };
  else if (stress < 60) level = { key: "moderate", label: "Moderate", emoji: "🟡", color: T.warn };
  else if (stress < 80) level = { key: "elevated", label: "Elevated", emoji: "🟠", color: T.warn };
  else level = { key: "high", label: "High", emoji: "🔴", color: T.bad };
  if (reasons.length === 0) reasons.push("No significant operational stress factors reported.");
  return { stress, level, reasons };
}

/* ---------------------------------------------------------------
   NEW: Explainable AI — contributing factors behind the risk score.
   Purely additive: reads existing categoryScores + mission penalties,
   never changes how the underlying scores are calculated.
----------------------------------------------------------------- */
function explainableFactors(categoryScores, mission) {
  const factors = [];
  Object.entries(categoryScores || {}).forEach(([cat, score]) => {
    const gap = Math.max(0, 70 - score); // how far below a healthy baseline
    if (gap > 0) factors.push({ label: cat, weight: gap, kind: "wellness" });
  });
  Object.entries(mission || MISSION_DEFAULTS).forEach(([key, value]) => {
    const field = MISSION_FIELDS[key];
    const opt = field?.options.find((o) => o.v === value);
    if (opt && opt.penalty > 0) factors.push({ label: field.label, weight: opt.penalty, kind: "mission" });
  });
  const total = factors.reduce((s, f) => s + f.weight, 0) || 1;
  return factors
    .map((f) => ({ ...f, pct: Math.round((f.weight / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
}

/* ---------------------------------------------------------------
   NEW: Future Stress Forecast — simulated 7-day projection.
   Deterministic per-score (not random each render) so refreshing the
   page doesn't jitter the forecast. Architecture is ready to be
   swapped for a real trained forecasting model later.
----------------------------------------------------------------- */
function buildForecast(overall) {
  const stressNow = 100 - (overall ?? 70);
  const rnd = seededRandom(Math.round(stressNow * 97) + 13);
  const days = ["Today", "Tomorrow", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
  let s = stressNow;
  const drift = (rnd() - 0.35) * 6; // slight upward bias, like the example in the spec
  const points = days.map(() => {
    s = Math.max(5, Math.min(95, s + drift + (rnd() - 0.5) * 8));
    return Math.round(s);
  });
  const levelFor = (v) =>
    v < 40 ? { label: "Low", emoji: "🟢" }
    : v < 60 ? { label: "Moderate", emoji: "🟡" }
    : v < 80 ? { label: "Elevated", emoji: "🟠" }
    : { label: "High", emoji: "🔴" };
  const forecast = days.map((day, i) => ({ day, stress: points[i], ...levelFor(points[i]) }));
  const peak = Math.max(...points);
  const trend = points[points.length - 1] > points[0] + 3 ? "Increasing ↑" : points[points.length - 1] < points[0] - 3 ? "Improving ↓" : "Stable →";
  return { forecast, current: stressNow, peak, trend };
}

/* ---------------------------------------------------------------
   NEW: Personalized recommendations — supportive, non-clinical.
----------------------------------------------------------------- */
function personalizedRecommendations(categoryScores, trend, overall) {
  const recs = [];
  if ((categoryScores?.["Sleep & Recovery"] ?? 100) < 65)
    recs.push("Consider prioritizing adequate rest and reviewing your current duty/rest pattern.");
  if ((categoryScores?.["Workload"] ?? 100) < 65)
    recs.push("Consider requesting a welfare review of your current workload.");
  if (trend === "Increasing ↑")
    recs.push("Your wellness-risk trend is increasing. Consider completing a follow-up check-in.");
  if ((overall ?? 100) < 50)
    recs.push("Consider requesting confidential support or an authorized professional consultation.");
  if (recs.length === 0)
    recs.push("No specific concerns detected right now — keep up your current routine and check in regularly.");
  return recs;
}



function buildSimplePdf(blocks) {
  // blocks: [{ text, size=11, gap=16, bold=false }]
  const pageWidth = 612, pageHeight = 792, marginX = 54;
  let y = pageHeight - 60;
  const ops = [];
  blocks.forEach((b) => {
    const font = b.bold ? "/F2" : "/F1";
    const size = b.size || 11;
    ops.push(`BT ${font} ${size} Tf ${marginX} ${y} Td (${escapePdfText(b.text)}) Tj ET`);
    y -= b.gap || Math.round(size * 1.5);
  });
  const content = ops.join("\n");

  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 6 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function downloadTextAsPdf(blocks, filename) {
  const pdfString = buildSimplePdf(blocks);
  const bytes = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) bytes[i] = pdfString.charCodeAt(i) & 0xff;
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------------------------------------------
   Small building blocks
----------------------------------------------------------------- */
function Badge({ color, dim, children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 5, fontSize: 12.5, fontWeight: 600,
      color, background: dim, border: `1px solid ${color}33`,
    }}>{children}</span>
  );
}

function ProgressBar({ value, color = T.accent }) {
  return (
    <div style={{ height: 6, background: T.borderSoft, borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, value))}%`, height: "100%",
        background: color, borderRadius: 3, transition: "width .5s ease",
      }} />
    </div>
  );
}

function Panel({ children, style, className }) {
  return (
    <div className={className} style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: 20, ...style,
    }}>{children}</div>
  );
}

function StatCard({ label, value, sub, accentColor }) {
  return (
    <Panel style={{ borderLeft: `3px solid ${accentColor || T.accent}`, flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12.5, color: T.textDim, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: T.text, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>{sub}</div>}
    </Panel>
  );
}

function PageHeader({ title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>{title}</h1>
        {sub && <p style={{ fontSize: 13.5, color: T.textDim, margin: "6px 0 0" }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", icon: Icon, style, disabled }) {
  const variants = {
    primary: { background: T.accent, color: "#0E1621", border: `1px solid ${T.accent}` },
    secondary: { background: "transparent", color: T.text, border: `1px solid ${T.border}` },
    ghost: { background: "transparent", color: T.textDim, border: "1px solid transparent" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "9px 16px", borderRadius: 6, fontSize: 13.5, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      fontFamily: "inherit", ...variants[variant], ...style,
    }}>
      {Icon && <Icon size={15} />} {children}
    </button>
  );
}

/* ---------------------------------------------------------------
   Login
----------------------------------------------------------------- */
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState("personnel");
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("welfareAiLogin") || "null");
      if (saved?.email && saved?.password) {
        setEmail(saved.email);
        setPw(saved.password);
        if (saved.role) setRole(saved.role);
        setRememberMe(true);
      }
    } catch (error) {
      console.warn("Unable to restore saved login credentials:", error);
    }
  }, []);

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const hasCredentials = emailIsValid && pw.trim();

  const handleLogin = () => {
    if (!hasCredentials) return;

    if (rememberMe) {
      localStorage.setItem("welfareAiLogin", JSON.stringify({ email: email.trim(), password: pw, role }));
    } else {
      localStorage.removeItem("welfareAiLogin");
    }

    onLogin(role, email.trim());
  };

  const roleOptions = [
    { value: "personnel", label: "Personnel" },
    { value: "admin", label: "Welfare Officer" },
    { value: "doctor", label: "Doctor" },
  ];

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(circle at 50% 0%, #16233350, ${T.bg} 60%)`, padding: 20,
    }}>
      <div style={{ width: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 10, background: T.accentDim,
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
            border: `1px solid ${T.accent}55`,
          }}>
            <Shield size={26} color={T.accent} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: 0.2 }}>Personnel Welfare AI</div>
          <div style={{ fontSize: 12.5, color: T.textFaint, marginTop: 4 }}>Wellness screening & decision-support platform</div>
        </div>

        <Panel>
          <label style={{ fontSize: 12, color: T.textDim, display: "block", marginBottom: 6 }}>Sign in as</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 6, marginBottom: 14,
              background: T.bg, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: "inherit",
            }}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <label style={{ fontSize: 12, color: T.textDim, display: "block", marginBottom: 6 }}>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 6, marginBottom: 14,
              background: T.bg, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: "inherit",
            }}
          />
          <label style={{ fontSize: 12, color: T.textDim, display: "block", marginBottom: 6 }}>Password</label>
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 6, marginBottom: 12,
              background: T.bg, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: "inherit",
            }}
          />

          <label style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 18, fontSize: 12.5, color: T.textDim,
            cursor: "pointer", userSelect: "none",
          }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: T.accent }}
            />
            Save login details
          </label>

          <Button onClick={handleLogin} disabled={!hasCredentials} style={{ width: "100%", justifyContent: "center" }}>
            Sign in
          </Button>

          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 11.5, color: T.textFaint,
            justifyContent: "center",
          }}>
            <Lock size={12} /> Email and password are required to continue
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Sidebar / Shell
----------------------------------------------------------------- */
const NAV_PERSONNEL = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "screening", label: "Screening", icon: ClipboardList },
  { key: "camera", label: "Camera check", icon: CameraIcon },
  { key: "insights", label: "Risk Insights", icon: Brain },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "consultations", label: "Consultations", icon: Stethoscope },
  { key: "report", label: "Reports", icon: FileText },
  { key: "privacy", label: "Privacy Center", icon: ShieldCheck },
];
const NAV_ADMIN = [
  { key: "admin", label: "Overview", icon: LayoutDashboard },
  { key: "analytics", label: "Team analytics", icon: BarChart3 },
  { key: "sos", label: "SOS Requests", icon: Siren },
  { key: "consultations", label: "Consultations", icon: Stethoscope },
  { key: "report", label: "Reports", icon: FileText },
  { key: "privacy", label: "Privacy Center", icon: ShieldCheck },
];
const NAV_DOCTOR = [
  { key: "doctor-dashboard", label: "Doctor Dashboard", icon: LayoutDashboard },
  { key: "consultations", label: "Consultation Requests", icon: Stethoscope },
  { key: "analytics", label: "Appointments", icon: Calendar },
  { key: "report", label: "Reports", icon: FileText },
  { key: "privacy", label: "Privacy Center", icon: ShieldCheck },
];

function Sidebar({ role, page, setPage, onLogout }) {
  const items = role === "admin" ? NAV_ADMIN : role === "doctor" ? NAV_DOCTOR : NAV_PERSONNEL;
  return (
    <div className="no-print" style={{
      width: 216, background: T.surface, borderRight: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", padding: "18px 12px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 26 }}>
        <Shield size={19} color={T.accent} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text, letterSpacing: 0.1 }}>Welfare AI</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => {
          const active = page === it.key;
          return (
            <button key={it.key} onClick={() => setPage(it.key)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6,
              background: active ? T.accentDim : "transparent", border: "none", cursor: "pointer",
              color: active ? T.accent : T.textDim, fontSize: 13.5, fontWeight: active ? 600 : 500,
              fontFamily: "inherit", textAlign: "left",
            }}>
              <it.icon size={16} /> {it.label}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 14, borderTop: `1px solid ${T.borderSoft}` }}>
        <button onClick={onLogout} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6,
          background: "transparent", border: "none", cursor: "pointer", color: T.textFaint,
          fontSize: 13, fontFamily: "inherit", width: "100%", textAlign: "left",
        }}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );
}

function TopBar({ role, user }) {
  const displayName = user?.name || (role === "admin" ? "Welfare Officer" : role === "doctor" ? "Doctor" : "Personnel");

  return (
    <div className="no-print" style={{
      height: 54, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 22px", flexShrink: 0,
    }}>
      <div style={{ fontSize: 12.5, color: T.textFaint }}>
        {role === "admin" ? `Welfare Officer Console · ${displayName}` : role === "doctor" ? `Doctor Portal · ${displayName}` : `Personnel Portal · ${displayName}`}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Bell size={16} color={T.textDim} />
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: T.accentDim,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11.5, fontWeight: 700, color: T.accent, border: `1px solid ${T.accent}44`,
        }}>{role === "admin" ? "WO" : role === "doctor" ? "DR" : "PN"}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Dashboard (personnel)
----------------------------------------------------------------- */
function DashboardPage({ result, setPage, onSendSos, user }) {
  const score = result?.overall ?? 69;
  const risk = riskOf(score);
  const personName = user?.name || result?.person?.name || "You";

  return (
    <div>
      <PageHeader
        title={result ? `Welcome back, ${personName}` : `Good evening, ${personName}`}
        sub={`${personName}'s current wellness overview.`}
        right={onSendSos ? <SilentSosButton onSend={onSendSos} /> : null}
      />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Wellness score" value={score} sub="out of 100" accentColor={risk.color} />
        <StatCard label="Risk level" value={risk.label} accentColor={risk.color} />
        <StatCard label="Last screening" value={result ? "Today" : "5 days ago"} />
        <StatCard label="7-day trend" value="+6 pts" sub="Improving" accentColor={T.good} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Panel style={{ flex: "2 1 380px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Wellness trend, last 7 days</div>
            <TrendingUp size={15} color={T.textFaint} />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={result?.trend || TREND_HISTORY}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="day" stroke={T.textFaint} fontSize={12} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis stroke={T.textFaint} fontSize={12} domain={[0, 100]} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5 }} />
              <Line type="monotone" dataKey="score" stroke={T.accent} strokeWidth={2.5} dot={{ r: 3, fill: T.accent }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel style={{ flex: "1 1 220px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Recommendations</div>
          {(result?.observations || [
            "Sleep and recovery may need attention.",
            "Social support appears relatively strong.",
            "Consider a short recovery break this week.",
          ]).map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: T.textDim, marginBottom: 10, lineHeight: 1.5 }}>
              <CheckCircle2 size={15} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} /> {o}
            </div>
          ))}
        </Panel>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Button onClick={() => setPage("screening")} icon={ClipboardList}>Start screening</Button>
        <Button onClick={() => setPage("camera")} variant="secondary" icon={CameraIcon}>Camera check</Button>
        <Button onClick={() => setPage("insights")} variant="secondary" icon={Brain}>Risk insights</Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Screening
----------------------------------------------------------------- */
function ScreeningPage({ onComplete }) {
  const categories = Object.keys(QUESTIONS);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [voiceStatus, setVoiceStatus] = useState({});
  const recognitionRef = useRef(null);

  const catKey = categories[step];
  const cat = QUESTIONS[catKey];
  const catAnswers = answers[catKey] || {};
  const catComplete = cat.items.every((_, i) => catAnswers[i] != null);
  const progress = ((step) / categories.length) * 100 + (catComplete ? (100 / categories.length) : 0);

  function setAnswer(qIdx, v) {
    setAnswers((prev) => ({ ...prev, [catKey]: { ...(prev[catKey] || {}), [qIdx]: v } }));
  }

  function startVoiceAnswer(questionIndex) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus((prev) => ({ ...prev, [questionIndex]: "Voice input is not supported in this browser. Please use Chrome or Edge on localhost." }));
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          startSpeechRecognition(questionIndex, SpeechRecognition);
        })
        .catch(() => {
          setVoiceStatus((prev) => ({ ...prev, [questionIndex]: "Microphone permission is blocked. Allow mic access in the browser, then try again." }));
        });
      return;
    }

    startSpeechRecognition(questionIndex, SpeechRecognition);
  }

  function startSpeechRecognition(questionIndex, SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceStatus((prev) => ({ ...prev, [questionIndex]: "Listening… speak your answer." }));
    };

    recognition.onspeechend = () => {
      setVoiceStatus((prev) => ({ ...prev, [questionIndex]: "Processing your voice response…" }));
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        for (let j = 0; j < event.results[i].length; j++) {
          transcript += `${event.results[i][j].transcript} `;
        }
      }
      transcript = transcript.trim();
      const score = detectVoiceScore(transcript);
      if (score != null) {
        setAnswer(questionIndex, score);
        setVoiceStatus((prev) => ({ ...prev, [questionIndex]: `Heard: “${transcript}” → mapped to ${score}/5.` }));
      } else {
        setVoiceStatus((prev) => ({ ...prev, [questionIndex]: `Heard: “${transcript}”. Please say a value like good, okay, difficult, or a number from 1 to 5.` }));
      }
    };

    recognition.onerror = (event) => {
      const message = event.error === "not-allowed"
        ? "Microphone permission was blocked. Please allow mic access and try again."
        : event.error === "no-speech"
          ? "No speech was detected. Please speak clearly and try again."
          : event.error === "timed-out"
            ? "Voice response timed out. Please try again."
            : "Voice input failed. Please try again or use the buttons.";
      setVoiceStatus((prev) => ({ ...prev, [questionIndex]: message }));
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function finish() {
    const categoryScores = {};
    categories.forEach((c) => {
      const a = answers[c] || {};
      const vals = Object.values(a);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      categoryScores[c] = Math.round(avg * 20);
    });
    const overall = Math.round(
      Object.values(categoryScores).reduce((s, v) => s + v, 0) / categories.length
    );
    onComplete(categoryScores, overall);
  }

  return (
    <div>
      <PageHeader title="Wellness screening" sub="Answer honestly — there are no right or wrong responses." />
      <div style={{ marginBottom: 22 }}>
        <ProgressBar value={progress} />
        <div style={{ fontSize: 12, color: T.textFaint, marginTop: 6 }}>
          Section {step + 1} of {categories.length}
        </div>
      </div>

      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <cat.icon size={18} color={T.accent} />
          <div style={{ fontSize: 15.5, fontWeight: 600, color: T.text }}>{catKey}</div>
        </div>

        {cat.items.map((q, qi) => (
          <div key={qi} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13.5, color: T.text, marginBottom: 10 }}>{q}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {OPTIONS.map((opt) => {
                const selected = catAnswers[qi] === opt.v;
                return (
                  <button key={opt.v} onClick={() => setAnswer(qi, opt.v)} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "10px 14px", borderRadius: 7, cursor: "pointer", minWidth: 76,
                    background: selected ? T.accentDim : T.bg,
                    border: `1px solid ${selected ? T.accent : T.border}`,
                    color: selected ? T.accent : T.textDim, fontFamily: "inherit",
                  }}>
                    <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                    <span style={{ fontSize: 11 }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => startVoiceAnswer(qi)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 10px", borderRadius: 6,
                  background: T.bg, border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                }}
              >
                🎙 Voice answer
              </button>
              {voiceStatus[qi] && (
                <span style={{ fontSize: 11.5, color: T.textDim }}>{voiceStatus[qi]}</span>
              )}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <Button variant="secondary" icon={ArrowLeft} disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
          {step < categories.length - 1 ? (
            <Button icon={ArrowRight} disabled={!catComplete} onClick={() => setStep((s) => s + 1)}>Next section</Button>
          ) : (
            <Button icon={CheckCircle2} disabled={!catComplete} onClick={finish}>Complete screening</Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------
   AI Analysis result
----------------------------------------------------------------- */
function ResultPage({ result, setPage }) {
  if (!result) {
    return (
      <div>
        <PageHeader title="AI wellness assessment" />
        <Panel><div style={{ color: T.textDim, fontSize: 13.5 }}>Complete a screening to see your assessment.</div></Panel>
      </div>
    );
  }
  const risk = riskOf(result.overall);
  return (
    <div>
      <PageHeader title="AI wellness assessment"
        sub="A screening and decision-support signal — not a clinical diagnosis."
        right={<Badge color={risk.color} dim={risk.dim}><AlertTriangle size={12} /> {risk.label}</Badge>} />

      <Panel style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: T.text }}>{result.overall}</div>
          <div style={{ fontSize: 13, color: T.textDim }}>/ 100 overall wellness indicator</div>
        </div>
        {Object.entries(result.categoryScores).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: T.text }}>{k}</span>
              <span style={{ color: T.textDim }}>{v}%</span>
            </div>
            <ProgressBar value={v} color={riskOf(v).color} />
          </div>
        ))}
      </Panel>

      <Panel style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 12 }}>AI-generated observations</div>
        {result.observations.map((o, i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: T.textDim, marginBottom: 10, lineHeight: 1.5 }}>
            <CheckCircle2 size={15} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} /> {o}
          </div>
        ))}
      </Panel>

      <Panel style={{ display: "flex", gap: 10, alignItems: "flex-start", background: T.accentDim, border: `1px solid ${T.accent}44` }}>
        <Info size={16} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: T.textDim, lineHeight: 1.6 }}>
          This indicator is generated from self-reported responses and is intended to support, not replace,
          judgment by a qualified welfare or medical professional. If concerns persist, please speak with one.
        </div>
      </Panel>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Button onClick={() => setPage("report")} icon={FileText}>View report card</Button>
        <Button onClick={() => setPage("dashboard")} variant="secondary">Back to dashboard</Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Camera wellness check (simulated — clearly labelled)
----------------------------------------------------------------- */
const CAMERA_ERROR_MESSAGES = {
  NotAllowedError: "Camera permission was denied. Click the 🔒 site controls icon in your browser's address bar → Camera → Allow, then click Retry Camera.",
  NotFoundError: "No camera was found on this device. Connect a camera and click Retry Camera.",
  NotReadableError: "Your camera appears to be in use by another application or tab. Close it, then click Retry Camera.",
  SecurityError: "Your browser blocked this request due to a security restriction.",
  insecureContext: "Camera access requires HTTPS (or localhost during development) — this page isn't currently served over a secure origin.",
  unsupported: "This browser doesn't support camera access (getUserMedia is unavailable).",
  unknown: "Camera access failed. Please try again.",
};

function CameraPage({ onSignal }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [errorType, setErrorType] = useState(null);
  const [permissionState, setPermissionState] = useState(null);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [showTechnical, setShowTechnical] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelError, setModelError] = useState(null);

  const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  useEffect(() => {
    let permStatus;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "camera" })
        .then((result) => {
          permStatus = result;
          setPermissionState(result.state);
          result.onchange = () => setPermissionState(result.state);
        })
        .catch(() => {});
    }
    return () => { if (permStatus) permStatus.onchange = null; };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus((s) => (s === "active" ? "idle" : s));
  }, []);

  useEffect(() => {
    if (status !== "active" || !videoRef.current || !streamRef.current) return;
    if (videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;
    videoRef.current.play().catch(() => {});
  }, [status]);

  const startCamera = useCallback(async () => {
    setErrorType(null);
    setModelError(null);

    if (!isSecureContext) {
      setErrorType("insecureContext");
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorType("unsupported");
      setStatus("error");
      return;
    }

    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setStatus("active");
    } catch (e) {
      const name = e && e.name;
      setErrorType(
        name === "NotAllowedError" ? "NotAllowedError"
        : name === "NotFoundError" ? "NotFoundError"
        : name === "NotReadableError" ? "NotReadableError"
        : name === "SecurityError" ? "SecurityError"
        : "unknown"
      );
      setStatus("error");
    }
  }, [isSecureContext]);

  useEffect(() => {
    let cancelled = false;
    if (status !== "active") {
      setModelsReady(false);
      return undefined;
    }

    async function loadFaceModels() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(FACE_API_MODEL_URL),
        ]);
        if (!cancelled) setModelsReady(true);
      } catch (err) {
        console.error("Failed to load face models", err);
        if (!cancelled) {
          setModelError("Unable to load face-analysis models. Please check your internet connection and try again.");
          setStatus("error");
        }
      }
    }

    loadFaceModels();
    return () => { cancelled = true; };
  }, [status]);

  useEffect(() => {
    if (status !== "active" || !modelsReady || !videoRef.current) return undefined;

    const detectExpression = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const result = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (!result) {
          setCurrent({ key: "neutral", label: "No face detected", emoji: "—", color: T.textDim, confidence: 0 });
          return;
        }

        const best = result.expressions.asSortedArray()[0];
        const mapping = {
          happy: { key: "happy", label: "Happy", emoji: "😊", color: T.good },
          neutral: { key: "neutral", label: "Neutral", emoji: "😐", color: T.accent },
          sad: { key: "sad", label: "Sad", emoji: "😢", color: "#7AA2C9" },
          angry: { key: "angry", label: "Angry", emoji: "😠", color: T.bad },
          fearful: { key: "fearful", label: "Fearful", emoji: "😨", color: T.warn },
          disgusted: { key: "disgusted", label: "Disgusted", emoji: "🤢", color: "#8E7CC3" },
          surprised: { key: "surprised", label: "Surprised", emoji: "😮", color: "#D3A3FF" },
        };

        const expression = mapping[best.expression] || {
          key: "neutral",
          label: best.expression,
          emoji: "😐",
          color: T.accent,
        };

        const reading = {
          ...expression,
          confidence: Math.round(best.probability * 100),
          t: Date.now(),
        };

        setCurrent(reading);
        setHistory((h) => [reading, ...h].slice(0, 8));
      } catch (err) {
        console.error("Face detection error", err);
        setModelError("Face detection is temporarily unavailable. Please try again.");
      }
    };

    detectExpression();
    intervalRef.current = setInterval(detectExpression, 1300);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, modelsReady]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const counts = EXPRESSIONS.map((e) => ({
    ...e,
    pct: history.length ? Math.round((history.filter((h) => h.key === e.key).length / history.length) * 100) : 0,
  }));

  const blockedBeforeAsking = permissionState === "denied" && status === "idle";
  const showSimulatedFallback = status === "error" && isInIframe;
  const showRealError = status === "error" && !isInIframe;

  return (
    <div>
      <PageHeader title="AI-assisted expression & wellness signal"
        sub="Live webcam analysis using a face-expression model."
        right={<Badge color={T.good} dim={T.goodDim}><Info size={12} /> Live analysis</Badge>} />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Panel style={{ flex: "1 1 340px" }}>
          <div style={{
            position: "relative", aspectRatio: "4/3", background: "#060B12", borderRadius: 8,
            overflow: "hidden", border: `1px solid ${T.border}`, display: "flex",
            alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}>
            {status === "active" ? (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : showSimulatedFallback ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", margin: "0 auto 12px",
                  background: `radial-gradient(circle, ${T.warn}33, transparent 70%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "welfarePulse 2.2s ease-in-out infinite",
                }}>
                  <span style={{ fontSize: 28 }}>{current ? current.emoji : "🙂"}</span>
                </div>
                <div style={{ fontSize: 12.5, color: T.warn, fontWeight: 600, marginBottom: 4 }}>
                  🟠 Simulated preview (demo mode)
                </div>
                <div style={{ fontSize: 11.5, color: T.textFaint, maxWidth: 280, margin: "0 auto" }}>
                  This real browser version uses a live face model when opened outside the sandboxed preview.
                </div>
              </div>
            ) : showRealError ? (
              <div style={{ textAlign: "center", padding: 20, maxWidth: 300 }}>
                <CameraIcon size={26} style={{ marginBottom: 8, opacity: 0.6, color: T.warn }} />
                <div style={{ fontSize: 12.5, color: T.warn, fontWeight: 600 }}>
                  {CAMERA_ERROR_MESSAGES[errorType] || CAMERA_ERROR_MESSAGES.unknown}
                </div>
                {modelError && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: T.textDim }}>{modelError}</div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: T.textFaint, fontSize: 12.5, padding: 20, maxWidth: 300 }}>
                <CameraIcon size={26} style={{ marginBottom: 8, opacity: 0.6 }} />
                {status === "requesting" && <div>Requesting camera access…</div>}
                {status === "idle" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>Camera access is optional and only used for the AI-assisted expression wellness signal.</div>
                    <div style={{ color: T.textFaint, fontSize: 11.5 }}>
                      Nothing is recorded or uploaded — your browser processes the camera feed locally.
                    </div>
                  </div>
                )}
              </div>
            )}
            {status === "active" && (
              <div style={{
                position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 6,
                background: "#0009", padding: "4px 9px", borderRadius: 5, fontSize: 11, color: T.good, fontWeight: 600,
              }}>
                🟢 Camera Active
              </div>
            )}
          </div>

          {showSimulatedFallback && (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setShowTechnical((s) => !s)}
                style={{ background: "none", border: "none", color: T.textFaint, fontSize: 11.5, cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                {showTechnical ? "Hide" : "Show"} technical details
              </button>
              {showTechnical && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: T.textFaint, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 10px" }}>
                  {CAMERA_ERROR_MESSAGES[errorType] || CAMERA_ERROR_MESSAGES.unknown}
                </div>
              )}
            </div>
          )}

          {blockedBeforeAsking && (
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 6,
              background: T.warnDim, border: `1px solid ${T.warn}44`, fontSize: 12.5, color: T.textDim, marginBottom: 12,
            }}>
              <Lock size={14} color={T.warn} style={{ flexShrink: 0, marginTop: 1 }} />
              Camera permission is blocked. Click the 🔒 site controls icon in your browser address bar → Camera → Allow, then click Retry Camera.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {status !== "active" ? (
              <Button icon={CameraIcon} onClick={startCamera} disabled={status === "requesting"}>
                {status === "error" ? "📷 Retry Camera" : "🎥 Allow Camera Access"}
              </Button>
            ) : (
              <>
                <Button icon={CameraIcon} variant="secondary" onClick={stopCamera}>Stop Camera</Button>
                <Button icon={RefreshCcw} variant="ghost" onClick={() => onSignal && current && onSignal(current)}>
                  Save current reading
                </Button>
              </>
            )}
          </div>
        </Panel>

        <Panel style={{ flex: "1 1 280px" }}>
          <div style={{ fontSize: 13, color: T.textDim, marginBottom: 6 }}>Current expression</div>
          {current ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 30 }}>{current.emoji}</span>
                <div style={{ fontSize: 18, fontWeight: 600, color: T.text }}>{current.label}</div>
              </div>
              <div style={{ fontSize: 12.5, color: T.textFaint, marginBottom: 16 }}>Confidence: {current.confidence}%</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: T.textFaint, marginBottom: 16 }}>
              {status === "active" ? "Waiting for first reading…" : "Start the camera to see live readings."}
            </div>
          )}

          <div style={{ fontSize: 13, color: T.textDim, marginBottom: 10 }}>Recent observations</div>
          {counts.map((c) => (
            <div key={c.key} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                <span style={{ color: T.text }}>{c.emoji} {c.label}</span>
                <span style={{ color: T.textDim }}>{c.pct}%</span>
              </div>
              <ProgressBar value={c.pct} color={c.color} />
            </div>
          ))}
        </Panel>
      </div>

      <Panel style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Info size={16} color={T.textFaint} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: T.textFaint, lineHeight: 1.6 }}>
          This feature reads only the live webcam feed and predicts a rough facial expression using a browser model.
          It is not a medical diagnosis and should be treated as one weak, optional signal alongside the questionnaire.
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------
   Analytics
----------------------------------------------------------------- */
function AnalyticsPage({ result, role }) {
  const trend = result?.trend || TREND_HISTORY;
  const categoryData = Object.entries(result?.categoryScores || {
    "Sleep & Recovery": 72, Workload: 58, Mood: 64, "Social & Family": 81,
  }).map(([name, value]) => ({ name: name.replace(" & ", " &\n"), value }));

  const riskDist = role === "admin"
    ? [
        { name: "Low", value: ROSTER.filter((r) => r.risk === "low").length, color: T.good },
        { name: "Moderate", value: ROSTER.filter((r) => r.risk === "moderate").length, color: T.warn },
        { name: "High", value: ROSTER.filter((r) => r.risk === "high").length, color: T.bad },
      ]
    : [
        { name: "Low", value: 4, color: T.good },
        { name: "Moderate", value: 2, color: T.warn },
        { name: "High", value: 1, color: T.bad },
      ];

  return (
    <div>
      <PageHeader title={role === "admin" ? "Team analytics" : "Analytics"}
        sub={role === "admin" ? "Aggregate trends across your unit. Individual responses stay access-controlled." : "Your trends over time."} />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Panel style={{ flex: "2 1 380px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>
            {role === "admin" ? "Average wellness trend" : "Wellness trend"}
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={trend}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="day" stroke={T.textFaint} fontSize={12} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis stroke={T.textFaint} fontSize={12} domain={[0, 100]} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5 }} />
              <Line type="monotone" dataKey="score" stroke={T.accent} strokeWidth={2.5} dot={{ r: 3, fill: T.accent }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel style={{ flex: "1 1 220px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Risk distribution</div>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={riskDist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                {riskDist.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 6 }}>
            {riskDist.map((d) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textDim }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} /> {d.name}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Category breakdown</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={categoryData}>
            <CartesianGrid stroke={T.borderSoft} vertical={false} />
            <XAxis dataKey="name" stroke={T.textFaint} fontSize={11.5} tickLine={false} axisLine={{ stroke: T.border }} interval={0} />
            <YAxis stroke={T.textFaint} fontSize={12} domain={[0, 100]} tickLine={false} axisLine={false} width={28} />
            <Tooltip contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5 }} />
            <Bar dataKey="value" fill={T.accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------
   Report card
----------------------------------------------------------------- */
function ReportPage({ result, person, currentUser }) {
  const activePerson = person || currentUser || result?.person || null;
  const overall = activePerson ? (activePerson.score ?? result?.overall ?? 74) : (result?.overall ?? 74);
  const risk = riskOf(overall);
  const personData = activePerson ? personSeries(activePerson) : null;
  const categories = personData?.categories || result?.categoryScores || {
    "Sleep & Recovery": 72, Workload: 68, Mood: 76, "Social & Family": 82,
  };
  const observations = result?.observations || [
    "Stable wellness indicators across the past week.",
    "Good social support reported.",
    "Recovery time appears adequate.",
  ];
  const rec = consultationRecommendationFor(overall);
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const personnelId = activePerson ? activePerson.id : "PN-2201";
  const displayName = activePerson?.name || "You";

  function handleDownloadPdf() {
    const blocks = [
      { text: "Personnel wellness report", size: 18, bold: true, gap: 30 },
      { text: `Personnel ID: ${personnelId}`, size: 11, gap: 16 },
      { text: `Assessment date: ${today}`, size: 11, gap: 24 },
      { text: `Overall wellness: ${overall} / 100  (${risk.label})`, size: 13, bold: true, gap: 26 },
      { text: "Category performance", size: 12, bold: true, gap: 18 },
      ...Object.entries(categories).map(([k, v]) => ({ text: `  ${k}: ${v}%`, size: 11, gap: 15 })),
      { text: "AI observations", size: 12, bold: true, gap: 18 },
      ...observations.map((o) => ({ text: `  - ${o}`, size: 11, gap: 15 })),
      { text: "Recommended consultation", size: 12, bold: true, gap: 18 },
      { text: `  ${rec.type} - ${rec.professional} (${rec.urgency})`, size: 11, gap: 15 },
      { text: `  ${rec.note}`, size: 11, gap: 24 },
      { text: "Generated by the AI-Based Personnel Welfare System.", size: 9, gap: 13 },
      { text: "Decision-support signal, not a clinical diagnosis.", size: 9, gap: 13 },
      { text: "If this is a mental health emergency, contact emergency services or a crisis helpline immediately.", size: 9, gap: 13 },
    ];
    downloadTextAsPdf(blocks, `wellness-report-${personnelId}.pdf`);
  }

  return (
    <div>
      <PageHeader title={`${displayName}'s wellness report`}
        right={<div className="no-print" style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
          <Button icon={Download} onClick={handleDownloadPdf}>Download PDF</Button>
        </div>} />
      <div className="no-print" style={{ fontSize: 11.5, color: T.textFaint, marginTop: -14, marginBottom: 14 }}>
        "Download PDF" saves a file straight to your device. "Print" opens your browser's print dialog instead.
      </div>

      <Panel className="print-page" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${T.border}`, paddingBottom: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, color: T.textFaint }}>Personnel ID</div>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{personnelId}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.textFaint }}>Assessment date</div>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{today}</div>
          </div>
        </div>

        <div style={{ marginBottom: 18, fontSize: 14, color: T.text, fontWeight: 600 }}>
          {displayName}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 4 }}>Overall wellness</div>
            <div style={{ fontSize: 38, fontWeight: 700, color: T.text }}>{overall}<span style={{ fontSize: 16, color: T.textFaint }}> / 100</span></div>
          </div>
          <Badge color={risk.color} dim={risk.dim}>{risk.label}</Badge>
        </div>

        <div style={{ fontSize: 12.5, color: T.textFaint, textTransform: "none", marginBottom: 10, fontWeight: 600 }}>Category performance</div>
        {Object.entries(categories).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "7px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
            <span style={{ color: T.text }}>{k}</span>
            <span style={{ color: T.textDim }}>{v}%</span>
          </div>
        ))}

        <div style={{ fontSize: 12.5, color: T.textFaint, marginTop: 20, marginBottom: 10, fontWeight: 600 }}>AI observations</div>
        {observations.map((o, i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: T.textDim, marginBottom: 8, lineHeight: 1.5 }}>
            <CheckCircle2 size={14} color={T.good} style={{ flexShrink: 0, marginTop: 2 }} /> {o}
          </div>
        ))}

        <div style={{ fontSize: 12.5, color: T.textFaint, marginTop: 20, marginBottom: 10, fontWeight: 600 }}>Recommended consultation</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: T.text, marginBottom: 4 }}>
          <span>{rec.type} · {rec.professional}</span>
          <Badge color={rec.color} dim={rec.dim}>{rec.urgency}</Badge>
        </div>
        <div style={{ fontSize: 12.5, color: T.textDim, lineHeight: 1.5 }}>{rec.note}</div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.textFaint, textAlign: "center" }}>
          Generated by the AI-Based Personnel Welfare System · decision-support signal, not a clinical diagnosis.
          If this is a mental health emergency, contact emergency services or a crisis helpline immediately.
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------
   Admin overview
----------------------------------------------------------------- */
function AdminPage({ setPage, onSelectPerson, user }) {
  const avg = Math.round(ROSTER.reduce((s, r) => s + r.score, 0) / ROSTER.length);
  const high = ROSTER.filter((r) => r.risk === "high");
  const welfareName = user?.name || "Welfare Officer";

  return (
    <div>
      <PageHeader title={`Welcome, ${welfareName}`} sub="Aggregate signals only — individual responses remain access-controlled." />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Unit average" value={avg} sub="wellness score" />
        <StatCard label="Personnel screened" value={`${ROSTER.length}/6`} sub="this week" />
        <StatCard label="High-concern flags" value={high.length} accentColor={T.bad} />
        <StatCard label="Screening completion" value="83%" accentColor={T.good} />
      </div>

      {high.length > 0 && (
        <Panel style={{ marginBottom: 16, borderLeft: `3px solid ${T.bad}`, background: T.badDim }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, fontWeight: 600, color: T.text, marginBottom: 4 }}>
            <AlertTriangle size={15} color={T.bad} /> Alerts
          </div>
          <div style={{ fontSize: 13, color: T.textDim }}>
            {high.map((h) => h.id).join(", ")} flagged for high concern — recommend welfare officer follow-up.
          </div>
        </Panel>
      )}

      <Panel>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Roster</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 24px", gap: 8, fontSize: 11.5, color: T.textFaint, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
          <div>ID</div><div>Name</div><div>Score</div><div>Risk</div><div>Last screening</div><div />
        </div>
        {ROSTER.map((r) => {
          const risk = riskOf(r.score);
          return (
            <div key={r.id} onClick={() => { onSelectPerson && onSelectPerson(r); setPage("personDetail"); }}
              style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 24px", gap: 8, fontSize: 13, color: T.text,
                padding: "11px 0", borderBottom: `1px solid ${T.borderSoft}`, alignItems: "center", cursor: "pointer",
              }}>
              <div style={{ color: T.textDim }}>{r.id}</div>
              <div>{r.name}</div>
              <div>{r.score}</div>
              <div><Badge color={risk.color} dim={risk.dim}>{risk.label}</Badge></div>
              <div style={{ color: T.textFaint }}>{r.last}</div>
              <div><ChevronRight size={14} color={T.textFaint} /></div>
            </div>
          );
        })}
      </Panel>

      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        <Button icon={BarChart3} onClick={() => setPage("analytics")}>View team analytics</Button>
        <Button variant="secondary" icon={Stethoscope} onClick={() => setPage("consultations")}>Consultations dashboard</Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Per-person dashboard — own graph + own consultation recommendation
----------------------------------------------------------------- */
function DoctorDashboardPage({ requests = [] }) {
  const consultationRequests = requests.length > 0
    ? requests.map((request) => ({
        id: request.id,
        patient: request.patientName || request.name || "Patient",
        patientEmail: request.patientEmail || request.email || "",
        time: request.slot || request.time || "To be scheduled",
        mode: request.mode || "In-person",
        priority: request.priority || "Routine",
      }))
    : [
        { id: "CR-104", patient: "A. Kumar", time: "Today, 4:30 PM", mode: "Video", priority: "High" },
        { id: "CR-118", patient: "N. Sharma", time: "Today, 6:15 PM", mode: "Phone", priority: "Moderate" },
        { id: "CR-121", patient: "P. Nair", time: "Tomorrow, 9:00 AM", mode: "In-person", priority: "Routine" },
      ];

  const appointments = consultationRequests.slice(0, 3).map((request) => ({
    patient: request.patient,
    slot: request.time,
    type: request.mode,
  }));

  return (
    <div>
      <PageHeader title="Doctor dashboard" sub="Review consultation requests and scheduled appointments." />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Consultation requests" value={String(consultationRequests.length)} sub="new this week" accentColor={T.bad} />
        <StatCard label="Appointments today" value={String(Math.min(appointments.length + 2, 5))} sub="scheduled" accentColor={T.accent} />
        <StatCard label="Pending follow-ups" value={String(Math.max(1, consultationRequests.length - 1))} sub="to review" accentColor={T.warn} />
        <StatCard label="Response rate" value="94%" sub="within 24h" accentColor={T.good} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Panel style={{ flex: "2 1 420px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Consultation requests</div>
          {consultationRequests.map((request) => (
            <div key={request.id} style={{
              display: "flex", justifyContent: "space-between", gap: 12,
              padding: "12px 0", borderBottom: `1px solid ${T.borderSoft}`, alignItems: "center", flexWrap: "wrap",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{request.patient}</div>
                {request.patientEmail && <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 2 }}>{request.patientEmail}</div>}
                <div style={{ fontSize: 12, color: T.textDim }}>{request.id} · {request.time} · {request.mode}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Badge color={request.priority === "High" ? T.bad : request.priority === "Moderate" ? T.warn : T.good} dim={request.priority === "High" ? T.badDim : request.priority === "Moderate" ? T.warnDim : T.goodDim}>
                  {request.priority}
                </Badge>
                <Button variant="secondary" style={{ padding: "7px 12px", fontSize: 12.5 }}>Review</Button>
                <Button style={{ padding: "7px 12px", fontSize: 12.5 }}>Accept</Button>
              </div>
            </div>
          ))}
        </Panel>

        <Panel style={{ flex: "1 1 260px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Appointments</div>
          {appointments.map((item, index) => (
            <div key={`${item.patient}-${index}`} style={{ padding: "10px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.patient}</div>
              <div style={{ fontSize: 12, color: T.textDim }}>{item.slot}</div>
              <div style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>{item.type}</div>
            </div>
          ))}
          <div style={{ marginTop: 14 }}>
            <Button style={{ width: "100%", justifyContent: "center" }} icon={Calendar}>Book appointment</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PersonDetailPage({ person, setPage, setSelectedPerson }) {
  if (!person) {
    return (
      <div>
        <PageHeader title="Personnel dashboard" />
        <Panel><div style={{ color: T.textDim, fontSize: 13.5 }}>Select someone from the roster to view their dashboard.</div></Panel>
      </div>
    );
  }
  const { trend, categories } = personSeries(person);
  const risk = riskOf(person.score);
  const rec = consultationRecommendationFor(person.score);

  return (
    <div>
      <PageHeader title={person.name}
        sub={`${person.id} · Individual wellness dashboard`}
        right={<Button variant="secondary" icon={ArrowLeft} onClick={() => setPage("admin")}>Back to roster</Button>} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Current score" value={person.score} sub="out of 100" accentColor={risk.color} />
        <StatCard label="Risk level" value={risk.label} accentColor={risk.color} />
        <StatCard label="Last screening" value={person.last} />
        <StatCard label="Recommended consultation" value={rec.urgency} accentColor={rec.color} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Panel style={{ flex: "2 1 380px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>
            {person.name}'s wellness trend, last 7 days
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="day" stroke={T.textFaint} fontSize={12} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis stroke={T.textFaint} fontSize={12} domain={[0, 100]} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5 }} />
              <Line type="monotone" dataKey="score" stroke={risk.color} strokeWidth={2.5} dot={{ r: 3, fill: risk.color }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel style={{ flex: "1 1 260px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Category breakdown</div>
          {Object.entries(categories).map(([k, v]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: T.text }}>{k}</span>
                <span style={{ color: T.textDim }}>{v}%</span>
              </div>
              <ProgressBar value={v} color={riskOf(v).color} />
            </div>
          ))}
        </Panel>
      </div>

      <Panel style={{ marginTop: 16, borderLeft: `3px solid ${rec.color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{rec.type} recommended</div>
          <Badge color={rec.color} dim={rec.dim}>{rec.urgency}</Badge>
        </div>
        <div style={{ fontSize: 13, color: T.textDim, marginBottom: 14, lineHeight: 1.5 }}>{rec.note} Suggested with: {rec.professional}.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button icon={Stethoscope} onClick={() => setPage("consultations")}>Schedule consultation</Button>
          <Button variant="secondary" icon={FileText} onClick={() => setPage("report")}>View printable report</Button>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------
   Consultations — recommendation + scheduling (timing / location / remote)
----------------------------------------------------------------- */
function ConsultationBooking({ subject, onRequestConsultation, currentUser }) {
  const [mode, setMode] = useState("in-person"); // "in-person" | "remote"
  const [locationId, setLocationId] = useState(LOCATIONS[0].id);
  const [remoteId, setRemoteId] = useState(REMOTE_OPTIONS[0].id);
  const [slot, setSlot] = useState(null);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const rec = consultationRecommendationFor(subject.score);

  useEffect(() => { setConfirmed(false); setSlot(null); setCustomDate(""); setCustomTime(""); }, [subject.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => setUserCoords(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  const optionStyle = (selected) => ({
    display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 6, cursor: "pointer",
    background: selected ? T.accentDim : T.bg, border: `1px solid ${selected ? T.accent : T.border}`,
    color: selected ? T.accent : T.textDim, fontSize: 13, fontFamily: "inherit",
  });
  const inputStyle = {
    padding: "9px 12px", borderRadius: 6, background: T.bg, border: `1px solid ${T.border}`,
    color: T.text, fontSize: 13, fontFamily: "inherit",
  };

  // A custom date+time (if the user filled both) takes priority over a preset slot.
  const customSlot = customDate && customTime
    ? new Date(`${customDate}T${customTime}`).toLocaleString("en-IN", {
        weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit",
      })
    : null;
  const effectiveSlot = customSlot || slot;
  const selectedLocation = LOCATIONS.find((item) => item.id === locationId) || LOCATIONS[0];
  const directionsUrl = userCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.latitude},${userCoords.longitude}&destination=${encodeURIComponent(selectedLocation.query)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLocation.query + " India")}`;

  function pickCustom(field, value) {
    setSlot(null);
    if (field === "date") setCustomDate(value); else setCustomTime(value);
  }

  return (
    <Panel style={{ borderLeft: `3px solid ${rec.color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{rec.type} for {subject.name}</div>
          <div style={{ fontSize: 12.5, color: T.textDim, marginTop: 4 }}>{rec.note}</div>
        </div>
        <Badge color={rec.color} dim={rec.dim}>{rec.urgency}</Badge>
      </div>

      <div style={{ fontSize: 12.5, color: T.textFaint, fontWeight: 600, marginBottom: 8 }}>How would you like to consult?</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setMode("in-person")} style={optionStyle(mode === "in-person")}>
          <MapPin size={14} /> In person
        </button>
        <button onClick={() => setMode("remote")} style={optionStyle(mode === "remote")}>
          <Video size={14} /> Remote
        </button>
      </div>

      {mode === "in-person" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {LOCATIONS.map((l) => (
            <button key={l.id} onClick={() => setLocationId(l.id)} style={{ ...optionStyle(locationId === l.id), flexDirection: "column", alignItems: "flex-start", minWidth: 160 }}>
              <span style={{ fontWeight: 600, color: locationId === l.id ? T.accent : T.text }}>{l.name}</span>
              <span style={{ fontSize: 11.5, color: T.textFaint }}>{l.distance}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {REMOTE_OPTIONS.map((o) => (
              <button key={o.id} onClick={() => setRemoteId(o.id)} style={optionStyle(remoteId === o.id)}>
                <o.icon size={14} /> {o.label}
              </button>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 6,
            background: T.accentDim, border: `1px solid ${T.accent}44`, fontSize: 13, color: T.text,
          }}>
            <Phone size={14} color={T.accent} />
            {remoteId === "video" ? "Video consultation number: " : "Call this number for your consultation: "}
            <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>{CONSULT_PHONE}</span>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: T.textFaint, fontWeight: 600, marginBottom: 8 }}>Choose a time</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {TIME_SLOTS.map((t) => (
          <button key={t} onClick={() => { setSlot(t); setCustomDate(""); setCustomTime(""); }} style={optionStyle(slot === t)}>
            <Calendar size={13} /> {t}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 8 }}>Or pick your own date and time</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <input type="date" value={customDate} onChange={(e) => pickCustom("date", e.target.value)} style={inputStyle} />
        <input type="time" value={customTime} onChange={(e) => pickCustom("time", e.target.value)} style={inputStyle} />
        {customSlot && <span style={{ fontSize: 12.5, color: T.accent }}>Selected: {customSlot}</span>}
      </div>

      {mode === "in-person" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "9px 12px", borderRadius: 6,
              background: T.accentDim, border: `1px solid ${T.accent}44`,
              color: T.accent, fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            <MapPin size={14} /> {userCoords ? "Live route to" : "Open map for"} {selectedLocation.name}
          </a>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px",
            borderRadius: 6, background: T.bg, border: `1px solid ${T.border}`,
            color: T.textDim, fontSize: 12.5,
          }}>
            <Compass size={14} /> Distance: {selectedLocation.distance}
          </span>
        </div>
      )}

      {mode === "remote" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          <button
            onClick={() => {
              if (remoteId === "video") {
                window.open("https://meet.google.com", "_blank", "noopener,noreferrer");
                return;
              }
              window.location.href = `tel:${CONSULT_PHONE}`;
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "9px 12px", borderRadius: 6,
              background: T.accentDim, border: `1px solid ${T.accent}44`,
              color: T.accent, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {remoteId === "video" ? <Video size={14} /> : <Phone size={14} />} 
            {remoteId === "video" ? "Start live video consultation" : "Call doctor now"}
          </button>
        </div>
      )}

      {confirmed ? (
        <Badge color={T.good} dim={T.goodDim}><CheckCircle2 size={13} /> Appointment request sent to {CONSULT_PHONE} for {effectiveSlot}</Badge>
      ) : (
        <Button
          icon={Stethoscope}
          disabled={!effectiveSlot}
          onClick={async () => {
            const patientName = subject.name || "Patient";
            const patientEmail = subject.email || currentUser?.email || "";
            const request = {
              id: `CR-${Date.now()}`,
              patientName,
              name: patientName,
              patientId: subject.id || "PN-2201",
              email: patientEmail,
              patientEmail,
              slot: effectiveSlot,
              mode: mode === "remote" ? (remoteId === "video" ? "Video" : "Phone") : "In-person",
              priority: rec.urgency === "Within 24–48 hours" ? "High" : rec.urgency === "Within 1–2 weeks" ? "Moderate" : "Routine",
              time: effectiveSlot,
            };

            if (onRequestConsultation) {
              onRequestConsultation((prev) => [request, ...prev]);
            }

            const msgText = `Appointment request for ${patientName}. Preferred slot: ${effectiveSlot}. Mode: ${mode === "remote" ? (remoteId === "video" ? "Video consultation" : "Phone consultation") : `In person at ${LOCATIONS.find((item) => item.id === locationId)?.name}`}.`;
            const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

            if (isMobile) {
              const msg = encodeURIComponent(msgText);
              window.location.href = `sms:${CONSULT_PHONE}?body=${msg}`;
            } else {
              const payload = `To: ${CONSULT_PHONE}\n\n${msgText}`;
              try {
                await navigator.clipboard.writeText(payload);
                window.alert(`Appointment request copied. Paste this into SMS to ${CONSULT_PHONE}.\n\n${payload}`);
              } catch {
                window.alert(`Appointment request ready to send to ${CONSULT_PHONE}:\n\n${payload}`);
              }
            }

            setConfirmed(true);
          }}
        >
          Request appointment
        </Button>
      )}
    </Panel>
  );
}

function ConsultationsPage({ role, result, roster = ROSTER, currentUser, consultationRequests = [], onAddConsultationRequest }) {
  const [activeId, setActiveId] = useState(role === "admin" ? null : "self");

  const selfSubject = currentUser || { id: "PN-2201", name: "You", score: result?.overall ?? 69 };
  const activePerson = activeId === "self" ? selfSubject : roster.find((r) => r.id === activeId) || null;

  return (
    <div>
      <PageHeader title="Consultations"
        sub="AI-informed recommendations for professional follow-up — timing, location, and remote options." />

      <Panel style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, background: T.accentDim, border: `1px solid ${T.accent}44` }}>
        <Info size={16} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: T.textDim, lineHeight: 1.6 }}>
          These are scheduling suggestions from screening signals, not a medical referral or diagnosis. In a crisis
          or medical emergency, contact emergency services or a crisis helpline immediately rather than using this page.
        </div>
      </Panel>

      {role === "admin" && (
        <Panel style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 14 }}>Team consultation queue</div>

          {consultationRequests.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, color: T.textFaint, marginBottom: 8 }}>New patient requests</div>
              {consultationRequests.map((req) => (
                <div key={req.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 8, fontSize: 13, color: T.text, padding: "10px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
                  <div>{req.patientName}</div>
                  <div style={{ color: T.textDim }}>{req.mode}</div>
                  <div style={{ color: T.textDim }}>{req.slot}</div>
                  <div><Badge color={T.accent} dim={T.accentDim}>{req.priority || "Routine"}</Badge></div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, fontSize: 11.5, color: T.textFaint, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <div>Name</div><div>Score</div><div>Recommended</div><div>Timing</div><div />
          </div>
          {roster.map((r) => {
            const rec = consultationRecommendationFor(r.score);
            return (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, fontSize: 13, color: T.text, padding: "11px 0", borderBottom: `1px solid ${T.borderSoft}`, alignItems: "center" }}>
                <div>{r.name}</div>
                <div style={{ color: T.textDim }}>{r.score}</div>
                <div style={{ color: T.textDim }}>{rec.type}</div>
                <div><Badge color={rec.color} dim={rec.dim}>{rec.urgency}</Badge></div>
                <div><Button variant={activeId === r.id ? "primary" : "secondary"} onClick={() => setActiveId(r.id)} style={{ padding: "6px 12px", fontSize: 12.5 }}>Schedule</Button></div>
              </div>
            );
          })}
        </Panel>
      )}

      {activePerson ? (
        <ConsultationBooking subject={activePerson} currentUser={currentUser} onRequestConsultation={onAddConsultationRequest} />
      ) : (
        <Panel><div style={{ fontSize: 13, color: T.textDim }}>Select someone from the queue above to view and schedule their recommended consultation.</div></Panel>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   NEW: Risk Insights page — Mission Context, Mission-Aware Risk,
   Explainable AI, Future Stress Forecast, Personalized Recommendations,
   and a Wellness Trend Timeline summary. All additive; none of this
   changes the existing screening/report/analytics logic.
----------------------------------------------------------------- */
function InsightsPage({ result }) {
  const [mission, setMission] = useState(MISSION_DEFAULTS);
  const overall = result?.overall ?? 69;
  const categoryScores = result?.categoryScores || { "Sleep & Recovery": 68, Workload: 64, Mood: 74, "Social & Family": 80 };

  const missionRisk = missionAwareRisk(overall, mission);
  const factors = explainableFactors(categoryScores, mission);
  const { forecast, current, peak, trend } = buildForecast(overall);
  const recs = personalizedRecommendations(categoryScores, trend, overall);

  // Wellness Trend Timeline — reuses the same deterministic per-score
  // trend generator already used elsewhere in the app (personSeries),
  // just presented as a labeled timeline here.
  const { trend: weekTrend } = personSeries({ id: "YOU-TIMELINE", score: overall });
  const labelFor = (v) => (v >= 72 ? "Low" : v >= 50 ? "Moderate" : "High");
  const weekAvg = Math.round(weekTrend.reduce((s, d) => s + d.score, 0) / weekTrend.length);

  return (
    <div>
      <PageHeader title="Risk Insights"
        sub="Mission-aware, explainable AI risk assessment — a wellness-support indicator, not a medical diagnosis." />

      {/* Mission Context */}
      <Panel style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <Compass size={16} color={T.accent} /> Mission Context
        </div>
        <div style={{ fontSize: 12.5, color: T.textFaint, marginBottom: 14 }}>
          Optional operational context — combined with your screening responses for a mission-aware risk estimate.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {Object.entries(MISSION_FIELDS).map(([key, field]) => (
            <div key={key}>
              <div style={{ fontSize: 12, color: T.textDim, marginBottom: 6 }}>{field.icon} {field.label}</div>
              <select
                value={mission[key]}
                onChange={(e) => setMission((m) => ({ ...m, [key]: e.target.value }))}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 6, background: T.bg,
                  border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontFamily: "inherit",
                }}
              >
                {field.options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Panel>

      {/* Mission-Aware Stress Risk */}
      <Panel style={{ marginBottom: 16, borderLeft: `3px solid ${missionRisk.level.color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Mission-Aware Stress Risk</div>
          <Badge color={missionRisk.level.color} dim={missionRisk.level.color === T.good ? T.goodDim : missionRisk.level.color === T.bad ? T.badDim : T.warnDim}>
            {missionRisk.level.emoji} {missionRisk.level.label}
          </Badge>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{missionRisk.stress}/100</div>
        <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 6 }}>Reason:</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: T.textDim }}>
          {missionRisk.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 10 }}>
          This is an AI-based wellness risk assessment, not a medical diagnosis.
        </div>
      </Panel>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        {/* Explainable AI */}
        <Panel style={{ flex: "1 1 340px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Why is your risk high?</div>
          <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 14 }}>Top contributing factors</div>
          {factors.map((f) => (
            <div key={f.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                <span>{f.kind === "mission" ? "🪖" : "📋"} {f.label}</span>
                <span style={{ color: T.textDim }}>+{f.pct}%</span>
              </div>
              <ProgressBar value={f.pct} color={f.kind === "mission" ? T.warn : T.accent} />
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 10, lineHeight: 1.5 }}>
            Your current risk estimate is primarily associated with the factors above, weighted by how far each
            deviates from a healthy baseline. Architecture is ready for real feature-importance / SHAP output
            once a trained model is connected.
          </div>
        </Panel>

        {/* Future Stress Forecast */}
        <Panel style={{ flex: "1 1 340px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Future Stress Forecast</div>
          <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 10 }}>
            Current Risk: {current}/100 · Predicted Peak: {peak}/100 · Trend: {trend}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={forecast}>
              <CartesianGrid stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="day" stroke={T.textFaint} fontSize={11} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis stroke={T.textFaint} fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} width={24} />
              <Tooltip contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12 }} />
              <Line type="monotone" dataKey="stress" stroke={T.warn} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {forecast.map((f) => (
              <span key={f.day} style={{ fontSize: 11, color: T.textDim, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "3px 7px" }}>
                {f.day} → {f.emoji} {f.label}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 10 }}>
            Your recent workload, sleep and duty pattern indicate {trend === "Increasing ↑" ? "an increasing" : trend === "Improving ↓" ? "an improving" : "a stable"} wellness-risk trend.
            This is a simulated projection, not a certainty.
          </div>
        </Panel>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Personalized Recommendations */}
        <Panel style={{ flex: "1 1 300px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Recommended Actions</div>
          {recs.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: T.textDim, marginBottom: 8, lineHeight: 1.5 }}>
              <CheckCircle2 size={13} color={T.good} style={{ flexShrink: 0, marginTop: 2 }} /> {r}
            </div>
          ))}
        </Panel>

        {/* Wellness Trend Timeline */}
        <Panel style={{ flex: "1 1 300px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>My Wellness Trend</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {weekTrend.map((d) => (
              <span key={d.day} style={{ fontSize: 11, color: T.textDim, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "3px 7px" }}>
                {d.day} → {labelFor(d.score)}
              </span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            <div><span style={{ color: T.textFaint }}>Current: </span>{labelFor(weekTrend[weekTrend.length - 1].score)}</div>
            <div><span style={{ color: T.textFaint }}>Previous: </span>{labelFor(weekTrend[weekTrend.length - 2]?.score ?? weekTrend[0].score)}</div>
            <div><span style={{ color: T.textFaint }}>7-Day Average: </span>{weekAvg}/100</div>
            <div><span style={{ color: T.textFaint }}>Trend: </span>{weekTrend[weekTrend.length - 1].score > weekTrend[0].score ? "Improving ↑" : "Watch ↓"}</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   NEW: Silent SOS — confidential support request button + modal.
   Purely additive UI; sosRequests state lives in App() and is passed
   down, same pattern already used for `result`/`selectedPerson`.
----------------------------------------------------------------- */
function SilentSosButton({ onSend }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  function confirm() {
    onSend();
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); }, 1800);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8,
          background: T.badDim, border: `1px solid ${T.bad}66`, color: T.bad, fontWeight: 700,
          fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <Siren size={16} /> Silent SOS
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, background: "#000a", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 50,
        }} onClick={() => !sent && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: 24, maxWidth: 340, width: "90%", textAlign: "center",
          }}>
            {sent ? (
              <>
                <CheckCircle2 size={28} color={T.good} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Confidential support request sent.</div>
              </>
            ) : (
              <>
                <Siren size={26} color={T.bad} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Request confidential welfare support?</div>
                <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 18 }}>
                  This notifies an authorized welfare officer only. It is not a public alert.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={confirm} icon={Siren}>Send Support Request</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SosRequestsPage({ sosRequests, updateSosStatus }) {
  return (
    <div>
      <PageHeader title="SOS Requests" sub="Confidential welfare support requests — visible only to authorized officers." />
      <Panel>
        {sosRequests.length === 0 ? (
          <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: 30 }}>
            No confidential support requests at this time.
          </div>
        ) : (
          sosRequests.map((r) => (
            <div key={r.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0", borderBottom: `1px solid ${T.borderSoft}`,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.personnelId} · {r.unit}</div>
                <div style={{ fontSize: 11.5, color: T.textFaint }}>{new Date(r.timestamp).toLocaleString()} · Priority: {r.priority}</div>
              </div>
              <select
                value={r.status}
                onChange={(e) => updateSosStatus(r.id, e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, background: T.bg, border: `1px solid ${T.border}`, color: T.text, fontSize: 12.5, fontFamily: "inherit" }}
              >
                {["Pending", "Acknowledged", "In Review", "Support Arranged", "Resolved"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------
   NEW: Privacy & Trust Center
----------------------------------------------------------------- */
function PrivacyPage() {
  const rows = [
    { role: "Personnel", access: "Own screening, own risk score, own trends, own recommendations, own consultations." },
    { role: "Doctor", access: "Authorized personnel assessments, risk factors, consultation info, follow-up status." },
    { role: "Welfare Officer", access: "Support requests, relevant wellness information, intervention status." },
    { role: "Supervisor", access: "Aggregated unit wellness information, operational workload trends." },
    { role: "Admin", access: "System analytics, user/unit management, aggregated wellness statistics." },
  ];
  const badges = ["Role-Based Access", "Encrypted Data", "Confidential Wellness Records", "Authorized Access Only", "Anonymous Unit Analytics", "Audit Logging"];

  return (
    <div>
      <PageHeader title="Privacy & Trust" sub="What each role can see, and how your wellness data is protected." />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {badges.map((b) => (
          <Badge key={b} color={T.accent} dim={T.accentDim}><Lock size={12} /> {b}</Badge>
        ))}
      </div>
      <Panel>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Who can see what</div>
        {rows.map((r) => (
          <div key={r.role} style={{ padding: "10px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{r.role}</div>
            <div style={{ fontSize: 12.5, color: T.textDim }}>{r.access}</div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------
   App shell
----------------------------------------------------------------- */
const PRINT_STYLES = `
  @keyframes welfarePulse {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.06); opacity: 1; }
  }
  @media print {
    .no-print { display: none !important; }
    body { background: #ffffff !important; }
    .print-page {
      background: #ffffff !important;
      border-color: #ccc !important;
      color: #111 !important;
      box-shadow: none !important;
    }
    .print-page * {
      color: #111 !important;
      border-color: #ccc !important;
      background: transparent !important;
    }
  }
`;

export default function App() {
  const [role, setRole] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [result, setResult] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [consultationRequests, setConsultationRequests] = useState([
    { id: "CR-104", patientName: "A. Kumar", patientId: "PN-104", slot: "Today, 4:30 PM", mode: "Video", priority: "High" },
    { id: "CR-118", patientName: "N. Sharma", patientId: "PN-118", slot: "Today, 6:15 PM", mode: "Phone", priority: "Moderate" },
  ]);
  const [sosRequests, setSosRequests] = useState([]);

  function addConsultationRequest(updater) {
    setConsultationRequests((prev) => typeof updater === "function" ? updater(prev) : [updater, ...prev]);
  }

  function addSosRequest() {
    setSosRequests((prev) => [
      {
        id: `SOS-${Date.now()}`,
        personnelId: "PN-2201",
        timestamp: new Date().toISOString(),
        unit: "Alpha Company",
        status: "Pending",
        priority: "High",
        assignedOfficer: null,
        resolutionStatus: "Open",
      },
      ...prev,
    ]);
  }

  function updateSosStatus(id, status) {
    setSosRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  function handleLogin(r, email) {
    const profile = resolveLoggedInProfile(email, r);
    setRole(r);
    setCurrentUser(profile);
    setSelectedPerson(profile);
    if (r === "admin") setPage("admin");
    else if (r === "doctor") setPage("doctor-dashboard");
    else setPage("dashboard");
  }

  function handleScreeningComplete(categoryScores, overall) {
    const observations = [];
    if (categoryScores["Sleep & Recovery"] < 65) observations.push("Sleep and recovery indicators are lower than ideal — consider prioritising rest.");
    if (categoryScores["Workload"] < 65) observations.push("Workload responses suggest moderate to high pressure.");
    if (categoryScores["Mood"] < 65) observations.push("Mood indicators may benefit from a check-in with a support professional.");
    if (categoryScores["Social & Family"] >= 70) observations.push("Social support appears relatively strong.");
    if (observations.length === 0) observations.push("Overall indicators are stable across the screened categories.");
    observations.push("This is a screening signal, not a diagnosis — speak with a qualified professional if concerns persist.");

    const trend = [...TREND_HISTORY.slice(1), { day: "Today", score: overall }];
    setResult({ categoryScores, overall, observations, trend, person: currentUser || selectedPerson || ROSTER[0] });
    setPage("result");
  }

  if (!role) return (
    <>
      <link rel="stylesheet" href={fontLink} />
      <LoginPage onLogin={handleLogin} />
    </>
  );

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: T.bg, minHeight: "100vh", color: T.text }}>
      <link rel="stylesheet" href={fontLink} />
      <style>{PRINT_STYLES}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar role={role} page={page} setPage={setPage} onLogout={() => { setRole(null); setResult(null); setSelectedPerson(null); setCurrentUser(null); setPage("dashboard"); }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <TopBar role={role} user={currentUser} />
          <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
            {page === "dashboard" && <DashboardPage result={result} setPage={setPage} onSendSos={addSosRequest} user={currentUser} />}
            {page === "screening" && <ScreeningPage onComplete={handleScreeningComplete} />}
            {page === "result" && <ResultPage result={result} setPage={setPage} />}
            {page === "camera" && <CameraPage />}
            {page === "insights" && <InsightsPage result={result} />}
            {page === "analytics" && <AnalyticsPage result={result} role={role} />}
            {page === "consultations" && <ConsultationsPage role={role} result={result} roster={ROSTER} currentUser={currentUser} consultationRequests={consultationRequests} onAddConsultationRequest={addConsultationRequest} />}
            {page === "report" && <ReportPage result={result} person={selectedPerson} currentUser={currentUser} />}
            {page === "admin" && <AdminPage setPage={setPage} onSelectPerson={setSelectedPerson} user={currentUser} />}
            {page === "doctor-dashboard" && <DoctorDashboardPage requests={consultationRequests} />}
            {page === "sos" && <SosRequestsPage sosRequests={sosRequests} updateSosStatus={updateSosStatus} />}
            {page === "privacy" && <PrivacyPage />}
            {page === "personDetail" && <PersonDetailPage person={selectedPerson} setPage={setPage} setSelectedPerson={setSelectedPerson} />}
          </div>
        </div>
      </div>
    </div>
  );
}
