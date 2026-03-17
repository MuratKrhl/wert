import { useState, useEffect, useRef } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const TOWER_BASE_URL = "https://your-tower-host";
const TOWER_TOKEN    = "your-oauth-token-here";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_TEMPLATES = [
  {
    id: 1, name: "Deploy Web Application",
    description: "Production web sunucularına uygulama deploy eder",
    status: "successful", last_job_run: "2026-03-03T14:22:00Z",
    project: { name: "WebOps" },
    extra_vars: [
      { key: "app_version",  label: "Uygulama Versiyonu", type: "text",   default: "v2.4.1",      required: true  },
      { key: "target_env",   label: "Hedef Ortam",        type: "select", default: "production",  required: true,  options: ["production","staging","dev"] },
      { key: "force_pull",   label: "Force Pull",         type: "bool",   default: "true",        required: false },
      { key: "notify_slack", label: "Slack Bildirimi",    type: "bool",   default: "false",       required: false },
    ],
  },
  {
    id: 2, name: "Patch Linux Servers",
    description: "Tüm Linux sunucularına güvenlik yamaları uygular",
    status: "running", last_job_run: "2026-03-04T08:05:00Z",
    project: { name: "Security" },
    extra_vars: [
      { key: "patch_type",    label: "Yama Türü",        type: "select", default: "security",  required: true,  options: ["security","full","kernel-only"] },
      { key: "reboot_after",  label: "Sonra Yeniden Başlat", type: "bool", default: "false",   required: false },
      { key: "target_hosts",  label: "Hedef Host Grubu", type: "text",   default: "all",       required: true  },
    ],
  },
  {
    id: 3, name: "Database Backup",
    description: "PostgreSQL veritabanlarının yedeğini alır",
    status: "failed", last_job_run: "2026-03-04T01:00:00Z",
    project: { name: "DBA-Ops" },
    extra_vars: [
      { key: "db_name",     label: "Veritabanı Adı",   type: "text",   default: "prod_db",  required: true  },
      { key: "backup_type", label: "Yedek Türü",        type: "select", default: "full",     required: true,  options: ["full","incremental","schema-only"] },
      { key: "compress",    label: "Sıkıştır (gzip)",   type: "bool",   default: "true",     required: false },
      { key: "s3_bucket",   label: "S3 Bucket",         type: "text",   default: "backups-prod", required: false },
    ],
  },
  {
    id: 4, name: "Nginx Config Reload",
    description: "Nginx konfigürasyonunu tüm load balancer'lara iter",
    status: "successful", last_job_run: "2026-03-02T17:45:00Z",
    project: { name: "Infra" },
    extra_vars: [
      { key: "validate_only", label: "Sadece Doğrula",  type: "bool",   default: "false",    required: false },
      { key: "config_branch", label: "Config Branch",   type: "text",   default: "main",     required: true  },
    ],
  },
  {
    id: 5, name: "User Provisioning",
    description: "Yeni kullanıcı hesaplarını sistemlere ekler",
    status: "successful", last_job_run: "2026-03-01T09:30:00Z",
    project: { name: "IAM" },
    extra_vars: [
      { key: "username",  label: "Kullanıcı Adı",  type: "text",   default: "",           required: true  },
      { key: "user_role", label: "Rol",             type: "select", default: "developer",  required: true,  options: ["developer","ops","admin","readonly"] },
      { key: "send_mail", label: "E-posta Gönder",  type: "bool",   default: "true",       required: false },
    ],
  },
  {
    id: 6, name: "SSL Certificate Renew",
    description: "Süresi dolan SSL sertifikalarını yeniler",
    status: "never", last_job_run: null,
    project: { name: "Security" },
    extra_vars: [
      { key: "domain",     label: "Domain",          type: "text",   default: "",           required: true  },
      { key: "dry_run",    label: "Dry Run",          type: "bool",   default: "true",       required: false },
      { key: "cert_type",  label: "Sertifika Türü",  type: "select", default: "letsencrypt", required: true, options: ["letsencrypt","self-signed","corporate"] },
    ],
  },
];

const MOCK_LOGS = {
  1: [
    { t: "play",    line: "PLAY [Deploy Web Application] ****************************" },
    { t: "task",    line: "\nTASK [Gathering Facts] ***********************************" },
    { t: "ok",      line: "ok: [web01.prod]  ok: [web02.prod]" },
    { t: "task",    line: "\nTASK [Pull Docker image] *********************************" },
    { t: "changed", line: "changed: [web01.prod]  changed: [web02.prod]" },
    { t: "task",    line: "\nTASK [Restart service] ***********************************" },
    { t: "changed", line: "changed: [web01.prod]  changed: [web02.prod]" },
    { t: "task",    line: "\nTASK [Health check] **************************************" },
    { t: "ok",      line: 'ok: [web01.prod] => {"status": 200}' },
    { t: "ok",      line: 'ok: [web02.prod] => {"status": 200}' },
    { t: "play",    line: "\nPLAY RECAP ***********************************************" },
    { t: "recap",   line: "web01.prod  : ok=4  changed=2  failed=0" },
    { t: "recap",   line: "web02.prod  : ok=4  changed=2  failed=0" },
    { t: "success", line: "\n✓ Job tamamlandı — 0 hata" },
  ],
  2: [
    { t: "play",    line: "PLAY [Patch Linux Servers] *******************************" },
    { t: "task",    line: "\nTASK [Gathering Facts] ***********************************" },
    { t: "ok",      line: "ok: [linux01]  ok: [linux02]  ok: [linux03]" },
    { t: "task",    line: "\nTASK [Update apt cache] **********************************" },
    { t: "changed", line: "changed: [linux01]  changed: [linux02]  changed: [linux03]" },
    { t: "task",    line: "\nTASK [Apply patches] *************************************" },
    { t: "changed", line: "changed: [linux01]  changed: [linux02]  changed: [linux03]" },
    { t: "play",    line: "\nPLAY RECAP ***********************************************" },
    { t: "recap",   line: "linux01 : ok=3  changed=2  failed=0" },
    { t: "recap",   line: "linux02 : ok=3  changed=2  failed=0" },
    { t: "recap",   line: "linux03 : ok=3  changed=2  failed=0" },
    { t: "success", line: "\n✓ Job tamamlandı — 0 hata" },
  ],
  3: [
    { t: "play",  line: "PLAY [Database Backup] ***********************************" },
    { t: "task",  line: "\nTASK [Gathering Facts] ***********************************" },
    { t: "ok",    line: "ok: [db01.prod]" },
    { t: "task",  line: "\nTASK [Run pg_dump] ***************************************" },
    { t: "error", line: 'fatal: [db01.prod]: FAILED! => {"msg": "pg_dump: connection refused"}' },
    { t: "play",  line: "\nPLAY RECAP ***********************************************" },
    { t: "recap", line: "db01.prod : ok=1  changed=0  failed=1" },
    { t: "error", line: "\n✗ Job başarısız — 1 görev hata verdi" },
  ],
  default: [
    { t: "play",    line: "PLAY [Running playbook…] *********************************" },
    { t: "task",    line: "\nTASK [Gathering Facts] ***********************************" },
    { t: "ok",      line: "ok: [host01]" },
    { t: "task",    line: "\nTASK [Execute tasks] *************************************" },
    { t: "changed", line: "changed: [host01]" },
    { t: "play",    line: "\nPLAY RECAP ***********************************************" },
    { t: "recap",   line: "host01 : ok=2  changed=1  failed=0" },
    { t: "success", line: "\n✓ Job tamamlandı" },
  ],
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return "Hiç çalışmadı";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return `${diff}s önce`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  return `${Math.floor(diff / 86400)}g önce`;
}

const STATUS_META = {
  successful: { label: "Başarılı",  color: "#22c55e", dot: "#16a34a" },
  running:    { label: "Çalışıyor", color: "#f59e0b", dot: "#d97706", pulse: true },
  failed:     { label: "Başarısız", color: "#ef4444", dot: "#dc2626" },
  never:      { label: "Bekliyor",  color: "#6b7280", dot: "#4b5563" },
};

const LOG_COLORS = {
  ok: "#22c55e", task: "#a78bfa", changed: "#f59e0b",
  recap: "#60a5fa", play: "#94a3b8", error: "#ef4444", success: "#22c55e",
};

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.never;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 4,
      background: meta.color + "18", border: `1px solid ${meta.color}40`,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
      color: meta.color, fontFamily: "monospace", textTransform: "uppercase",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: meta.dot,
        animation: meta.pulse ? "pulseRing 1.4s ease-in-out infinite" : "none",
      }} />
      {meta.label}
    </span>
  );
}

// ─── PARAMS MODAL ─────────────────────────────────────────────────────────────
function ParamsModal({ template, onStart, onClose }) {
  const [values, setValues] = useState(() => {
    const init = {};
    template.extra_vars.forEach(v => { init[v.key] = v.default; });
    return init;
  });
  const [errors, setErrors]   = useState({});
  const [starting, setStarting] = useState(false);

  const set = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: false }));
  };

  const validate = () => {
    const errs = {};
    template.extra_vars.forEach(v => {
      if (v.required && !values[v.key]?.toString().trim()) errs[v.key] = true;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStart = async () => {
    if (!validate()) return;
    setStarting(true);
    await new Promise(r => setTimeout(r, 700));
    const jobId = Math.floor(10000 + Math.random() * 90000);
    onStart({ templateId: template.id, templateName: template.name, jobId, vars: values });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{
        width: 500, maxWidth: "95vw", maxHeight: "90vh",
        background: "#111116",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(225,29,72,0.2)",
        animation: "modalSlide 0.3s cubic-bezier(0.16,1,0.3,1)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Modal header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6,
                background: "linear-gradient(135deg,#e11d48,#7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13,
              }}>⚙</div>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#f9fafb" }}>
                {template.name}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontFamily: "'JetBrains Mono',monospace" }}>
              {template.description}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#6b7280", borderRadius: 6, padding: "4px 12px",
            cursor: "pointer", fontSize: 13, fontFamily: "monospace", marginLeft: 12,
            flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Params */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#4b5563",
            fontFamily: "monospace", letterSpacing: "0.12em",
            textTransform: "uppercase", marginBottom: 16,
          }}>
            — Extra Variables
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {template.extra_vars.map(v => (
              <div key={v.key}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: 6, alignItems: "center",
                }}>
                  <label style={{
                    fontSize: 12, fontWeight: 700, color: "#d1d5db",
                    fontFamily: "'JetBrains Mono',monospace",
                  }}>
                    {v.label}
                    {v.required && (
                      <span style={{ color: "#e11d48", marginLeft: 4 }}>*</span>
                    )}
                  </label>
                  <span style={{
                    fontSize: 9, color: "#374151", fontFamily: "monospace",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 3,
                  }}>
                    {v.key}
                  </span>
                </div>

                {/* Text input */}
                {v.type === "text" && (
                  <input
                    value={values[v.key] || ""}
                    onChange={e => set(v.key, e.target.value)}
                    placeholder={v.default || v.key}
                    style={{
                      width: "100%", padding: "9px 12px",
                      background: errors[v.key] ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                      border: errors[v.key] ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 7, color: "#e5e7eb", fontSize: 13,
                      fontFamily: "'JetBrains Mono',monospace",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box",
                    }}
                    className="param-inp"
                  />
                )}

                {/* Select */}
                {v.type === "select" && (
                  <select
                    value={values[v.key]}
                    onChange={e => set(v.key, e.target.value)}
                    style={{
                      width: "100%", padding: "9px 12px",
                      background: "#0d0d12",
                      border: errors[v.key] ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 7, color: "#e5e7eb", fontSize: 13,
                      fontFamily: "'JetBrains Mono',monospace",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    {v.options.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                )}

                {/* Bool toggle */}
                {v.type === "bool" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {["true", "false"].map(opt => (
                      <button
                        key={opt}
                        onClick={() => set(v.key, opt)}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 700,
                          fontFamily: "'JetBrains Mono',monospace", cursor: "pointer",
                          border: values[v.key] === opt
                            ? `1px solid ${opt === "true" ? "#22c55e" : "#ef4444"}`
                            : "1px solid rgba(255,255,255,0.1)",
                          background: values[v.key] === opt
                            ? (opt === "true" ? "#22c55e18" : "#ef444418")
                            : "rgba(255,255,255,0.03)",
                          color: values[v.key] === opt
                            ? (opt === "true" ? "#22c55e" : "#ef4444")
                            : "#6b7280",
                          transition: "all 0.15s",
                        }}
                      >
                        {opt === "true" ? "✓  true" : "✗  false"}
                      </button>
                    ))}
                  </div>
                )}

                {errors[v.key] && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontFamily: "monospace" }}>
                    Bu alan zorunludur
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* JSON preview */}
          <div style={{
            marginTop: 20, padding: 12,
            background: "#050508",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7,
          }}>
            <div style={{ fontSize: 9, color: "#374151", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>
              extra_vars preview
            </div>
            <pre style={{ margin: 0, fontSize: 11, color: "#6b7280", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(values, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.2)",
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button onClick={onClose} style={{
            padding: "10px 22px", borderRadius: 7, fontSize: 13, fontWeight: 600,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#9ca3af", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace",
            transition: "all 0.15s",
          }}>
            İptal
          </button>
          <button
            onClick={handleStart}
            disabled={starting}
            style={{
              padding: "10px 28px", borderRadius: 7, fontSize: 13, fontWeight: 700,
              background: starting ? "#7c3aed" : "linear-gradient(135deg,#e11d48,#be123c)",
              border: "none", color: "#fff", cursor: starting ? "wait" : "pointer",
              fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.05em",
              boxShadow: "0 4px 16px rgba(225,29,72,0.4)",
              transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {starting ? (
              <><span style={{ animation: "spin 0.8s linear infinite", display:"inline-block" }}>⟳</span> Başlatılıyor…</>
            ) : (
              <><span>▶</span> Start Job</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LOG PANEL ────────────────────────────────────────────────────────────────
function LogPanel({ job, onClose }) {
  const [lines, setLines]     = useState([]);
  const [status, setStatus]   = useState("running");
  const [elapsed, setElapsed] = useState(0);
  const bottomRef = useRef(null);
  const lineRef   = useRef(null);
  const timerRef  = useRef(null);

  useEffect(() => {
    if (!job) return;
    setLines([]);
    setStatus("running");
    setElapsed(0);

    const script = MOCK_LOGS[job.templateId] || MOCK_LOGS.default;
    let i = 0;

    lineRef.current = setInterval(() => {
      if (i < script.length) {
        setLines(prev => [...prev, script[i++]]);
      } else {
        clearInterval(lineRef.current);
        const last = script[script.length - 1];
        setStatus(last.t === "error" ? "error" : "done");
      }
    }, 270);

    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

    return () => {
      clearInterval(lineRef.current);
      clearInterval(timerRef.current);
    };
  }, [job]);

  useEffect(() => {
    if (status !== "running") clearInterval(timerRef.current);
  }, [status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!job) return null;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const sc = status === "running" ? "#f59e0b" : status === "done" ? "#22c55e" : "#ef4444";
  const sl = status === "running" ? "● Çalışıyor" : status === "done" ? "✓ Tamamlandı" : "✗ Başarısız";

  return (
    <div style={{
      marginTop: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10, overflow: "hidden",
      animation: "slideDown 0.35s cubic-bezier(0.16,1,0.3,1)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", background: "rgba(0,0,0,0.45)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: sc,
            animation: status === "running" ? "pulseRing 1.4s ease-in-out infinite" : "none",
          }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#e5e7eb", fontWeight: 700 }}>
            {job.templateName}
          </span>
          <span style={{
            fontSize: 10, color: "#6b7280", fontFamily: "monospace",
            background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4,
          }}>JOB #{job.jobId}</span>

          {/* Vars summary */}
          {job.vars && Object.keys(job.vars).length > 0 && (
            <span style={{
              fontSize: 10, color: "#818cf8", fontFamily: "monospace",
              background: "#818cf810", border: "1px solid #818cf830",
              padding: "2px 8px", borderRadius: 4,
            }}>
              {Object.keys(job.vars).length} parametre
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#4b5563" }}>⏱ {mm}:{ss}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: "monospace",
            letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 4,
            textTransform: "uppercase",
            background: sc + "18", color: sc, border: `1px solid ${sc}40`,
          }}>{sl}</span>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#6b7280", borderRadius: 5, padding: "3px 10px",
            cursor: "pointer", fontSize: 12, fontFamily: "monospace",
          }}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div style={{
        background: "#050508", height: 220, overflowY: "auto",
        padding: "14px 18px",
        fontFamily: "'JetBrains Mono',monospace", fontSize: 12, lineHeight: 1.75,
      }}>
        {/* Injected vars note */}
        {job.vars && (
          <div style={{ color: "#4b5563", marginBottom: 8, fontSize: 11 }}>
            {`# extra_vars: ${JSON.stringify(job.vars)}`}
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{ color: LOG_COLORS[l.t] || "#9ca3af", whiteSpace: "pre-wrap", animation: "logLine 0.15s ease" }}>
            {l.line}
          </div>
        ))}
        {status === "running" && (
          <span style={{ animation: "blink 1s step-end infinite", color: "#e5e7eb" }}>█</span>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div style={{
        background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "6px 16px", display: "flex", justifyContent: "space-between",
        fontSize: 10, fontFamily: "monospace", color: "#374151",
      }}>
        <span>{lines.length} satır · {status === "running" ? "akıyor…" : "tamamlandı"}</span>
        <span>GET /api/v2/jobs/{job.jobId}/stdout/</span>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AnsibleSlide() {
  const [templates, setTemplates]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilter]   = useState("all");
  const [useMock, setUseMock]       = useState(true);
  const [paramTarget, setParamTarget] = useState(null); // template to configure
  const [activeJob, setActiveJob]   = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setTemplates(useMock ? MOCK_TEMPLATES : await (async () => {
          const r = await fetch(`${TOWER_BASE_URL}/api/v2/job_templates/?page_size=50`, {
            headers: { Authorization: `Bearer ${TOWER_TOKEN}` },
          });
          return (await r.json()).results;
        })());
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();
  }, [useMock]);

  const filtered = templates.filter(t => {
    const ms = t.name.toLowerCase().includes(search.toLowerCase()) ||
               t.description.toLowerCase().includes(search.toLowerCase());
    return ms && (filterStatus === "all" || t.status === filterStatus);
  });

  const counts = templates.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1; return acc;
  }, {});

  const handleStart = (job) => {
    setParamTarget(null);
    setActiveJob(job);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;700;800&display=swap');

        @keyframes pulseRing {
          0%   { box-shadow:0 0 0 0px rgba(217,119,6,0.7); }
          70%  { box-shadow:0 0 0 6px rgba(217,119,6,0); }
          100% { box-shadow:0 0 0 0px rgba(217,119,6,0); }
        }
        @keyframes fadeRow {
          from { opacity:0; transform:translateX(-5px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes logLine {
          from { opacity:0; transform:translateX(-4px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes blink    { 0%,100%{opacity:1;} 50%{opacity:0;} }
        @keyframes fadeIn   { from{opacity:0;} to{opacity:1;} }
        @keyframes modalSlide {
          from { opacity:0; transform:translateY(-20px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }

        .tpl-row:hover    { background:rgba(255,255,255,0.04) !important; }
        .filter-btn:hover { background:rgba(255,255,255,0.08) !important; }
        .search-inp:focus { outline:none; border-color:#e11d48 !important; }
        .param-inp:focus  { outline:none; border-color:#e11d48 !important; }
        .launch-btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
        .launch-btn:active { transform:translateY(0); }

        ::-webkit-scrollbar       { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }
      `}</style>

      {/* PARAMS MODAL */}
      {paramTarget && (
        <ParamsModal
          template={paramTarget}
          onStart={handleStart}
          onClose={() => setParamTarget(null)}
        />
      )}

      <div style={{
        fontFamily: "'Syne',sans-serif",
        background: "#0d0d12", borderRadius: 14, padding: 28,
        color: "#e5e7eb", position: "relative", overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        {/* BG grid */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
          backgroundSize:"40px 40px",
          maskImage:"radial-gradient(ellipse at 50% 0%,black 40%,transparent 80%)",
        }} />
        <div style={{
          position:"absolute", top:-60, right:-40, width:280, height:280, pointerEvents:"none",
          background:"radial-gradient(circle,rgba(225,29,72,0.12) 0%,transparent 70%)",
        }} />

        {/* HEADER */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, position:"relative" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <div style={{
                width:30, height:30, borderRadius:7, fontSize:15,
                background:"linear-gradient(135deg,#e11d48,#7c3aed)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>⚡</div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800, letterSpacing:"-0.02em", color:"#f9fafb" }}>
                Ansible Tower
              </h2>
            </div>
            <p style={{ margin:0, fontSize:12, color:"#6b7280", fontFamily:"'JetBrains Mono',monospace" }}>
              {templates.length} template · Ekip iş akışları
            </p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { label:"Başarılı", count:counts.successful||0, color:"#22c55e" },
              { label:"Çalışan",  count:counts.running||0,    color:"#f59e0b" },
              { label:"Hatalı",   count:counts.failed||0,     color:"#ef4444" },
            ].map(s => (
              <div key={s.label} style={{
                padding:"6px 12px", borderRadius:7, textAlign:"center",
                background:s.color+"12", border:`1px solid ${s.color}30`,
              }}>
                <div style={{ fontSize:18, fontWeight:800, color:s.color, lineHeight:1 }}>{s.count}</div>
                <div style={{ fontSize:10, color:"#6b7280", marginTop:2, fontFamily:"monospace" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TOOLBAR */}
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <input
            className="search-inp"
            placeholder="🔍  Template ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex:1, minWidth:180, padding:"8px 14px",
              background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:7, color:"#e5e7eb", fontSize:13,
              fontFamily:"'JetBrains Mono',monospace", transition:"border-color 0.2s",
            }}
          />
          {["all","successful","running","failed"].map(f => (
            <button key={f} className="filter-btn" onClick={() => setFilter(f)} style={{
              padding:"8px 14px", borderRadius:7, fontSize:12, fontWeight:600,
              border:filterStatus===f ? "1px solid #e11d48" : "1px solid rgba(255,255,255,0.1)",
              background:filterStatus===f ? "#e11d4820" : "rgba(255,255,255,0.03)",
              color:filterStatus===f ? "#f43f5e" : "#9ca3af",
              cursor:"pointer", fontFamily:"monospace", transition:"all 0.18s",
            }}>
              {f === "all" ? "Tümü" : STATUS_META[f]?.label}
            </button>
          ))}
          <button onClick={() => setUseMock(v => !v)} style={{
            padding:"8px 14px", borderRadius:7, fontSize:11, fontWeight:700,
            border:"1px solid rgba(255,255,255,0.1)",
            background:useMock ? "#7c3aed20" : "#16a34a20",
            color:useMock ? "#a78bfa" : "#4ade80",
            cursor:"pointer", fontFamily:"monospace", letterSpacing:"0.05em",
          }}>
            {useMock ? "● MOCK" : "● LIVE"}
          </button>
        </div>

        {/* TABLE */}
        <div style={{
          border:"1px solid rgba(255,255,255,0.07)", borderRadius:10,
          overflow:"hidden", background:"rgba(255,255,255,0.02)",
        }}>
          <div style={{
            display:"grid", gridTemplateColumns:"2fr 2.5fr 1fr 1.2fr 1fr",
            padding:"10px 16px",
            background:"rgba(255,255,255,0.04)",
            borderBottom:"1px solid rgba(255,255,255,0.07)",
            fontSize:10, fontWeight:700, color:"#4b5563",
            letterSpacing:"0.1em", textTransform:"uppercase",
            fontFamily:"'JetBrains Mono',monospace",
          }}>
            <span>TEMPLATE</span><span>AÇIKLAMA</span>
            <span>PROJE</span><span>SON ÇALIŞMA</span>
            <span style={{ textAlign:"right" }}>İŞLEM</span>
          </div>

          {loading ? (
            <div style={{ padding:40, textAlign:"center", color:"#4b5563", fontFamily:"monospace", fontSize:13 }}>⟳ Yükleniyor…</div>
          ) : error ? (
            <div style={{ padding:30, textAlign:"center", color:"#ef4444", fontFamily:"monospace", fontSize:12 }}>✗ {error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:30, textAlign:"center", color:"#4b5563", fontFamily:"monospace", fontSize:12 }}>Sonuç bulunamadı</div>
          ) : filtered.map((t, i) => (
            <div key={t.id} className="tpl-row" style={{
              display:"grid", gridTemplateColumns:"2fr 2.5fr 1fr 1.2fr 1fr",
              padding:"13px 16px",
              borderBottom:i < filtered.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              alignItems:"center", transition:"background 0.15s",
              animation:"fadeRow 0.3s ease both", animationDelay:`${i*0.04}s`,
              background: activeJob?.templateId===t.id ? "rgba(225,29,72,0.05)" : "transparent",
            }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#f3f4f6", marginBottom:4 }}>{t.name}</div>
                <StatusBadge status={t.status} />
              </div>
              <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.4, paddingRight:12, fontFamily:"'JetBrains Mono',monospace" }}>
                {t.description}
              </div>
              <div style={{
                fontSize:11, fontWeight:600, color:"#818cf8", fontFamily:"monospace",
                background:"#818cf810", border:"1px solid #818cf830",
                borderRadius:4, padding:"2px 8px", display:"inline-block",
              }}>
                {t.project.name}
              </div>
              <div style={{ fontSize:11, color:"#4b5563", fontFamily:"'JetBrains Mono',monospace" }}>
                {timeAgo(t.last_job_run)}
              </div>

              {/* LAUNCH BUTTON → opens params modal */}
              <div style={{ textAlign:"right" }}>
                <button
                  className="launch-btn"
                  onClick={() => setParamTarget(t)}
                  style={{
                    padding:"6px 18px", borderRadius:5, border:"none",
                    background:"linear-gradient(135deg,#e11d48,#be123c)",
                    color:"#fff", fontSize:12, fontWeight:700, letterSpacing:"0.05em",
                    cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
                    transition:"all 0.2s", whiteSpace:"nowrap",
                    boxShadow:"0 2px 10px rgba(225,29,72,0.4)",
                  }}
                >
                  ⚙  Launch
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* LOG PANEL */}
        <LogPanel job={activeJob} onClose={() => setActiveJob(null)} />

        {/* Footer */}
        <div style={{
          marginTop:14, display:"flex", justifyContent:"space-between",
          fontSize:11, color:"#374151", fontFamily:"monospace",
        }}>
          <span>{filtered.length} / {templates.length} template gösteriliyor</span>
          <span>{TOWER_BASE_URL}</span>
        </div>
      </div>
    </>
  );
}
