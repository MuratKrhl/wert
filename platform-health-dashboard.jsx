import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
  Cell, Scatter, ScatterChart, ZAxis
} from "recharts";

/* ═══════════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════════════════════ */
const T = {
  bg:         "#f0f4f9",
  surface:    "#f7f9fc",
  card:       "#ffffff",
  border:     "#dde4ef",
  borderMid:  "#c8d4e8",
  divider:    "#eaeff8",

  blue:       "#1d4ed8", blueL:"#eff6ff", blueMid:"#3b82f6",
  green:      "#059669", greenL:"#ecfdf5",
  amber:      "#d97706", amberL:"#fffbeb",
  red:        "#dc2626", redL:"#fef2f2",
  teal:       "#0891b2", tealL:"#ecfeff",
  purple:     "#7c3aed", purpleL:"#f5f3ff",
  orange:     "#ea580c", orangeL:"#fff7ed",
  pink:       "#db2777", pinkL:"#fdf2f8",

  text:       "#0f172a",
  textMid:    "#334155",
  textDim:    "#64748b",
  textFaint:  "#94a3b8",

  mono: "'IBM Plex Mono', monospace",
  sans: "'Outfit', sans-serif",
};

/* ═══════════════════════════════════════════════════════════════════════════════
   DATA ENGINE
═══════════════════════════════════════════════════════════════════════════════ */
const rnd  = (b, v) => +(b + (Math.random()-0.5)*v*2).toFixed(3);
const rndI = (b, v) => Math.round(b + (Math.random()-0.5)*v*2);
const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));

const mkTs = (base, variance, n=60) => {
  const now = Date.now();
  return Array.from({length:n}, (_,i) => {
    const d = new Date(now - (n-i)*2*60000);
    return {
      ts: `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`,
      v: rnd(base, variance),
    };
  });
};

// Inject a spike at index 45 for drama
const mkTsSpike = (base, variance, spikeVal, n=60) => {
  const data = mkTs(base, variance, n);
  data[44].v = spikeVal;
  data[45].v = spikeVal * 0.9;
  data[46].v = spikeVal * 0.6;
  return data;
};

const mkFleet = (n, base, variance) => {
  const hosts = Array.from({length:n}, (_,i) => ({
    id: `h${String(i+1).padStart(3,"0")}`,
    v: clamp(rnd(base, variance), 0, 100),
  })).sort((a,b) => a.v - b.v);
  const vals = hosts.map(h => h.v).sort((a,b)=>a-b);
  const pct = p => vals[Math.floor(p*(vals.length-1)/100)];
  return {
    hosts,
    stats: {
      min: pct(0).toFixed(1), p25: pct(25).toFixed(1), p50: pct(50).toFixed(1),
      p75: pct(75).toFixed(1), p90: pct(90).toFixed(1), p95: pct(95).toFixed(1),
      p99: pct(99).toFixed(1), max: pct(100).toFixed(1),
      avg: (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1),
    },
    histogram: (() => {
      const buckets = 12;
      const mx = Math.ceil(Math.max(...vals)/buckets)*buckets;
      return Array.from({length:buckets}, (_,i) => ({
        lo: i*(mx/buckets), hi: (i+1)*(mx/buckets),
        label: `${Math.round(i*(mx/buckets))}`,
        count: vals.filter(v => v >= i*(mx/buckets) && v < (i+1)*(mx/buckets)).length,
      }));
    })(),
    top15: hosts.slice(-15).reverse(),
    critical: hosts.filter(h => h.v > base + variance * 1.5),
  };
};

const NOW_PROBLEMS = [
  { id:"P-4821", sev:"HIGH",   title:"JBoss Thread Pool Saturation — 3 nodes", service:"JBoss",     age:"8m ago",  davis:"Correlated with deploy jboss-app:v4.12.1" },
  { id:"P-4819", sev:"MEDIUM", title:"NGINX Upstream Failures Elevated",       service:"NGINX",     age:"22m ago", davis:"Caused by upstream jboss-pool-3 slowdown" },
  { id:"P-4815", sev:"MEDIUM", title:"OpenShift Memory Pressure — worker-04",  service:"Openshift", age:"41m ago", davis:"OOMKilled events detected, 3 container restarts" },
  { id:"P-4810", sev:"LOW",    title:"Hazelcast WAN Replication Lag Spike",    service:"Hazelcast", age:"1h 12m",  davis:"DC-2 → DC-3 replication lag peaked at 1.2s" },
  { id:"P-4802", sev:"LOW",    title:"CTG Queue Depth Brief Spike",            service:"CTG",       age:"2h 5m",   davis:"Resolved automatically. CICS PROD2 brief overload." },
];

const DEPLOYMENTS = [
  { ts: "12:44", service:"JBoss",    version:"v4.12.1", status:"warn" },
  { ts: "10:18", service:"NGINX",    version:"v1.24.3", status:"ok"   },
  { ts: "09:02", service:"Provenir", version:"v8.4.0",  status:"ok"   },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   SERVICE CONFIG
═══════════════════════════════════════════════════════════════════════════════ */
const SVC_DEFS = {
  NGINX: {
    label:"NGINX", badge:"EDGE PROXY", color:T.green, hostCount:84,
    desc:"Inbound HTTP/S proxy & load balancer",
    slo:{ name:"Availability", target:99.9, current:99.97 },
    apdex:0.94,
    kpis:[
      { label:"Total RPS",    value:14820, unit:"req/s", prev:14360, status:"ok"   },
      { label:"P95 Latency",  value:68,    unit:"ms",    prev:71,    status:"ok"   },
      { label:"5xx Rate",     value:0.31,  unit:"%",     prev:0.35,  status:"ok"   },
      { label:"Cache Hit",    value:81.4,  unit:"%",     prev:80.1,  status:"ok"   },
      { label:"Active Conns", value:4218,  unit:"",      prev:4100,  status:"ok"   },
      { label:"Upst Failures",value:18,    unit:"/min",  prev:12,    status:"warn" },
    ],
    primaryTs: [
      { label:"Requests/sec",    key:"nginx.rps",      base:14820, var:800,  unit:"req/s", color:T.green  },
      { label:"P95 Latency",     key:"nginx.lat_p95",  base:68,    var:12,   unit:"ms",    color:T.blue   },
      { label:"5xx Error Rate",  key:"nginx.5xx",      base:0.31,  var:0.08, unit:"%",     color:T.red    },
      { label:"Active Conns",    key:"nginx.conns",    base:4218,  var:300,  unit:"",      color:T.purple },
    ],
    metrics:[
      { id:"nginx.rps",          label:"Requests/sec",          dynaKey:"ext:nginx.requests.total",               v:14820,  unit:"req/s", status:"ok",   fleet:mkFleet(84,176,60),  ts:mkTs(14820,800),      thr:40000,  desc:"Total HTTP/S req/s across all nginx workers." },
      { id:"nginx.rps_get",      label:"GET Rate",              dynaKey:"ext:nginx.requests.get",                 v:11820,  unit:"req/s", status:"ok",   fleet:mkFleet(84,141,55),  ts:mkTs(11820,700),      thr:35000,  desc:"HTTP GET request rate." },
      { id:"nginx.rps_post",     label:"POST Rate",             dynaKey:"ext:nginx.requests.post",                v:2840,   unit:"req/s", status:"ok",   fleet:mkFleet(84,34,14),   ts:mkTs(2840,200),       thr:8000,   desc:"HTTP POST request rate." },
      { id:"nginx.lat_p50",      label:"Latency P50",           dynaKey:"ext:nginx.upstream.response_time.p50",   v:38,     unit:"ms",    status:"ok",   fleet:mkFleet(84,38,12),   ts:mkTs(38,8),           thr:100,    desc:"Median upstream response time." },
      { id:"nginx.lat_p95",      label:"Latency P95",           dynaKey:"ext:nginx.upstream.response_time.p95",   v:68,     unit:"ms",    status:"ok",   fleet:mkFleet(84,68,25),   ts:mkTs(68,12),          thr:200,    desc:"P95 upstream response time." },
      { id:"nginx.lat_p99",      label:"Latency P99",           dynaKey:"ext:nginx.upstream.response_time.p99",   v:142,    unit:"ms",    status:"ok",   fleet:mkFleet(84,142,40),  ts:mkTs(142,25),         thr:500,    desc:"P99 upstream response time — tail latency." },
      { id:"nginx.5xx",          label:"5xx Error Rate",        dynaKey:"ext:nginx.upstream.5xx.rate",            v:0.31,   unit:"%",     status:"ok",   fleet:mkFleet(84,0.31,0.2),ts:mkTs(0.31,0.08),      thr:1.0,    desc:"HTTP 5xx rate from upstreams." },
      { id:"nginx.4xx",          label:"4xx Error Rate",        dynaKey:"ext:nginx.upstream.4xx.rate",            v:1.82,   unit:"%",     status:"warn", fleet:mkFleet(84,1.82,0.8),ts:mkTsSpike(1.82,0.3,4.2), thr:5,   desc:"Client error rate." },
      { id:"nginx.conns",        label:"Active Connections",    dynaKey:"ext:nginx.connections.active",           v:4218,   unit:"",      status:"ok",   fleet:mkFleet(84,50,20),   ts:mkTs(4218,300),       thr:15000,  desc:"Live TCP connections to nginx workers." },
      { id:"nginx.conns_wait",   label:"Waiting Connections",   dynaKey:"ext:nginx.connections.waiting",          v:1840,   unit:"",      status:"ok",   fleet:mkFleet(84,22,10),   ts:mkTs(1840,150),       thr:8000,   desc:"Connections in keep-alive wait state." },
      { id:"nginx.upstream_fail",label:"Upstream Failures",     dynaKey:"ext:nginx.upstream.fails",               v:18,     unit:"/min",  status:"warn", fleet:mkFleet(84,0.21,0.3),ts:mkTsSpike(18,6,48),   thr:50,     desc:"Failed connections to upstream backends per minute." },
      { id:"nginx.cache_hit",    label:"Cache Hit Ratio",       dynaKey:"ext:nginx.cache.hit_ratio",              v:81.4,   unit:"%",     status:"ok",   fleet:mkFleet(84,81.4,8),  ts:mkTs(81.4,3),         thr:60,     desc:"Proxy cache hit %. Below 60% increases origin load." },
      { id:"nginx.ssl_hs",       label:"SSL Handshakes/s",      dynaKey:"ext:nginx.ssl.handshakes",               v:1240,   unit:"/s",    status:"ok",   fleet:mkFleet(84,15,8),    ts:mkTs(1240,120),       thr:5000,   desc:"TLS handshake rate. High = session cache issue." },
      { id:"nginx.bytes_in",     label:"Ingress Bandwidth",     dynaKey:"builtin:host.net.bytes.received",        v:3.4,    unit:"GB/s",  status:"ok",   fleet:mkFleet(84,40,15),   ts:mkTs(3.4,0.4),        thr:20,     desc:"Inbound network bandwidth." },
      { id:"nginx.bytes_out",    label:"Egress Bandwidth",      dynaKey:"builtin:host.net.bytes.sent",            v:8.2,    unit:"GB/s",  status:"ok",   fleet:mkFleet(84,98,30),   ts:mkTs(8.2,0.8),        thr:40,     desc:"Outbound network bandwidth." },
      { id:"nginx.cpu",          label:"Worker CPU P90",        dynaKey:"builtin:host.cpu.usage",                 v:38.2,   unit:"%",     status:"ok",   fleet:mkFleet(84,38.2,15), ts:mkTs(38.2,5),         thr:80,     desc:"P90 CPU across nginx fleet." },
      { id:"nginx.mem",          label:"Worker Memory P90",     dynaKey:"builtin:host.mem.usage",                 v:44.6,   unit:"%",     status:"ok",   fleet:mkFleet(84,44.6,10), ts:mkTs(44.6,4),         thr:85,     desc:"P90 memory across nginx fleet." },
      { id:"nginx.open_fds",     label:"Open File Descriptors", dynaKey:"ext:nginx.worker.connections",           v:84200,  unit:"",      status:"ok",   fleet:mkFleet(84,1002,200),ts:mkTs(84200,3000),     thr:200000, desc:"Open fd count. Max typically 65535 per worker." },
      { id:"nginx.reload",       label:"Config Reloads/h",      dynaKey:"ext:nginx.reloads.total",                v:4,      unit:"/h",    status:"ok",   fleet:mkFleet(84,4,2),     ts:mkTs(4,2),            thr:20,     desc:"nginx -s reload events per hour." },
    ],
  },

  HTTPD: {
    label:"HTTPD", badge:"EDGE PROXY", color:T.orange, hostCount:62,
    desc:"Apache HTTP Server — static & SSL termination",
    slo:{ name:"Availability", target:99.9, current:99.94 },
    apdex:0.92,
    kpis:[
      { label:"Total RPS",     value:8640,  unit:"req/s", prev:8200,  status:"ok"   },
      { label:"Busy Workers",  value:1248,  unit:"",      prev:980,   status:"warn" },
      { label:"Worker Sat.",   value:50.3,  unit:"%",     prev:39.5,  status:"warn" },
      { label:"Bandwidth",     value:18.4,  unit:"GB/s",  prev:17.2,  status:"ok"   },
      { label:"Response P95",  value:82,    unit:"ms",    prev:79,    status:"ok"   },
      { label:"Error Rate",    value:0.44,  unit:"%",     prev:0.41,  status:"ok"   },
    ],
    primaryTs:[
      { label:"Requests/sec",   key:"httpd.rps",       base:8640,  var:500,  unit:"req/s", color:T.orange },
      { label:"Busy Workers",   key:"httpd.busy",      base:1248,  var:100,  unit:"",      color:T.amber  },
      { label:"Response P95",   key:"httpd.resp_p95",  base:82,    var:15,   unit:"ms",    color:T.blue   },
      { label:"Error Rate",     key:"httpd.err",       base:0.44,  var:0.08, unit:"%",     color:T.red    },
    ],
    metrics:[
      { id:"httpd.rps",          label:"Requests/sec",          dynaKey:"ext:apache.requests",                    v:8640,   unit:"req/s", status:"ok",   fleet:mkFleet(62,139,55),   ts:mkTs(8640,500),       thr:25000,  desc:"Apache total requests/sec across fleet." },
      { id:"httpd.busy",         label:"Busy Workers",          dynaKey:"ext:apache.workers.busy",                v:1248,   unit:"",      status:"warn", fleet:mkFleet(62,20,8),     ts:mkTsSpike(1248,100,1820), thr:2000, desc:"Active MPM worker slots. >80% of MaxRequestWorkers = saturation." },
      { id:"httpd.idle",         label:"Idle Workers",          dynaKey:"ext:apache.workers.idle",                v:1232,   unit:"",      status:"ok",   fleet:mkFleet(62,20,6),     ts:mkTs(1232,80),        thr:null,   desc:"Idle workers available. Low = saturation risk." },
      { id:"httpd.worker_sat",   label:"Worker Saturation",     dynaKey:"ext:apache.workers.saturation",          v:50.3,   unit:"%",     status:"warn", fleet:mkFleet(62,50.3,12),  ts:mkTs(50.3,5),         thr:80,     desc:"Busy / (Busy+Idle) * 100. High values risk request queuing." },
      { id:"httpd.resp_p50",     label:"Response Time P50",     dynaKey:"builtin:service.response.time.p50",      v:44,     unit:"ms",    status:"ok",   fleet:mkFleet(62,44,15),    ts:mkTs(44,8),           thr:200,    desc:"P50 servlet response time." },
      { id:"httpd.resp_p95",     label:"Response Time P95",     dynaKey:"builtin:service.response.time",          v:82,     unit:"ms",    status:"ok",   fleet:mkFleet(62,82,30),    ts:mkTs(82,15),          thr:500,    desc:"P95 response time." },
      { id:"httpd.resp_p99",     label:"Response Time P99",     dynaKey:"builtin:service.response.time.p99",      v:184,    unit:"ms",    status:"ok",   fleet:mkFleet(62,184,50),   ts:mkTs(184,30),         thr:1000,   desc:"P99 response time — tail latency." },
      { id:"httpd.err_rate",     label:"Error Rate",            dynaKey:"builtin:service.errors.total.rate",      v:0.44,   unit:"%",     status:"ok",   fleet:mkFleet(62,0.44,0.2), ts:mkTs(0.44,0.08),      thr:1,      desc:"Application error rate." },
      { id:"httpd.ssl_errors",   label:"SSL Errors/min",        dynaKey:"ext:apache.ssl.errors",                  v:3,      unit:"/min",  status:"ok",   fleet:mkFleet(62,0.05,0.1), ts:mkTs(3,2),            thr:10,     desc:"SSL/TLS handshake errors per minute." },
      { id:"httpd.bytes",        label:"Throughput",            dynaKey:"ext:apache.bytes_per_sec",               v:18400,  unit:"MB/s",  status:"ok",   fleet:mkFleet(62,296,120),  ts:mkTs(18400,1500),     thr:50000,  desc:"Total data transfer rate." },
      { id:"httpd.conn_rate",    label:"Connection Rate",       dynaKey:"ext:apache.connections.total",           v:3820,   unit:"/s",    status:"ok",   fleet:mkFleet(62,62,25),    ts:mkTs(3820,300),       thr:10000,  desc:"New TCP connections/second." },
      { id:"httpd.keepalive",    label:"KeepAlive Connections", dynaKey:"ext:apache.scoreboard.keepalive",        v:8240,   unit:"",      status:"ok",   fleet:mkFleet(62,133,40),   ts:mkTs(8240,400),       thr:20000,  desc:"Keep-alive conn count. High = fd exhaustion risk." },
      { id:"httpd.cpu",          label:"Host CPU P90",          dynaKey:"builtin:host.cpu.usage",                 v:36.4,   unit:"%",     status:"ok",   fleet:mkFleet(62,36.4,14),  ts:mkTs(36.4,5),         thr:80,     desc:"P90 CPU. builtin:host.cpu.usage" },
      { id:"httpd.mem",          label:"Host Memory P90",       dynaKey:"builtin:host.mem.usage",                 v:51.2,   unit:"%",     status:"ok",   fleet:mkFleet(62,51.2,12),  ts:mkTs(51.2,5),         thr:85,     desc:"P90 memory." },
      { id:"httpd.load_avg",     label:"Host Load Average",     dynaKey:"ext:apache.cpu_load",                    v:2.14,   unit:"",      status:"ok",   fleet:mkFleet(62,2.14,0.8), ts:mkTs(2.14,0.4),       thr:8,      desc:"1-min load average on Apache hosts." },
      { id:"httpd.log_errors",   label:"Error Log Rate",        dynaKey:"builtin:log.events.error",               v:24,     unit:"/min",  status:"ok",   fleet:mkFleet(62,0.4,0.3),  ts:mkTs(24,6),           thr:100,    desc:"Error-level log events per minute." },
    ],
  },

  JBoss: {
    label:"JBoss", badge:"MIDDLEWARE", color:T.purple, hostCount:124,
    desc:"WildFly/JBoss EAP — core business logic tier",
    slo:{ name:"Response Time", target:99.5, current:99.61 },
    apdex:0.88,
    kpis:[
      { label:"Total TPS",    value:21680,  unit:"tps",  prev:20400, status:"ok"   },
      { label:"Heap P90",     value:72.4,   unit:"%",    prev:69.8,  status:"warn" },
      { label:"GC Pause P95", value:148,    unit:"ms",   prev:112,   status:"warn" },
      { label:"Thread Sat.",  value:58.4,   unit:"%",    prev:52.1,  status:"ok"   },
      { label:"Resp P95",     value:124,    unit:"ms",   prev:118,   status:"ok"   },
      { label:"Error Rate",   value:0.52,   unit:"%",    prev:0.48,  status:"ok"   },
    ],
    primaryTs:[
      { label:"Heap Usage %",    key:"jboss.heap",      base:72.4, var:5,    unit:"%",   color:T.purple },
      { label:"Request TPS",     key:"jboss.tps",       base:21680,var:1200, unit:"tps", color:T.green  },
      { label:"GC Pause P95",    key:"jboss.gc_sus",    base:148,  var:30,   unit:"ms",  color:T.amber  },
      { label:"Busy Threads",    key:"jboss.busy_th",   base:22840,var:1500, unit:"",    color:T.blue   },
    ],
    metrics:[
      { id:"jboss.heap_pct",     label:"Heap Usage %",          dynaKey:"builtin:tech.jvm.heap.memoryUsed",             v:72.4,   unit:"%",   status:"warn", fleet:mkFleet(124,72.4,12),  ts:mkTs(72.4,5),         thr:85,   desc:"JVM heap utilization. builtin:tech.jvm.heap.memoryUsed / memoryLimit" },
      { id:"jboss.heap_mb",      label:"Heap Used (MB)",        dynaKey:"builtin:tech.jvm.heap.memoryUsed.absolute",    v:5840,   unit:"MB",  status:"warn", fleet:mkFleet(124,5840,800), ts:mkTs(5840,400),       thr:6800, desc:"Absolute heap in MB. 8GB max per instance." },
      { id:"jboss.heap_old",     label:"Old Gen Heap %",        dynaKey:"builtin:tech.jvm.heap.old.memoryUsed",         v:48.2,   unit:"%",   status:"ok",   fleet:mkFleet(124,48.2,14),  ts:mkTs(48.2,6),         thr:75,   desc:"Old generation heap. High = GC pressure or leak risk." },
      { id:"jboss.nonheap",      label:"Non-Heap (Metaspace)",  dynaKey:"builtin:tech.jvm.nonHeap.memoryUsed",          v:284,    unit:"MB",  status:"ok",   fleet:mkFleet(124,284,50),   ts:mkTs(284,20),         thr:512,  desc:"Metaspace + CodeCache + CompressedClassSpace." },
      { id:"jboss.gc_activity",  label:"GC Activity %",         dynaKey:"builtin:tech.jvm.gc.activity",                 v:4.2,    unit:"%",   status:"ok",   fleet:mkFleet(124,4.2,2),    ts:mkTs(4.2,1),          thr:15,   desc:"Time in GC as % of JVM uptime." },
      { id:"jboss.gc_sus",       label:"GC Suspension P95",     dynaKey:"builtin:tech.jvm.gc.suspension",               v:148,    unit:"ms",  status:"warn", fleet:mkFleet(124,148,60),   ts:mkTsSpike(148,30,420),thr:200,  desc:"STW GC pause time P95. >200ms = user impact." },
      { id:"jboss.gc_count",     label:"GC Count/min",          dynaKey:"builtin:tech.jvm.gc.count",                    v:12.4,   unit:"/min",status:"ok",   fleet:mkFleet(124,12.4,4),   ts:mkTs(12.4,3),         thr:40,   desc:"Minor+major GC events per minute." },
      { id:"jboss.threads_total",label:"Thread Count Total",    dynaKey:"builtin:tech.jvm.threads.count",               v:38640,  unit:"",    status:"ok",   fleet:mkFleet(124,312,40),   ts:mkTs(38640,2000),     thr:62000,desc:"Total JVM threads across fleet." },
      { id:"jboss.busy_threads", label:"Busy Threads",          dynaKey:"ext:jboss.undertow.activeRequests",            v:22840,  unit:"",    status:"warn", fleet:mkFleet(124,184,35),   ts:mkTsSpike(22840,1500,32000), thr:49600, desc:"Undertow threads actively handling requests." },
      { id:"jboss.tps",          label:"Request TPS",           dynaKey:"builtin:service.requestCount.total",           v:21680,  unit:"tps", status:"ok",   fleet:mkFleet(124,175,60),   ts:mkTs(21680,1200),     thr:60000,desc:"Requests/sec. builtin:service.requestCount.total" },
      { id:"jboss.resp_p50",     label:"Response Time P50",     dynaKey:"builtin:service.response.time.p50",            v:68,     unit:"ms",  status:"ok",   fleet:mkFleet(124,68,25),    ts:mkTs(68,15),          thr:200,  desc:"Median response time." },
      { id:"jboss.resp_p95",     label:"Response Time P95",     dynaKey:"builtin:service.response.time",                v:124,    unit:"ms",  status:"ok",   fleet:mkFleet(124,124,45),   ts:mkTs(124,25),         thr:500,  desc:"P95 response time." },
      { id:"jboss.resp_p99",     label:"Response Time P99",     dynaKey:"builtin:service.response.time.p99",            v:284,    unit:"ms",  status:"ok",   fleet:mkFleet(124,284,80),   ts:mkTs(284,50),         thr:1000, desc:"P99 response time — long-tail latency." },
      { id:"jboss.err_rate",     label:"Error Rate",            dynaKey:"builtin:service.errors.total.rate",            v:0.52,   unit:"%",   status:"ok",   fleet:mkFleet(124,0.52,0.3), ts:mkTs(0.52,0.1),       thr:2,    desc:"Application error rate." },
      { id:"jboss.apdex",        label:"Apdex Score",           dynaKey:"builtin:service.apdex.order",                  v:0.88,   unit:"",    status:"ok",   fleet:mkFleet(124,0.88,0.08),ts:mkTs(0.88,0.03),      thr:0.75, desc:"Apdex. <0.85 = user experience degradation." },
      { id:"jboss.ds_active",    label:"DB Pool Active Conn",   dynaKey:"ext:jboss.datasource.activeConnections",       v:2820,   unit:"",    status:"ok",   fleet:mkFleet(124,22.7,8),   ts:mkTs(2820,200),       thr:5000, desc:"Active JDBC connections across fleet." },
      { id:"jboss.ds_wait",      label:"DB Pool Wait Time",     dynaKey:"ext:jboss.datasource.waitTime",                v:8.4,    unit:"ms",  status:"ok",   fleet:mkFleet(124,8.4,5),    ts:mkTs(8.4,3),          thr:50,   desc:"Wait time for available DB connection." },
      { id:"jboss.ds_idle",      label:"DB Pool Idle Conn",     dynaKey:"ext:jboss.datasource.idleConnections",         v:1240,   unit:"",    status:"ok",   fleet:mkFleet(124,10,4),     ts:mkTs(1240,100),       thr:null, desc:"Idle JDBC connections (pool headroom)." },
      { id:"jboss.ejb_pool",     label:"EJB Pool Available",    dynaKey:"ext:jboss.ejb.pool.availableCount",            v:2480,   unit:"",    status:"ok",   fleet:mkFleet(124,20,6),     ts:mkTs(2480,150),       thr:500,  desc:"Available EJB pool instances. Low = EJB starvation." },
      { id:"jboss.classes",      label:"Loaded Classes",        dynaKey:"builtin:tech.jvm.classLoading.loadedClassCount",v:48240, unit:"",    status:"ok",   fleet:mkFleet(124,48240,1000),ts:mkTs(48240,200),     thr:80000,desc:"JVM loaded class count." },
      { id:"jboss.cpu",          label:"Host CPU P90",          dynaKey:"builtin:host.cpu.usage",                       v:58.4,   unit:"%",   status:"ok",   fleet:mkFleet(124,58.4,18),  ts:mkTs(58.4,8),         thr:80,   desc:"P90 CPU." },
      { id:"jboss.mem",          label:"Host Memory P90",       dynaKey:"builtin:host.mem.usage",                       v:68.2,   unit:"%",   status:"warn", fleet:mkFleet(124,68.2,12),  ts:mkTs(68.2,6),         thr:85,   desc:"P90 host memory." },
    ],
  },

  WebSphere: {
    label:"WebSphere", badge:"MIDDLEWARE", color:"#6366f1", hostCount:88,
    desc:"IBM WebSphere AS — legacy enterprise services",
    slo:{ name:"Availability", target:99.9, current:99.88 },
    apdex:0.85,
    kpis:[
      { label:"Active Sessions",  value:142840, unit:"",    prev:138000, status:"ok"   },
      { label:"Thread Sat.",      value:68.4,   unit:"%",   prev:62.1,   status:"warn" },
      { label:"DB Wait P95",      value:12.8,   unit:"ms",  prev:11.4,   status:"ok"   },
      { label:"Response P95",     value:188,    unit:"ms",  prev:172,    status:"ok"   },
      { label:"Error Rate",       value:0.48,   unit:"%",   prev:0.44,   status:"ok"   },
      { label:"Apdex",            value:0.85,   unit:"",    prev:0.87,   status:"warn" },
    ],
    primaryTs:[
      { label:"Thread Saturation", key:"was.tsat",      base:68.4,   var:8,    unit:"%",   color:"#6366f1" },
      { label:"Active Sessions",   key:"was.sessions",  base:142840, var:8000, unit:"",    color:T.teal   },
      { label:"Response P95 ms",   key:"was.resp",      base:188,    var:30,   unit:"ms",  color:T.blue   },
      { label:"DB Wait P95 ms",    key:"was.db_wait",   base:12.8,   var:4,    unit:"ms",  color:T.amber  },
    ],
    metrics:[
      { id:"was.heap",          label:"JVM Heap %",            dynaKey:"builtin:tech.jvm.heap.memoryUsed",          v:65.8,   unit:"%",   status:"ok",   fleet:mkFleet(88,65.8,14),   ts:mkTs(65.8,6),         thr:85,   desc:"IBM J9 JVM heap utilization." },
      { id:"was.gc_sus",        label:"GC Suspension",         dynaKey:"builtin:tech.jvm.gc.suspension",            v:88,     unit:"ms",  status:"ok",   fleet:mkFleet(88,88,40),     ts:mkTs(88,20),          thr:200,  desc:"J9 GC pause duration. Gencon policy." },
      { id:"was.thread_active", label:"Active Threads",        dynaKey:"ext:websphere.threadpool.activeThreads",    v:2880,   unit:"",    status:"warn", fleet:mkFleet(88,32.7,12),   ts:mkTs(2880,200),       thr:4000, desc:"WebContainer active threads." },
      { id:"was.thread_sat",    label:"Thread Pool Saturation",dynaKey:"ext:websphere.threadpool.percentMaxed",     v:68.4,   unit:"%",   status:"warn", fleet:mkFleet(88,68.4,15),   ts:mkTs(68.4,8),         thr:85,   desc:"% of max thread pool in use." },
      { id:"was.resp_p50",      label:"Response P50",          dynaKey:"builtin:service.response.time.p50",         v:98,     unit:"ms",  status:"ok",   fleet:mkFleet(88,98,30),     ts:mkTs(98,20),          thr:200,  desc:"Median servlet response time." },
      { id:"was.resp_p95",      label:"Response P95",          dynaKey:"builtin:service.response.time",             v:188,    unit:"ms",  status:"ok",   fleet:mkFleet(88,188,60),    ts:mkTs(188,30),         thr:500,  desc:"P95 servlet response time." },
      { id:"was.resp_p99",      label:"Response P99",          dynaKey:"builtin:service.response.time.p99",         v:420,    unit:"ms",  status:"ok",   fleet:mkFleet(88,420,100),   ts:mkTs(420,60),         thr:1000, desc:"P99 response time." },
      { id:"was.err_rate",      label:"Error Rate",            dynaKey:"builtin:service.errors.total.rate",         v:0.48,   unit:"%",   status:"ok",   fleet:mkFleet(88,0.48,0.2),  ts:mkTs(0.48,0.1),       thr:1,    desc:"Error rate." },
      { id:"was.sessions",      label:"Active HTTP Sessions",  dynaKey:"ext:websphere.servlet.activeSessions",      v:142840, unit:"",    status:"ok",   fleet:mkFleet(88,1623,400),  ts:mkTs(142840,8000),    thr:300000,desc:"Active session manager sessions." },
      { id:"was.db_pool_pct",   label:"JDBC Pool Usage %",     dynaKey:"ext:websphere.jdbc.poolSize",               v:61.2,   unit:"%",   status:"ok",   fleet:mkFleet(88,61.2,14),   ts:mkTs(61.2,6),         thr:85,   desc:"JDBC connection pool utilization." },
      { id:"was.db_wait",       label:"DB Connection Wait",    dynaKey:"ext:websphere.jdbc.waitTime",               v:12.8,   unit:"ms",  status:"ok",   fleet:mkFleet(88,12.8,6),    ts:mkTs(12.8,4),         thr:50,   desc:"Average wait for JDBC connection." },
      { id:"was.db_timeout",    label:"DB Conn Timeouts/h",    dynaKey:"ext:websphere.jdbc.connectionTimeout",      v:2,      unit:"/h",  status:"ok",   fleet:mkFleet(88,0.02,0.03), ts:mkTs(2,1),            thr:10,   desc:"JDBC connection timeout events." },
      { id:"was.request_rate",  label:"Request Rate",          dynaKey:"builtin:service.requestCount.total",        v:12840,  unit:"tps", status:"ok",   fleet:mkFleet(88,145,55),    ts:mkTs(12840,800),      thr:40000,desc:"Transactions per second." },
      { id:"was.apdex",         label:"Apdex Score",           dynaKey:"builtin:service.apdex.order",               v:0.85,   unit:"",    status:"warn", fleet:mkFleet(88,0.85,0.08), ts:mkTs(0.85,0.03),      thr:0.75, desc:"Apdex <0.85 = user experience degradation." },
      { id:"was.cpu",           label:"Host CPU P90",          dynaKey:"builtin:host.cpu.usage",                    v:54.2,   unit:"%",   status:"ok",   fleet:mkFleet(88,54.2,16),   ts:mkTs(54.2,8),         thr:80,   desc:"P90 CPU." },
      { id:"was.mem",           label:"Host Memory P90",       dynaKey:"builtin:host.mem.usage",                    v:72.4,   unit:"%",   status:"ok",   fleet:mkFleet(88,72.4,10),   ts:mkTs(72.4,6),         thr:85,   desc:"P90 memory." },
      { id:"was.msg_queue",     label:"MQ Message Depth",      dynaKey:"ext:websphere.jms.messageCount",            v:284,    unit:"",    status:"ok",   fleet:mkFleet(88,3.2,2),     ts:mkTs(284,60),         thr:1000, desc:"JMS/MQ queue depth across all queues." },
    ],
  },

  CTG: {
    label:"CTG", badge:"CICS GATEWAY", color:T.amber, hostCount:48,
    desc:"IBM CICS Transaction Gateway — mainframe bridge",
    slo:{ name:"Transaction", target:99.95, current:99.97 },
    apdex:0.96,
    kpis:[
      { label:"Active Tasks",  value:2304,  unit:"",    prev:2180,  status:"ok" },
      { label:"CICS Regions",  value:"8/8", unit:"",    prev:"8/8", status:"ok" },
      { label:"Response P95",  value:124,   unit:"ms",  prev:118,   status:"ok" },
      { label:"Error Rate",    value:0.06,  unit:"%",   prev:0.07,  status:"ok" },
      { label:"TPS",           value:29760, unit:"tps", prev:28400, status:"ok" },
      { label:"Queue Depth",   value:142,   unit:"",    prev:168,   status:"ok" },
    ],
    primaryTs:[
      { label:"TPS",           key:"ctg.tps",      base:29760, var:2000, unit:"tps", color:T.amber  },
      { label:"Response P95",  key:"ctg.resp_p95", base:124,   var:20,   unit:"ms",  color:T.blue   },
      { label:"Queue Depth",   key:"ctg.queue",    base:142,   var:40,   unit:"",    color:T.purple },
      { label:"Error Rate",    key:"ctg.err",      base:0.06,  var:0.02, unit:"%",   color:T.red    },
    ],
    metrics:[
      { id:"ctg.active_tasks",  label:"Active Tasks",           dynaKey:"ext:ctg.tasks.active",                v:2304,   unit:"",     status:"ok",   fleet:mkFleet(48,48,12),    ts:mkTs(2304,200),       thr:5000,   desc:"CTG tasks actively executing." },
      { id:"ctg.queued",        label:"Queued Tasks",           dynaKey:"ext:ctg.tasks.queued",                v:142,    unit:"",     status:"ok",   fleet:mkFleet(48,3,2),      ts:mkTs(142,40),         thr:500,    desc:"Tasks queued waiting for CICS connection." },
      { id:"ctg.tps",           label:"Throughput TPS",         dynaKey:"ext:ctg.transactions.rate",           v:29760,  unit:"tps",  status:"ok",   fleet:mkFleet(48,620,80),   ts:mkTs(29760,2000),     thr:80000,  desc:"Transactions per second." },
      { id:"ctg.resp_p50",      label:"Response Time P50",      dynaKey:"ext:ctg.response.time.p50",           v:68,     unit:"ms",   status:"ok",   fleet:mkFleet(48,68,20),    ts:mkTs(68,12),          thr:500,    desc:"Median CTG→CICS→CTG round trip." },
      { id:"ctg.resp_p95",      label:"Response Time P95",      dynaKey:"ext:ctg.response.time.p95",           v:124,    unit:"ms",   status:"ok",   fleet:mkFleet(48,124,40),   ts:mkTs(124,20),         thr:1000,   desc:"P95 end-to-end response time." },
      { id:"ctg.resp_p99",      label:"Response Time P99",      dynaKey:"ext:ctg.response.time.p99",           v:284,    unit:"ms",   status:"ok",   fleet:mkFleet(48,284,80),   ts:mkTs(284,50),         thr:2000,   desc:"P99 response time." },
      { id:"ctg.err_rate",      label:"Error Rate",             dynaKey:"ext:ctg.errors.rate",                 v:0.06,   unit:"%",    status:"ok",   fleet:mkFleet(48,0.06,0.04),ts:mkTs(0.06,0.02),      thr:0.1,    desc:"Transaction error rate." },
      { id:"ctg.cics_conns",    label:"CICS Connections",       dynaKey:"ext:ctg.connections.cics",            v:1536,   unit:"",     status:"ok",   fleet:mkFleet(48,32,6),     ts:mkTs(1536,80),        thr:3072,   desc:"Active TCP sockets to CICS regions." },
      { id:"ctg.client_conns",  label:"Client Connections",     dynaKey:"ext:ctg.connections.client",          v:4820,   unit:"",     status:"ok",   fleet:mkFleet(48,100,30),   ts:mkTs(4820,300),       thr:12000,  desc:"Inbound connections from app servers." },
      { id:"ctg.timeouts",      label:"Timeouts/min",           dynaKey:"ext:ctg.timeout.count",               v:8,      unit:"/min", status:"ok",   fleet:mkFleet(48,0.16,0.2), ts:mkTs(8,4),            thr:30,     desc:"CTG request timeouts per minute." },
      { id:"ctg.region_health", label:"CICS Region Availability",dynaKey:"ext:ctg.regions.available",         v:99.98,  unit:"%",    status:"ok",   fleet:mkFleet(48,99.98,0.05),ts:mkTs(99.98,0.02),    thr:99,     desc:"CICS regions reachable and responding." },
      { id:"ctg.heap",          label:"JVM Heap %",             dynaKey:"builtin:tech.jvm.heap.memoryUsed",    v:58.4,   unit:"%",    status:"ok",   fleet:mkFleet(48,58.4,12),  ts:mkTs(58.4,6),         thr:85,     desc:"CTG JVM heap." },
      { id:"ctg.workload",      label:"Workload Queue",         dynaKey:"ext:ctg.workload.queued",             v:284,    unit:"",     status:"ok",   fleet:mkFleet(48,6,4),      ts:mkTs(284,60),         thr:1000,   desc:"Pending requests in workload manager queue." },
      { id:"ctg.cpu",           label:"Host CPU",               dynaKey:"builtin:host.cpu.usage",              v:38.4,   unit:"%",    status:"ok",   fleet:mkFleet(48,38.4,12),  ts:mkTs(38.4,6),         thr:80,     desc:"Host CPU." },
    ],
  },

  Hazelcast: {
    label:"Hazelcast", badge:"IN-MEMORY GRID", color:T.teal, hostCount:18,
    desc:"Hazelcast IMDG — distributed session cache & data grid",
    slo:{ name:"Hit Rate", target:90, current:94.8 },
    apdex:0.98,
    kpis:[
      { label:"Cluster Members", value:18,       unit:"",       prev:18,       status:"ok" },
      { label:"Total Entries",   value:"284M",   unit:"",       prev:"281M",   status:"ok" },
      { label:"Hit Rate",        value:94.8,     unit:"%",      prev:95.1,     status:"ok" },
      { label:"Op Rate",         value:"842K",   unit:"ops/s",  prev:"810K",   status:"ok" },
      { label:"Heap Avg",        value:68.4,     unit:"%",      prev:66.8,     status:"ok" },
      { label:"WAN Lag",         value:14,       unit:"ms",     prev:11,       status:"ok" },
    ],
    primaryTs:[
      { label:"GET ops/s",      key:"hz.gets",     base:684000, var:40000, unit:"ops/s", color:T.teal  },
      { label:"Heap Usage %",   key:"hz.heap",     base:68.4,   var:5,     unit:"%",     color:T.purple},
      { label:"Cache Hit %",    key:"hz.hit",      base:94.8,   var:1.5,   unit:"%",     color:T.green },
      { label:"WAN Lag ms",     key:"hz.wan",      base:14,     var:4,     unit:"ms",    color:T.amber },
    ],
    metrics:[
      { id:"hz.members",         label:"Cluster Size",            dynaKey:"ext:hazelcast.cluster.size",               v:18,        unit:"",      status:"ok",   fleet:mkFleet(18,18,0.2),    ts:mkTs(18,0.3),         thr:12,       desc:"Active cluster members." },
      { id:"hz.heap",            label:"Heap Usage %",            dynaKey:"ext:hazelcast.memory.usedHeap",            v:68.4,      unit:"%",     status:"ok",   fleet:mkFleet(18,68.4,10),   ts:mkTs(68.4,5),         thr:80,       desc:"JVM heap per node." },
      { id:"hz.native",          label:"Off-Heap Memory %",       dynaKey:"ext:hazelcast.memory.usedNativeMemory",    v:41.2,      unit:"%",     status:"ok",   fleet:mkFleet(18,41.2,8),    ts:mkTs(41.2,4),         thr:85,       desc:"High-density native memory usage." },
      { id:"hz.entries",         label:"Total Map Entries",       dynaKey:"ext:hazelcast.map.entryCount",             v:284000000, unit:"",      status:"ok",   fleet:mkFleet(18,15777778,2000000),ts:mkTs(284000000,5000000),thr:500000000,desc:"Entries across all distributed maps." },
      { id:"hz.entry_mem",       label:"Entry Memory Size",       dynaKey:"ext:hazelcast.map.ownedEntryMemoryCost",   v:42.8,      unit:"GB",    status:"ok",   fleet:mkFleet(18,42.8,5),    ts:mkTs(42.8,2),         thr:100,      desc:"Total map entry memory cost." },
      { id:"hz.gets",            label:"GET Operations/s",        dynaKey:"ext:hazelcast.map.getOperations",          v:684000,    unit:"ops/s", status:"ok",   fleet:mkFleet(18,38000,8000),ts:mkTs(684000,40000),   thr:2000000,  desc:"Map.get() calls per second." },
      { id:"hz.puts",            label:"PUT Operations/s",        dynaKey:"ext:hazelcast.map.putOperations",          v:128000,    unit:"ops/s", status:"ok",   fleet:mkFleet(18,7111,2000), ts:mkTs(128000,12000),   thr:500000,   desc:"Map.put() calls per second." },
      { id:"hz.removes",         label:"REMOVE Operations/s",     dynaKey:"ext:hazelcast.map.removeOperations",       v:30000,     unit:"ops/s", status:"ok",   fleet:mkFleet(18,1667,500),  ts:mkTs(30000,4000),     thr:200000,   desc:"Map.remove() calls per second." },
      { id:"hz.hit",             label:"Cache Hit Ratio",         dynaKey:"ext:hazelcast.map.hitRatio",               v:94.8,      unit:"%",     status:"ok",   fleet:mkFleet(18,94.8,3),    ts:mkTs(94.8,1.5),       thr:90,       desc:"Cache hit ratio. Below 90% = SLO breach." },
      { id:"hz.latency_get",     label:"GET Latency P99",         dynaKey:"ext:hazelcast.map.getLatency",             v:0.84,      unit:"ms",    status:"ok",   fleet:mkFleet(18,0.84,0.3),  ts:mkTs(0.84,0.2),       thr:5,        desc:"Map.get() P99 latency." },
      { id:"hz.migrations",      label:"Partition Migrations",    dynaKey:"ext:hazelcast.partition.migration.count",  v:0,         unit:"",      status:"ok",   fleet:mkFleet(18,0,0.5),     ts:mkTs(0.2,0.3),        thr:5,        desc:"Active partition migrations." },
      { id:"hz.wan_lag",         label:"WAN Replication Lag",     dynaKey:"ext:hazelcast.wan.replication.lag",        v:14,        unit:"ms",    status:"ok",   fleet:mkFleet(18,14,6),      ts:mkTs(14,4),           thr:500,      desc:"WAN replication lag between DCs." },
      { id:"hz.gc_time",         label:"GC Time/min",             dynaKey:"ext:hazelcast.gc.time",                    v:420,       unit:"ms/min",status:"ok",   fleet:mkFleet(18,420,120),   ts:mkTs(420,80),         thr:2000,     desc:"GC time per minute." },
      { id:"hz.backups",         label:"Backup Entry Count",      dynaKey:"ext:hazelcast.map.backupEntryCount",       v:284000000, unit:"",      status:"ok",   fleet:mkFleet(18,15777778,1000000),ts:mkTs(284000000,4000000),thr:null,desc:"Backup copy entries. Should ≈ primary entries." },
      { id:"hz.network_in",      label:"Network In",              dynaKey:"builtin:host.net.bytes",                   v:24.8,      unit:"GB/s",  status:"ok",   fleet:mkFleet(18,24.8,5),    ts:mkTs(24.8,2),         thr:80,       desc:"Inbound cluster network traffic." },
      { id:"hz.cpu",             label:"Host CPU",                dynaKey:"builtin:host.cpu.usage",                   v:42.4,      unit:"%",     status:"ok",   fleet:mkFleet(18,42.4,10),   ts:mkTs(42.4,5),         thr:80,       desc:"Host CPU." },
    ],
  },

  Provenir: {
    label:"Provenir", badge:"DECISION ENGINE", color:T.pink, hostCount:24,
    desc:"Real-time credit decision & fraud scoring engine",
    slo:{ name:"Latency P99 <500ms", target:99.9, current:99.94 },
    apdex:0.96,
    kpis:[
      { label:"Decisions/sec",  value:7680,  unit:"dec/s", prev:7400,  status:"ok" },
      { label:"P50 Latency",    value:38,    unit:"ms",    prev:41,    status:"ok" },
      { label:"P99 Latency",    value:184,   unit:"ms",    prev:196,   status:"ok" },
      { label:"Approval Rate",  value:68.4,  unit:"%",     prev:68.1,  status:"ok" },
      { label:"Error Rate",     value:0.03,  unit:"%",     prev:0.04,  status:"ok" },
      { label:"Queue Depth",    value:284,   unit:"",      prev:310,   status:"ok" },
    ],
    primaryTs:[
      { label:"Decisions/sec",  key:"prov.rate",  base:7680,  var:400,  unit:"dec/s", color:T.pink  },
      { label:"P50 Latency",    key:"prov.p50",   base:38,    var:5,    unit:"ms",    color:T.green },
      { label:"P99 Latency",    key:"prov.p99",   base:184,   var:30,   unit:"ms",    color:T.amber },
      { label:"Queue Depth",    key:"prov.queue", base:284,   var:60,   unit:"",      color:T.blue  },
    ],
    metrics:[
      { id:"prov.rate",       label:"Decision Rate",         dynaKey:"ext:provenir.decisions.rate",        v:7680,  unit:"dec/s",status:"ok",   fleet:mkFleet(24,320,50),    ts:mkTs(7680,400),       thr:20000, desc:"Real-time decisions per second." },
      { id:"prov.p50",        label:"Decision Latency P50",  dynaKey:"ext:provenir.decisions.latency.p50", v:38,    unit:"ms",   status:"ok",   fleet:mkFleet(24,38,10),     ts:mkTs(38,5),           thr:100,   desc:"Median decision time." },
      { id:"prov.p95",        label:"Decision Latency P95",  dynaKey:"ext:provenir.decisions.latency.p95", v:112,   unit:"ms",   status:"ok",   fleet:mkFleet(24,112,30),    ts:mkTs(112,18),         thr:300,   desc:"P95 decision latency." },
      { id:"prov.p99",        label:"Decision Latency P99",  dynaKey:"ext:provenir.decisions.latency.p99", v:184,   unit:"ms",   status:"ok",   fleet:mkFleet(24,184,60),    ts:mkTs(184,30),         thr:500,   desc:"P99 decision latency — tail driven by complex models." },
      { id:"prov.queue",      label:"Queue Depth",           dynaKey:"ext:provenir.queue.depth",           v:284,   unit:"",     status:"ok",   fleet:mkFleet(24,12,5),      ts:mkTs(284,60),         thr:1000,  desc:"Requests pending in decision queue." },
      { id:"prov.rules",      label:"Active Rules",          dynaKey:"ext:provenir.rules.active",          v:1284,  unit:"",     status:"ok",   fleet:mkFleet(24,1284,5),    ts:mkTs(1284,4),         thr:3000,  desc:"Active decision rules loaded." },
      { id:"prov.err_rate",   label:"Error Rate",            dynaKey:"ext:provenir.errors.rate",           v:0.03,  unit:"%",    status:"ok",   fleet:mkFleet(24,0.03,0.02), ts:mkTs(0.03,0.01),      thr:0.05,  desc:"Error rate. Timeout + rule exception + DB failure." },
      { id:"prov.approve",    label:"Approval Rate",         dynaKey:"ext:provenir.outcomes.approve",      v:68.4,  unit:"%",    status:"ok",   fleet:mkFleet(24,68.4,2),    ts:mkTs(68.4,1.5),       thr:null,  desc:"Approved decisions %." },
      { id:"prov.decline",    label:"Decline Rate",          dynaKey:"ext:provenir.outcomes.decline",      v:24.1,  unit:"%",    status:"ok",   fleet:mkFleet(24,24.1,2),    ts:mkTs(24.1,1.2),       thr:null,  desc:"Declined decisions %." },
      { id:"prov.refer",      label:"Refer Rate",            dynaKey:"ext:provenir.outcomes.refer",        v:7.5,   unit:"%",    status:"ok",   fleet:mkFleet(24,7.5,1),     ts:mkTs(7.5,0.8),        thr:null,  desc:"Referred for manual review %." },
      { id:"prov.ml_lat",     label:"ML Score Latency",      dynaKey:"ext:provenir.ml.score.latency",      v:18.4,  unit:"ms",   status:"ok",   fleet:mkFleet(24,18.4,5),    ts:mkTs(18.4,3),         thr:50,    desc:"ML model scoring time per request." },
      { id:"prov.db_qps",     label:"DB Queries/sec",        dynaKey:"ext:provenir.db.queries",            v:48420, unit:"qps",  status:"ok",   fleet:mkFleet(24,2018,400),  ts:mkTs(48420,3000),     thr:120000,desc:"Database queries per second." },
      { id:"prov.heap",       label:"JVM Heap %",            dynaKey:"builtin:tech.jvm.heap.memoryUsed",   v:62.8,  unit:"%",    status:"ok",   fleet:mkFleet(24,62.8,10),   ts:mkTs(62.8,5),         thr:85,    desc:"JVM heap." },
      { id:"prov.cpu",        label:"Host CPU",              dynaKey:"builtin:host.cpu.usage",             v:42.4,  unit:"%",    status:"ok",   fleet:mkFleet(24,42.4,12),   ts:mkTs(42.4,6),         thr:80,    desc:"Host CPU." },
    ],
  },

  Evam: {
    label:"Evam", badge:"EVENT STREAMING", color:T.orange, hostCount:36,
    desc:"Real-time event processing & campaign management",
    slo:{ name:"Processing Latency", target:99.5, current:99.82 },
    apdex:0.94,
    kpis:[
      { label:"Events/sec",    value:"446K",  unit:"ev/s",  prev:"421K",  status:"ok" },
      { label:"Proc P50",      value:18,      unit:"ms",    prev:19,      status:"ok" },
      { label:"Kafka Lag",     value:2840,    unit:"msgs",  prev:3100,    status:"ok" },
      { label:"Active Camps",  value:86,      unit:"",      prev:84,      status:"ok" },
      { label:"Actions/min",   value:"138K",  unit:"/min",  prev:"131K",  status:"ok" },
      { label:"Error Rate",    value:0.02,    unit:"%",     prev:0.02,    status:"ok" },
    ],
    primaryTs:[
      { label:"Events/sec",    key:"evam.rate",   base:446000, var:30000, unit:"ev/s", color:T.orange},
      { label:"Proc P50 ms",   key:"evam.p50",    base:18,     var:3,     unit:"ms",   color:T.green },
      { label:"Kafka Lag",     key:"evam.lag",    base:2840,   var:400,   unit:"msgs", color:T.amber },
      { label:"Actions/min",   key:"evam.actions",base:138600, var:10000, unit:"/min", color:T.blue  },
    ],
    metrics:[
      { id:"evam.rate",       label:"Event Ingestion Rate",    dynaKey:"ext:evam.events.rate",              v:446000, unit:"ev/s",  status:"ok",   fleet:mkFleet(36,12388,3000),ts:mkTs(446000,30000),   thr:2000000,desc:"Events ingested per second from Kafka." },
      { id:"evam.p50",        label:"Processing Latency P50",  dynaKey:"ext:evam.events.latency.p50",       v:18,     unit:"ms",    status:"ok",   fleet:mkFleet(36,18,6),      ts:mkTs(18,3),           thr:100,    desc:"Median processing latency." },
      { id:"evam.p95",        label:"Processing Latency P95",  dynaKey:"ext:evam.events.latency.p95",       v:48,     unit:"ms",    status:"ok",   fleet:mkFleet(36,48,15),     ts:mkTs(48,8),           thr:300,    desc:"P95 event processing time." },
      { id:"evam.p99",        label:"Processing Latency P99",  dynaKey:"ext:evam.events.latency.p99",       v:84,     unit:"ms",    status:"ok",   fleet:mkFleet(36,84,25),     ts:mkTs(84,15),          thr:500,    desc:"P99 processing latency." },
      { id:"evam.lag",        label:"Kafka Consumer Lag",      dynaKey:"ext:evam.queue.kafka.depth",        v:2840,   unit:"msgs",  status:"ok",   fleet:mkFleet(36,79,30),     ts:mkTs(2840,400),       thr:10000,  desc:"Total Kafka consumer group lag." },
      { id:"evam.lag_delta",  label:"Lag Trend (5m delta)",    dynaKey:"ext:evam.consumer.lag.delta",       v:-120,   unit:"msgs/5m",status:"ok",  fleet:mkFleet(36,-3.3,6),    ts:mkTs(-120,200),       thr:500,    desc:"5-min lag change. Negative = catching up." },
      { id:"evam.campaigns",  label:"Active Campaigns",        dynaKey:"ext:evam.campaigns.active",         v:86,     unit:"",      status:"ok",   fleet:mkFleet(36,86,3),      ts:mkTs(86,2),           thr:300,    desc:"Running Evam campaigns." },
      { id:"evam.actions",    label:"Actions Fired/min",       dynaKey:"ext:evam.actions.rate",             v:138600, unit:"/min",  status:"ok",   fleet:mkFleet(36,3850,800),  ts:mkTs(138600,10000),   thr:500000, desc:"Campaign actions per minute." },
      { id:"evam.err_rate",   label:"Error Rate",              dynaKey:"ext:evam.errors.rate",              v:0.02,   unit:"%",     status:"ok",   fleet:mkFleet(36,0.02,0.02), ts:mkTs(0.02,0.01),      thr:0.5,    desc:"Event processing error rate." },
      { id:"evam.throughput", label:"Output Throughput",       dynaKey:"ext:evam.throughput",               v:28400,  unit:"MB/s",  status:"ok",   fleet:mkFleet(36,789,150),   ts:mkTs(28400,2000),     thr:100000, desc:"Data output rate to downstream." },
      { id:"evam.heap",       label:"JVM Heap %",              dynaKey:"builtin:tech.jvm.heap.memoryUsed",  v:58.4,   unit:"%",     status:"ok",   fleet:mkFleet(36,58.4,12),   ts:mkTs(58.4,5),         thr:85,     desc:"JVM heap." },
      { id:"evam.gc",         label:"GC Activity %",           dynaKey:"builtin:tech.jvm.gc.activity",      v:2.8,    unit:"%",     status:"ok",   fleet:mkFleet(36,2.8,1.5),   ts:mkTs(2.8,0.8),        thr:15,     desc:"Time in GC." },
      { id:"evam.cpu",        label:"Host CPU P90",            dynaKey:"builtin:host.cpu.usage",            v:48.4,   unit:"%",     status:"ok",   fleet:mkFleet(36,48.4,15),   ts:mkTs(48.4,7),         thr:80,     desc:"P90 CPU." },
      { id:"evam.mem",        label:"Host Memory P90",         dynaKey:"builtin:host.mem.usage",            v:62.4,   unit:"%",     status:"ok",   fleet:mkFleet(36,62.4,10),   ts:mkTs(62.4,6),         thr:85,     desc:"P90 memory." },
    ],
  },

  Openshift: {
    label:"Openshift", badge:"CONTAINER PLATFORM", color:T.red, hostCount:642,
    desc:"OCP 4.x — 642 pods · 18 nodes · 3 availability zones",
    slo:{ name:"Pod Availability", target:99.9, current:99.71 },
    apdex:null,
    kpis:[
      { label:"Running Pods",  value:618,  unit:"/ 642", prev:622,  status:"ok"   },
      { label:"CrashLoop",     value:4,    unit:"pods",  prev:2,    status:"warn" },
      { label:"CPU Req %",     value:72.4, unit:"%",     prev:69.8, status:"warn" },
      { label:"Mem Req %",     value:78.8, unit:"%",     prev:76.2, status:"warn" },
      { label:"Node CPU P90",  value:68.4, unit:"%",     prev:65.1, status:"warn" },
      { label:"etcd Latency",  value:8.4,  unit:"ms",    prev:7.8,  status:"ok"   },
    ],
    primaryTs:[
      { label:"Running Pods",   key:"os.pods",     base:618,  var:8,    unit:"",    color:T.green },
      { label:"Node CPU %",     key:"os.cpu",      base:68.4, var:6,    unit:"%",   color:T.red   },
      { label:"Node Mem %",     key:"os.mem",      base:74.8, var:5,    unit:"%",   color:T.amber },
      { label:"Pod Restarts/h", key:"os.restarts", base:48,   var:12,   unit:"/h",  color:T.purple},
    ],
    metrics:[
      { id:"os.pods_run",     label:"Running Pods",            dynaKey:"builtin:containers.running_state",                v:618,    unit:"",     status:"ok",   fleet:mkFleet(18,34.3,5),     ts:mkTs(618,8),          thr:642,  desc:"Pods in Running state." },
      { id:"os.pods_pend",    label:"Pending Pods",            dynaKey:"ext:kubernetes.pod.count.pending",                v:16,     unit:"",     status:"warn", fleet:mkFleet(18,0.9,1),      ts:mkTsSpike(16,6,28),   thr:30,   desc:"Pods stuck in Pending (resource pressure)." },
      { id:"os.pods_crash",   label:"CrashLoop Pods",          dynaKey:"ext:kubernetes.pod.count.crashloop",              v:4,      unit:"",     status:"warn", fleet:mkFleet(18,0.2,0.4),    ts:mkTs(4,2),            thr:10,   desc:"Pods in CrashLoopBackOff." },
      { id:"os.pods_fail",    label:"Failed Pods",             dynaKey:"ext:kubernetes.pod.count.failed",                 v:4,      unit:"",     status:"warn", fleet:mkFleet(18,0.2,0.3),    ts:mkTs(4,2),            thr:10,   desc:"Pods in Failed terminal state." },
      { id:"os.node_cpu",     label:"Node CPU Utilization",    dynaKey:"builtin:host.cpu.usage",                          v:68.4,   unit:"%",    status:"warn", fleet:mkFleet(18,68.4,14),    ts:mkTs(68.4,6),         thr:80,   desc:"CPU utilization across OCP worker nodes." },
      { id:"os.node_mem",     label:"Node Memory",             dynaKey:"builtin:host.mem.usage",                          v:74.8,   unit:"%",    status:"warn", fleet:mkFleet(18,74.8,10),    ts:mkTs(74.8,5),         thr:85,   desc:"Memory utilization across OCP nodes." },
      { id:"os.cpu_req",      label:"CPU Requests %",          dynaKey:"ext:kubernetes.node.allocatable.cpu",             v:72.4,   unit:"%",    status:"warn", fleet:mkFleet(18,72.4,8),     ts:mkTs(72.4,4),         thr:85,   desc:"Allocatable CPU claimed by pod requests." },
      { id:"os.mem_req",      label:"Memory Requests %",       dynaKey:"ext:kubernetes.node.allocatable.memory",          v:78.8,   unit:"%",    status:"warn", fleet:mkFleet(18,78.8,8),     ts:mkTs(78.8,4),         thr:90,   desc:"Allocatable memory claimed by requests." },
      { id:"os.cpu_lim",      label:"CPU Limits %",            dynaKey:"ext:kubernetes.node.allocatable.cpu.limits",      v:84.2,   unit:"%",    status:"warn", fleet:mkFleet(18,84.2,8),     ts:mkTs(84.2,5),         thr:100,  desc:"CPU limits vs allocatable. >100% = overcommit." },
      { id:"os.mem_lim",      label:"Memory Limits %",         dynaKey:"ext:kubernetes.node.allocatable.memory.limits",   v:92.4,   unit:"%",    status:"warn", fleet:mkFleet(18,92.4,6),     ts:mkTs(92.4,4),         thr:100,  desc:"Memory limits vs allocatable." },
      { id:"os.restarts",     label:"Pod Restarts/h",          dynaKey:"ext:kubernetes.container.restartCount",           v:48,     unit:"/h",   status:"warn", fleet:mkFleet(18,2.7,2),      ts:mkTsSpike(48,12,84),  thr:100,  desc:"Container restart events per hour." },
      { id:"os.hpa",          label:"HPA Scale Events/h",      dynaKey:"ext:kubernetes.hpa.currentReplicas",              v:12,     unit:"/h",   status:"ok",   fleet:mkFleet(18,0.7,1),      ts:mkTs(12,4),           thr:50,   desc:"HPA scaling events per hour." },
      { id:"os.etcd_lat",     label:"etcd Request Latency",    dynaKey:"ext:kubernetes.etcd.latency",                     v:8.4,    unit:"ms",   status:"ok",   fleet:mkFleet(3,8.4,3),       ts:mkTs(8.4,2),          thr:100,  desc:"etcd request latency. >100ms = control plane issue." },
      { id:"os.api_rps",      label:"API Server RPS",          dynaKey:"ext:kubernetes.apiserver.request.rate",           v:4820,   unit:"req/s",status:"ok",   fleet:mkFleet(3,1607,200),    ts:mkTs(4820,400),       thr:10000,desc:"Kubernetes API server request rate." },
      { id:"os.pvc",          label:"PVC Usage",               dynaKey:"ext:kubernetes.pvc.usage",                        v:58.4,   unit:"%",    status:"ok",   fleet:mkFleet(18,58.4,12),    ts:mkTs(58.4,3),         thr:85,   desc:"PersistentVolumeClaim utilization." },
      { id:"os.net_in",       label:"Cluster Network In",      dynaKey:"ext:kubernetes.network.received",                 v:42.8,   unit:"GB/s", status:"ok",   fleet:mkFleet(18,42.8,8),     ts:mkTs(42.8,4),         thr:200,  desc:"Total inbound cluster network traffic." },
      { id:"os.ctr_cpu",      label:"Container CPU P95",       dynaKey:"builtin:containers.cpu.usageMilliCores",          v:842,    unit:"mCPU", status:"ok",   fleet:mkFleet(642,842,300),   ts:mkTs(842,80),         thr:2000, desc:"P95 container CPU (millicores)." },
      { id:"os.ctr_mem",      label:"Container Memory P95",    dynaKey:"builtin:containers.memory.workingSet",            v:684,    unit:"MB",   status:"ok",   fleet:mkFleet(642,684,200),   ts:mkTs(684,60),         thr:2048, desc:"P95 container memory working set." },
      { id:"os.oom_kills",    label:"OOMKill Events/h",        dynaKey:"ext:kubernetes.oomkill.count",                    v:3,      unit:"/h",   status:"warn", fleet:mkFleet(18,0.17,0.3),   ts:mkTs(3,2),            thr:5,    desc:"Out-of-memory kill events per hour." },
      { id:"os.net_drop",     label:"Network Drops/min",       dynaKey:"ext:kubernetes.network.drops",                    v:8,      unit:"/min", status:"ok",   fleet:mkFleet(18,0.4,0.5),    ts:mkTs(8,4),            thr:50,   desc:"Network packet drops across cluster." },
    ],
  },
};

const TABS = ["NGINX","HTTPD","JBoss","WebSphere","CTG","Hazelcast","Provenir","Evam","Openshift"];

/* ═══════════════════════════════════════════════════════════════════════════════
   FORMAT HELPER
═══════════════════════════════════════════════════════════════════════════════ */
const fmt = (v) => {
  if (typeof v === "string") return v;
  if (typeof v !== "number") return String(v);
  const a = Math.abs(v);
  if (a >= 1e9)  return (v/1e9).toFixed(1)+"B";
  if (a >= 1e6)  return (v/1e6).toFixed(1)+"M";
  if (a >= 1e4)  return v.toLocaleString();
  if (a < 0.001 && v !== 0) return v.toFixed(4);
  if (a < 0.1 && v !== 0)  return v.toFixed(3);
  if (a < 10)              return v.toFixed(1);
  return Math.round(v).toLocaleString();
};

const sColor = (s) => s==="warn"?T.amber : s==="critical"?T.red : T.green;
const sBg    = (s) => s==="warn"?T.amberL : s==="critical"?T.redL : T.greenL;

/* ═══════════════════════════════════════════════════════════════════════════════
   SPARKLINE
═══════════════════════════════════════════════════════════════════════════════ */
function Spark({ data, color, h=28 }) {
  return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={data} margin={{top:1,right:0,left:0,bottom:1}}>
        <defs>
          <linearGradient id={`sg${color.replace(/\W/g,"")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="10%" stopColor={color} stopOpacity={0.18}/>
            <stop offset="90%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#sg${color.replace(/\W/g,"")})`} dot={false} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   INLINE CHART PANEL (full visible, no click required)
═══════════════════════════════════════════════════════════════════════════════ */
function InlineChart({ cfg, deployments }) {
  const tsData = useMemo(() => mkTs(cfg.base, cfg.var), []);
  const vals = tsData.map(d=>d.v);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const id = `ig${cfg.key.replace(/\W/g,"")}`;

  const deployIdx = deployments && tsData.length > 50 ? 38 : -1;

  return (
    <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:8,
      padding:"12px 14px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{fontSize:10,color:T.textDim,fontFamily:T.mono,textTransform:"uppercase",letterSpacing:"0.06em"}}>{cfg.label}</div>
          <div style={{fontFamily:T.mono,fontSize:20,fontWeight:700,color:T.text,lineHeight:1.1}}>
            {fmt(vals[vals.length-1])} <span style={{fontSize:10,fontWeight:400,color:T.textFaint}}>{cfg.unit}</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>
            min <span style={{color:T.green,fontWeight:700}}>{fmt(mn)}</span> · max <span style={{color:T.amber,fontWeight:700}}>{fmt(mx)}</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={tsData} margin={{top:4,right:4,left:0,bottom:0}}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="10%" stopColor={cfg.color} stopOpacity={0.2}/>
              <stop offset="90%" stopColor={cfg.color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="ts" tick={{fontSize:8,fill:T.textFaint,fontFamily:T.mono}} interval={19} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:8,fill:T.textFaint,fontFamily:T.mono}} axisLine={false} tickLine={false} width={40}/>
          <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,fontSize:10,fontFamily:T.mono}} itemStyle={{color:cfg.color}} labelStyle={{color:T.textDim}}/>
          {deployIdx > 0 && <ReferenceLine x={tsData[deployIdx]?.ts} stroke={T.blue} strokeDasharray="3 3" strokeWidth={1} label={{value:"deploy",fill:T.blue,fontSize:8,fontFamily:T.mono}}/>}
          <Area type="monotone" dataKey="v" stroke={cfg.color} strokeWidth={1.8} fill={`url(#${id})`} dot={false}
            activeDot={{r:3,fill:cfg.color,stroke:"#fff",strokeWidth:1}}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FLEET HEATMAP — every host as a colored cell
═══════════════════════════════════════════════════════════════════════════════ */
function FleetHeatmap({ fleet, label, unit, color, threshold }) {
  const [hovHost, setHovHost] = useState(null);

  const getColor = (v) => {
    if (!threshold) {
      const pct = (v - Math.min(...fleet.hosts.map(h=>h.v))) / (Math.max(...fleet.hosts.map(h=>h.v)) - Math.min(...fleet.hosts.map(h=>h.v)) || 1);
      if (pct > 0.9) return T.red;
      if (pct > 0.75) return T.amber;
      return color || T.green;
    }
    const r = v / threshold;
    if (r > 0.95) return T.red;
    if (r > 0.8)  return T.amber;
    if (r > 0.6)  return color || T.green;
    return T.textFaint;
  };

  return (
    <div style={{background:T.card, border:`1px solid ${T.border}`, borderRadius:8,
      padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.mono}}>
          FLEET HEATMAP — {label}
        </div>
        <div style={{display:"flex",gap:10,fontSize:9,fontFamily:T.mono,color:T.textFaint}}>
          <span>● <span style={{color:T.textFaint}}>Low</span></span>
          <span>● <span style={{color:color||T.green}}>Normal</span></span>
          <span>● <span style={{color:T.amber}}>High</span></span>
          <span>● <span style={{color:T.red}}>Critical</span></span>
        </div>
      </div>

      {/* Percentile summary bar */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        {[["P50",fleet.stats.p50],["P75",fleet.stats.p75],["P90",fleet.stats.p90],["P95",fleet.stats.p95],["P99",fleet.stats.p99],["MAX",fleet.stats.max]].map(([l,v])=>(
          <div key={l} style={{
            background:T.bg,borderRadius:5,padding:"4px 10px",
            border:`1px solid ${l==="P99"||l==="MAX"?T.amber+"44":T.border}`,
          }}>
            <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>{l} </span>
            <span style={{fontSize:11,fontWeight:700,color:l==="P99"||l==="MAX"?T.amber:T.text,fontFamily:T.mono}}>{v}<span style={{fontSize:8,color:T.textFaint}}>{unit}</span></span>
          </div>
        ))}
        <div style={{background:T.redL,borderRadius:5,padding:"4px 10px",border:`1px solid ${T.red}22`}}>
          <span style={{fontSize:9,color:T.red,fontFamily:T.mono}}>
            {fleet.critical.length} hosts above 85% threshold
          </span>
        </div>
      </div>

      {/* Host cells */}
      <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
        {fleet.hosts.map((h,i) => {
          const c = getColor(h.v);
          const isHov = hovHost === h.id;
          return (
            <div key={h.id}
              onMouseEnter={()=>setHovHost(h.id)}
              onMouseLeave={()=>setHovHost(null)}
              style={{
                width:14,height:14,borderRadius:2,
                background:c,
                opacity:isHov?1:0.75,
                transition:"all 0.1s",
                cursor:"default",
                position:"relative",
              }}
              title={`${h.id}: ${h.v.toFixed(1)}${unit}`}
            />
          );
        })}
      </div>

      {/* Histogram */}
      <div style={{marginTop:12}}>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={fleet.histogram} margin={{top:2,right:0,left:0,bottom:0}}>
            <YAxis tick={false} axisLine={false} tickLine={false} width={0}/>
            <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,fontSize:10,fontFamily:T.mono}}
              formatter={(v)=>[`${v} hosts`,"Count"]} labelFormatter={(l)=>`Range: ${l}${unit}`}/>
            <Bar dataKey="count" radius={[2,2,0,0]}>
              {fleet.histogram.map((entry,i)=>{
                const isHigh = i >= fleet.histogram.length * 0.8;
                return <Cell key={i} fill={isHigh?T.amber:color||T.green} opacity={0.7}/>;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   METRIC CARD — compact
═══════════════════════════════════════════════════════════════════════════════ */
function MCard({ m, color, onClick }) {
  const [hov, setHov] = useState(false);
  const sc = m.status==="warn"?T.amber : m.status==="critical"?T.red : (color||T.blue);
  const usePct = m.thr && typeof m.v === "number" && m.v >= 0;
  const pctOfThr = usePct ? clamp((m.v/m.thr)*100, 0, 110) : 0;

  return (
    <div onClick={()=>onClick(m)}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        background:hov?"#f8fafd":T.card,
        border:`1px solid ${hov?T.borderMid:T.border}`,
        borderRadius:7, padding:"11px 13px",
        cursor:"pointer", transition:"all 0.11s ease",
        boxShadow:hov?"0 2px 10px rgba(0,0,0,0.07)":"0 1px 2px rgba(0,0,0,0.03)",
        borderTop:`2px solid ${m.status!=="ok"?sc:"transparent"}`,
        position:"relative",
      }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
        <span style={{fontSize:9,color:T.textDim,fontFamily:T.mono,textTransform:"uppercase",letterSpacing:"0.07em",lineHeight:1.3,flex:1,marginRight:4}}>
          {m.label}
        </span>
        {m.status!=="ok" && <span style={{
          fontSize:8,color:m.status==="warn"?T.amber:T.red,background:m.status==="warn"?T.amberL:T.redL,
          padding:"1px 5px",borderRadius:3,fontFamily:T.mono,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,
        }}>{m.status.toUpperCase()}</span>}
      </div>

      <div style={{fontFamily:T.mono,fontSize:19,fontWeight:700,color:T.text,lineHeight:1,marginBottom:4}}>
        {fmt(m.v)}<span style={{fontSize:9,color:T.textFaint,fontWeight:400,marginLeft:2}}>{m.unit}</span>
      </div>

      {usePct && (
        <div style={{background:T.divider,borderRadius:2,height:3,overflow:"hidden",marginBottom:4}}>
          <div style={{
            width:`${Math.min(100,pctOfThr)}%`, height:"100%",
            background:pctOfThr>85?T.amber:pctOfThr>95?T.red:sc,
            transition:"width 0.3s",
          }}/>
        </div>
      )}

      <Spark data={m.ts} color={sc} h={24}/>

      <div style={{fontSize:8,color:T.textFaint,fontFamily:T.mono,marginTop:3,
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {m.dynaKey}
      </div>

      {hov && (
        <div style={{
          position:"absolute",top:6,right:8,
          fontSize:9,color:sc,fontFamily:T.mono,
        }}>drill-down →</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PROCESS-LEVEL PROBLEM DATA
═══════════════════════════════════════════════════════════════════════════════ */
const PROBLEM_DETAILS = {
  "P-4821": {
    id:"P-4821", sev:"HIGH", service:"JBoss",
    title:"JBoss Thread Pool Saturation — 3 nodes",
    startedAt:"13:52:14", detectedAt:"13:52:44", duration:"8m 12s",
    davisRca:"Deploy jboss-app:v4.12.1 introduced a synchronous external API call inside the EJB transaction boundary. Under load, slow responses from payment-gateway (avg 1.8s) block Undertow http-executor threads, cascading into queue buildup and eventual rejection.",
    impactedNodes: [
      {
        host:"jboss-app-pod-042", ip:"10.0.18.42", dc:"DC-1", status:"critical",
        pid:28471, jvmVersion:"OpenJDK 17.0.8", uptime:"6d 14h 22m",
        threadPool:{ name:"http-executor", max:400, active:398, queued:84, rejected:12, waitAvgMs:1820 },
        extraPools:[
          { name:"ejb-executor",     max:64,  active:61, queued:18, rejected:3,  waitAvgMs:940  },
          { name:"default-executor", max:128, active:82, queued:0,  rejected:0,  waitAvgMs:0    },
          { name:"io-worker",        max:40,  active:40, queued:0,  rejected:0,  waitAvgMs:0    },
        ],
        heap:{ used:88.4, max:8192, usedMb:7242, oldGen:72.1, metaspace:284 },
        gc:{ pauseLastMs:614, pauseP95:580, activityPct:18.4, minorPerMin:28, majorPerMin:2 },
        cpu:94.2, sysLoad:7.82,
        topThreads:[
          { id:"http-executor-thread-0",  state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1842, lock:"com.bmw.payment.HttpConnectionPool@3a4f9c" },
          { id:"http-executor-thread-1",  state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1794, lock:"com.bmw.payment.HttpConnectionPool@3a4f9c" },
          { id:"http-executor-thread-2",  state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1788, lock:"com.bmw.payment.HttpConnectionPool@3a4f9c" },
          { id:"http-executor-thread-3",  state:"TIMED_WAIT",cpuPct:0.1, method:"com.bmw.order.OrderService.processOrder(OrderService.java:142)",               waitMs:820,  lock:null },
          { id:"http-executor-thread-4",  state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1710, lock:"com.bmw.payment.HttpConnectionPool@3a4f9c" },
          { id:"http-executor-thread-5",  state:"RUNNABLE", cpuPct:18.4, method:"com.bmw.catalog.CatalogService.search(CatalogService.java:88)",                waitMs:0,    lock:null },
          { id:"http-executor-thread-6",  state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1680, lock:"com.bmw.payment.HttpConnectionPool@3a4f9c" },
          { id:"http-executor-thread-7",  state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1640, lock:"com.bmw.payment.HttpConnectionPool@3a4f9c" },
        ],
        stackTrace:`"http-executor-thread-0" #142 prio=5 os_prio=0 cpu=0.12ms elapsed=8.24s tid=0x00007f8b4c001800 nid=0x6f20 waiting for monitor entry [0x00007f8b1c2fe000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)
        - waiting to lock <0x000000078a4f9c30> (a com.bmw.payment.HttpConnectionPool)
        at com.bmw.payment.PaymentGatewayClient.execute(PaymentGatewayClient.java:198)
        at com.bmw.order.OrderEJB.processPayment(OrderEJB.java:87)
        at com.bmw.order.OrderEJB$Proxy$_$$_WeldSubclass.processPayment$$super(Unknown Source)
        at sun.reflect.GeneratedMethodAccessor1248.invoke(Unknown Source)
        at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)
        at java.lang.reflect.Method.invoke(Method.java:498)
        at org.jboss.as.ejb3.tx.CMTTxInterceptor.invokeInCallerTx(CMTTxInterceptor.java:194)
        at org.jboss.as.ejb3.tx.CMTTxInterceptor.required(CMTTxInterceptor.java:340)
        at org.jboss.as.ejb3.tx.CMTTxInterceptor.processInvocation(CMTTxInterceptor.java:239)
        at org.jboss.invocation.InterceptorContext.proceed(InterceptorContext.java:422)
        at io.undertow.servlet.handlers.ServletHandler.handleRequest(ServletHandler.java:74)
        at io.undertow.servlet.handlers.security.ServletConfidentialityConstraintHandler.handleRequest(...:64)
        at io.undertow.server.handlers.encoding.EncodingHandler.handleRequest(EncodingHandler.java:71)
        at io.undertow.server.Connectors.executeRootHandler(Connectors.java:387)
        at io.undertow.server.HttpServerExchange$1.run(HttpServerExchange.java:841)
        at org.jboss.threads.ContextClassLoaderSavingRunnable.run(ContextClassLoaderSavingRunnable.java:35)
        at org.jboss.threads.EnhancedQueueExecutor.safeRun(EnhancedQueueExecutor.java:1990)
        at org.jboss.threads.EnhancedQueueExecutor$ThreadBody.run(EnhancedQueueExecutor.java:1486)`,
        errors:[
          { time:"13:52:44", level:"ERROR", logger:"io.undertow.request", msg:"UT005023: Exception handling request to /api/payment/process", ex:"java.util.concurrent.RejectedExecutionException: Task rejected from Enhanced Queue Executor 'XNIO-1'" },
          { time:"13:52:46", level:"ERROR", logger:"io.undertow.request", msg:"UT005023: Exception handling request to /api/order/checkout",  ex:"java.util.concurrent.RejectedExecutionException: Task rejected from Enhanced Queue Executor 'XNIO-1'" },
          { time:"13:52:48", level:"WARN",  logger:"com.bmw.payment.PaymentGatewayClient", msg:"Connection pool exhausted, waiting for available connection. Pool: HttpConnectionPool@3a4f9c [max=50, inUse=50, waiting=84]", ex:null },
          { time:"13:53:02", level:"ERROR", logger:"org.jboss.as.ejb3", msg:"EJB invocation failed on component OrderEJB for method processPayment. Exception: javax.ejb.EJBTransactionRolledbackException", ex:"Caused by: com.bmw.payment.GatewayTimeoutException: Payment gateway did not respond within 30000ms" },
          { time:"13:53:18", level:"ERROR", logger:"io.undertow.request", msg:"UT005023: Exception handling request to /api/payment/process", ex:"java.util.concurrent.RejectedExecutionException: Task rejected from Enhanced Queue Executor 'XNIO-1'" },
        ],
      },
      {
        host:"jboss-app-pod-087", ip:"10.0.18.87", dc:"DC-2", status:"critical",
        pid:31284, jvmVersion:"OpenJDK 17.0.8", uptime:"6d 14h 22m",
        threadPool:{ name:"http-executor", max:400, active:384, queued:62, rejected:7, waitAvgMs:1640 },
        extraPools:[
          { name:"ejb-executor",     max:64,  active:58, queued:12, rejected:1,  waitAvgMs:820  },
          { name:"default-executor", max:128, active:76, queued:0,  rejected:0,  waitAvgMs:0    },
          { name:"io-worker",        max:40,  active:38, queued:0,  rejected:0,  waitAvgMs:0    },
        ],
        heap:{ used:84.2, max:8192, usedMb:6897, oldGen:68.4, metaspace:281 },
        gc:{ pauseLastMs:542, pauseP95:520, activityPct:14.8, minorPerMin:24, majorPerMin:1 },
        cpu:88.4, sysLoad:6.94,
        topThreads:[
          { id:"http-executor-thread-0", state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1680, lock:"com.bmw.payment.HttpConnectionPool@2b8e7d" },
          { id:"http-executor-thread-1", state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1620, lock:"com.bmw.payment.HttpConnectionPool@2b8e7d" },
          { id:"http-executor-thread-2", state:"RUNNABLE", cpuPct:22.1, method:"com.bmw.catalog.CatalogService.searchProducts(CatalogService.java:142)",        waitMs:0,    lock:null },
          { id:"http-executor-thread-3", state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1580, lock:"com.bmw.payment.HttpConnectionPool@2b8e7d" },
        ],
        stackTrace:`"http-executor-thread-0" #138 prio=5 os_prio=0 cpu=0.08ms elapsed=7.94s tid=0x00007f8b4c002200 nid=0x7120 waiting for monitor entry
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)
        - waiting to lock <0x000000078b8e7d10> (a com.bmw.payment.HttpConnectionPool)
        at com.bmw.payment.PaymentGatewayClient.execute(PaymentGatewayClient.java:198)
        at com.bmw.order.OrderEJB.processPayment(OrderEJB.java:87)
        at org.jboss.as.ejb3.tx.CMTTxInterceptor.required(CMTTxInterceptor.java:340)
        at io.undertow.server.Connectors.executeRootHandler(Connectors.java:387)`,
        errors:[
          { time:"13:52:51", level:"ERROR", logger:"io.undertow.request", msg:"UT005023: Exception handling request to /api/payment/process", ex:"java.util.concurrent.RejectedExecutionException: Task rejected from Enhanced Queue Executor 'XNIO-1'" },
          { time:"13:53:08", level:"WARN",  logger:"com.bmw.payment.PaymentGatewayClient", msg:"Connection pool exhausted. Pool: HttpConnectionPool@2b8e7d [max=50, inUse=50, waiting=62]", ex:null },
        ],
      },
      {
        host:"jboss-app-pod-103", ip:"10.0.19.103", dc:"DC-2", status:"warn",
        pid:29847, jvmVersion:"OpenJDK 17.0.8", uptime:"6d 14h 22m",
        threadPool:{ name:"http-executor", max:400, active:312, queued:28, rejected:1, waitAvgMs:1240 },
        extraPools:[
          { name:"ejb-executor",     max:64,  active:42, queued:4,  rejected:0,  waitAvgMs:480  },
          { name:"default-executor", max:128, active:64, queued:0,  rejected:0,  waitAvgMs:0    },
          { name:"io-worker",        max:40,  active:32, queued:0,  rejected:0,  waitAvgMs:0    },
        ],
        heap:{ used:76.8, max:8192, usedMb:6291, oldGen:58.4, metaspace:278 },
        gc:{ pauseLastMs:284, pauseP95:340, activityPct:8.2, minorPerMin:16, majorPerMin:0 },
        cpu:72.4, sysLoad:5.12,
        topThreads:[
          { id:"http-executor-thread-0", state:"BLOCKED",  cpuPct:0.0,  method:"com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)", waitMs:1280, lock:"com.bmw.payment.HttpConnectionPool@1c7f4a" },
          { id:"http-executor-thread-1", state:"RUNNABLE", cpuPct:14.2, method:"com.bmw.catalog.CatalogService.search(CatalogService.java:88)",                waitMs:0,    lock:null },
          { id:"http-executor-thread-2", state:"TIMED_WAIT",cpuPct:0.1, method:"com.bmw.order.OrderService.processOrder(OrderService.java:142)",               waitMs:640,  lock:null },
        ],
        stackTrace:`"http-executor-thread-0" #124 prio=5 os_prio=0 cpu=0.06ms elapsed=6.84s
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.bmw.payment.PaymentGatewayClient.callSync(PaymentGatewayClient.java:284)
        - waiting to lock <0x000000078c7f4a20> (a com.bmw.payment.HttpConnectionPool)
        at com.bmw.order.OrderEJB.processPayment(OrderEJB.java:87)
        at org.jboss.as.ejb3.tx.CMTTxInterceptor.required(CMTTxInterceptor.java:340)`,
        errors:[
          { time:"13:52:58", level:"WARN", logger:"com.bmw.payment.PaymentGatewayClient", msg:"Connection pool near exhaustion. Pool: HttpConnectionPool@1c7f4a [max=50, inUse=46, waiting=28]", ex:null },
        ],
      },
    ],
    timeline:[
      { time:"13:48:02", event:"Deploy",  detail:"jboss-app:v4.12.1 rolled out — 124 pods updated",          color:T.blue  },
      { time:"13:50:14", event:"Anomaly", detail:"Payment gateway response time rises: 180ms → 1.4s",         color:T.amber },
      { time:"13:51:28", event:"Anomaly", detail:"http-executor busy threads: 180 → 320 on pod-042",          color:T.amber },
      { time:"13:52:14", event:"Problem", detail:"Thread pool saturation detected on 3 nodes",                 color:T.red   },
      { time:"13:52:44", event:"Alert",   detail:"Davis AI raises HIGH problem P-4821",                       color:T.red   },
      { time:"13:52:48", event:"Error",   detail:"RejectedExecutionException — requests dropping on pod-042", color:T.red   },
      { time:"13:53:02", event:"Error",   detail:"EJBTransactionRolledbackException — GatewayTimeoutException",color:T.red  },
      { time:"13:55:00", event:"Info",    detail:"Auto-remediation: payment-gw timeout reduced 30s→5s via config", color:T.teal },
    ],
    recommendation:[
      { prio:1, label:"Immediate",  action:"Set PaymentGatewayClient HTTP timeout to 5s (currently 30s). Deploy hotfix or toggle feature flag `payment.sync.timeout.ms=5000`." },
      { prio:2, label:"Short-term", action:"Increase HttpConnectionPool maxConnections from 50→200 in payment-gw-config.xml. Restart pods pod-042 and pod-087." },
      { prio:3, label:"Long-term",  action:"Refactor PaymentGatewayClient.callSync() to async/reactive pattern (CompletableFuture or Mutiny). Remove blocking call from EJB transaction boundary." },
      { prio:4, label:"Prevention", action:"Add circuit breaker (Hystrix/Resilience4j) around PaymentGatewayClient with 2s timeout and 50% failure threshold before open." },
    ],
    affectedEndpoints:[
      { path:"/api/payment/process", errorRate:"82.4%", p95:"28420ms", volume:"1240 req/min" },
      { path:"/api/order/checkout",  errorRate:"71.2%", p95:"22840ms", volume:"840 req/min"  },
      { path:"/api/order/confirm",   errorRate:"34.8%", p95:"8420ms",  volume:"420 req/min"  },
    ],
  },

  "P-4819": {
    id:"P-4819", sev:"MEDIUM", service:"NGINX",
    title:"NGINX Upstream Failures Elevated",
    startedAt:"13:38:22", detectedAt:"13:39:00", duration:"22m 4s",
    davisRca:"NGINX upstream failures correlate with JBoss thread pool saturation (P-4821). jboss-pool-3 (10.0.18.42-87) is returning 502/504 responses due to thread rejection. NGINX is failing over to healthy nodes but upstream failure counter is elevated.",
    impactedNodes:[
      {
        host:"nginx-edge-pod-014", ip:"10.0.10.14", dc:"DC-1", status:"warn",
        pid:18247, jvmVersion:"nginx/1.24.3", uptime:"12d 4h 18m",
        threadPool:{ name:"worker_processes", max:8, active:8, queued:0, rejected:0, waitAvgMs:0 },
        extraPools:[],
        heap:{ used:0, max:0, usedMb:0, oldGen:0, metaspace:0 },
        gc:{ pauseLastMs:0, pauseP95:0, activityPct:0, minorPerMin:0, majorPerMin:0 },
        cpu:42.4, sysLoad:3.2,
        topThreads:[
          { id:"worker-process-1", state:"RUNNABLE", cpuPct:14.2, method:"ngx_http_upstream_process_header → upstream: jboss-pool-3 → 502", waitMs:0, lock:null },
          { id:"worker-process-2", state:"RUNNABLE", cpuPct:12.8, method:"ngx_http_upstream_next → failover to jboss-pool-1",               waitMs:0, lock:null },
        ],
        stackTrace:`nginx: worker process [14] upstream error log (last 5 entries):
2024/01/15 13:52:44 [error] 18247#18247: *284721 connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://10.0.18.42:8080/api/payment/process", host: "portal.bmw.com"
2024/01/15 13:52:46 [error] 18247#18247: *284724 upstream timed out (110: Connection timed out) while reading response header from upstream, upstream: "http://10.0.18.87:8080/api/order/checkout"
2024/01/15 13:52:48 [warn]  18247#18247: *284728 upstream server temporarily disabled while connecting to upstream: "http://10.0.18.42:8080"
2024/01/15 13:52:51 [error] 18247#18247: *284731 no live upstreams while connecting to upstream, client: 185.42.8.14, upstream: "jboss-pool-3"
2024/01/15 13:53:02 [error] 18247#18247: *284740 connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://10.0.18.103:8080/api/payment/process"`,
        errors:[
          { time:"13:52:44", level:"ERROR", logger:"nginx.upstream", msg:"connect() failed (111: Connection refused) upstream: http://10.0.18.42:8080/api/payment/process", ex:null },
          { time:"13:52:46", level:"ERROR", logger:"nginx.upstream", msg:"upstream timed out (110: Connection timed out) upstream: http://10.0.18.87:8080/api/order/checkout", ex:null },
          { time:"13:52:48", level:"WARN",  logger:"nginx.upstream", msg:"upstream server temporarily disabled: http://10.0.18.42:8080", ex:null },
          { time:"13:52:51", level:"ERROR", logger:"nginx.upstream", msg:"no live upstreams while connecting to upstream: jboss-pool-3", ex:null },
        ],
      },
    ],
    timeline:[
      { time:"13:38:22", event:"Anomaly", detail:"Upstream failure rate rises: 0.3% → 2.8%",                 color:T.amber },
      { time:"13:39:00", event:"Alert",   detail:"Davis AI raises MEDIUM problem P-4819",                    color:T.amber },
      { time:"13:52:44", event:"Error",   detail:"jboss-pool-3 nodes returning 502/504 — failover triggered", color:T.red   },
      { time:"13:52:48", level:"Warn",    detail:"Upstream 10.0.18.42 marked temporarily disabled",           color:T.amber },
      { time:"13:53:00", event:"Info",    detail:"NGINX failover active — traffic routed to pool-1 and pool-2",color:T.teal },
    ],
    recommendation:[
      { prio:1, label:"Immediate",  action:"Verify jboss-pool-3 nodes (pod-042, pod-087) are healthy. Check upstream http-executor rejection rate." },
      { prio:2, label:"Short-term", action:"Reduce NGINX proxy_connect_timeout from 60s→5s and proxy_read_timeout from 120s→15s for payment endpoints." },
      { prio:3, label:"Long-term",  action:"Enable NGINX active health checks (health_check interval=5s fails=3) to proactively remove unhealthy upstreams." },
    ],
    affectedEndpoints:[
      { path:"/api/payment/*",  errorRate:"28.4%", p95:"12840ms", volume:"1240 req/min" },
      { path:"/api/order/*",    errorRate:"18.2%", p95:"8420ms",  volume:"840 req/min"  },
    ],
  },

  "P-4815": {
    id:"P-4815", sev:"MEDIUM", service:"Openshift",
    title:"OpenShift Memory Pressure — worker-04",
    startedAt:"13:19:08", detectedAt:"13:20:00", duration:"41m 6s",
    davisRca:"worker-04 (10.0.20.14) memory utilization reached 91.4%. OOMKiller evicted 3 containers. Memory pressure driven by jboss-app pods scheduled on this node exceeding their memory limits due to heap growth from the P-4821 GC anomaly.",
    impactedNodes:[
      {
        host:"worker-04", ip:"10.0.20.14", dc:"DC-1", status:"critical",
        pid:1, jvmVersion:"RHCOS 4.13 / kernel 5.14.0", uptime:"42d 8h 14m",
        threadPool:{ name:"kubelet", max:110, active:98, queued:0, rejected:0, waitAvgMs:0 },
        extraPools:[],
        heap:{ used:91.4, max:256000, usedMb:233984, oldGen:0, metaspace:0 },
        gc:{ pauseLastMs:0, pauseP95:0, activityPct:0, minorPerMin:0, majorPerMin:0 },
        cpu:78.4, sysLoad:14.82,
        topThreads:[
          { id:"jboss-app-pod-042",    state:"RUNNING",  cpuPct:94.2, method:"JVM Process — heap 7242MB / 8192MB limit (88.4%)",   waitMs:0, lock:null },
          { id:"jboss-app-pod-087",    state:"RUNNING",  cpuPct:88.4, method:"JVM Process — heap 6897MB / 8192MB limit (84.2%)",   waitMs:0, lock:null },
          { id:"jboss-app-pod-099",    state:"OOMKilled", cpuPct:0,   method:"OOMKilled at 13:42:18 — heap 8192MB / 8192MB limit", waitMs:0, lock:null },
          { id:"hazelcast-pod-003",    state:"RUNNING",  cpuPct:42.4, method:"JVM Process — heap 5840MB / 8192MB limit (71.3%)",   waitMs:0, lock:null },
          { id:"evam-worker-pod-011",  state:"RUNNING",  cpuPct:48.4, method:"JVM Process — heap 4820MB / 8192MB limit (58.8%)",   waitMs:0, lock:null },
        ],
        stackTrace:`kernel: [13:42:18] Out of memory: Killed process 31847 (java) total-vm:16777216kB, anon-rss:8388608kB, file-rss:0kB, shmem-rss:0kB
kernel: [13:42:18] oom_score_adj: 980 → container jboss-app-pod-099/jboss-app
kubelet: E0115 13:42:18.284 31847 container_manager.go:1284] OOM event for container "jboss-app" in pod "jboss-app-pod-099_prod-ns"
Event: Warning OOMKilling jboss-app-pod-099 Memory cgroup out of memory: Killed process 31847 (java)
Event: Warning BackOff   jboss-app-pod-099 Back-off restarting failed container jboss-app
Event: Normal  Pulled    jboss-app-pod-099 Container image "bmw-portal/jboss-app:v4.12.1" already present on machine
Event: Normal  Started   jboss-app-pod-099 Started container jboss-app (restart #3)`,
        errors:[
          { time:"13:42:18", level:"ERROR", logger:"kernel.oom",     msg:"Out of memory: Killed process 31847 (java) anon-rss:8388608kB in container jboss-app-pod-099", ex:null },
          { time:"13:42:18", level:"ERROR", logger:"kubelet",        msg:"OOMKilling container jboss-app in pod jboss-app-pod-099_prod-ns. Memory cgroup out of memory.", ex:null },
          { time:"13:42:19", level:"WARN",  logger:"kubelet",        msg:"Back-off restarting failed container jboss-app in pod jboss-app-pod-099", ex:null },
          { time:"13:48:02", level:"WARN",  logger:"kubelet",        msg:"Node memory pressure taint applied: node.kubernetes.io/memory-pressure", ex:null },
          { time:"13:50:14", level:"WARN",  logger:"kube-scheduler", msg:"Pod jboss-app-pod-128 cannot be scheduled: node worker-04 has memory pressure taint", ex:null },
        ],
      },
    ],
    timeline:[
      { time:"13:19:08", event:"Anomaly", detail:"worker-04 memory utilization rises: 74% → 86%",              color:T.amber },
      { time:"13:20:00", event:"Alert",   detail:"Davis AI raises MEDIUM problem P-4815",                      color:T.amber },
      { time:"13:42:18", event:"Error",   detail:"OOMKill: jboss-app-pod-099 terminated (restart #3)",         color:T.red   },
      { time:"13:48:02", event:"Warn",    detail:"Memory pressure taint applied to worker-04",                  color:T.amber },
      { time:"13:50:14", event:"Warn",    detail:"Pod scheduling blocked on worker-04 — memory pressure",       color:T.amber },
      { time:"13:55:00", event:"Info",    detail:"jboss-app-pod-099 restarted successfully (4th attempt)",      color:T.teal  },
    ],
    recommendation:[
      { prio:1, label:"Immediate",  action:"Cordon worker-04: kubectl cordon worker-04. Drain non-critical pods to reduce memory pressure." },
      { prio:2, label:"Short-term", action:"Reduce JBoss pod memory limit from 8Gi→6Gi and set request=limit to guarantee QoS class. Reschedule jboss-app-pod-042/087 to less-loaded nodes." },
      { prio:3, label:"Long-term",  action:"Add Vertical Pod Autoscaler (VPA) for jboss-app with updateMode=Auto. Set JVM -Xmx to 85% of container memory limit, not 100%." },
    ],
    affectedEndpoints:[],
  },

  "P-4810": {
    id:"P-4810", sev:"LOW", service:"Hazelcast",
    title:"Hazelcast WAN Replication Lag Spike",
    startedAt:"12:48:14", detectedAt:"12:49:00", duration:"1h 12m",
    davisRca:"WAN replication lag between DC-1 and DC-3 spiked to 1.2s for ~4 minutes. Caused by DC-3 network saturation during a bulk cache warm-up operation triggered by evam-worker deployment. Self-resolved after warm-up completed.",
    impactedNodes:[
      {
        host:"hz-node-dc3-01", ip:"10.2.10.11", dc:"DC-3", status:"warn",
        pid:22841, jvmVersion:"OpenJDK 17.0.8", uptime:"18d 2h 44m",
        threadPool:{ name:"hz.sys.operation.thread", max:20, active:18, queued:4, rejected:0, waitAvgMs:240 },
        extraPools:[
          { name:"hz.operation.thread",   max:16, active:14, queued:0, rejected:0, waitAvgMs:0 },
          { name:"hz.io.thread",          max:8,  active:8,  queued:0, rejected:0, waitAvgMs:0 },
        ],
        heap:{ used:74.2, max:12288, usedMb:9118, oldGen:58.4, metaspace:124 },
        gc:{ pauseLastMs:180, pauseP95:240, activityPct:6.4, minorPerMin:12, majorPerMin:0 },
        cpu:68.4, sysLoad:5.84,
        topThreads:[
          { id:"hz.sys.operation.thread-0", state:"TIMED_WAIT", cpuPct:2.4, method:"com.hazelcast.wan.impl.WanReplicationPublisherImpl.publishReplicationEvent (WAN batch send, batch=512, lag=1240ms)", waitMs:1240, lock:null },
          { id:"hz.sys.operation.thread-1", state:"RUNNABLE",   cpuPct:18.4,method:"com.hazelcast.map.impl.MapService.putToPartition — 18420 entries/s inbound", waitMs:0, lock:null },
        ],
        stackTrace:`"hz.sys.operation.thread-0" #84 daemon prio=5 cpu=2.4ms elapsed=4.14s
   java.lang.Thread.State: TIMED_WAITING (on object monitor)
        at java.lang.Object.wait(Native Method)
        at com.hazelcast.wan.impl.WanReplicationPublisherImpl.publishReplicationEvent(WanReplicationPublisherImpl.java:284)
        at com.hazelcast.wan.impl.WanBatchReplication.publishBatch(WanBatchReplication.java:142)
        at com.hazelcast.internal.partition.operation.BasePutAllOperation.run(BasePutAllOperation.java:88)
        at com.hazelcast.spi.impl.operationservice.Operation.call(Operation.java:187)`,
        errors:[
          { time:"12:48:14", level:"WARN", logger:"com.hazelcast.wan", msg:"WAN replication lag exceeded threshold: DC-1→DC-3 lag=1240ms (threshold=500ms)", ex:null },
          { time:"12:52:28", level:"INFO", logger:"com.hazelcast.wan", msg:"WAN replication lag normalizing: DC-1→DC-3 lag=284ms", ex:null },
        ],
      },
    ],
    timeline:[
      { time:"12:44:02", event:"Deploy",  detail:"evam-worker:v3.8.2 deployed in DC-3 — bulk cache warm-up triggered", color:T.blue  },
      { time:"12:48:14", event:"Anomaly", detail:"WAN lag DC-1→DC-3 spikes: 14ms → 1240ms",                            color:T.amber },
      { time:"12:49:00", event:"Alert",   detail:"Davis AI raises LOW problem P-4810",                                   color:T.blue  },
      { time:"12:52:28", event:"Info",    detail:"Cache warm-up complete, WAN lag normalizing: 1240ms → 284ms",          color:T.teal  },
      { time:"12:54:00", event:"Resolved",detail:"WAN lag back to baseline: 14ms",                                       color:T.green },
    ],
    recommendation:[
      { prio:1, label:"Short-term", action:"Add WAN replication throttle to evam warm-up job: maxWanPublishQueueSize=1000, batchSize=100." },
      { prio:2, label:"Long-term",  action:"Schedule bulk cache warm-ups during off-peak hours or implement incremental warm-up with rate limiting." },
    ],
    affectedEndpoints:[],
  },

  "P-4802": {
    id:"P-4802", sev:"LOW", service:"CTG",
    title:"CTG Queue Depth Brief Spike",
    startedAt:"11:55:08", detectedAt:"11:55:44", duration:"Resolved",
    davisRca:"CTG queue depth spiked to 420 tasks for ~3 minutes due to CICS PROD2 region brief overload during batch job DFHZB02. Auto-resolved when batch completed. No client-visible errors.",
    impactedNodes:[
      {
        host:"ctg-gw-pod-008", ip:"10.0.14.18", dc:"DC-2", status:"ok",
        pid:24821, jvmVersion:"OpenJDK 11.0.18 (IBM Semeru)", uptime:"24d 6h 42m",
        threadPool:{ name:"ctg.worker", max:200, active:142, queued:420, rejected:0, waitAvgMs:2840 },
        extraPools:[
          { name:"ctg.cics.conn", max:64, active:64, queued:0, rejected:0, waitAvgMs:0 },
        ],
        heap:{ used:58.4, max:4096, usedMb:2392, oldGen:42.1, metaspace:88 },
        gc:{ pauseLastMs:42, pauseP95:84, activityPct:1.8, minorPerMin:6, majorPerMin:0 },
        cpu:48.4, sysLoad:3.84,
        topThreads:[
          { id:"ctg.worker-thread-0", state:"WAITING", cpuPct:0.0, method:"com.ibm.ctg.client.JavaGateway.execute — CICS PROD2 DFHZB02 batch hold, waitMs=2840", waitMs:2840, lock:null },
          { id:"ctg.worker-thread-1", state:"WAITING", cpuPct:0.0, method:"com.ibm.ctg.client.JavaGateway.execute — CICS PROD2 response pending",                waitMs:2640, lock:null },
        ],
        stackTrace:`"ctg.worker-thread-0" #48 prio=5 cpu=0.0ms elapsed=2.84s
   java.lang.Thread.State: WAITING (parking)
        at sun.misc.Unsafe.park(Native Method)
        at com.ibm.ctg.client.JavaGateway.execute(JavaGateway.java:842)
        at com.ibm.ctg.client.JavaGateway.flow(JavaGateway.java:714)
        at com.bmw.integration.ctg.CTGConnectionPool.executeECI(CTGConnectionPool.java:284)
        at com.bmw.integration.ctg.CTGService.invoke(CTGService.java:142)
[CICS response: PROD2-DFHZB02 | EIBRESP=0 | wait=2840ms — batch job holding resources]`,
        errors:[
          { time:"11:55:08", level:"WARN", logger:"com.bmw.integration.ctg", msg:"CTG queue depth exceeded warning threshold: queued=420 (threshold=100). CICS region: PROD2", ex:null },
          { time:"11:58:24", level:"INFO", logger:"com.bmw.integration.ctg", msg:"CTG queue depth normalizing: queued=12. CICS PROD2 batch DFHZB02 completed.", ex:null },
        ],
      },
    ],
    timeline:[
      { time:"11:52:00", event:"Info",     detail:"CICS PROD2 batch job DFHZB02 started — scheduled maintenance batch", color:T.blue  },
      { time:"11:55:08", event:"Anomaly",  detail:"CTG queue depth: 12 → 420 tasks",                                     color:T.amber },
      { time:"11:55:44", event:"Alert",    detail:"Davis AI raises LOW problem P-4802",                                   color:T.blue  },
      { time:"11:58:24", event:"Resolved", detail:"DFHZB02 batch completed, queue draining: 420 → 12",                   color:T.green },
      { time:"11:59:00", event:"Resolved", detail:"Problem auto-resolved — no client impact",                             color:T.green },
    ],
    recommendation:[
      { prio:1, label:"Prevention", action:"Schedule CICS batch DFHZB02 outside business hours (after 22:00) to avoid CTG contention." },
      { prio:2, label:"Short-term", action:"Increase CICS PROD2 MXT (max tasks) from 200→400 during batch windows to reduce CTG queue buildup." },
    ],
    affectedEndpoints:[],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   PROCESS INVESTIGATION MODAL
═══════════════════════════════════════════════════════════════════════════════ */
function ProcessInvestigationModal({ problem, onClose }) {
  const [activeNode, setActiveNode] = useState(0);
  const [ptab, setPtab] = useState("threads");
  if (!problem) return null;

  const detail = PROBLEM_DETAILS[problem.id];
  if (!detail) return null;

  const sevColor = { HIGH:T.red, MEDIUM:T.amber, LOW:T.blue };
  const sc = sevColor[problem.sev] || T.blue;
  const scL = problem.sev==="HIGH"?T.redL : problem.sev==="MEDIUM"?T.amberL : T.blueL;

  const node = detail.impactedNodes[activeNode];
  const ptabs = [
    {k:"threads",l:"Thread Pool"},
    {k:"dump",l:"Stack Trace"},
    {k:"errors",l:"Error Log"},
    {k:"process",l:"Process Metrics"},
  ];

  const threadStateColor = (s) => ({
    BLOCKED:"#dc2626", TIMED_WAIT:"#d97706", WAITING:"#7c3aed",
    RUNNABLE:"#059669", OOMKilled:"#dc2626",
  })[s] || T.textDim;

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(10,20,35,0.65)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",
      backdropFilter:"blur(8px)",
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#fff",borderRadius:12,
        width:960,maxWidth:"98vw",maxHeight:"92vh",
        display:"flex",flexDirection:"column",
        boxShadow:"0 40px 100px rgba(0,0,0,0.25),0 0 0 1px rgba(0,0,0,0.08)",
        overflow:"hidden",
      }}>

        {/* ── HEADER ── */}
        <div style={{background:scL,padding:"16px 22px",borderBottom:`2px solid ${sc}22`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{
                  fontSize:9,fontFamily:T.mono,fontWeight:800,
                  color:sc,background:"white",padding:"2px 8px",
                  borderRadius:3,border:`1px solid ${sc}44`,letterSpacing:"0.06em",
                }}>{problem.sev}</span>
                <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>{detail.id}</span>
                <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>·</span>
                <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>Started {detail.startedAt}</span>
                <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>·</span>
                <span style={{fontSize:9,color:sc,fontFamily:T.mono,fontWeight:700}}>Duration: {detail.duration}</span>
              </div>
              <div style={{fontSize:18,fontWeight:800,color:T.text,marginBottom:4,fontFamily:T.mono}}>{problem.title}</div>
              <div style={{fontSize:11,color:T.textMid,lineHeight:1.6,maxWidth:700}}>{detail.davisRca}</div>
            </div>
            <button onClick={onClose} style={{
              background:"white",border:`1px solid ${T.border}`,color:T.textDim,
              borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:T.mono,flexShrink:0,marginLeft:12,
            }}>✕ Close</button>
          </div>

          {/* Affected endpoints */}
          {detail.affectedEndpoints.length > 0 && (
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
              <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono,alignSelf:"center"}}>Affected endpoints:</span>
              {detail.affectedEndpoints.map((ep,i)=>(
                <div key={i} style={{
                  background:"white",border:`1px solid ${T.red}33`,borderRadius:5,
                  padding:"4px 10px",display:"flex",gap:8,alignItems:"center",
                }}>
                  <span style={{fontSize:10,fontFamily:T.mono,fontWeight:700,color:T.text}}>{ep.path}</span>
                  <span style={{fontSize:9,fontFamily:T.mono,color:T.red,fontWeight:700}}>{ep.errorRate} errors</span>
                  <span style={{fontSize:9,fontFamily:T.mono,color:T.amber}}>{ep.p95} P95</span>
                  <span style={{fontSize:9,fontFamily:T.mono,color:T.textFaint}}>{ep.volume}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{display:"flex",flex:1,overflow:"hidden"}}>

          {/* ── LEFT: Timeline + Nodes ── */}
          <div style={{width:240,flexShrink:0,background:T.bg,borderRight:`1px solid ${T.border}`,
            display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Timeline */}
            <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.border}`}}>
              <div style={{fontSize:9,color:T.textFaint,fontFamily:T.mono,textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:8}}>Event Timeline</div>
              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {detail.timeline.map((ev,i)=>(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",position:"relative"}}>
                    {/* vertical line */}
                    {i < detail.timeline.length-1 && (
                      <div style={{position:"absolute",left:5,top:12,bottom:-4,width:1,background:T.border}}/>
                    )}
                    <div style={{
                      width:10,height:10,borderRadius:"50%",
                      background:ev.color,flexShrink:0,marginTop:2,
                      boxShadow:`0 0 4px ${ev.color}66`,
                    }}/>
                    <div style={{paddingBottom:8}}>
                      <div style={{fontSize:8,color:T.textFaint,fontFamily:T.mono}}>{ev.time}</div>
                      <div style={{fontSize:9,color:ev.color,fontFamily:T.mono,fontWeight:700}}>{ev.event}</div>
                      <div style={{fontSize:9,color:T.textMid,lineHeight:1.4}}>{ev.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Node selector */}
            <div style={{padding:"12px 14px",flex:1,overflow:"auto"}}>
              <div style={{fontSize:9,color:T.textFaint,fontFamily:T.mono,textTransform:"uppercase",
                letterSpacing:"0.07em",marginBottom:8}}>
                Impacted Nodes ({detail.impactedNodes.length})
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {detail.impactedNodes.map((n,i)=>{
                  const nc = n.status==="critical"?T.red:n.status==="warn"?T.amber:T.green;
                  return (
                    <div key={i} onClick={()=>setActiveNode(i)} style={{
                      padding:"8px 10px",borderRadius:6,cursor:"pointer",
                      background:activeNode===i?T.card:"transparent",
                      border:`1px solid ${activeNode===i?T.borderMid:T.border}`,
                      borderLeft:`3px solid ${nc}`,
                      transition:"all 0.1s",
                    }}>
                      <div style={{fontSize:10,fontWeight:700,color:T.text,fontFamily:T.mono}}>{n.host}</div>
                      <div style={{fontSize:8,color:T.textFaint,fontFamily:T.mono}}>{n.ip} · {n.dc}</div>
                      <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:8,color:nc,fontFamily:T.mono,fontWeight:700,
                          background:n.status==="critical"?T.redL:n.status==="warn"?T.amberL:T.greenL,
                          padding:"1px 5px",borderRadius:3}}>{n.status.toUpperCase()}</span>
                        <span style={{fontSize:8,color:T.textFaint,fontFamily:T.mono}}>CPU {n.cpu}%</span>
                        {n.heap.max > 0 && <span style={{fontSize:8,color:T.textFaint,fontFamily:T.mono}}>Heap {n.heap.used}%</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Remediation */}
              <div style={{marginTop:16}}>
                <div style={{fontSize:9,color:T.textFaint,fontFamily:T.mono,textTransform:"uppercase",
                  letterSpacing:"0.07em",marginBottom:8}}>Remediation Steps</div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {detail.recommendation.map((r,i)=>(
                    <div key={i} style={{
                      padding:"8px 10px",borderRadius:6,
                      background:i===0?T.redL:i===1?T.amberL:T.blueL,
                      border:`1px solid ${i===0?T.red:i===1?T.amber:T.blue}22`,
                    }}>
                      <div style={{fontSize:8,fontFamily:T.mono,fontWeight:700,
                        color:i===0?T.red:i===1?T.amber:T.blue,marginBottom:3}}>
                        {r.prio}. {r.label}
                      </div>
                      <div style={{fontSize:9,color:T.textMid,lineHeight:1.5}}>{r.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Node detail ── */}
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Node header */}
            <div style={{
              padding:"12px 18px",borderBottom:`1px solid ${T.border}`,
              background:T.surface,flexShrink:0,
            }}>
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontFamily:T.mono,fontSize:13,fontWeight:700,color:T.text}}>{node.host}</div>
                  <div style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>
                    {node.ip} · {node.dc} · PID {node.pid} · {node.jvmVersion} · Up {node.uptime}
                  </div>
                </div>
                {/* Key metrics pills */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[
                    {l:"CPU",         v:`${node.cpu}%`,                            warn:node.cpu>80},
                    ...(node.heap.max>0?[
                      {l:"Heap",        v:`${node.heap.used}%`,                      warn:node.heap.used>85},
                      {l:"Old Gen",     v:`${node.heap.oldGen}%`,                    warn:node.heap.oldGen>75},
                      {l:"GC Pause",    v:`${node.gc.pauseLastMs}ms`,               warn:node.gc.pauseLastMs>200},
                      {l:"GC Activity", v:`${node.gc.activityPct}%`,                warn:node.gc.activityPct>15},
                    ]:[]),
                    {l:"Thread Active",v:`${node.threadPool.active}/${node.threadPool.max}`, warn:(node.threadPool.active/node.threadPool.max)>0.9},
                    ...(node.threadPool.queued>0?[{l:"Queued",v:`${node.threadPool.queued}`,warn:node.threadPool.queued>10}]:[]),
                    ...(node.threadPool.rejected>0?[{l:"Rejected",v:`${node.threadPool.rejected}`,warn:true}]:[]),
                  ].map((p,i)=>(
                    <div key={i} style={{
                      background:p.warn?T.redL:T.card,
                      border:`1px solid ${p.warn?T.red+"44":T.border}`,
                      borderRadius:5,padding:"3px 8px",
                    }}>
                      <div style={{fontSize:8,color:T.textFaint,fontFamily:T.mono,letterSpacing:"0.05em"}}>{p.l}</div>
                      <div style={{fontSize:11,fontWeight:700,color:p.warn?T.red:T.text,fontFamily:T.mono}}>{p.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-tabs */}
              <div style={{display:"flex",gap:0,marginTop:10}}>
                {ptabs.map(t=>(
                  <button key={t.k} onClick={()=>setPtab(t.k)} style={{
                    background:"none",border:"none",
                    borderBottom:`2px solid ${ptab===t.k?sc:"transparent"}`,
                    color:ptab===t.k?T.text:T.textDim,
                    padding:"6px 13px",cursor:"pointer",
                    fontSize:10,fontFamily:T.mono,fontWeight:ptab===t.k?700:400,
                    textTransform:"uppercase",letterSpacing:"0.05em",
                  }}>{t.l}</button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div style={{flex:1,overflow:"auto",padding:16,background:T.bg}}>

              {/* THREAD POOL */}
              {ptab==="threads" && (
                <div>
                  {/* Main pool visual */}
                  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 16px",marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.mono}}>{node.threadPool.name}</span>
                      <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>max: {node.threadPool.max}</span>
                    </div>

                    {/* Visual bar */}
                    <div style={{background:T.divider,borderRadius:4,height:24,overflow:"hidden",marginBottom:8,position:"relative"}}>
                      <div style={{
                        position:"absolute",left:0,top:0,height:"100%",
                        width:`${(node.threadPool.active/node.threadPool.max)*100}%`,
                        background:node.threadPool.active/node.threadPool.max>0.9?T.red:T.amber,
                        borderRadius:4,transition:"width 0.3s",
                        display:"flex",alignItems:"center",paddingLeft:8,
                      }}>
                        <span style={{fontSize:9,color:"white",fontFamily:T.mono,fontWeight:700,whiteSpace:"nowrap"}}>
                          {node.threadPool.active} ACTIVE
                        </span>
                      </div>
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                      {[
                        {l:"Active",   v:node.threadPool.active,   c:T.red,   bg:T.redL},
                        {l:"Queued",   v:node.threadPool.queued,   c:T.amber, bg:T.amberL},
                        {l:"Rejected", v:node.threadPool.rejected, c:T.red,   bg:T.redL},
                        {l:"Avg Wait", v:`${node.threadPool.waitAvgMs}ms`, c:T.amber, bg:T.amberL},
                      ].map((s,i)=>(
                        <div key={i} style={{background:s.bg,borderRadius:6,padding:"8px 12px",border:`1px solid ${s.c}22`}}>
                          <div style={{fontSize:9,color:s.c,fontFamily:T.mono,fontWeight:700,marginBottom:2}}>{s.l}</div>
                          <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:T.mono}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extra pools */}
                  {node.extraPools.length > 0 && (
                    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 16px",marginBottom:12}}>
                      <div style={{fontSize:10,fontWeight:700,color:T.textDim,fontFamily:T.mono,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                        Other Thread Pools
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {node.extraPools.map((p,i)=>{
                          const sat = p.active/p.max;
                          return (
                            <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontFamily:T.mono,fontSize:10,color:T.textMid,width:160,flexShrink:0}}>{p.name}</span>
                              <div style={{flex:1,background:T.divider,borderRadius:3,height:8,overflow:"hidden"}}>
                                <div style={{
                                  width:`${sat*100}%`,height:"100%",
                                  background:sat>0.9?T.red:sat>0.7?T.amber:T.green,
                                  borderRadius:3,
                                }}/>
                              </div>
                              <span style={{fontFamily:T.mono,fontSize:10,fontWeight:700,
                                color:sat>0.9?T.red:sat>0.7?T.amber:T.text,width:60,textAlign:"right"}}>
                                {p.active}/{p.max}
                              </span>
                              {p.queued>0 && <span style={{fontSize:9,color:T.amber,fontFamily:T.mono,background:T.amberL,
                                padding:"1px 5px",borderRadius:3}}>+{p.queued} queued</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top threads */}
                  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 16px"}}>
                    <div style={{fontSize:10,fontWeight:700,color:T.textDim,fontFamily:T.mono,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                      Top Threads by State
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {node.topThreads.map((th,i)=>(
                        <div key={i} style={{
                          background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,
                          padding:"8px 12px",
                          borderLeft:`3px solid ${threadStateColor(th.state)}`,
                        }}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                            <span style={{
                              fontSize:8,fontFamily:T.mono,fontWeight:700,
                              color:threadStateColor(th.state),
                              background:"white",padding:"1px 6px",borderRadius:3,
                              border:`1px solid ${threadStateColor(th.state)}33`,
                            }}>{th.state}</span>
                            <span style={{fontSize:10,fontFamily:T.mono,fontWeight:700,color:T.text}}>{th.id}</span>
                            {th.cpuPct > 0 && <span style={{fontSize:8,color:T.green,fontFamily:T.mono,marginLeft:"auto"}}>CPU {th.cpuPct}%</span>}
                            {th.waitMs > 0 && <span style={{fontSize:8,color:T.red,fontFamily:T.mono}}>waited {th.waitMs}ms</span>}
                          </div>
                          <div style={{fontSize:9,color:T.textDim,fontFamily:T.mono,wordBreak:"break-all",lineHeight:1.4}}>
                            {th.method}
                          </div>
                          {th.lock && (
                            <div style={{fontSize:8,color:T.red,fontFamily:T.mono,marginTop:2}}>
                              🔒 blocked on: {th.lock}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STACK TRACE */}
              {ptab==="dump" && (
                <div style={{
                  background:"#0f172a",borderRadius:8,padding:16,
                  fontFamily:T.mono,fontSize:10,color:"#94a3b8",
                  lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-all",
                  border:"1px solid #1e293b",
                }}>
                  <div style={{color:"#64748b",marginBottom:8,fontSize:9}}>
                    {`# Thread dump — ${node.host} (PID ${node.pid}) — captured at ${detail.startedAt}`}
                  </div>
                  {node.stackTrace.split("\n").map((line,i)=>{
                    const isMethod = line.trim().startsWith("at ");
                    const isWait   = line.trim().startsWith("- waiting") || line.trim().startsWith("- locked");
                    const isThread = line.trim().startsWith('"');
                    const isState  = line.trim().startsWith("java.lang.Thread.State");
                    return (
                      <div key={i} style={{
                        color: isThread?   "#e2e8f0"
                             : isState ?   "#a78bfa"
                             : isMethod?   "#7dd3fc"
                             : isWait  ?   "#fbbf24"
                             : "#94a3b8",
                        paddingLeft: isMethod||isWait ? 16 : 0,
                      }}>{line}</div>
                    );
                  })}
                </div>
              )}

              {/* ERROR LOG */}
              {ptab==="errors" && (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {node.errors.map((e,i)=>{
                    const lc = e.level==="ERROR"?T.red:e.level==="WARN"?T.amber:T.blue;
                    return (
                      <div key={i} style={{
                        background:T.card,border:`1px solid ${lc}22`,borderRadius:7,padding:"10px 14px",
                        borderLeft:`3px solid ${lc}`,
                      }}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{
                            fontSize:8,fontFamily:T.mono,fontWeight:800,
                            color:lc,background:lc==="#dc2626"?T.redL:lc===T.amber?T.amberL:T.blueL,
                            padding:"1px 6px",borderRadius:3,
                          }}>{e.level}</span>
                          <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>{e.time}</span>
                          <span style={{fontSize:9,color:T.textDim,fontFamily:T.mono,marginLeft:4}}>{e.logger}</span>
                        </div>
                        <div style={{fontSize:10,color:T.textMid,fontFamily:T.mono,lineHeight:1.5,marginBottom:e.ex?6:0}}>
                          {e.msg}
                        </div>
                        {e.ex && (
                          <div style={{fontSize:9,color:T.red,fontFamily:T.mono,background:T.redL,
                            padding:"4px 8px",borderRadius:4,lineHeight:1.5,marginTop:4,wordBreak:"break-all"}}>
                            {e.ex}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PROCESS METRICS */}
              {ptab==="process" && (
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                    {/* CPU + Load */}
                    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 16px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:T.textDim,fontFamily:T.mono,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>CPU & System</div>
                      {[
                        {l:"CPU Utilization",  v:`${node.cpu}%`,             warn:node.cpu>80},
                        {l:"System Load Avg",  v:`${node.sysLoad}`,          warn:node.sysLoad>8},
                      ].map((r,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                          padding:"6px 0",borderBottom:`1px solid ${T.divider}`}}>
                          <span style={{fontSize:10,color:T.textMid,fontFamily:T.mono}}>{r.l}</span>
                          <span style={{fontSize:12,fontWeight:700,color:r.warn?T.red:T.text,fontFamily:T.mono}}>{r.v}</span>
                        </div>
                      ))}
                    </div>

                    {/* GC */}
                    {node.heap.max > 0 && (
                      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 16px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.textDim,fontFamily:T.mono,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>GC & Memory</div>
                        {[
                          {l:"Heap Used",       v:`${node.heap.used}%  (${node.heap.usedMb}MB)`,  warn:node.heap.used>85},
                          {l:"Old Gen",         v:`${node.heap.oldGen}%`,                          warn:node.heap.oldGen>75},
                          {l:"Metaspace",       v:`${node.heap.metaspace}MB`,                      warn:false},
                          {l:"GC Pause Last",   v:`${node.gc.pauseLastMs}ms`,                      warn:node.gc.pauseLastMs>200},
                          {l:"GC Pause P95",    v:`${node.gc.pauseP95}ms`,                         warn:node.gc.pauseP95>200},
                          {l:"GC Activity",     v:`${node.gc.activityPct}%`,                       warn:node.gc.activityPct>15},
                          {l:"Minor GC/min",    v:`${node.gc.minorPerMin}`,                        warn:node.gc.minorPerMin>30},
                          {l:"Major GC/min",    v:`${node.gc.majorPerMin}`,                        warn:node.gc.majorPerMin>1},
                        ].map((r,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                            padding:"4px 0",borderBottom:`1px solid ${T.divider}`}}>
                            <span style={{fontSize:10,color:T.textMid,fontFamily:T.mono}}>{r.l}</span>
                            <span style={{fontSize:11,fontWeight:700,color:r.warn?T.red:T.text,fontFamily:T.mono}}>{r.v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Heap visualization */}
                  {node.heap.max > 0 && (
                    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 16px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:T.textDim,fontFamily:T.mono,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                        Heap Memory Breakdown ({node.heap.usedMb}MB / {node.heap.max}MB)
                      </div>
                      {[
                        {l:"Old Generation", pct:node.heap.oldGen,        color:node.heap.oldGen>75?T.red:T.amber},
                        {l:"Young Gen (Eden+Survivor)", pct:node.heap.used-node.heap.oldGen, color:T.green},
                        {l:"Free",           pct:100-node.heap.used,      color:T.divider},
                      ].map((seg,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          <div style={{width:12,height:12,borderRadius:2,background:seg.color,flexShrink:0}}/>
                          <span style={{fontSize:10,color:T.textMid,fontFamily:T.mono,width:200}}>{seg.l}</span>
                          <div style={{flex:1,background:T.divider,borderRadius:3,height:10,overflow:"hidden"}}>
                            <div style={{width:`${Math.max(0,seg.pct)}%`,height:"100%",background:seg.color,borderRadius:3}}/>
                          </div>
                          <span style={{fontSize:10,fontWeight:700,color:T.text,fontFamily:T.mono,width:40,textAlign:"right"}}>
                            {Math.max(0,seg.pct).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PROBLEM FEED
═══════════════════════════════════════════════════════════════════════════════ */
function ProblemFeed() {
  const [selProblem, setSelProblem] = useState(null);
  const sevColor = {HIGH:T.red, MEDIUM:T.amber, LOW:T.blue};

  return (
    <>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,
        padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{fontSize:11,fontWeight:700,color:T.text,fontFamily:T.mono}}>DAVIS AI — ACTIVE PROBLEMS</span>
          <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>Click any problem for process-level investigation</span>
          <span style={{marginLeft:"auto",fontSize:9,fontFamily:T.mono,color:T.red,background:T.redL,
            padding:"2px 8px",borderRadius:4,border:`1px solid ${T.red}22`,fontWeight:700}}>
            {NOW_PROBLEMS.filter(p=>p.sev==="HIGH").length} HIGH
          </span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {NOW_PROBLEMS.map(p=>{
            const hasDetail = !!PROBLEM_DETAILS[p.id];
            const [hov, setHov] = useState(false);
            return (
              <div key={p.id}
                onClick={()=>hasDetail && setSelProblem(p)}
                onMouseEnter={()=>setHov(true)}
                onMouseLeave={()=>setHov(false)}
                style={{
                  display:"flex",alignItems:"flex-start",gap:10,
                  padding:"10px 12px",borderRadius:6,
                  background:p.sev==="HIGH"?T.redL:p.sev==="MEDIUM"?T.amberL:T.blueL,
                  border:`1px solid ${hov&&hasDetail?sevColor[p.sev]:sevColor[p.sev]+"22"}`,
                  cursor:hasDetail?"pointer":"default",
                  transition:"all 0.12s",
                  boxShadow:hov&&hasDetail?"0 2px 8px rgba(0,0,0,0.08)":"none",
                  transform:hov&&hasDetail?"translateX(2px)":"translateX(0)",
                }}>
                <div style={{
                  fontSize:9,fontFamily:T.mono,fontWeight:700,
                  color:sevColor[p.sev],background:"white",
                  padding:"2px 7px",borderRadius:3,flexShrink:0,marginTop:1,
                  border:`1px solid ${sevColor[p.sev]}33`,
                }}>{p.sev}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.text,marginBottom:2,
                    display:"flex",alignItems:"center",gap:6}}>
                    {p.title}
                    {hasDetail && (
                      <span style={{fontSize:8,color:sevColor[p.sev],fontFamily:T.mono,
                        background:"white",padding:"1px 5px",borderRadius:3,
                        border:`1px solid ${sevColor[p.sev]}33`}}>
                        process detail →
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:9,color:T.textDim,fontFamily:T.mono}}>{p.davis}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                  <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>{p.age}</span>
                  <span style={{fontSize:8,color:T.textFaint,fontFamily:T.mono}}>{p.service}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selProblem && (
        <ProcessInvestigationModal problem={selProblem} onClose={()=>setSelProblem(null)}/>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DETAIL MODAL
═══════════════════════════════════════════════════════════════════════════════ */
function DetailModal({ m, onClose }) {
  const [dtab, setDtab] = useState("ts");
  if (!m) return null;

  const sc = m.status==="warn"?T.amber : m.status==="critical"?T.red : T.blue;
  const vals = m.ts.map(d=>d.v).sort((a,b)=>a-b);
  const pct = (p) => vals[Math.floor(p*(vals.length-1)/100)]?.toFixed(2);
  const avg = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
  const fl = m.fleet;

  const dtabs = [{k:"ts",l:"Time Series"},{k:"hist",l:"Fleet Histogram"},{k:"top15",l:"Top 15 Hosts"},{k:"stats",l:"Stats & API"}];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,25,40,0.55)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#fff",borderRadius:12,width:820,maxWidth:"97vw",maxHeight:"90vh",
        display:"flex",flexDirection:"column",
        boxShadow:"0 32px 80px rgba(0,0,0,0.2),0 0 0 1px rgba(0,0,0,0.07)",overflow:"hidden",
      }}>
        {/* Header */}
        <div style={{background:T.surface,padding:"18px 24px 0",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div>
              <div style={{fontSize:9,color:T.textFaint,fontFamily:T.mono,letterSpacing:"0.08em",marginBottom:3}}>
                DYNATRACE METRIC DETAIL · {m.dynaKey}
              </div>
              <div style={{fontFamily:T.mono,fontSize:22,fontWeight:700,color:T.text}}>
                {m.label}
                <span style={{marginLeft:12,color:sc,fontSize:28}}>{fmt(m.v)}</span>
                <span style={{fontSize:11,color:T.textFaint,marginLeft:3}}>{m.unit}</span>
                {m.status!=="ok" && <span style={{marginLeft:10,fontSize:10,fontWeight:700,
                  color:sColor(m.status),background:sBg(m.status),
                  padding:"2px 8px",borderRadius:4,verticalAlign:"middle"}}>{m.status.toUpperCase()}</span>}
              </div>
              <div style={{fontSize:11,color:T.textDim,marginTop:4,maxWidth:500}}>{m.desc}</div>
            </div>
            <button onClick={onClose} style={{background:"none",border:`1px solid ${T.border}`,
              color:T.textDim,borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:T.mono,alignSelf:"flex-start"}}>✕</button>
          </div>

          {/* Stat pills */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {[
              {l:"NOW",   v:`${fmt(m.v)} ${m.unit}`,              c:sc},
              {l:"MIN",   v:`${vals[0]?.toFixed(2)} ${m.unit}`,   c:T.textMid},
              {l:"AVG",   v:`${avg} ${m.unit}`,                   c:T.textMid},
              {l:"P50",   v:`${pct(50)} ${m.unit}`,               c:T.textMid},
              {l:"P90",   v:`${pct(90)} ${m.unit}`,               c:T.textMid},
              {l:"P95",   v:`${pct(95)} ${m.unit}`,               c:T.amber},
              {l:"P99",   v:`${pct(99)} ${m.unit}`,               c:T.red},
              {l:"MAX",   v:`${vals[vals.length-1]?.toFixed(2)} ${m.unit}`, c:T.red},
              m.thr?{l:"THRESHOLD",v:`${fmt(m.thr)} ${m.unit}`,c:T.amber}:null,
            ].filter(Boolean).map((s,i)=>(
              <div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:5,padding:"4px 10px"}}>
                <div style={{fontSize:8,color:T.textFaint,fontFamily:T.mono,letterSpacing:"0.07em"}}>{s.l}</div>
                <div style={{fontSize:11,fontWeight:700,color:s.c,fontFamily:T.mono}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Fleet percentile summary */}
          {fl && (
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono,alignSelf:"center"}}>Fleet ({fl.hosts.length} hosts):</span>
              {[["P50",fl.stats.p50],["P90",fl.stats.p90],["P95",fl.stats.p95],["P99",fl.stats.p99],["MAX",fl.stats.max],["AVG",fl.stats.avg]].map(([l,v])=>(
                <div key={l} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:4,padding:"3px 8px"}}>
                  <span style={{fontSize:8,color:T.textFaint,fontFamily:T.mono}}>{l} </span>
                  <span style={{fontSize:10,fontWeight:700,color:l==="P99"||l==="MAX"?T.red:l==="P95"?T.amber:T.text,fontFamily:T.mono}}>{v}</span>
                </div>
              ))}
              {fl.critical.length > 0 && (
                <span style={{fontSize:9,color:T.red,fontFamily:T.mono,background:T.redL,
                  padding:"3px 8px",borderRadius:4,border:`1px solid ${T.red}22`}}>
                  {fl.critical.length} hosts critical
                </span>
              )}
            </div>
          )}

          <div style={{display:"flex",gap:0}}>
            {dtabs.map(t=>(
              <button key={t.k} onClick={()=>setDtab(t.k)} style={{
                background:"none",border:"none",
                borderBottom:`2px solid ${dtab===t.k?sc:"transparent"}`,
                color:dtab===t.k?T.text:T.textDim,
                padding:"7px 14px",cursor:"pointer",
                fontSize:10,fontFamily:T.mono,textTransform:"uppercase",
                letterSpacing:"0.05em",transition:"all 0.1s",
              }}>{t.l}</button>
            ))}
          </div>
        </div>

        <div style={{flex:1,overflow:"auto",padding:20,background:T.bg}}>

          {/* TIME SERIES */}
          {dtab==="ts" && (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={m.ts} margin={{top:10,right:16,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="mdg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={sc} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={sc} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={T.divider} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="ts" tick={{fontSize:9,fill:T.textFaint,fontFamily:T.mono}} interval={11} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:T.textFaint,fontFamily:T.mono}} axisLine={false} tickLine={false} width={55}/>
                  <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,fontSize:11,fontFamily:T.mono}}
                    labelStyle={{color:T.textDim}} itemStyle={{color:sc}}/>
                  {m.thr && <ReferenceLine y={m.thr} stroke={T.amber} strokeDasharray="5 4" strokeWidth={1}
                    label={{value:"threshold",fill:T.amber,fontSize:9,fontFamily:T.mono,position:"right"}}/>}
                  <ReferenceLine y={parseFloat(pct(95))} stroke={T.blue} strokeDasharray="3 3" strokeWidth={1} opacity={0.5}
                    label={{value:"p95",fill:T.blue,fontSize:9,fontFamily:T.mono,position:"right"}}/>
                  <Area type="monotone" dataKey="v" stroke={sc} strokeWidth={2} fill="url(#mdg)" dot={false}
                    activeDot={{r:4,fill:sc,stroke:"#fff",strokeWidth:2}}/>
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}

          {/* FLEET HISTOGRAM */}
          {dtab==="hist" && fl && (
            <div>
              <div style={{fontSize:11,color:T.textDim,fontFamily:T.mono,marginBottom:12}}>
                Distribution of current values across {fl.hosts.length} hosts
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={fl.histogram} margin={{top:5,right:10,left:0,bottom:20}}>
                  <CartesianGrid stroke={T.divider} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="label" tick={{fontSize:9,fill:T.textFaint,fontFamily:T.mono,angle:-30,dy:8}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:T.textFaint,fontFamily:T.mono}} axisLine={false} tickLine={false}
                    label={{value:"hosts",angle:-90,position:"insideLeft",fontSize:9,fill:T.textFaint,fontFamily:T.mono}}/>
                  <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,fontSize:11,fontFamily:T.mono}}
                    formatter={(v)=>[`${v} hosts`,"Count"]}/>
                  <Bar dataKey="count" radius={[3,3,0,0]}>
                    {fl.histogram.map((e,i)=>(
                      <Cell key={i} fill={i>=fl.histogram.length*0.75?T.amber:(i>=fl.histogram.length*0.5?T.blue:T.green)} opacity={0.8}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Heatmap cells */}
              <div style={{marginTop:12}}>
                <div style={{fontSize:10,color:T.textDim,fontFamily:T.mono,marginBottom:6}}>All hosts — hover for value</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                  {fl.hosts.map((h) => {
                    const r = m.thr ? h.v/m.thr : (h.v-fl.hosts[0].v)/(fl.hosts[fl.hosts.length-1].v-fl.hosts[0].v||1);
                    const c = r>0.95?T.red:r>0.8?T.amber:r>0.5?sc:T.textFaint;
                    return (
                      <div key={h.id} style={{width:12,height:12,borderRadius:2,background:c,opacity:0.7}}
                        title={`${h.id}: ${h.v.toFixed(1)}${m.unit}`}/>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TOP 15 HOSTS */}
          {dtab==="top15" && fl && (
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <div style={{fontSize:10,color:T.textDim,fontFamily:T.mono,marginBottom:6}}>
                Top 15 hosts by {m.label} — highest first
              </div>
              {fl.top15.map((h,i) => {
                const pct2 = m.thr ? Math.min(100,(h.v/m.thr)*100) : Math.min(100,(h.v/parseFloat(fl.stats.max))*100);
                const isAboveP90 = h.v > parseFloat(fl.stats.p90);
                return (
                  <div key={h.id} style={{
                    display:"flex",alignItems:"center",gap:10,
                    background:T.card,border:`1px solid ${isAboveP90?T.amber+"33":T.border}`,
                    borderRadius:6,padding:"7px 12px",
                    borderLeft:`3px solid ${isAboveP90?T.amber:T.border}`,
                  }}>
                    <span style={{fontFamily:T.mono,fontSize:10,color:T.textFaint,width:18,textAlign:"right"}}>#{i+1}</span>
                    <span style={{fontFamily:T.mono,fontSize:10,color:T.textMid,width:80}}>{h.id}</span>
                    <div style={{flex:1,background:T.divider,borderRadius:3,height:6,overflow:"hidden"}}>
                      <div style={{width:`${pct2}%`,height:"100%",background:isAboveP90?T.amber:sc,borderRadius:3}}/>
                    </div>
                    <span style={{fontFamily:T.mono,fontSize:12,fontWeight:700,color:isAboveP90?T.amber:T.text,width:80,textAlign:"right"}}>
                      {fmt(h.v)} <span style={{fontSize:8,color:T.textFaint}}>{m.unit}</span>
                    </span>
                    {isAboveP90 && <span style={{fontSize:8,color:T.amber,fontFamily:T.mono,background:T.amberL,
                      padding:"1px 6px",borderRadius:3,flexShrink:0}}>ABOVE P90</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* STATS & API */}
          {dtab==="stats" && (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["Metric Key",m.dynaKey],["Metric ID",m.id],["Threshold",m.thr?`${fmt(m.thr)} ${m.unit}`:"—"],
                  ["Aggregation","AVG, P50, P90, P95, P99"],["Resolution","2 minutes"],["Retention","35 days"],
                  ["Fleet Size",`${m.fleet?.hosts.length||"—"} hosts`],["Fleet P90",`${m.fleet?.stats.p90||"—"} ${m.unit}`],
                ].map(([l,v])=>(
                  <div key={l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 14px"}}>
                    <div style={{fontSize:9,color:T.textFaint,fontFamily:T.mono,marginBottom:3}}>{l}</div>
                    <div style={{fontSize:11,fontWeight:600,color:T.text,fontFamily:T.mono,wordBreak:"break-all"}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{background:T.blueL,border:`1px solid ${T.blue}22`,borderRadius:8,padding:14}}>
                <div style={{fontSize:9,color:T.blueText,fontFamily:T.mono,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>
                  Dynatrace Metrics API v2 Query
                </div>
                <code style={{display:"block",fontSize:10,color:T.blueText,fontFamily:T.mono,lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
{`GET /api/v2/metrics/query
  ?metricSelector=${m.dynaKey}
    :percentile(50),${m.dynaKey}
    :percentile(95),${m.dynaKey}
    :percentile(99)
  &resolution=2m
  &from=now-2h
  &to=now
  &entitySelector=type(PROCESS_GROUP),
    tag(env:prod),tag(team:platform)`}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ROOT COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [svcs] = useState(() => SVC_DEFS);
  const [tab, setTab]       = useState("NGINX");
  const [selM, setSelM]     = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [section, setSection] = useState("overview"); // overview | heatmap | metrics
  const [time, setTime]     = useState(new Date());

  useEffect(() => { const t = setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t); }, []);

  const svc = svcs[tab];
  const allSvcs = Object.values(svcs);
  const totalHosts = allSvcs.reduce((a,s)=>a+s.hostCount,0);
  const allWarn = allSvcs.reduce((a,s)=>a+s.metrics.filter(m=>m.status!=="ok").length,0);

  const filtered = useMemo(()=>svc.metrics.filter(m=>{
    const ms = !search || m.label.toLowerCase().includes(search.toLowerCase()) || m.dynaKey.toLowerCase().includes(search.toLowerCase());
    const mf = filter==="all" || m.status===filter;
    return ms && mf;
  }),[svc,search,filter]);

  // SLO burn rate calc
  const slo = svc.slo;
  const errorBudget = slo ? (((slo.current - slo.target)/(100-slo.target))*100).toFixed(1) : null;
  const sloOk = slo ? slo.current >= slo.target : true;

  // Primary heatmap metric (first metric)
  const heatM = svc.metrics[0];

  return (
    <div style={{fontFamily:T.sans,background:T.bg,minHeight:"100vh",color:T.text,display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px;height:4px; }
        ::-webkit-scrollbar-track { background:${T.bg}; }
        ::-webkit-scrollbar-thumb { background:${T.borderMid};border-radius:2px; }
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        button:focus{outline:none}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
        <div style={{padding:"12px 20px 0"}}>
          {/* Title row */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,flexWrap:"wrap"}}>
            <h1 style={{margin:0,fontSize:14,fontWeight:800,letterSpacing:"0.05em",color:T.text,fontFamily:T.mono}}>
              PLATFORM HEALTH METRICS
            </h1>
            <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono,letterSpacing:"0.03em"}}>BMW PORTAL OPERATIONS CENTER — NOC LIVE VIEW</span>

            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              {/* Global stats */}
              {[
                {l:`${totalHosts} HOSTS`,     c:T.blueText,  bg:T.blueL},
                {l:`${allWarn} WARNINGS`,     c:allWarn>0?T.amberText:T.greenText, bg:allWarn>0?T.amberL:T.greenL},
                {l:`${NOW_PROBLEMS.filter(p=>p.sev==="HIGH").length} HIGH PROBLEMS`, c:T.redText||T.red, bg:T.redL},
              ].map(b=>(
                <span key={b.l} style={{fontSize:9,fontFamily:T.mono,fontWeight:700,
                  color:b.c,background:b.bg,padding:"3px 9px",borderRadius:4}}>
                  {b.l}
                </span>
              ))}
              <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",
                background:T.greenL,borderRadius:4,border:`1px solid ${T.green}22`}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:T.green,display:"inline-block",animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:9,color:T.greenText,fontFamily:T.mono,fontWeight:700}}>
                  DYNATRACE LIVE · {time.toLocaleTimeString("tr-TR")}
                </span>
              </div>
            </div>
          </div>

          {/* Service tabs */}
          <div style={{display:"flex",gap:0,overflowX:"auto"}}>
            {TABS.map(t => {
              const s = svcs[t];
              const act = t===tab;
              const wc = s.metrics.filter(m=>m.status!=="ok").length;
              return (
                <button key={t} onClick={()=>{setTab(t);setSection("overview");setSearch("");setFilter("all");}} style={{
                  background:"none",border:"none",
                  borderBottom:`2px solid ${act?s.color:"transparent"}`,
                  color:act?T.text:T.textDim,
                  padding:"8px 14px",cursor:"pointer",
                  fontSize:11,fontFamily:T.mono,fontWeight:act?700:500,
                  letterSpacing:"0.04em",whiteSpace:"nowrap",
                  display:"flex",alignItems:"center",gap:4,transition:"all 0.12s",
                }}>
                  {wc>0 && <span style={{width:4,height:4,borderRadius:"50%",background:T.amber,display:"inline-block"}}/>}
                  {t}
                  <span style={{
                    fontSize:8,padding:"1px 4px",borderRadius:3,
                    color:act?s.color:T.textFaint,
                    background:act?s.color+"15":"transparent",
                    fontFamily:T.mono,
                  }}>{s.hostCount}h</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{flex:1,padding:16,overflowY:"auto"}}>

        {/* Service title + SLO strip */}
        <div style={{
          display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",
          background:T.card,border:`1px solid ${T.border}`,borderRadius:8,
          padding:"10px 16px",marginBottom:12,
          boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
          borderLeft:`3px solid ${svc.color}`,
        }}>
          <span style={{fontSize:13,fontWeight:800,color:T.text,fontFamily:T.mono}}>{svc.label}</span>
          <span style={{fontSize:9,fontWeight:700,color:svc.color,border:`1px solid ${svc.color}44`,
            borderRadius:4,padding:"2px 8px",fontFamily:T.mono,letterSpacing:"0.07em"}}>{svc.badge}</span>
          <span style={{fontSize:11,color:T.textDim}}>{svc.desc}</span>

          {slo && (
            <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:8}}>
              <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>SLO</span>
              <span style={{
                fontSize:10,fontWeight:700,fontFamily:T.mono,
                color:sloOk?T.greenText:T.redText||T.red,
                background:sloOk?T.greenL:T.redL,
                padding:"2px 8px",borderRadius:4,
              }}>{slo.current}% / {slo.target}%</span>
              <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>
                Error budget: {errorBudget}% remaining
              </span>
            </div>
          )}
          {svc.apdex !== null && svc.apdex !== undefined && (
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>Apdex</span>
              <span style={{fontSize:12,fontWeight:700,fontFamily:T.mono,
                color:svc.apdex>=0.94?T.green:svc.apdex>=0.85?T.amber:T.red}}>
                {svc.apdex}
                <span style={{fontSize:9,color:T.textFaint,marginLeft:4,fontWeight:400}}>
                  {svc.apdex>=0.94?"Excellent":svc.apdex>=0.85?"Good":"Fair"}
                </span>
              </span>
            </div>
          )}

          {/* Section nav */}
          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
            {[{k:"overview",l:"Overview"},{k:"heatmap",l:"Fleet Heatmap"},{k:"metrics",l:"All Metrics"}].map(s=>(
              <button key={s.k} onClick={()=>setSection(s.k)} style={{
                background:section===s.k?svc.color+"15":"none",
                border:`1px solid ${section===s.k?svc.color:T.border}`,
                color:section===s.k?svc.color:T.textDim,
                borderRadius:5,padding:"4px 11px",cursor:"pointer",
                fontSize:10,fontFamily:T.mono,fontWeight:section===s.k?700:400,
              }}>{s.l}</button>
            ))}
          </div>
        </div>

        {/* ── OVERVIEW SECTION ── */}
        {section==="overview" && (
          <div style={{animation:"fadeIn 0.18s ease"}}>

            {/* Davis AI problems */}
            <ProblemFeed/>

            {/* KPI row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:16}}>
              {svc.kpis.map((k,i)=>{
                const delta = typeof k.value==="number" && typeof k.prev==="number" ? k.value - k.prev : null;
                const up = delta !== null && delta > 0;
                return (
                  <div key={i} style={{
                    background:T.card,border:`1px solid ${T.border}`,borderRadius:8,
                    padding:"12px 14px",
                    borderLeft:`3px solid ${k.status==="warn"?T.amber:k.status==="critical"?T.red:svc.color}`,
                    boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{fontSize:9,color:T.textDim,fontFamily:T.mono,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{k.label}</div>
                    <div style={{fontFamily:T.mono,fontSize:21,fontWeight:700,color:k.status==="warn"?T.amber:T.text,lineHeight:1}}>
                      {typeof k.value==="number"?fmt(k.value):k.value}
                      <span style={{fontSize:9,color:T.textFaint,fontWeight:400,marginLeft:2}}>{k.unit}</span>
                    </div>
                    {delta !== null && (
                      <div style={{fontSize:9,color:up?(k.status==="warn"?T.amber:T.red):T.green,fontFamily:T.mono,marginTop:3}}>
                        {up?"▲":"▼"} {Math.abs(delta).toFixed(typeof delta==="number"&&Math.abs(delta)<10?1:0)} vs 1h ago
                      </div>
                    )}
                    {k.status!=="ok" && (
                      <div style={{fontSize:8,color:T.amber,fontFamily:T.mono,marginTop:2}}>⚠ {k.status.toUpperCase()}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inline charts — 4 key metrics always visible */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10,marginBottom:16}}>
              {svc.primaryTs.map((cfg,i)=>(
                <InlineChart key={i} cfg={cfg} deployments={DEPLOYMENTS.filter(d=>d.service===svc.label)}/>
              ))}
            </div>

            {/* Mini heatmap preview */}
            <div style={{marginBottom:4}}>
              <FleetHeatmap fleet={heatM.fleet} label={heatM.label} unit={heatM.unit} color={svc.color} threshold={heatM.thr}/>
            </div>
          </div>
        )}

        {/* ── HEATMAP SECTION ── */}
        {section==="heatmap" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:12,animation:"fadeIn 0.18s ease"}}>
            {svc.metrics.filter((_,i)=>i<8).map(m=>(
              <FleetHeatmap key={m.id} fleet={m.fleet} label={m.label} unit={m.unit} color={svc.color} threshold={m.thr}/>
            ))}
          </div>
        )}

        {/* ── ALL METRICS SECTION ── */}
        {section==="metrics" && (
          <div style={{animation:"fadeIn 0.18s ease"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search metric name or dynatrace key..."
                style={{
                  background:T.card,border:`1px solid ${T.border}`,borderRadius:6,
                  padding:"6px 12px",fontSize:11,fontFamily:T.mono,color:T.text,
                  width:260,outline:"none",
                }}/>
              <div style={{display:"flex",gap:4}}>
                {["all","ok","warn"].map(f=>(
                  <button key={f} onClick={()=>setFilter(f)} style={{
                    background:filter===f?(f==="warn"?T.amberL:f==="ok"?T.greenL:T.blueL):"none",
                    border:`1px solid ${filter===f?(f==="warn"?T.amber:f==="ok"?T.green:T.blue):T.border}`,
                    color:filter===f?(f==="warn"?T.amberText:f==="ok"?T.greenText:T.blueText):T.textDim,
                    borderRadius:5,padding:"5px 12px",cursor:"pointer",
                    fontSize:9,fontFamily:T.mono,fontWeight:700,letterSpacing:"0.04em",
                  }}>{f.toUpperCase()}</button>
                ))}
              </div>
              <span style={{fontSize:10,color:T.textDim,fontFamily:T.mono}}>
                {filtered.length} / {svc.metrics.length} metrics
                {svc.metrics.filter(m=>m.status!=="ok").length>0 && ` · ${svc.metrics.filter(m=>m.status!=="ok").length} warnings`}
              </span>
              <span style={{marginLeft:"auto",fontSize:9,color:T.textFaint,fontFamily:T.mono}}>Click any card for fleet drill-down</span>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:9}}>
              {filtered.map(m=>(
                <MCard key={m.id} m={m} color={svc.color} onClick={setSelM}/>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop:14,padding:"10px 16px",
          background:T.card,border:`1px solid ${T.border}`,borderRadius:7,
          display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:6,
          boxShadow:"0 1px 2px rgba(0,0,0,0.03)",
        }}>
          <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>
            Dynatrace SaaS · bmw-portal.live.dynatrace.com · Env: PRODUCTION · Resolution: 2m · Retention: 35d
          </span>
          <span style={{fontSize:9,color:T.textFaint,fontFamily:T.mono}}>
            {svc.metrics.filter(m=>m.status==="ok").length}/{svc.metrics.length} metrics OK ·
            {svc.hostCount} hosts · auto-refresh 30s
          </span>
        </div>
      </div>

      {selM && <DetailModal m={selM} onClose={()=>setSelM(null)}/>}
    </div>
  );
}
