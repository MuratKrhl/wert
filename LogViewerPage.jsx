import { useState, useCallback } from "react";

// ── Mock Data ──────────────────────────────────────────────────────────────────
const ENVIRONMENTS = [
  { key: "PROD", label: "Production" },
  { key: "TEST", label: "Test" },
  { key: "DEV",  label: "Development" },
];

const SERVERS = {
  PROD: [
    { hostname: "app-srv-001", os: "linux", elk_covered: true },
    { hostname: "app-srv-002", os: "linux", elk_covered: true },
    { hostname: "aix-srv-001", os: "aix",   elk_covered: false },
    { hostname: "aix-srv-002", os: "aix",   elk_covered: false },
    { hostname: "web-srv-001", os: "linux", elk_covered: true },
  ],
  TEST: [
    { hostname: "test-srv-001", os: "linux", elk_covered: true },
    { hostname: "test-srv-002", os: "linux", elk_covered: false },
  ],
  DEV: [
    { hostname: "dev-srv-001", os: "linux", elk_covered: false },
  ],
};

const APPS = {
  "app-srv-001": [
    { name: "myapp.ear",   label: "My Application",  log_type: "APP" },
    { name: "billing.ear", label: "Billing Service",  log_type: "APP" },
    { name: "IBMIHS",      label: "IBM HTTP Server",  log_type: "IHS" },
    { name: "web_log",     label: "Web Log",          log_type: "WEB" },
  ],
  "app-srv-002": [
    { name: "myapp.ear",   label: "My Application",  log_type: "APP" },
    { name: "IBMIHS",      label: "IBM HTTP Server",  log_type: "IHS" },
  ],
  "aix-srv-001": [
    { name: "erp.ear",     label: "ERP Application", log_type: "APP" },
    { name: "IBMIHS",      label: "IBM HTTP Server",  log_type: "IHS" },
    { name: "web_log",     label: "Web Log",          log_type: "WEB" },
  ],
  "aix-srv-002": [
    { name: "portal.ear",  label: "Portal App",      log_type: "APP" },
    { name: "IBMIHS",      label: "IBM HTTP Server",  log_type: "IHS" },
  ],
  "web-srv-001": [
    { name: "web_log",     label: "Web Log",          log_type: "WEB" },
    { name: "IBMIHS",      label: "IBM HTTP Server",  log_type: "IHS" },
  ],
  "test-srv-001": [{ name: "myapp.ear", label: "My Application", log_type: "APP" }],
  "test-srv-002": [{ name: "myapp.ear", label: "My Application", log_type: "APP" }],
  "dev-srv-001":  [{ name: "myapp.ear", label: "My Application", log_type: "APP" }],
};

const ALL_FILES = [
  { name: "app.log",             size_label: "45.2 MB",  date: "2026-03-09", rotated: false },
  { name: "app-2026-03-08.log",  size_label: "120.8 MB", date: "2026-03-08", rotated: true  },
  { name: "app-2026-03-07.log",  size_label: "98.3 MB",  date: "2026-03-07", rotated: true  },
  { name: "app-2026-03-06.log",  size_label: "54.1 MB",  date: "2026-03-06", rotated: true  },
];

const QUICK_RANGES = [
  { key: "today",     label: "Bugün",     days: 0 },
  { key: "yesterday", label: "Dün",       days: 1 },
  { key: "3days",     label: "Son 3 gün", days: 3 },
];

const LOG_TYPES = ["Tümü", "APP", "IHS", "WEB"];

const MOCK_MESSAGES = [
  { level: "ERROR",   msg: "NullPointerException at com.example.service.UserService.getUser(UserService.java:142)", stack: "java.lang.NullPointerException\n  at com.example.service.UserService.getUser(UserService.java:142)\n  at com.example.web.UserController.show(UserController.java:88)" },
  { level: "ERROR",   msg: "Connection timeout to database after 30000ms", stack: null },
  { level: "WARNING", msg: "Slow query detected: 4523ms for SELECT * FROM transactions", stack: null },
  { level: "INFO",    msg: "Application started successfully on port 9080", stack: null },
  { level: "INFO",    msg: "Request completed: POST /api/payment [200] 234ms", stack: null },
  { level: "INFO",    msg: "Cache refreshed: 1240 items loaded", stack: null },
  { level: "DEBUG",   msg: "Session created for user: john.doe@example.com", stack: null },
  { level: "ERROR",   msg: "Failed to process transaction TXN-20260309-00421: Insufficient funds", stack: null },
  { level: "WARNING", msg: "Memory usage at 82%: consider increasing heap size", stack: null },
  { level: "INFO",    msg: "Scheduled task ReportGenerator completed in 1.2s", stack: null },
];

const generateLogs = (keyword) => {
  const hours = ["08","09","10","11","12","13","14","15"];
  const entries = [];
  for (let i = 0; i < 60; i++) {
    const base = MOCK_MESSAGES[i % MOCK_MESSAGES.length];
    if (keyword && !base.msg.toLowerCase().includes(keyword.toLowerCase())) continue;
    const h = hours[i % hours.length];
    const m = String((i * 7) % 60).padStart(2, "0");
    const s = String((i * 13) % 60).padStart(2, "0");
    entries.push({
      id: i + 1,
      timestamp: `2026-03-09 ${h}:${m}:${s}`,
      level: base.level,
      thread: String(i + 1).padStart(8, "0"),
      message: base.msg,
      stack_trace: base.stack,
      is_multiline: !!base.stack,
      raw: `[09/03/26 ${h}:${m}:${s}:000 TRT] ${String(i+1).padStart(8,"0")} SystemOut  ${base.level[0]}  ${base.msg}`,
    });
  }
  return entries.slice(0, 35);
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; };

const LEVEL_CFG = {
  ERROR:   { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#dc2626" },
  WARNING: { color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#d97706" },
  INFO:    { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", dot: "#2563eb" },
  DEBUG:   { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", dot: "#6b7280" },
  UNKNOWN: { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", dot: "#6b7280" },
};

const levelCounts = (entries) => {
  const c = { ERROR: 0, WARNING: 0, INFO: 0, DEBUG: 0 };
  entries.forEach(e => { if (c[e.level] !== undefined) c[e.level]++; });
  return c;
};

// ── Sub-components ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.1em",
    textTransform: "uppercase", marginBottom: 7 }}>
    {children}
  </div>
);

const StyledSelect = ({ value, onChange, options, placeholder, disabled }) => (
  <div style={{ position: "relative" }}>
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{
        width: "100%", padding: "7px 28px 7px 10px",
        background: disabled ? "#f9fafb" : "#fff",
        border: `1px solid ${disabled ? "#e5e7eb" : "#d1d5db"}`,
        borderRadius: 6, color: disabled ? "#9ca3af" : "#374151",
        fontSize: 12.5, appearance: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        outline: "none", fontFamily: "inherit",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
      onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
      onBlur={e => { e.target.style.borderColor = disabled ? "#e5e7eb" : "#d1d5db"; e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.key || o} value={o.key || o}>{o.label || o}</option>)}
    </select>
    <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
      pointerEvents: "none", color: "#9ca3af", fontSize: 9 }}>▼</span>
  </div>
);

const LevelBadge = ({ level }) => {
  const c = LEVEL_CFG[level] || LEVEL_CFG.UNKNOWN;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 4,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em",
      fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {level}
    </span>
  );
};

const LogRow = ({ entry, isRaw, isExpanded, onToggle }) => {
  const [hovered, setHovered] = useState(false);
  const c = LEVEL_CFG[entry.level] || LEVEL_CFG.UNKNOWN;
  return (
    <div style={{ borderBottom: "1px solid #f3f4f6" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div onClick={() => entry.is_multiline && onToggle(entry.id)}
        style={{
          display: "grid",
          gridTemplateColumns: isRaw ? "1fr" : "108px 148px 96px 1fr",
          padding: "8px 16px", alignItems: "start",
          background: hovered ? "#f8faff" : isExpanded ? "#fafbff" : "transparent",
          cursor: entry.is_multiline ? "pointer" : "default",
          borderLeft: `3px solid ${isExpanded ? c.color : "transparent"}`,
          transition: "background 0.1s",
        }}>
        {isRaw ? (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
            color: "#6b7280", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {entry.raw}
          </span>
        ) : (
          <>
            <div style={{ paddingTop: 1 }}><LevelBadge level={entry.level} /></div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
              color: "#9ca3af", paddingTop: 2 }}>
              {entry.timestamp?.split(" ")[1]}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: "#d1d5db", paddingTop: 2 }}>
              {entry.thread}
            </span>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12.5, lineHeight: 1.5,
                color: entry.level === "ERROR" ? "#dc2626" : entry.level === "WARNING" ? "#92400e" : "#374151" }}>
                {entry.message}
              </span>
              {entry.is_multiline && (
                <span style={{ fontSize: 10.5, color: "#3b82f6", flexShrink: 0, marginTop: 2,
                  fontFamily: "'JetBrains Mono', monospace" }}>
                  {isExpanded ? "▲ gizle" : "▼ trace"}
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {!isRaw && isExpanded && entry.stack_trace && (
        <div style={{ margin: "0 16px 10px 375px", padding: "10px 14px",
          background: "#fef2f2", borderRadius: 6, borderLeft: `3px solid ${c.color}` }}>
          <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, color: "#b91c1c", lineHeight: 1.7 }}>
            {entry.stack_trace}
          </pre>
        </div>
      )}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LogViewerPage() {
  const [env,         setEnv]         = useState("");
  const [server,      setServer]      = useState("");
  const [logType,     setLogType]     = useState("Tümü");
  const [app,         setApp]         = useState("");
  const [file,        setFile]        = useState("");
  const [quickRange,  setQuickRange]  = useState("today");
  const [dateFrom,    setDateFrom]    = useState(todayStr());
  const [dateTo,      setDateTo]      = useState(todayStr());
  const [showRotated, setShowRotated] = useState(false);
  const [kwInput,     setKwInput]     = useState("");
  const [keyword,     setKeyword]     = useState("");
  const [isRaw,       setIsRaw]       = useState(false);
  const [expanded,    setExpanded]    = useState({});
  const [page,        setPage]        = useState(1);
  const [entries,     setEntries]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [source,      setSource]      = useState(null);
  const PAGE_SIZE = 20;

  const handleEnvChange    = v => { setEnv(v); setServer(""); setApp(""); setFile(""); setEntries([]); setLogType("Tümü"); };
  const handleServerChange = v => { setServer(v); setApp(""); setFile(""); setEntries([]); };
  const handleLogTypeChange= v => { setLogType(v); setApp(""); setFile(""); setEntries([]); };
  const handleAppChange    = v => { setApp(v); setFile(""); setEntries([]); };

  const handleQuickRange = (r) => {
    setQuickRange(r.key);
    setDateFrom(r.days === 0 ? todayStr() : daysAgoStr(r.days));
    setDateTo(todayStr());
  };

  const allApps      = APPS[server] || [];
  const filteredApps = logType === "Tümü" ? allApps : allApps.filter(a => a.log_type === logType);
  const filteredFiles= ALL_FILES.filter(f => {
    if (!showRotated && f.rotated) return false;
    if (f.date < dateFrom || f.date > dateTo) return false;
    return true;
  });

  const doLoad = useCallback((kw, fname) => {
    setLoading(true); setExpanded({}); setPage(1);
    setTimeout(() => {
      const srv = (SERVERS[env] || []).find(s => s.hostname === server);
      setSource(srv?.elk_covered ? "ELK" : "SSH");
      setEntries(generateLogs(kw));
      setLoading(false);
    }, 500);
  }, [env, server]);

  const handleFileSelect = (fname) => { setFile(fname); doLoad(keyword, fname); };
  const handleSearch     = () => { setKeyword(kwInput); doLoad(kwInput, file); };
  const toggleExpand     = id => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const counts   = levelCounts(entries);
  const paged    = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPgs = Math.ceil(entries.length / PAGE_SIZE);
  const servers  = SERVERS[env] || [];
  const srvInfo  = servers.find(s => s.hostname === server);

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6",
      fontFamily: "'Inter', 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f3f4f6; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        input[type=date] { color-scheme: light; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div style={{ height: 54, background: "#fff", borderBottom: "1px solid #e5e7eb",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(59,130,246,0.4)", fontSize: 16 }}>⚡</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.03em" }}>
            Log Viewer
          </span>
        </div>

        <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
          {[env, server, app, file].filter(Boolean).map((item, i, arr) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: i === arr.length - 1 ? "#111827" : "#6b7280",
                fontWeight: i === arr.length - 1 ? 600 : 400 }}>{item}</span>
              {i < arr.length - 1 && <span style={{ color: "#d1d5db" }}>/</span>}
            </span>
          ))}
          {!env && <span style={{ color: "#9ca3af" }}>Ortam seçerek başlayın</span>}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {source && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20,
              background: source === "ELK" ? "#eff6ff" : "#fffbeb",
              border: `1px solid ${source === "ELK" ? "#bfdbfe" : "#fde68a"}`,
              fontSize: 12, fontWeight: 600,
              color: source === "ELK" ? "#1d4ed8" : "#92400e",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%",
                background: source === "ELK" ? "#3b82f6" : "#f59e0b" }} />
              {source === "ELK" ? "Elasticsearch" : "SSH"}
            </div>
          )}
          {entries.length > 0 && (
            <button style={{ display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 7, background: "#fff",
              border: "1px solid #d1d5db", color: "#374151", fontSize: 12.5,
              cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              ↓ TXT İndir
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div style={{ width: 268, flexShrink: 0, background: "#fff",
          borderRight: "1px solid #e5e7eb", display: "flex",
          flexDirection: "column", overflow: "hidden",
          boxShadow: "1px 0 4px rgba(0,0,0,0.03)" }}>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px" }}>

            {/* Kaynak */}
            <div style={{ marginBottom: 18 }}>
              <SectionLabel>Kaynak Seçimi</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <StyledSelect value={env}    onChange={handleEnvChange}    options={ENVIRONMENTS} placeholder="Ortam seçin..." />
                <StyledSelect value={server} onChange={handleServerChange}
                  options={servers.map(s => ({ key: s.hostname, label: `${s.hostname}${s.os === "aix" ? "  ·  AIX" : ""}` }))}
                  placeholder="Sunucu seçin..." disabled={!env} />
              </div>
            </div>

            {/* Log Tipi */}
            <div style={{ marginBottom: 18 }}>
              <SectionLabel>Log Tipi</SectionLabel>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {LOG_TYPES.map(t => (
                  <button key={t} onClick={() => handleLogTypeChange(t)} disabled={!server}
                    style={{
                      padding: "5px 11px", borderRadius: 6, border: "1px solid",
                      fontSize: 11.5, cursor: server ? "pointer" : "not-allowed",
                      fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s",
                      borderColor: logType === t ? "#3b82f6" : "#e5e7eb",
                      background: logType === t ? "#eff6ff" : server ? "#f9fafb" : "#f9fafb",
                      color: logType === t ? "#1d4ed8" : server ? "#6b7280" : "#c4c9d4",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Uygulama */}
            <div style={{ marginBottom: 18 }}>
              <SectionLabel>Uygulama</SectionLabel>
              <StyledSelect value={app} onChange={handleAppChange}
                options={filteredApps.map(a => ({ key: a.name, label: a.label }))}
                placeholder={!server ? "Önce sunucu seçin" : filteredApps.length === 0 ? "Bu tipte uygulama yok" : "Uygulama seçin..."}
                disabled={!server || filteredApps.length === 0} />
            </div>

            {/* Zaman Aralığı */}
            <div style={{ marginBottom: 18 }}>
              <SectionLabel>Zaman Aralığı</SectionLabel>

              {/* Hızlı seçici */}
              <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                {QUICK_RANGES.map(r => (
                  <button key={r.key} onClick={() => handleQuickRange(r)}
                    style={{
                      flex: 1, padding: "6px 4px", borderRadius: 6, border: "1px solid",
                      fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                      fontWeight: quickRange === r.key ? 600 : 400,
                      borderColor: quickRange === r.key ? "#3b82f6" : "#e5e7eb",
                      background: quickRange === r.key ? "#eff6ff" : "#f9fafb",
                      color: quickRange === r.key ? "#1d4ed8" : "#6b7280",
                      transition: "all 0.12s",
                    }}>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Manuel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[["Başlangıç", dateFrom, v => { setDateFrom(v); setQuickRange(""); }],
                  ["Bitiş",     dateTo,   v => { setDateTo(v);   setQuickRange(""); }]
                ].map(([lbl, val, setter]) => (
                  <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#9ca3af", width: 58, flexShrink: 0 }}>{lbl}</span>
                    <input type="date" value={val} onChange={e => setter(e.target.value)}
                      style={{
                        flex: 1, padding: "6px 8px", background: "#fff",
                        border: "1px solid #d1d5db", borderRadius: 6,
                        color: "#374151", fontSize: 12, outline: "none", fontFamily: "inherit",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                      onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                      onBlur={e => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Arşiv Toggle */}
            <div style={{ marginBottom: 16, padding: "11px 12px", background: "#f9fafb",
              borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 2 }}>
                    Arşiv Dosyaları
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Rotated logları dahil et</div>
                </div>
                <div onClick={() => setShowRotated(p => !p)}
                  style={{ width: 38, height: 21, borderRadius: 11, cursor: "pointer",
                    background: showRotated ? "#3b82f6" : "#d1d5db",
                    position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{
                    width: 17, height: 17, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2, left: showRotated ? 19 : 2,
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
              </div>
            </div>

            {/* Dosya listesi label */}
            <SectionLabel>
              Log Dosyaları {app && `(${filteredFiles.length})`}
            </SectionLabel>
          </div>

          {/* Dosyalar */}
          <div style={{ maxHeight: 210, overflowY: "auto", borderTop: "1px solid #f3f4f6" }}>
            {!app ? (
              <div style={{ padding: "16px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                Uygulama seçilmedi
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                Bu aralıkta dosya bulunamadı
              </div>
            ) : (
              filteredFiles.map(f => (
                <div key={f.name} onClick={() => handleFileSelect(f.name)}
                  style={{
                    padding: "9px 14px", cursor: "pointer",
                    borderLeft: `3px solid ${file === f.name ? "#3b82f6" : "transparent"}`,
                    background: file === f.name ? "#eff6ff" : "transparent",
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={e => { if (file !== f.name) e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={e => { if (file !== f.name) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13 }}>📄</span>
                      <span style={{ fontSize: 12, color: file === f.name ? "#1d4ed8" : "#374151",
                        fontWeight: file === f.name ? 600 : 400 }}>
                        {f.name}
                      </span>
                    </div>
                    {f.rotated && (
                      <span style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
                        background: "#f3f4f6", color: "#9ca3af", border: "1px solid #e5e7eb" }}>
                        ARŞİV
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, paddingLeft: 22 }}>
                    <span style={{ fontSize: 10.5, color: "#9ca3af",
                      fontFamily: "'JetBrains Mono', monospace" }}>{f.size_label}</span>
                    <span style={{ fontSize: 10.5, color: "#c4c9d4" }}>{f.date}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sunucu bilgisi */}
          {srvInfo && (
            <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>İşletim Sistemi</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#374151",
                  fontFamily: "'JetBrains Mono', monospace" }}>
                  {srvInfo.os.toUpperCase()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Log Kaynağı</span>
                <span style={{ fontSize: 11, fontWeight: 600,
                  color: srvInfo.elk_covered ? "#1d4ed8" : "#d97706",
                  fontFamily: "'JetBrains Mono', monospace" }}>
                  {srvInfo.elk_covered ? "ELK" : "SSH"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Main Content ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Filter Bar */}
          <div style={{ padding: "10px 16px", background: "#fff",
            borderBottom: "1px solid #e5e7eb", display: "flex",
            alignItems: "center", gap: 8, flexShrink: 0,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

            <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
              <span style={{ position: "absolute", left: 10, top: "50%",
                transform: "translateY(-50%)", color: "#9ca3af", fontSize: 14 }}>🔍</span>
              <input value={kwInput} onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Keyword ara...  (Enter)"
                style={{
                  width: "100%", padding: "7px 10px 7px 34px",
                  background: "#fff", border: "1px solid #d1d5db",
                  borderRadius: 7, color: "#374151", fontSize: 13,
                  outline: "none", fontFamily: "inherit",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
                onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                onBlur={e => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
              />
            </div>

            <button onClick={handleSearch}
              style={{ padding: "7px 20px", borderRadius: 7, background: "#2563eb",
                border: "none", color: "#fff", fontSize: 13, cursor: "pointer",
                fontWeight: 600, fontFamily: "inherit",
                boxShadow: "0 1px 3px rgba(37,99,235,0.4)", transition: "background 0.15s" }}
              onMouseEnter={e => e.target.style.background = "#1d4ed8"}
              onMouseLeave={e => e.target.style.background = "#2563eb"}>
              Ara
            </button>

            {keyword && (
              <div style={{ display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", background: "#eff6ff",
                border: "1px solid #bfdbfe", borderRadius: 20 }}>
                <span style={{ fontSize: 11.5, color: "#1d4ed8", fontStyle: "italic" }}>"{keyword}"</span>
                <span onClick={() => { setKeyword(""); setKwInput(""); doLoad("", file); }}
                  style={{ fontSize: 13, color: "#93c5fd", cursor: "pointer", fontWeight: 700 }}>×</span>
              </div>
            )}

            <div style={{ marginLeft: "auto", display: "flex", gap: 1,
              background: "#f3f4f6", padding: 2, borderRadius: 8, border: "1px solid #e5e7eb" }}>
              {["Parsed", "Raw"].map(v => (
                <button key={v} onClick={() => setIsRaw(v === "Raw")}
                  style={{
                    padding: "5px 16px", borderRadius: 7, border: "none",
                    background: (v === "Raw") === isRaw ? "#fff" : "transparent",
                    color: (v === "Raw") === isRaw ? "#111827" : "#9ca3af",
                    fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
                    fontWeight: (v === "Raw") === isRaw ? 600 : 400,
                    boxShadow: (v === "Raw") === isRaw ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Level Summary */}
          {entries.length > 0 && (
            <div style={{ padding: "7px 16px", background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
              {Object.entries(counts).map(([level, count]) => {
                const c = LEVEL_CFG[level];
                return count > 0 ? (
                  <div key={level} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{level}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.color,
                      fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
                  </div>
                ) : null;
              })}
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#9ca3af",
                fontFamily: "'JetBrains Mono', monospace" }}>
                {entries.length} satır · {page}/{totalPgs} sayfa
              </span>
            </div>
          )}

          {/* Table Header */}
          {!isRaw && entries.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "108px 148px 96px 1fr",
              padding: "6px 16px", borderBottom: "1px solid #e5e7eb",
              background: "#f9fafb", flexShrink: 0 }}>
              {["Level", "Zaman", "Thread", "Mesaj"].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af",
                  letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</span>
              ))}
            </div>
          )}

          {/* Log Rows */}
          <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                height: 220, gap: 10, color: "#6b7280" }}>
                <div style={{ width: 20, height: 20, border: "2px solid #e5e7eb",
                  borderTopColor: "#3b82f6", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 13 }}>Loglar yükleniyor...</span>
              </div>
            ) : entries.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: 300, gap: 10,
                animation: "fadeIn 0.3s ease" }}>
                <div style={{ fontSize: 48 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
                  {file ? "Sonuç bulunamadı" : "Sol panelden dosya seçin"}
                </div>
                {!env && <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  Ortam → Sunucu → Log Tipi → Uygulama → Dosya
                </div>}
              </div>
            ) : (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                {paged.map(entry => (
                  <LogRow key={entry.id} entry={entry} isRaw={isRaw}
                    isExpanded={!!expanded[entry.id]} onToggle={toggleExpand} />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPgs > 1 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              background: "#f9fafb", flexShrink: 0 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "5px 12px", background: "#fff", border: "1px solid #d1d5db",
                  borderRadius: 6, color: page === 1 ? "#d1d5db" : "#374151",
                  cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 12,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>←</button>
              {Array.from({ length: Math.min(totalPgs, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{
                    padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    border: `1px solid ${page === p ? "#2563eb" : "#d1d5db"}`,
                    background: page === p ? "#2563eb" : "#fff",
                    color: page === p ? "#fff" : "#6b7280",
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: page === p ? 700 : 400,
                    boxShadow: page === p ? "0 1px 3px rgba(37,99,235,0.3)" : "0 1px 2px rgba(0,0,0,0.04)",
                  }}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPgs, p + 1))} disabled={page === totalPgs}
                style={{ padding: "5px 12px", background: "#fff", border: "1px solid #d1d5db",
                  borderRadius: 6, color: page === totalPgs ? "#d1d5db" : "#374151",
                  cursor: page === totalPgs ? "not-allowed" : "pointer", fontSize: 12,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>→</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
