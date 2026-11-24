// ===== Shift Keying Lab: math core (ASK, FSK, PSK and 16-QAM) =====
// Carrier amplitude A = 1 V into 1 ohm. Eb = (average power) x Tb, and PSK, FSK and 16-QAM all use 0.5 W average power.
// ASK is referenced to its full amplitude (Eb = A^2 Tb / 2), so on average on-off keying uses half of that.

// ---------- Gaussian tail ----------
function erfc(x) {                       // Numerical Recipes erfcc, fractional error < 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
const Qf = x => 0.5 * erfc(x / Math.SQRT2);       // Q(x) = P(standard normal > x)
const popcount = n => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };

// ---------- 16-QAM: Gray coded, 2 bits per axis, average symbol energy normalised to 1 ----------
const GRAY2 = [0, 1, 3, 2];                       // level index 0..3 -> 2-bit Gray code
const QAM_SC = 1 / Math.sqrt(10);                 // levels are -3,-1,+1,+3 times this
const qamLevel = j => (2 * j - 3) * QAM_SC;
function qamSymbol(v) {                           // v = 4 bits: high 2 bits set I, low 2 bits set Q
  return { i: qamLevel(GRAY2.indexOf(v >> 2)), q: qamLevel(GRAY2.indexOf(v & 3)) };
}
function berQAM(g) {                              // exact bit error rate, Gray 16-QAM, g = Eb/N0 (ratio)
  const sigma = Math.sqrt(1 / (2 * 4 * g));       // Es = 1, k = 4 bits per symbol
  let tot = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    if (i === j) continue;
    const xi = qamLevel(i), lo = j === 0 ? -Infinity : qamLevel(j) - QAM_SC, hi = j === 3 ? Infinity : qamLevel(j) + QAM_SC;
    const P = (lo === -Infinity ? 1 : Qf((lo - xi) / sigma)) - (hi === Infinity ? 0 : Qf((hi - xi) / sigma));
    tot += P * popcount(GRAY2[i] ^ GRAY2[j]);
  }
  return tot / 8;                                 // 4 levels x 2 bits per axis
}

// ---------- BER (coherent detection, AWGN) ----------
// PSK: Pb = Q( sqrt(2 Eb/N0) )   FSK: Pb = Q( sqrt(Eb/N0) )   ASK (m = 1, OOK): Pb = Q( sqrt(Eb/(2 N0)) )
// ASK with index m: Pb = Q( sqrt(2 Eb/N0) * m/(1+m) )          16-QAM: exact sum over decision steps (berQAM)
function ber(kind, ebn0dB, m) {
  const g = Math.pow(10, ebn0dB / 10);
  if (kind === 'PSK') return Qf(Math.sqrt(2 * g));
  if (kind === 'FSK') return Qf(Math.sqrt(g));
  if (kind === 'QAM') return berQAM(g);
  return Qf(Math.sqrt(2 * g) * m / (1 + m));
}
function requiredEbN0(kind, target, m) {          // smallest Eb/N0 (dB) giving BER <= target
  let lo = -10, hi = 60;
  if (ber(kind, hi, m) > target) return NaN;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (ber(kind, mid, m) > target) lo = mid; else hi = mid; }
  return hi;
}

// ---------- bandwidth (Lectures 7 and 8) ----------
// ASK, PSK: BW_NYQ = Rb, BW_NOM = 2 Rb.   FSK: BW_NYQ = (f1 - f0) + Rb, BW_NOM = (f1 - f0) + 2 Rb.
// 16-QAM: 4 bits per symbol, so baud rate Rs = Rb/4 and BW_NYQ = Rs, BW_NOM = 2 Rs.
function bandwidths(kind, Rb, df) {
  if (kind === 'FSK') return { nyq: df + Rb, nom: df + 2 * Rb };
  if (kind === 'QAM') return { nyq: Rb / 4, nom: Rb / 2 };
  return { nyq: Rb, nom: 2 * Rb };
}

// ---------- random numbers ----------
function makeRng(seed) {                          // mulberry32 + Box-Muller (repeatable)
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let spare = null;
  const g = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let x; do { x = u(); } while (x <= 1e-300);
    const r = Math.sqrt(-2 * Math.log(x)), th = 2 * Math.PI * u();
    spare = r * Math.sin(th); return r * Math.cos(th);
  };
  return { u, g };
}

// ---------- Monte Carlo: BER = bit errors / total bits (Lecture 6). Returns the number of bit errors. ----------
// Correlator outputs in signal space, scaled so that sqrt(Eb) = 1 for PSK/FSK/ASK; noise std per dimension = sqrt(N0/2).
function simulate(kind, nBits, ebn0dB, m, rng) {
  const g = Math.pow(10, ebn0dB / 10);
  if (kind === 'QAM') {
    const s = Math.sqrt(1 / (2 * 4 * g)), nSym = Math.floor(nBits / 4);
    const slice = x => { const j = Math.round((x / QAM_SC + 3) / 2); return j < 0 ? 0 : j > 3 ? 3 : j; };
    let err = 0;
    for (let n = 0; n < nSym; n++) {
      const v = Math.floor(rng.u() * 16), p = qamSymbol(v);
      const vr = (GRAY2[slice(p.i + s * rng.g())] << 2) | GRAY2[slice(p.q + s * rng.g())];
      err += popcount(v ^ vr);
    }
    return err;
  }
  const s = Math.sqrt(1 / (2 * g)), a0 = (1 - m) / (1 + m), th = (1 + a0) / 2;
  let err = 0;
  for (let i = 0; i < nBits; i++) {
    const b = rng.u() < 0.5 ? 1 : 0;
    let d;
    if (kind === 'PSK') d = ((b ? 1 : -1) + s * rng.g()) > 0 ? 1 : 0;
    else if (kind === 'FSK') { const r1 = (b ? 1 : 0) + s * rng.g(), r0 = (b ? 0 : 1) + s * rng.g(); d = r1 > r0 ? 1 : 0; }
    else d = ((b ? 1 : a0) + s * rng.g()) > th ? 1 : 0;
    if (d !== b) err++;
  }
  return err;
}

// ---------- waveforms ----------
// p = { Rb, fc, df, m }. FSK: f0 = fc - df/2 (0), f1 = fc + df/2 (1). PSK: 1 -> 0 deg, 0 -> 180 deg.
// ASK: 1 -> A, 0 -> A(1-m)/(1+m). 16-QAM: s(t) = I cos(wc t) - Q sin(wc t), one symbol per 4 bits (bits.length must be a multiple of 4).
function amplitudeOf(kind, b, m) { return kind === 'ASK' ? (b ? 1 : (1 - m) / (1 + m)) : kind === 'PSK' ? (b ? 1 : -1) : 1; }
function waveform(kind, bits, p, fs, noise, rngSeed) {
  const Tb = 1 / p.Rb, N = Math.round(bits.length * Tb * fs);
  const y = new Float32Array(N), clean = new Float32Array(N);
  const wc = 2 * Math.PI * p.fc, w0 = 2 * Math.PI * (p.fc - p.df / 2), w1 = 2 * Math.PI * (p.fc + p.df / 2);
  let L = 1, sc = 0, bI, bQ, aI = 0, aQ = 0, rng;
  if (noise) {                                    // band-pass noise of power N0*Bn around fc
    rng = makeRng(rngSeed);
    L = Math.max(1, Math.round(fs / noise.Bn)); sc = Math.sqrt(noise.N0 * noise.Bn);
    bI = new Float64Array(L); bQ = new Float64Array(L);
    for (let i = 0; i < L; i++) { bI[i] = rng.g(); bQ[i] = rng.g(); aI += bI[i]; aQ += bQ[i]; }
  }
  const nSym = Math.floor(bits.length / 4);
  for (let n = 0; n < N; n++) {
    const t = n / fs;
    let v;
    if (kind === 'QAM') {
      const s = Math.min(nSym - 1, Math.floor(t / (4 * Tb))), q = qamSymbol(bits[4 * s] * 8 + bits[4 * s + 1] * 4 + bits[4 * s + 2] * 2 + bits[4 * s + 3]);
      v = q.i * Math.cos(wc * t) - q.q * Math.sin(wc * t);
    } else {
      const idx = Math.min(bits.length - 1, Math.floor(t / Tb)), b = bits[idx];
      if (p.nReal !== undefined && idx >= p.nReal) v = 0;               // padding bits are not sent (only 16-QAM needs them)
      else v = kind === 'FSK' ? Math.cos((b ? w1 : w0) * t) : amplitudeOf(kind, b, p.m) * Math.cos(wc * t);
    }
    clean[n] = v;
    if (noise) {
      const j = n % L, gi = rng.g(), gq = rng.g();
      aI += gi - bI[j]; aQ += gq - bQ[j]; bI[j] = gi; bQ[j] = gq;
      v += sc * (aI / Math.sqrt(L) * Math.cos(wc * t) - aQ / Math.sqrt(L) * Math.sin(wc * t));
    }
    y[n] = v;
  }
  return { y, clean, N };
}

// ---------- spectrum ----------
function fft(re, im) {                            // in-place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
// PSD of the complex envelope x(t) for random data (Welch, Hann window). The real carrier Re{x e^{j 2 pi fc t}}
// has one-sided PSD 0.5 [ Sx(f - fc) + Sx(-f - fc) ] in W/Hz.
function envelopePSD(kind, p, seed) {
  const rng = makeRng(seed), sr = kind === 'QAM' ? p.Rb / 4 : p.Rb;        // symbol rate
  let fsb = 16 * sr; if (kind === 'FSK') fsb = Math.max(fsb, 4 * (p.df + 8 * p.Rb));
  const spb = Math.max(8, Math.round(fsb / sr)); fsb = spb * sr;
  let nfft = 1; while (nfft < 16 * spb) nfft <<= 1;
  const nSym = Math.max(Math.ceil(8 * nfft / spb), Math.min(3000, Math.floor(400000 / spb)));
  const N = nSym * spb, re = new Float64Array(N), im = new Float64Array(N);
  for (let k = 0; k < nSym; k++) {
    let a = 0, b2 = 0, v = 0;
    if (kind === 'QAM') { const q = qamSymbol(Math.floor(rng.u() * 16)); a = q.i; b2 = q.q; }
    else { v = rng.u() < 0.5 ? 1 : 0; if (kind !== 'FSK') a = amplitudeOf(kind, v, p.m); }
    for (let n = k * spb; n < (k + 1) * spb; n++) {
      if (kind === 'FSK') { const ph = (v ? 1 : -1) * Math.PI * p.df * n / fsb; re[n] = Math.cos(ph); im[n] = Math.sin(ph); }
      else { re[n] = a; im[n] = b2; }
    }
  }
  const w = new Float64Array(nfft); let U = 0;
  for (let i = 0; i < nfft; i++) { w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / nfft); U += w[i] * w[i]; }
  const S = new Float64Array(nfft), br = new Float64Array(nfft), bi = new Float64Array(nfft);
  let segs = 0;
  for (let st = 0; st + nfft <= N; st += nfft / 2) {
    for (let i = 0; i < nfft; i++) { br[i] = re[st + i] * w[i]; bi[i] = im[st + i] * w[i]; }
    fft(br, bi);
    for (let i = 0; i < nfft; i++) S[(i + nfft / 2) % nfft] += br[i] * br[i] + bi[i] * bi[i];
    segs++;
  }
  const sc = 1 / (fsb * U * segs), df = fsb / nfft;
  for (let i = 0; i < nfft; i++) S[i] *= sc;
  return { S, df, nfft, f: i => (i - nfft / 2) * df };
}

// ---------- I-Q constellation (signal space) ----------
// ASK and PSK: points on the I axis, scaled so that sqrt(Eb) = 1 (peak amplitude for ASK). FSK: the two orthogonal tones are the two axes.
// 16-QAM: average symbol energy 1. Noise is Gaussian with standard deviation sqrt(N0/2) on each axis, in the same units.
// The receiver picks the nearest ideal point. Returns the ideal points and, for nSym random symbols, the received points.
function constellation(kind, ebn0dB, m, nSym, rng) {
  const g = Math.pow(10, ebn0dB / 10);
  let ideal, sigma = Math.sqrt(1 / (2 * g));
  if (kind === 'PSK') ideal = [{ x: -1, y: 0, bits: '0' }, { x: 1, y: 0, bits: '1' }];
  else if (kind === 'FSK') ideal = [{ x: 1, y: 0, bits: '0' }, { x: 0, y: 1, bits: '1' }];
  else if (kind === 'ASK') { const a0 = (1 - m) / (1 + m); ideal = [{ x: a0, y: 0, bits: '0' }, { x: 1, y: 0, bits: '1' }]; }
  else {
    ideal = []; sigma = Math.sqrt(1 / (8 * g));                       // Es = 4 Eb for 4 bits per symbol
    for (let v = 0; v < 16; v++) { const q = qamSymbol(v); ideal.push({ x: q.i, y: q.q, bits: v.toString(2).padStart(4, '0') }); }
  }
  const rx = new Float32Array(nSym), ry = new Float32Array(nSym), bad = new Uint8Array(nSym);
  let errs = 0;
  for (let n = 0; n < nSym; n++) {
    const t = Math.floor(rng.u() * ideal.length), p = ideal[t];
    const x = p.x + sigma * rng.g(), y = p.y + sigma * rng.g();
    let best = 0, bd = Infinity;
    for (let j = 0; j < ideal.length; j++) { const d = (x - ideal[j].x) ** 2 + (y - ideal[j].y) ** 2; if (d < bd) { bd = d; best = j; } }
    rx[n] = x; ry[n] = y; if (best !== t) { bad[n] = 1; errs++; }
  }
  return { ideal, rx, ry, bad, errs, nSym, sigma };
}
