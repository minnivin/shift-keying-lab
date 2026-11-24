// ===== Shift Keying Lab: left rail + one big plot (waveforms / spectrum / BER), ASK, FSK, PSK and 16-QAM =====
(function () {
const $ = id => document.getElementById(id);
const KINDS = ['ASK', 'FSK', 'PSK', 'QAM'];
const LABEL = { ASK: 'ASK', FSK: 'FSK', PSK: 'PSK', QAM: '16-QAM' };
const SUB = { ASK: 'amplitude', FSK: 'frequency', PSK: 'phase', QAM: 'amp/phase' };
const BPS = { ASK: 1, FSK: 1, PSK: 1, QAM: 4 };            // bits per symbol
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = { kind: 'PSK', view: 'wave', bits: '10100110', Rb: 1000, cpb: 4, dfn: 4, m: 1, eb: 8, noise: false,
            target: 4e-6, speed: 1, playing: !reduced };
const anim = { t: reduced ? 1 : 0, last: 0, raf: 0 };      // t = playhead position as a fraction of the bit stream
const fc = () => S.cpb * S.Rb;                              // carrier = cpb x bit rate
const df = () => S.dfn * S.Rb / 2;                          // FSK spacing, always a multiple of Rb/2
const ebLin = () => Math.pow(10, S.eb / 10);

const DESC = {
  ASK: 'Amplitude switches between A and A(1−m)/(1+m). Simplest, but the weakest against noise.',
  FSK: 'One tone per bit. Needs the most bandwidth: (f1 − f0) + Rb.',
  PSK: 'Binary PSK: the phase flips between 0° and 180°. Same bandwidth as ASK and about 3 dB better than FSK.',
  QAM: '16 amplitude/phase states carry 4 bits per symbol: the narrowest band, but it needs the cleanest signal.',
};

// ---------- formatting ----------
const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = n => String(n).split('').map(c => SUP[c] || c).join('');
const fmtE = x => {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  if (x >= 0.01) return x.toFixed(3);
  const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e);
  return m.toFixed(1) + '×10' + sup(e);
};
const fmtHz = f => f >= 1e3 ? (+(f / 1e3).toPrecision(4)) + ' kHz' : (+f.toPrecision(4)) + ' Hz';
const fmtBps = r => fmtHz(r).replace('Hz', 'bps');
const dB = x => 10 * Math.log10(x);

// ---------- colours ----------
let COL = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['ink', 'muted', 'line', 'grid', 'ask', 'fsk', 'psk', 'qam', 'noise', 'warn', 'panel', 'bg'])
    COL[k] = cs.getPropertyValue('--' + k).trim();
}
const colOf = k => COL[k.toLowerCase()];
function alpha(hex, a) {
  const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- canvas helpers ----------
const MONO = '12px "IBM Plex Mono", ui-monospace, Consolas, monospace';
const SANS = '12px "IBM Plex Sans", system-ui, sans-serif';
function prep(cv) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  return { g, w, h };
}
function niceTicks(a, b, n) {
  const span = b - a, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, t = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + step * 1e-9; v += step) t.push(+v.toFixed(10));
  return t;
}
function axes(g, box, ax) {
  const { l, r, t, b } = box;
  const X = v => l + (v - ax.x0) / (ax.x1 - ax.x0) * (r - l);
  const ly0 = ax.ylog ? Math.log10(ax.y0) : 0, ly1 = ax.ylog ? Math.log10(ax.y1) : 0;
  const Y = ax.ylog ? v => b - (Math.log10(Math.max(v, 1e-300)) - ly0) / (ly1 - ly0) * (b - t)
                    : v => b - (v - ax.y0) / (ax.y1 - ax.y0) * (b - t);
  g.save(); g.font = MONO; g.lineWidth = 1; g.strokeStyle = COL.grid;
  const xt = ax.xticks || niceTicks(ax.x0, ax.x1, Math.max(3, Math.floor((r - l) / 70)));
  let yt;
  if (ax.ylog) {
    yt = []; for (let e = Math.ceil(ly0); e <= ly1; e++) yt.push(Math.pow(10, e));
    g.globalAlpha = 0.6;
    for (let e = Math.floor(ly0); e < ly1; e++) for (let m = 2; m < 10; m++) {
      const v = m * Math.pow(10, e); if (v < ax.y0 || v > ax.y1) continue;
      g.beginPath(); g.moveTo(l, Y(v) + .5); g.lineTo(r, Y(v) + .5); g.stroke();
    }
    g.globalAlpha = 1;
  } else yt = niceTicks(ax.y0, ax.y1, Math.max(3, Math.floor((b - t) / 45)));
  g.fillStyle = COL.muted; g.textAlign = 'center'; g.textBaseline = 'top';
  for (const v of xt) { const x = Math.round(X(v)) + .5; g.beginPath(); g.moveTo(x, t); g.lineTo(x, b); g.stroke(); g.fillText(ax.xfmt ? ax.xfmt(v) : String(v), x, b + 5); }
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const v of yt) { const y = Math.round(Y(v)) + .5; g.beginPath(); g.moveTo(l, y); g.lineTo(r, y); g.stroke(); g.fillText(ax.yfmt ? ax.yfmt(v) : String(v), l - 6, y); }
  g.strokeStyle = COL.line; g.strokeRect(l + .5, t + .5, r - l - 1, b - t - 1);
  g.fillStyle = COL.ink; g.font = SANS;
  g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(ax.xlabel, (l + r) / 2, box.H - 6);
  g.save(); g.translate(14, (t + b) / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText(ax.ylabel, 0, 0); g.restore();
  g.restore();
  return { X, Y };
}

// ---------- 1. waveforms (computed once per change, drawn every animation frame) ----------
let PAD = 0;
function bitArray() {
  const raw = (S.bits.replace(/[^01]/g, '') || '0').split('').map(Number);
  PAD = (4 - raw.length % 4) % 4;                           // 16-QAM needs whole 4-bit symbols
  for (let i = 0; i < PAD; i++) raw.push(0);
  return raw;
}
let WV = null;
function computeWave() {
  const bits = bitArray(), Tb = 1 / S.Rb, T = bits.length * Tb;
  let fs = 64 * (fc() + df() / 2); if (fs * T > 40000) fs = 40000 / T;
  const N0 = (1 / (2 * S.Rb)) / ebLin();                    // Eb = 0.5 W x Tb
  const p = { Rb: S.Rb, fc: fc(), df: df(), m: S.m, nReal: bits.length - PAD };
  const lanes = {};
  for (const k of KINDS) {
    const wv = waveform(k, bits, p, fs, S.noise ? { N0, Bn: bandwidths(k, S.Rb, df()).nom } : null, 7);
    let pk = 1; if (S.noise) for (let n = 0; n < wv.N; n++) pk = Math.max(pk, Math.abs(wv.y[n]));
    lanes[k] = { wv, A: Math.min(pk, 3) * 1.1 };
  }
  WV = { bits, Tb, T, fs, lanes };
}
const headSec = () => Math.min(1, anim.t) * WV.T;
const bitLabel = (k, b) => k === 'PSK' ? (b ? '0°' : '180°') : k === 'FSK' ? (b ? 'f1' : 'f0') : (b ? 'A' : (S.m >= 0.999 ? '0' : 'low'));

function drawTime() {
  const cv = $('cvTime'); if (cv.hidden || !WV || !cv.clientWidth) return;
  const { g, w, h } = prep(cv), { bits, Tb, T, fs, lanes } = WV;
  const head = headSec(), running = anim.t < 1;
  const l = w < 520 ? 108 : 114, r = w - 16, top = 14, axisH = 40, gap = 10, n = KINDS.length;
  const bitH = Math.min(64, (h - top - axisH - gap * n) * 0.16), waveH = (h - top - axisH - gap * n - bitH) / n;
  const X = t => l + t / T * (r - l);
  const rows = [{ name: 'Data', t: top, h: bitH }];
  let y = top + bitH + gap;
  for (const k of KINDS) { rows.push({ name: k, t: y, h: waveH }); y += waveH + gap; }
  const bot = y - gap;

  const bi = Math.min(bits.length - 1, Math.floor(head / Tb));
  if (running) { g.fillStyle = alpha(COL.psk, 0.07); g.fillRect(X(bi * Tb), top, X((bi + 1) * Tb) - X(bi * Tb), bot - top); }
  for (const ln of rows) {
    if (ln.name === S.kind) { g.fillStyle = alpha(colOf(S.kind), 0.07); g.fillRect(l, ln.t, r - l, ln.h); }
    g.strokeStyle = COL.line; g.lineWidth = 1; g.strokeRect(l + .5, ln.t + .5, r - l - 1, ln.h - 1);
  }
  g.strokeStyle = COL.grid; g.setLineDash([3, 3]);
  for (let i = 1; i < bits.length; i++) { const x = Math.round(X(i * Tb)) + .5; g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke(); }
  g.setLineDash([]);

  // data lane (NRZ)
  const bl = rows[0], yb = v => bl.t + bl.h - 6 - v * (bl.h - 24);
  g.strokeStyle = COL.ink; g.lineWidth = 2; g.beginPath();
  bits.forEach((v, i) => { const x0 = X(i * Tb), x1 = X((i + 1) * Tb); i ? g.lineTo(x0, yb(v)) : g.moveTo(x0, yb(v)); g.lineTo(x1, yb(v)); });
  g.stroke();
  g.font = '600 13px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
  bits.forEach((v, i) => { g.fillStyle = i >= bits.length - PAD ? COL.muted : COL.ink; g.fillText(String(v), X((i + .5) * Tb), bl.t + 3); });
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '600 13px "IBM Plex Sans", sans-serif'; g.fillStyle = COL.ink;
  g.fillText('Data', 6, bl.t + bl.h / 2);

  // carrier lanes: faint full trace, bright trace up to the playhead
  const nHead = Math.min(lanes.ASK.wv.N, Math.floor(head * fs));
  KINDS.forEach((k, li) => {
    const ln = rows[li + 1], { wv, A } = lanes[k], c = colOf(k), sel = k === S.kind;
    const yy = v => ln.t + ln.h / 2 - Math.max(-A, Math.min(A, v)) / A * (ln.h / 2 - 4);
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(l, yy(0)); g.lineTo(r, yy(0)); g.stroke();
    const step = Math.max(1, Math.floor(wv.N / ((r - l) * 4)));
    const series = (arr, color, lw, end) => { g.strokeStyle = color; g.lineWidth = lw; g.beginPath();
      for (let i = 0; i < end; i += step) { const x = X(i / fs), v = yy(arr[i]); i ? g.lineTo(x, v) : g.moveTo(x, v); } g.stroke(); };
    if (running) {
      if (S.noise) series(wv.y, alpha(COL.noise, 0.22), 1, wv.N);
      series(wv.clean, alpha(c, 0.28), 1.2, wv.N);
    }
    if (S.noise) series(wv.y, alpha(COL.noise, 0.8), 1, nHead);
    series(wv.clean, c, sel ? 1.9 : 1.4, nHead);
    if (running && nHead > 0) { g.fillStyle = c; g.beginPath(); g.arc(X(head), yy(wv.clean[Math.min(wv.N - 1, nHead)]), 3.5, 0, 7); g.fill(); }
    g.font = MONO; g.textAlign = 'center'; g.textBaseline = 'bottom';
    const label = (txt, x) => { const y0 = ln.t + ln.h - 2; g.fillStyle = alpha(COL.panel, 0.9); const tw = g.measureText(txt).width; g.fillRect(x - tw / 2 - 2, y0 - 13, tw + 4, 12); g.fillStyle = c; g.fillText(txt, x, y0); };
    if (k === 'QAM') { for (let s = 0; s < bits.length / 4; s++) label(bits.slice(4 * s, 4 * s + 4).join(''), X((4 * s + 2) * Tb)); }
    else if ((r - l) / bits.length > 30) bits.forEach((b, i) => { if (i < bits.length - PAD) label(bitLabel(k, b), X((i + .5) * Tb)); });
    g.textAlign = 'left'; g.textBaseline = 'middle';                // scheme name and sub-label sit at the far left
    g.font = '700 14px "IBM Plex Sans", sans-serif'; g.fillStyle = c; g.fillText(LABEL[k], 6, ln.t + ln.h / 2 - 8);
    g.font = MONO; g.fillStyle = COL.muted; g.fillText(SUB[k], 6, ln.t + ln.h / 2 + 8);
    g.textAlign = 'right'; g.font = '10px "IBM Plex Mono", monospace';   // voltage scale sits against the plot
    g.fillText('1 V', l - 6, yy(1)); g.fillText('−1 V', l - 6, yy(-1));
  });
  if (running) { g.strokeStyle = alpha(COL.ink, 0.45); g.lineWidth = 1; g.beginPath(); g.moveTo(Math.round(X(head)) + .5, top); g.lineTo(Math.round(X(head)) + .5, bot); g.stroke(); }

  const ticks = niceTicks(0, T * 1e3, Math.max(3, Math.floor((r - l) / 80)));
  g.font = MONO; g.fillStyle = COL.muted; g.textAlign = 'center'; g.textBaseline = 'top'; g.strokeStyle = COL.line;
  for (const v of ticks) { const x = Math.round(X(v / 1e3)) + .5; g.beginPath(); g.moveTo(x, bot); g.lineTo(x, bot + 4); g.stroke(); g.fillText(String(+v.toFixed(3)), x, bot + 7); }
  g.fillStyle = COL.ink; g.font = SANS; g.textBaseline = 'bottom'; g.fillText('Time (ms)', (l + r) / 2, h - 6);
}

// ---------- 2. spectrum (selected scheme bold, the others faint) ----------
let specCache = { key: '', P: {} };
function drawSpec() {
  const cv = $('cvSpec'); if (cv.hidden || !cv.clientWidth) return;
  const N0n = (1 / (2 * S.Rb)) / ebLin();                       // same noise density as the waveforms
  const { g, w, h } = prep(cv), k = S.kind, c = colOf(k), D = df(), F = fc(), key = [S.Rb, D, S.m].join('|');
  if (specCache.key !== key) { const P = {}; for (const kk of KINDS) P[kk] = envelopePSD(kk, { Rb: S.Rb, df: D, m: S.m }, 21); specCache = { key, P }; }
  const bw = bandwidths(k, S.Rb, D);
  const maxNom = Math.max(...KINDS.map(kk => bandwidths(kk, S.Rb, D).nom)), span = maxNom / 2 + 1.5 * S.Rb, fLo = Math.max(0, F - span), fHi = F + span;
  const tr = {}; let pk = -Infinity;
  for (const kk of KINDS) {
    const P = specCache.P[kk], xs = [], ys = [];
    for (let i = 0; i < P.nfft; i++) {
      const fb = P.f(i), f = F + fb; if (f < fLo || f > fHi) continue;
      let v = P.S[i]; const j = Math.round((-2 * F - fb) / P.df + P.nfft / 2); if (j >= 0 && j < P.nfft) v += P.S[j];
      const d = dB(Math.max(0.5 * v + (S.noise ? N0n : 0), 1e-30)); xs.push(f); ys.push(d); pk = Math.max(pk, d);
    }
    tr[kk] = { xs, ys };
  }
  const y1 = Math.ceil((pk + 3) / 10) * 10, y0 = y1 - 50;
  const box = { l: 64, r: w - 16, t: 66, b: h - 46, H: h };
  const { X, Y } = axes(g, box, { x0: fLo / 1e3, x1: fHi / 1e3, y0, y1, xlabel: 'Frequency (kHz)', ylabel: 'Power density (dBW/Hz)', xfmt: v => String(+v.toFixed(2)) });
  const Xf = f => X(f / 1e3);
  g.save(); g.beginPath(); g.rect(box.l, box.t, box.r - box.l, box.b - box.t); g.clip();
  g.fillStyle = alpha(c, 0.07); g.fillRect(Xf(F - bw.nom / 2), box.t, Xf(F + bw.nom / 2) - Xf(F - bw.nom / 2), box.b - box.t);
  g.fillStyle = alpha(c, 0.14); g.fillRect(Xf(F - bw.nyq / 2), box.t, Xf(F + bw.nyq / 2) - Xf(F - bw.nyq / 2), box.b - box.t);
  const line = (kk, color, lw) => { g.strokeStyle = color; g.lineWidth = lw; g.beginPath(); tr[kk].xs.forEach((f, i) => { const x = Xf(f), yv = Y(Math.max(y0 - 5, tr[kk].ys[i])); i ? g.lineTo(x, yv) : g.moveTo(x, yv); }); g.stroke(); };
  for (const kk of KINDS) if (kk !== k) line(kk, alpha(colOf(kk), 0.3), 1.4);
  line(k, c, 2.2);
  if (S.noise) {                                                    // white-noise floor
    const yN = Y(dB(N0n)); g.strokeStyle = COL.ink; g.lineWidth = 1.2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(box.l, yN); g.lineTo(box.r, yN); g.stroke(); g.setLineDash([]);
    g.font = MONO; g.fillStyle = COL.ink; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(`noise floor ${dB(N0n).toFixed(0)} dBW/Hz`, box.r - 6, yN - 3);
  }
  const Rs = S.Rb / BPS[k];
  const marks = k === 'FSK' ? [[F - D / 2, 'f0'], [F + D / 2, 'f1'], [F - D / 2 - S.Rb, 'f0−Rb'], [F + D / 2 + S.Rb, 'f1+Rb']]
    : [[F, 'fc'], [F - Rs, 'fc−' + (k === 'QAM' ? 'Rs' : 'Rb')], [F + Rs, 'fc+' + (k === 'QAM' ? 'Rs' : 'Rb')]];
  g.font = MONO; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.strokeStyle = COL.ink; g.lineWidth = 1;
  for (const [f, nm] of marks) {
    g.setLineDash([2, 3]); g.beginPath(); g.moveTo(Xf(f), box.t); g.lineTo(Xf(f), box.b); g.stroke(); g.setLineDash([]);
    g.fillStyle = alpha(COL.panel, 0.9); const tw = g.measureText(nm).width; g.fillRect(Xf(f) - tw / 2 - 2, box.b - 18, tw + 4, 14);
    g.fillStyle = COL.ink; g.fillText(nm, Xf(f), box.b - 5);
  }
  g.restore();
  const bracket = (wid, yy, txt) => {
    const a = Xf(F - wid / 2), b = Xf(F + wid / 2);
    g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(a, yy + 4); g.lineTo(a, yy); g.lineTo(b, yy); g.lineTo(b, yy + 4); g.stroke();
    g.fillStyle = c; g.font = MONO; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(txt, (a + b) / 2, yy - 2);
  };
  bracket(bw.nom, 16, `BW_NOM ${fmtHz(bw.nom)}`);
  bracket(bw.nyq, 44, `BW_NYQ ${fmtHz(bw.nyq)}`);

  const P = specCache.P[k]; let tot = 0, inNom = 0;
  for (let i = 0; i < P.nfft; i++) { const v = P.S[i]; tot += v; if (Math.abs(P.f(i)) <= bw.nom / 2) inNom += v; }
  NOTE.spec = (k === 'FSK' ? 'FSK looks like two ASK spectra, one at f0 and one at f1. The two spikes are the tones. '
    : k === 'ASK' ? 'ASK is AM with a line-code message: side bands on both sides of the carrier. The spike at fc is carrier power that carries no data. '
    : k === 'PSK' ? 'PSK has the same main lobe as ASK, but no carrier spike: all the power is in the side bands. '
    : '16-QAM sends 4 bits per symbol, so symbols come 4× slower and the band is 4× narrower than PSK. The peak is taller because the same power is squeezed into less bandwidth. ') +
    `The faint lines are the other schemes. Power inside BW<sub>NOM</sub>: <b>${(100 * inNom / tot).toFixed(1)} %</b> · efficiency R<sub>b</sub>/BW<sub>NYQ</sub>: <b>${(S.Rb / bw.nyq).toFixed(2)} bit/s/Hz</b>` +
    (S.noise ? ` The dashed line is the noise floor, N<sub>0</sub> = <b>${dB(N0n).toFixed(1)} dBW/Hz</b>. Anything below it is buried in the noise.` : '');
}

// ---------- 2b. I-Q constellation of the selected scheme ----------
function drawConst() {
  const cv = $('cvConst'); if (!cv.clientWidth) return;
  const { g, w, h } = prep(cv), k = S.kind, c = colOf(k);
  const N = S.noise ? 1500 : 0, C = constellation(k, S.eb, S.m, N, makeRng(5));
  const maxI = Math.max(...C.ideal.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))));
  const lim = Math.max(1.1, S.noise ? Math.min(2.6, maxI + 3.2 * C.sigma) : maxI * 1.35);
  const side = Math.max(120, Math.min(w - 70, h - 70)), l = 54 + Math.max(0, (w - 70 - side) / 2), t = 24;
  const box = { l, r: l + side, t, b: t + side, H: h }, fsk = k === 'FSK', ticks = niceTicks(-lim, lim, 4);
  const { X, Y } = axes(g, box, { x0: -lim, x1: lim, y0: -lim, y1: lim, xticks: ticks, yticks: ticks,
    xlabel: fsk ? 'tone f0 (normalised)' : 'I, in-phase (normalised)', ylabel: fsk ? 'tone f1 (normalised)' : 'Q, quadrature (normalised)',
    xfmt: v => String(+v.toFixed(2)), yfmt: v => String(+v.toFixed(2)) });
  g.save(); g.beginPath(); g.rect(box.l, box.t, side, side); g.clip();
  // decision boundaries
  g.strokeStyle = alpha(COL.muted, 0.85); g.setLineDash([5, 4]); g.lineWidth = 1; g.beginPath();
  if (k === 'QAM') { for (const v of [-2 * QAM_SC, 0, 2 * QAM_SC]) { g.moveTo(X(v), box.t); g.lineTo(X(v), box.b); g.moveTo(box.l, Y(v)); g.lineTo(box.r, Y(v)); } }
  else if (fsk) { g.moveTo(X(-lim), Y(-lim)); g.lineTo(X(lim), Y(lim)); }
  else { const th = (C.ideal[0].x + C.ideal[1].x) / 2; g.moveTo(X(th), box.t); g.lineTo(X(th), box.b); }
  g.stroke(); g.setLineDash([]);
  // received symbols (wrong ones on top, in red)
  for (const wrong of [0, 1]) {
    g.fillStyle = wrong ? 'rgba(214, 69, 69, 0.9)' : alpha(c, 0.4);
    for (let n = 0; n < N; n++) if (C.bad[n] === wrong) { g.beginPath(); g.arc(X(C.rx[n]), Y(C.ry[n]), wrong ? 2.6 : 2.1, 0, 7); g.fill(); }
  }
  // ideal symbols
  g.strokeStyle = COL.ink; g.lineWidth = 2;
  for (const p of C.ideal) { const x = X(p.x), y = Y(p.y); g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke(); }
  if (side > 190) {
    g.font = '600 10.5px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    for (const p of C.ideal) {
      const txt = fsk ? (p.bits === '0' ? 'f0' : 'f1') : p.bits, x = X(p.x), y = Y(p.y) - 7, tw = g.measureText(txt).width;
      g.fillStyle = alpha(COL.panel, 0.85); g.fillRect(x - tw / 2 - 2, y - 12, tw + 4, 13); g.fillStyle = COL.ink; g.fillText(txt, x, y);
    }
  }
  g.restore();
  g.font = MONO; g.fillStyle = COL.ink; g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText(S.noise ? `symbol errors: ${C.errs} of ${N}` : 'ideal symbols (no noise)', box.l, 4);
  NOTE.iq = (S.noise
    ? `I-Q constellation (right): crosses are the ideal symbols, dots are what the receiver gets after noise, and red dots cross a dashed decision line so they are decoded wrongly (${C.errs} of ${N} here). `
    : `I-Q constellation (right): the ideal symbols${k === 'QAM' ? ', each labelled with its 4 bits' : ''}. Tick "Show the noise" to see them spread out. `)
    + (k === 'QAM' ? '16-QAM packs 16 points into the same space, so noise pushes a symbol over a line sooner than in PSK.' : fsk ? 'FSK uses its two orthogonal tones as the two axes.' : '');
}

// ---------- 3. BER ----------
const sim = { key: '', res: {}, tok: 0 };
function runSim() {
  const key = [S.eb, S.m].join('|'); if (sim.key === key) return;
  const tok = ++sim.tok; sim.key = key; sim.res = {};
  let i = 0;
  const step = () => {
    if (tok !== sim.tok) return;
    const k = KINDS[i], n = 200000;
    sim.res[k] = { e: simulate(k, n, S.eb, S.m, makeRng(100 + i)), n }; i++;
    renderTable(); drawBer();
    if (i < KINDS.length) setTimeout(step, 0);
  };
  setTimeout(step, 30);
}
function drawBer() {
  const cv = $('cvBer'); if (cv.hidden || !cv.clientWidth) return;
  const { g, w, h } = prep(cv);
  const Y0 = 1e-7, Y1 = 1, box = { l: 66, r: w - 16, t: 14, b: h - 46, H: h };
  const { X, Y } = axes(g, box, { x0: 0, x1: 18, y0: Y0, y1: Y1, ylog: true, xlabel: 'Eb/N0 (dB)', ylabel: 'Bit error rate (errors per bit)', yfmt: v => '10' + sup(Math.round(Math.log10(v))), xticks: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] });
  g.save(); g.beginPath(); g.rect(box.l, box.t, box.r - box.l, box.b - box.t); g.clip();
  g.strokeStyle = COL.ink; g.lineWidth = 1; g.setLineDash([4, 4]);
  if (S.target > Y0 && S.target < Y1) { g.beginPath(); g.moveTo(box.l, Y(S.target)); g.lineTo(box.r, Y(S.target)); g.stroke(); }
  g.beginPath(); g.moveTo(X(S.eb), box.t); g.lineTo(X(S.eb), box.b); g.stroke(); g.setLineDash([]);
  const lab = { PSK: [1, 'below'], FSK: [3, 'above'], ASK: [5, 'above'], QAM: [13.5, 'above'] };
  for (const k of KINDS) {
    const c = colOf(k), sel = k === S.kind;
    g.strokeStyle = c; g.lineWidth = sel ? 3.2 : 1.8; g.globalAlpha = sel ? 1 : 0.7; g.beginPath(); let started = false;
    for (let x = 0; x <= 18.001; x += 0.1) { const v = ber(k, x, S.m); if (v < Y0 * 0.5) break; started ? g.lineTo(X(x), Y(v)) : (g.moveTo(X(x), Y(v)), started = true); }
    g.stroke(); g.globalAlpha = 1;
    const v = ber(k, S.eb, S.m);
    if (v > Y0) { g.fillStyle = COL.panel; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(X(S.eb), Y(v), 4.5, 0, 7); g.fill(); g.stroke(); }
    const req = requiredEbN0(k, S.target, S.m);
    if (isFinite(req) && req <= 18 && S.target > Y0) { g.fillStyle = c; g.beginPath(); g.arc(X(req), Y(S.target), 4.5, 0, 7); g.fill(); }
    const sr = sim.res[k];
    if (sr && sr.e > 0) { g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); const x = X(S.eb), yv = Y(sr.e / sr.n); g.moveTo(x - 6, yv - 6); g.lineTo(x + 6, yv + 6); g.moveTo(x + 6, yv - 6); g.lineTo(x - 6, yv + 6); g.stroke(); }
    const [lx, pos] = lab[k], lv = ber(k, lx, S.m);
    g.font = '700 12px "IBM Plex Mono", monospace'; g.fillStyle = c; g.textAlign = 'left'; g.textBaseline = pos === 'below' ? 'top' : 'bottom';
    if (lv > Y0) g.fillText(LABEL[k], X(lx) + 6, Y(lv) + (pos === 'below' ? 5 : -4));
  }
  g.restore();
  g.font = MONO; g.fillStyle = COL.muted; g.textAlign = 'left'; g.textBaseline = 'bottom';
  g.fillText('○ theory at your Eb/N0', box.l + 10, box.b - 36);
  g.fillText('● Eb/N0 for the target BER', box.l + 10, box.b - 22);
  g.fillText('× simulated (200 000 bits)', box.l + 10, box.b - 8);
}
function renderTable() {
  const rows = KINDS.map(k => {
    const bw = bandwidths(k, S.Rb, df()), req = requiredEbN0(k, S.target, S.m), sr = sim.res[k];
    const simTxt = sr ? (sr.e ? fmtE(sr.e / sr.n) : `0 errors in ${sr.n.toLocaleString()}`) : '…';
    return `<tr${k === S.kind ? ' style="font-weight:600"' : ''}><td><i class="sw" style="background:${colOf(k)}"></i>${LABEL[k]}</td>` +
      `<td class="num">${fmtE(ber(k, S.eb, S.m))}</td><td class="num">${simTxt}</td>` +
      `<td class="num">${isFinite(req) ? req.toFixed(1) + ' dB' : '—'}</td><td class="num">${fmtHz(bw.nyq)}</td></tr>`;
  }).join('');
  $('cmp').innerHTML = `<thead><tr><th>Scheme</th><th>BER at ${S.eb} dB (per bit)</th><th>BER simulated</th><th>Eb/N0 for BER ${fmtE(S.target)}</th><th>BW<sub>NYQ</sub></th></tr></thead><tbody>${rows}</tbody>`;
}

// ---------- cards, chain, working, status ----------
const NOTE = { wave: '', spec: '', iq: '', ber: '' };
function renderWorking() {
  const k = S.kind, bw = bandwidths(k, S.Rb, df()), g = ebLin(), r = v => `<span class="res">${v}</span>`;
  const L = [];
  L.push(['Bit time', `Tb = 1 / Rb = 1 / ${S.Rb} = ${r((1e3 / S.Rb).toPrecision(3) + ' ms')}`]);
  if (k === 'FSK') {
    L.push(['Nyquist BW', `BW_NYQ = (f1 − f0) + Rb = ${fmtHz(df())} + ${fmtHz(S.Rb)} = ${r(fmtHz(bw.nyq))}`]);
    L.push(['Nominal BW', `BW_NOM = (f1 − f0) + 2·Rb = ${fmtHz(df())} + ${fmtHz(2 * S.Rb)} = ${r(fmtHz(bw.nom))}`]);
  } else if (k === 'QAM') {
    L.push(['Baud rate', `Rs = Rb / k = ${S.Rb} / 4 = ${r(S.Rb / 4 + ' baud')}`]);
    L.push(['Nyquist BW', `BW_NYQ = Rs = ${r(fmtHz(bw.nyq))}`]);
    L.push(['Nominal BW', `BW_NOM = 2·Rs = ${r(fmtHz(bw.nom))}`]);
  } else {
    L.push(['Nyquist BW', `BW_NYQ = Rb = ${r(fmtHz(bw.nyq))}`]);
    L.push(['Nominal BW', `BW_NOM = 2·Rb = ${r(fmtHz(bw.nom))}`]);
  }
  L.push(['Efficiency', `Rb / BW_NYQ = ${S.Rb} / ${bw.nyq} = ${r((S.Rb / bw.nyq).toFixed(2) + ' bit/s/Hz')}`]);
  L.push(['Eb/N0 as a ratio', `10^(${S.eb}/10) = ${r(g.toPrecision(4))}`]);
  let arg, f;
  if (k === 'PSK') { arg = Math.sqrt(2 * g); f = `Pb = Q(√(2·Eb/N0)) = Q(√(2 × ${g.toPrecision(4)}))`; }
  else if (k === 'FSK') { arg = Math.sqrt(g); f = `Pb = Q(√(Eb/N0)) = Q(√${g.toPrecision(4)})`; }
  else if (k === 'QAM') { arg = Math.sqrt(0.8 * g); f = `Pb ≈ (3/4)·Q(√(0.8·Eb/N0)) = ${fmtE(0.75 * Qf(arg))}; exact sum over the 4 levels per axis`; }
  else { arg = Math.sqrt(2 * g) * S.m / (1 + S.m); f = S.m >= 0.999 ? `Pb = Q(√(Eb/(2·N0))) = Q(√(${g.toPrecision(4)} / 2))` : `Pb = Q(√(2·Eb/N0) · m/(1+m)) = Q(√(2 × ${g.toPrecision(4)}) × ${(S.m / (1 + S.m)).toFixed(3)})`; }
  L.push(['Bit error rate', `${f} = ${k === 'QAM' ? '' : `Q(${arg.toFixed(3)}) = `}${r(fmtE(ber(k, S.eb, S.m)))}`]);
  const req = requiredEbN0(k, S.target, S.m);
  L.push(['Needed for target', `BER ${fmtE(S.target)} needs Eb/N0 = ${r(isFinite(req) ? req.toFixed(2) + ' dB' : '—')}`]);
  $('working').innerHTML = L.map(([a, b]) => `<div class="line"><div class="what">${a}</div><div class="math">${b.replace(/BW_NYQ/g, 'BW<sub>NYQ</sub>').replace(/BW_NOM/g, 'BW<sub>NOM</sub>')}</div></div>`).join('');
}
function renderStageHead() {
  const v = S.view, k = S.kind;
  $('stageTitle').textContent = v === 'wave' ? `Waveforms (V), power spectrum (dBW/Hz) and I-Q constellation of ${LABEL[k]}, updating together` : 'Bit error rate vs Eb/N0';
  if (v === 'wave') NOTE.wave = `Bit time T<sub>b</sub> = 1/R<sub>b</sub> = <b>${(1e3 / S.Rb).toPrecision(3)} ms</b>, carrier <b>${fmtHz(fc())}</b>. FSK sends f<sub>0</sub> = <b>${fmtHz(fc() - df() / 2)}</b> for 0 and f<sub>1</sub> = <b>${fmtHz(fc() + df() / 2)}</b> for 1. 16-QAM labels each 4-bit symbol, which lasts <b>${(4e3 / S.Rb).toPrecision(3)} ms</b>.` +
    (S.noise ? ` Purple: the same signals after noise at E<sub>b</sub>/N<sub>0</sub> = <b>${S.eb} dB</b>.` : '') +
    (PAD ? ` <span class="warn">${PAD} zero${PAD > 1 ? 's were' : ' was'} added (grey) to fill whole 16-QAM symbols.</span>` : '');
  if (v === 'ber') {
    const need = KINDS.map(kk => `${LABEL[kk]} ${requiredEbN0(kk, S.target, S.m).toFixed(1)} dB`);
    const rq = kk => requiredEbN0(kk, S.target, S.m);
    NOTE.ber = `The starting settings are the Lecture 7 exercise (slide 9): target BER 4×10⁻⁶ and E<sub>b</sub>/N<sub>0</sub> = 8 dB. Exact theory for coherent detection in AWGN. For this target BER, PSK needs <b>${(rq('FSK') - rq('PSK')).toFixed(1)} dB</b> less than FSK, FSK needs <b>${(rq('ASK') - rq('FSK')).toFixed(1)} dB</b> less than ASK (ASK is compared at the same peak amplitude; the Lecture 7 graph also shows about 3 dB between FSK and ASK), and 16-QAM saves bandwidth but needs <b>${(rq('QAM') - rq('PSK')).toFixed(1)} dB</b> more than PSK. Dots on the target line: <b>${need.join(' · ')}</b>.`;
  }
  const fcWarn = fc() - Math.max(...KINDS.map(kk => bandwidths(kk, S.Rb, df()).nom)) / 2 <= 0;
  $('stageNote').innerHTML = v === 'wave' ? NOTE.wave + '<br>' + NOTE.spec + '<br>' + NOTE.iq + (fcWarn ? ' <span class="warn">Carrier is too low for the widest spectrum; raise fc.</span>' : '') : NOTE.ber;
}

// ---------- playback ----------
function tick(ts) {
  anim.raf = 0;
  if (!S.playing || S.view !== 'wave' || !WV) return;
  if (!anim.last) anim.last = ts;
  const dt = Math.min(0.1, (ts - anim.last) / 1000); anim.last = ts;
  const period = Math.min(12, Math.max(4, WV.bits.length * 0.7));
  anim.t += dt * S.speed / period;
  if (anim.t > 1.12) anim.t = 0;
  drawTime();
  anim.raf = requestAnimationFrame(tick);
}
function ensureAnim() { if (S.playing && S.view === 'wave' && !anim.raf) { anim.last = 0; anim.raf = requestAnimationFrame(tick); } }

// ---------- wiring ----------
function syncUI() {
  for (const b of $('picks').children) b.setAttribute('aria-pressed', String(b.dataset.k === S.kind));
  for (const b of $('views').children) b.setAttribute('aria-pressed', String(b.dataset.v === S.view));
  $('rb').value = S.Rb / 1000; $('rbOut').textContent = fmtBps(S.Rb);
  $('fc').value = S.cpb; $('fcOut').textContent = fmtHz(fc()); $('fcHint').textContent = `${S.cpb} cycles per bit`;
  $('dfn').value = S.dfn; $('dfOut').textContent = fmtHz(df()); $('dfHint').textContent = `${S.dfn} × Rb/2, so the tones are orthogonal`;
  $('m').value = S.m; $('mOut').textContent = S.m.toFixed(2);
  $('eb').value = S.eb; $('ebOut').textContent = S.eb.toFixed(1) + ' dB';
  $('speed').value = S.speed; $('speedOut').textContent = S.speed.toFixed(2).replace(/0$/, '') + '×';
  $('showNoise').checked = S.noise; if ($('bits').value !== S.bits) $('bits').value = S.bits;
  $('playBtn').textContent = S.playing ? 'Pause' : 'Play';
  $('pill').textContent = LABEL[S.kind]; $('pill').style.setProperty('--c', colOf(S.kind)); $('sdesc').textContent = DESC[S.kind];
  $('playback').hidden = S.view !== 'wave';
  $('berExtra').hidden = S.view !== 'ber';
  $('cvTime').hidden = S.view !== 'wave'; $('lower').hidden = S.view !== 'wave'; $('stage').className = 'stage ' + (S.view === 'wave' ? 'two' : 'one'); $('cvBer').hidden = S.view !== 'ber';
  if (document.activeElement !== $('target')) $('target').value = S.target.toExponential(0);
}
let raf = 0;
function update() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderAll(); }); }
function drawAll() { drawTime(); drawSpec(); drawConst(); drawBer(); }
function renderAll() {
  syncUI(); computeWave(); drawAll(); runSim();
  renderStageHead(); renderTable(); renderWorking(); ensureAnim();
}
function redraw() { readColors(); if (!WV) return; drawAll(); }

function init() {
  readColors();
  for (const b of $('picks').children) b.addEventListener('click', () => { S.kind = b.dataset.k; update(); });
  for (const b of $('views').children) b.addEventListener('click', () => { S.view = b.dataset.v; update(); });
  const num = (id, fn) => $(id).addEventListener('input', e => { fn(parseFloat(e.target.value)); update(); });
  num('rb', v => S.Rb = v * 1000);
  num('fc', v => S.cpb = v);
  num('dfn', v => S.dfn = v);
  num('m', v => S.m = v);
  num('eb', v => S.eb = v);
  num('speed', v => S.speed = v);
  $('showNoise').addEventListener('change', e => { S.noise = e.target.checked; update(); });
  $('bits').addEventListener('input', e => { const c = e.target.value.replace(/[^01]/g, '').slice(0, 16); if (c !== e.target.value) e.target.value = c; S.bits = c || '0'; anim.t = 0; update(); });
  $('rand').addEventListener('click', () => { let b = ''; for (let i = 0; i < 8; i++) b += Math.random() < 0.5 ? '0' : '1'; S.bits = b; anim.t = 0; update(); });
  $('target').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0 && v < 0.5) S.target = v; else e.target.value = String(S.target); update(); });
  $('playBtn').addEventListener('click', () => { S.playing = !S.playing; if (S.playing && anim.t >= 1) anim.t = 0; update(); });
  $('restartBtn').addEventListener('click', () => { anim.t = 0; S.playing = true; update(); });
  const refs = $('refs'), open = () => { refs.hidden = false; $('refsClose').focus(); }, close = () => { refs.hidden = true; $('refsBtn').focus(); };
  $('refsBtn').addEventListener('click', open); $('refsClose').addEventListener('click', close);
  refs.addEventListener('click', e => { if (e.target === refs) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !refs.hidden) close(); });
  new ResizeObserver(() => redraw()).observe(document.querySelector('.stage'));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  renderAll();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
