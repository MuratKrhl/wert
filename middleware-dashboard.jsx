import { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell
} from "recharts";

/* ─── DESIGN TOKENS ─────────────────────────────────────── */
const C = {
  sidebar:  "#1b2035",
  sidebarH: "#232d45",
  accent:   "#3b82f6",
  bg:       "#f4f6f9",
  white:    "#ffffff",
  border:   "#e9edf4",
  text:     "#1e293b",
  muted:    "#8492a6",
  success:  "#22c55e",
  warning:  "#f59e0b",
  danger:   "#ef4444",
};

const PALETTE = {
  JBoss:      "#ef4444",
  Nginx:      "#10b981",
  WebSphere:  "#f59e0b",
  OpenShift:  "#6366f1",
  Provenir:   "#0ea5e9",
  PowerCurve: "#8b5cf6",
  Evam:       "#ec4899",
};

/* ─── HELPERS ───────────────────────────────────────────── */
const rnd = (b, v) => Math.max(2, b + (Math.random() - .5) * v * 2);
const sparkData = (n = 16, b = 50, v = 20) =>
  Array.from({ length: n }, (_, i) => ({ t: i, v: rnd(b, v) }));

const trendData = () =>
  Array.from({ length: 14 }, (_, i) => ({
    name: i % 2 === 0 ? `${i * 10}m` : "",
    JBoss: rnd(1200, 300), Nginx: rnd(3800, 600), WebSphere: rnd(800, 200),
    Provenir: rnd(320, 80), PowerCurve: rnd(110, 30),
  }));

/* ─── MINI SPARKLINE ────────────────────────────────────── */
const Spark = ({ data, color }) => (
  <ResponsiveContainer width="100%" height={44}>
    <AreaChart data={data} margin={{ top:4, right:0, bottom:0, left:0 }}>
      <defs>
        <linearGradient id={`sg-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
          <stop offset="95%" stopColor={color} stopOpacity={0}   />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
        fill={`url(#sg-${color.slice(1)})`} dot={false} />
    </AreaChart>
  </ResponsiveContainer>
);

/* ─── BADGE ─────────────────────────────────────────────── */
const Badge = ({ status }) => {
  const m = {
    UP:   { bg:"#dcfce7", fg:"#16a34a", tx:"Healthy" },
    WARN: { bg:"#fef3c7", fg:"#d97706", tx:"Warning" },
    DOWN: { bg:"#fee2e2", fg:"#dc2626", tx:"Down"    },
  }[status];
  return (
    <span style={{ background:m.bg, color:m.fg, borderRadius:20,
      padding:"2px 10px", fontSize:11, fontWeight:700 }}>{m.tx}</span>
  );
};

/* ─── PROGRESS ──────────────────────────────────────────── */
const Prog = ({ val, color, label }) => {
  const c = val > 85 ? C.danger : val > 68 ? C.warning : color;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:11, color:C.muted }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:700, color:c,
          fontFamily:"var(--mono)" }}>{val}%</span>
      </div>
      <div style={{ background:"#eef0f6", borderRadius:99, height:5 }}>
        <div style={{ width:`${Math.min(100,val)}%`, height:"100%",
          borderRadius:99, background:c, transition:"width 1.2s ease" }} />
      </div>
    </div>
  );
};

/* ─── SERVICE CARD ──────────────────────────────────────── */
const ServiceCard = ({ app, delay }) => {
  const [hov, setHov] = useState(false);
  const col = PALETTE[app.name] || "#64748b";
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:C.white, borderRadius:12, overflow:"hidden",
        border:`1px solid ${hov ? col+"55" : C.border}`,
        boxShadow: hov
          ? `0 8px 28px ${col}1a, 0 2px 6px rgba(0,0,0,.05)`
          : "0 2px 8px rgba(0,0,0,.05)",
        transition:"all .22s", cursor:"pointer",
        animation:"riseUp .5s ease both", animationDelay:delay,
      }}
    >
      <div style={{ height:3, background:col }} />
      <div style={{ padding:"18px 20px" }}>
        {/* header */}
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:col+"18",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, flexShrink:0 }}>{app.icon}</div>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{app.name}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:1,
                letterSpacing:.5 }}>{app.type}</div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column",
            alignItems:"flex-end", gap:5 }}>
            <Badge status={app.status} />
            {app.alerts > 0 && (
              <span style={{ fontSize:10, background:"#fee2e2",
                color:C.danger, borderRadius:4, padding:"1px 7px",
                fontWeight:700 }}>
                {app.alerts} alert{app.alerts>1?"s":""}
              </span>
            )}
          </div>
        </div>
        {/* primary metric + sparkline */}
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"flex-end", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:10, color:C.muted, letterSpacing:.7,
              textTransform:"uppercase", marginBottom:4 }}>
              {app.primaryLabel}
            </div>
            <div style={{ fontSize:26, fontWeight:800, color:col,
              fontFamily:"var(--mono)", lineHeight:1, letterSpacing:-1 }}>
              {app.primaryValue}
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>
              {app.primaryUnit}
            </div>
          </div>
          <div style={{ width:108 }}>
            <Spark data={app.sparkline} color={col} />
          </div>
        </div>
        {/* stat pills */}
        <div style={{ display:"grid",
          gridTemplateColumns:`repeat(${app.stats.length},1fr)`, gap:6,
          marginBottom: app.bar!==undefined ? 14 : 0 }}>
          {app.stats.map((s,i) => (
            <div key={i} style={{ background:"#f8fafc", borderRadius:8,
              padding:"7px 8px", textAlign:"center" }}>
              <div style={{ fontSize:12, fontWeight:800, color:col,
                fontFamily:"var(--mono)" }}>{s.value}</div>
              <div style={{ fontSize:9, color:C.muted, marginTop:2,
                letterSpacing:.4, textTransform:"uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
        {app.bar!==undefined && <Prog val={app.bar} color={col} label={app.barLabel} />}
      </div>
      <div style={{ background:"#f8fafc", padding:"8px 20px",
        borderTop:`1px solid ${C.border}`,
        display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:10, color:"#c0cad8" }}>Dynatrace</span>
        <span style={{ fontSize:10, color:"#c0cad8" }}>Updated {app.updated}</span>
      </div>
    </div>
  );
};

/* ─── STAT CARD ─────────────────────────────────────────── */
const StatCard = ({ icon, label, value, sub, color, trend, delay }) => (
  <div style={{
    background:C.white, borderRadius:12, padding:"20px 22px",
    border:`1px solid ${C.border}`, boxShadow:"0 2px 8px rgba(0,0,0,.04)",
    display:"flex", alignItems:"center", gap:16,
    animation:"riseUp .4s ease both", animationDelay:delay,
  }}>
    <div style={{ width:52, height:52, borderRadius:14, background:color+"18",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:24, flexShrink:0 }}>{icon}</div>
    <div style={{ flex:1 }}>
      <div style={{ fontSize:26, fontWeight:800, color:C.text,
        fontFamily:"var(--mono)", lineHeight:1, letterSpacing:-1 }}>{value}</div>
      <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{label}</div>
    </div>
    <div style={{ textAlign:"right" }}>
      <span style={{ fontSize:11, fontWeight:700,
        color: trend>0 ? C.success : trend<0 ? C.danger : C.muted,
        background: trend>0 ? "#dcfce7" : trend<0 ? "#fee2e2" : "#f4f6f9",
        borderRadius:4, padding:"2px 7px" }}>
        {trend>0 ? "▲" : trend<0 ? "▼" : "–"} {Math.abs(trend)}%
      </span>
      <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>{sub}</div>
    </div>
  </div>
);

/* ─── DATA ──────────────────────────────────────────────── */
const APPS = [
  { name:"JBoss", type:"APPLICATION SERVER", icon:"🔴", status:"UP", alerts:0, updated:"just now",
    primaryLabel:"Request Rate", primaryValue:"1.24K", primaryUnit:"req / sec",
    sparkline:sparkData(16,60,14),
    stats:[{label:"Error",value:"0.3%"},{label:"Threads",value:"142"},{label:"GC",value:"42ms"}],
    barLabel:"Heap Memory", bar:68 },
  { name:"Nginx", type:"REVERSE PROXY", icon:"🌿", status:"UP", alerts:0, updated:"just now",
    primaryLabel:"Active Connections", primaryValue:"3.8K", primaryUnit:"concurrent",
    sparkline:sparkData(16,55,22),
    stats:[{label:"Req/s",value:"4.2K"},{label:"5xx",value:"0.1%"},{label:"Lat",value:"18ms"}],
    barLabel:"Upstream", bar:100 },
  { name:"WebSphere", type:"APPLICATION SERVER", icon:"🔵", status:"WARN", alerts:2, updated:"15s ago",
    primaryLabel:"Transactions / sec", primaryValue:"842", primaryUnit:"TPS",
    sparkline:sparkData(16,68,18),
    stats:[{label:"Rollback",value:"1.2%"},{label:"HungTh",value:"3"},{label:"Pool",value:"74%"}],
    barLabel:"Heap Memory", bar:81 },
  { name:"OpenShift", type:"CONTAINER PLATFORM", icon:"☸️", status:"UP", alerts:1, updated:"just now",
    primaryLabel:"Running Pods", primaryValue:"247", primaryUnit:"of 249 total",
    sparkline:sparkData(16,82,8),
    stats:[{label:"Nodes",value:"18/18"},{label:"Failed",value:"2"},{label:"CPU",value:"61%"}],
    barLabel:"Cluster Mem", bar:72 },
  { name:"Provenir", type:"DECISION ENGINE", icon:"⚡", status:"UP", alerts:0, updated:"just now",
    primaryLabel:"Decisions / sec", primaryValue:"328", primaryUnit:"real-time",
    sparkline:sparkData(16,45,28),
    stats:[{label:"Latency",value:"64ms"},{label:"Queue",value:"12"},{label:"Error",value:"0.05%"}] },
  { name:"PowerCurve", type:"STRATEGY ENGINE", icon:"📊", status:"WARN", alerts:1, updated:"30s ago",
    primaryLabel:"Executions / sec", primaryValue:"115", primaryUnit:"strategy evals",
    sparkline:sparkData(16,40,18),
    stats:[{label:"AvgExec",value:"210ms"},{label:"Timeout",value:"7"},{label:"Active",value:"34"}],
    barLabel:"Concurrency", bar:80 },
  { name:"Evam", type:"EVENT PROCESSING", icon:"💜", status:"UP", alerts:0, updated:"just now",
    primaryLabel:"Events / sec", primaryValue:"9.6K", primaryUnit:"in + out",
    sparkline:sparkData(16,65,26),
    stats:[{label:"P99",value:"38ms"},{label:"Clients",value:"1.2K"},{label:"PushOK",value:"99.7%"}] },
];

const STATS = [
  { icon:"🧩", label:"Total Services",   value:"7", sub:"All registered",   color:"#6366f1", trend:0   },
  { icon:"✅", label:"Healthy Services", value:"5", sub:"Operating normal", color:"#10b981", trend:0   },
  { icon:"⚠️", label:"Warnings",         value:"2", sub:"Need attention",   color:"#f59e0b", trend:+1.2},
  { icon:"🔔", label:"Active Alerts",    value:"4", sub:"Across all apps",  color:"#ef4444", trend:-8.3},
];

const ALERTS = [
  { app:"WebSphere",  msg:"Heap usage exceeds 80%",    time:"2m ago",  sev:"danger"  },
  { app:"PowerCurve", msg:"Timeout spike detected",    time:"18m ago", sev:"warning" },
  { app:"OpenShift",  msg:"Pod CrashLoopBackOff ×2",  time:"34m ago", sev:"warning" },
  { app:"WebSphere",  msg:"Hung thread detected (×3)", time:"1h ago",  sev:"danger"  },
];

const CHART = trendData();

const NAVITEMS = [
  { icon:"📊", label:"Overview",    badge:null },
  { icon:"🔴", label:"JBoss",       badge:null },
  { icon:"🌿", label:"Nginx",       badge:null },
  { icon:"🔵", label:"WebSphere",   badge:"2"  },
  { icon:"☸️", label:"OpenShift",   badge:"1"  },
  { icon:"⚡", label:"Provenir",    badge:null },
  { icon:"📈", label:"PowerCurve",  badge:"1"  },
  { icon:"💜", label:"Evam",        badge:null },
];

/* ─── TOOLTIP ──────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`,
      borderRadius:8, padding:"10px 14px", fontSize:11,
      boxShadow:"0 4px 16px rgba(0,0,0,.08)" }}>
      <div style={{ fontWeight:700, marginBottom:6, color:C.text }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display:"flex", gap:8,
          alignItems:"center", marginBottom:3 }}>
          <span style={{ width:8, height:8, borderRadius:"50%",
            background:p.color, display:"inline-block" }} />
          <span style={{ color:C.muted }}>{p.name}</span>
          <span style={{ fontWeight:700, color:C.text,
            fontFamily:"var(--mono)", marginLeft:"auto" }}>
            {Math.round(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─── APP ───────────────────────────────────────────────── */
export default function App() {
  const [time, setTime]     = useState(new Date());
  const [filter, setFilter] = useState("ALL");
  const [nav, setNav]       = useState("Overview");
  const [col, setCol]       = useState(false);
  const [notif, setNotif]   = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const shown =
    filter==="ALL"    ? APPS :
    filter==="ISSUES" ? APPS.filter(a=>a.status!=="UP") :
                        APPS.filter(a=>a.status==="UP");

  const SW = col ? 62 : 228;

  return (
    <div style={{ display:"flex", height:"100vh",
      fontFamily:"var(--sans)", background:C.bg, overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        :root { --sans:'Manrope','Segoe UI',sans-serif; --mono:'JetBrains Mono',monospace; }
        *{ box-sizing:border-box; margin:0; padding:0; }
        @keyframes riseUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:.3} }
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-thumb{background:#d1d9e6;border-radius:4px}
        button{font-family:var(--sans);cursor:pointer}
      `}</style>

      {/* ══ SIDEBAR ══════════════════════════════════════ */}
      <aside style={{
        width:SW, minWidth:SW, background:C.sidebar,
        display:"flex", flexDirection:"column",
        transition:"width .25s, min-width .25s",
        boxShadow:"4px 0 20px rgba(0,0,0,.14)", zIndex:100, flexShrink:0,
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10,
          padding:"18px 14px", borderBottom:"1px solid #ffffff0d", flexShrink:0 }}>
          <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
            background:"linear-gradient(135deg,#3b82f6,#818cf8)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18 }}>⬡</div>
          {!col && (
            <div style={{ overflow:"hidden" }}>
              <div style={{ color:"#fff", fontWeight:800, fontSize:14,
                letterSpacing:-.3, whiteSpace:"nowrap" }}>MW Monitor</div>
              <div style={{ color:"#4a6584", fontSize:9, letterSpacing:.8 }}>DYNATRACE</div>
            </div>
          )}
          <button onClick={() => setCol(c=>!c)} style={{
            marginLeft:"auto", background:"none", border:"none",
            color:"#4a6584", fontSize:18, padding:2, flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>{col ? "▶" : "◀"}</button>
        </div>

        {/* Nav */}
        <div style={{ padding:"10px 8px", flex:1, overflowY:"auto" }}>
          {!col && (
            <div style={{ fontSize:9, color:"#344a63", letterSpacing:1.2,
              padding:"6px 10px 10px", textTransform:"uppercase" }}>
              Navigation
            </div>
          )}
          {NAVITEMS.map(n => {
            const active = nav===n.label;
            return (
              <div key={n.label} onClick={() => setNav(n.label)}
                style={{
                  display:"flex", alignItems:"center",
                  gap: col ? 0 : 11,
                  padding: col ? "11px 0" : "9px 12px",
                  justifyContent: col ? "center" : "flex-start",
                  borderRadius:8, marginBottom:2,
                  background: active ? C.accent : "transparent",
                  color: active ? "#fff" : "#8da0b5",
                  transition:"background .15s, color .15s",
                  cursor:"pointer",
                }}
                onMouseEnter={e => { if(!active) e.currentTarget.style.background="#ffffff0f"; }}
                onMouseLeave={e => { if(!active) e.currentTarget.style.background="transparent"; }}
              >
                <span style={{ fontSize:16, flexShrink:0 }}>{n.icon}</span>
                {!col && <>
                  <span style={{ fontSize:13, fontWeight:active?700:400,
                    flex:1, whiteSpace:"nowrap" }}>{n.label}</span>
                  {n.badge && (
                    <span style={{ background: active?"#ffffff33":C.danger,
                      color:"#fff", fontSize:10, fontWeight:700,
                      borderRadius:10, padding:"1px 7px" }}>{n.badge}</span>
                  )}
                </>}
              </div>
            );
          })}
        </div>

        {/* User */}
        {!col && (
          <div style={{ padding:"12px 14px", borderTop:"1px solid #ffffff0d",
            display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0,
              background:"linear-gradient(135deg,#3b82f6,#818cf8)",
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#fff", fontWeight:700, fontSize:12 }}>AT</div>
            <div>
              <div style={{ color:"#e2e8f0", fontSize:12, fontWeight:600 }}>Admin</div>
              <div style={{ color:"#4a6584", fontSize:10 }}>DevOps Team</div>
            </div>
          </div>
        )}
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* ── TOPBAR ── */}
        <header style={{ height:60, background:C.white,
          borderBottom:`1px solid ${C.border}`,
          display:"flex", alignItems:"center", padding:"0 28px", gap:14,
          flexShrink:0, boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text,
              letterSpacing:-.4 }}>Middleware Overview</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
              Dashboard › Middleware › Overview
            </div>
          </div>

          {/* search */}
          <div style={{ display:"flex", alignItems:"center", gap:8,
            background:"#f4f6f9", borderRadius:8, padding:"6px 14px",
            border:`1px solid ${C.border}`, width:190 }}>
            <span style={{ color:C.muted, fontSize:13 }}>🔍</span>
            <span style={{ fontSize:12, color:"#c0cad5" }}>Search services…</span>
          </div>

          {/* live */}
          <div style={{ display:"flex", alignItems:"center", gap:6,
            background:"#dcfce7", borderRadius:20, padding:"5px 12px" }}>
            <span style={{ width:7, height:7, borderRadius:"50%",
              background:C.success, animation:"blink 2s infinite",
              display:"inline-block" }} />
            <span style={{ fontSize:11, color:"#16a34a", fontWeight:700 }}>LIVE</span>
          </div>

          {/* notif */}
          <div style={{ position:"relative" }}>
            <button onClick={()=>setNotif(o=>!o)} style={{
              width:38, height:38, borderRadius:9,
              background: notif ? C.accent+"18" : "#f4f6f9",
              border:`1px solid ${notif ? C.accent+"55" : C.border}`,
              fontSize:17, display:"flex", alignItems:"center",
              justifyContent:"center", position:"relative" }}>
              🔔
              <span style={{ position:"absolute", top:7, right:7,
                width:8, height:8, background:C.danger, borderRadius:"50%",
                border:"2px solid #fff" }} />
            </button>
            {notif && (
              <div style={{ position:"absolute", right:0, top:46, width:310,
                background:C.white, borderRadius:12,
                boxShadow:"0 12px 40px rgba(0,0,0,.12)",
                border:`1px solid ${C.border}`, zIndex:999, overflow:"hidden" }}>
                <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`,
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontWeight:700, fontSize:13, color:C.text }}>Alerts</span>
                  <span style={{ background:"#fee2e2", color:C.danger,
                    fontSize:10, fontWeight:700, borderRadius:4,
                    padding:"1px 7px" }}>4 new</span>
                </div>
                {ALERTS.map((a,i) => (
                  <div key={i} style={{ padding:"10px 16px",
                    borderBottom:"1px solid #f8fafc",
                    display:"flex", gap:10, alignItems:"flex-start" }}>
                    <span style={{ fontSize:14, marginTop:1 }}>
                      {a.sev==="danger" ? "🔴" : "⚠️"}
                    </span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{a.app}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{a.msg}</div>
                    </div>
                    <span style={{ fontSize:10, color:"#b0bec5", flexShrink:0 }}>{a.time}</span>
                  </div>
                ))}
                <div style={{ padding:"10px 16px", textAlign:"center" }}>
                  <span style={{ fontSize:12, color:C.accent,
                    fontWeight:600 }}>View all alerts →</span>
                </div>
              </div>
            )}
          </div>

          {/* clock */}
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.text,
              fontFamily:"var(--mono)", lineHeight:1 }}>
              {time.toLocaleTimeString("tr-TR")}
            </div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
              {time.toLocaleDateString("tr-TR")}
            </div>
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

          {/* STAT CARDS */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
            gap:16, marginBottom:26 }}>
            {STATS.map((s,i) => (
              <StatCard key={s.label} {...s} delay={`${i*.08}s`} />
            ))}
          </div>

          {/* SECTION HEAD */}
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:16 }}>
            <div>
              <h2 style={{ fontSize:15, fontWeight:800, color:C.text,
                letterSpacing:-.2 }}>Service Status</h2>
              <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                {shown.length} of {APPS.length} services · {time.toLocaleTimeString("tr-TR")}
              </p>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {[
                { k:"ALL",    l:"All",     n:APPS.length },
                { k:"UP",     l:"Healthy", n:APPS.filter(a=>a.status==="UP").length },
                { k:"ISSUES", l:"Issues",  n:APPS.filter(a=>a.status!=="UP").length },
              ].map(f => (
                <button key={f.k} onClick={()=>setFilter(f.k)} style={{
                  background: filter===f.k ? C.accent : C.white,
                  color: filter===f.k ? "#fff" : C.muted,
                  border:`1px solid ${filter===f.k ? C.accent : C.border}`,
                  borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600,
                  transition:"all .18s", display:"inline-flex", alignItems:"center", gap:6,
                }}>
                  {f.l}
                  <span style={{
                    background: filter===f.k ? "#ffffff33" : "#f4f6f9",
                    color: filter===f.k ? "#fff" : C.muted,
                    borderRadius:4, padding:"0 6px", fontSize:11,
                  }}>{f.n}</span>
                </button>
              ))}
            </div>
          </div>

          {/* SERVICE GRID */}
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill,minmax(286px,1fr))",
            gap:16, marginBottom:26 }}>
            {shown.map((app,i) => (
              <ServiceCard key={app.name} app={app} delay={`${i*.06}s`} />
            ))}
          </div>

          {/* CHARTS ROW */}
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr",
            gap:16, marginBottom:26 }}>

            {/* Trend */}
            <div style={{ background:C.white, borderRadius:12, padding:"22px 24px",
              border:`1px solid ${C.border}`, boxShadow:"0 2px 8px rgba(0,0,0,.04)",
              animation:"riseUp .5s ease both", animationDelay:".1s" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:20 }}>
                <div>
                  <h3 style={{ fontSize:14, fontWeight:800, color:C.text }}>
                    Throughput Trend
                  </h3>
                  <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                    Request / event rate · last 3 hours
                  </p>
                </div>
                <span style={{ background:"#eff6ff", color:C.accent,
                  fontSize:11, fontWeight:700, borderRadius:6,
                  padding:"4px 12px", cursor:"pointer" }}>↓ Export</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={CHART}
                  margin={{ top:4, right:8, left:-22, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f7" />
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:C.muted }}
                    tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize:10, fill:C.muted }}
                    tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={7}
                    wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                  {["JBoss","Nginx","WebSphere","Provenir","PowerCurve"].map(k => (
                    <Line key={k} type="monotone" dataKey={k}
                      stroke={PALETTE[k]} strokeWidth={2} dot={false}
                      strokeDasharray={k==="WebSphere"?"5 3":undefined} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Alerts panel */}
            <div style={{ background:C.white, borderRadius:12, padding:"22px 24px",
              border:`1px solid ${C.border}`, boxShadow:"0 2px 8px rgba(0,0,0,.04)",
              animation:"riseUp .5s ease both", animationDelay:".18s" }}>
              <h3 style={{ fontSize:14, fontWeight:800, color:C.text, marginBottom:4 }}>
                Recent Alerts
              </h3>
              <p style={{ fontSize:11, color:C.muted, marginBottom:16 }}>
                Last 24h · {ALERTS.length} events
              </p>

              {/* Bar mini chart */}
              <div style={{ marginBottom:16 }}>
                <ResponsiveContainer width="100%" height={70}>
                  <BarChart data={[
                    { name:"WebSphere", v:2 }, { name:"PowerCurve", v:1 }, { name:"OpenShift", v:1 }
                  ]} margin={{ top:0, right:0, left:-36, bottom:0 }}>
                    <XAxis dataKey="name" tick={{ fontSize:9, fill:C.muted }}
                      axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:9, fill:C.muted }}
                      axisLine={false} tickLine={false} />
                    <Bar dataKey="v" radius={[4,4,0,0]}>
                      {[C.danger, C.warning, C.warning].map((c,i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Bar>
                    <Tooltip contentStyle={{ fontSize:11, borderRadius:6 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {ALERTS.map((a,i) => (
                  <div key={i} style={{ display:"flex", gap:10,
                    alignItems:"flex-start", background:"#f8fafc",
                    borderRadius:9, padding:"10px 12px",
                    border:`1px solid ${C.border}` }}>
                    <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
                      background: a.sev==="danger" ? "#fee2e2" : "#fef3c7",
                      display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:14 }}>
                      {a.sev==="danger" ? "🔴" : "⚠️"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{a.app}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:1,
                        overflow:"hidden", textOverflow:"ellipsis",
                        whiteSpace:"nowrap" }}>{a.msg}</div>
                    </div>
                    <span style={{ fontSize:10, color:"#b0bec5",
                      flexShrink:0, marginTop:2 }}>{a.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:11, color:"#c0cad8" }}>
              Middleware Monitoring Dashboard · v3.0
            </span>
            <span style={{ fontSize:11, color:"#c0cad8" }}>
              Dynatrace API · Auto-refresh 30s
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
