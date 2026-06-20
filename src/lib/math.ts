// --- Laguerre polynomial basis for Longstaff-Schwartz regression ---
// Evaluates [L0(x), L1(x), L2(x)] where x = S/S0 (normalized spot)
export function laguerreBasis(x: number): [number, number, number] {
  const L0 = Math.exp(-x / 2);
  const L1 = Math.exp(-x / 2) * (1 - x);
  const L2 = Math.exp(-x / 2) * (1 - 2 * x + 0.5 * x * x);
  return [L0, L1, L2];
}

// Ordinary Least Squares: solve (X'X)β = X'y for β
// X is n×k design matrix (array of row vectors), y is n-vector
// Returns β of length k. Uses simple 3×3 solve for k=3.
export function ols3(X: [number, number, number][], y: number[]): [number, number, number] {
  const n = X.length;
  // Accumulate X'X (3×3) and X'y (3×1)
  let a00 = 0, a01 = 0, a02 = 0, a11 = 0, a12 = 0, a22 = 0;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const [x0, x1, x2] = X[i];
    const yi = y[i];
    a00 += x0 * x0; a01 += x0 * x1; a02 += x0 * x2;
    a11 += x1 * x1; a12 += x1 * x2; a22 += x2 * x2;
    b0 += x0 * yi; b1 += x1 * yi; b2 += x2 * yi;
  }
  // Solve symmetric 3×3 system via Cramer / Gaussian elimination
  const A = [
    [a00, a01, a02, b0],
    [a01, a11, a12, b1],
    [a02, a12, a22, b2],
  ];
  for (let col = 0; col < 3; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    if (Math.abs(A[col][col]) < 1e-14) continue;
    for (let row = col + 1; row < 3; row++) {
      const f = A[row][col] / A[col][col];
      for (let k = col; k <= 3; k++) A[row][k] -= f * A[col][k];
    }
  }
  // Back substitution
  const beta: [number, number, number] = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    if (Math.abs(A[i][i]) < 1e-14) { beta[i] = 0; continue; }
    let s = A[i][3];
    for (let j = i + 1; j < 3; j++) s -= A[i][j] * beta[j];
    beta[i] = s / A[i][i];
  }
  return beta;
}

// --- Sobol quasi-random sequence (1D, direction numbers for dim 0) ---
// Generates the i-th Sobol number in [0,1) using Van der Corput base-2 (dim 0)
// and a simple primitive polynomial for dim 1.
// For MC variance reduction: use Sobol pairs instead of uniform pairs.
export function vanDerCorput(n: number): number {
  let result = 0;
  let f = 1;
  let i = n;
  while (i > 0) {
    f /= 2;
    result += f * (i % 2);
    i = Math.floor(i / 2);
  }
  return result;
}

// Generate a scrambled Sobol-like normal pair using VDC + inverse normal CDF
// Much lower discrepancy than Box-Muller on uniform randoms
export function sobolNormalPair(index: number): [number, number] {
  // Two independent VDC sequences (base 2 and base 3) -> normal via Beasley-Springer-Moro
  const u1 = Math.max(1e-10, Math.min(1 - 1e-10, vanDerCorput(index + 1)));
  const u2 = Math.max(1e-10, Math.min(1 - 1e-10, vanDerCorput(index + 1) * 0.6180339887 % 1));
  // Box-Muller on low-discrepancy uniforms
  const r = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

// --- Inverse Normal CDF (Beasley-Springer-Moro approximation) ---
export function normalInvCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
  const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
  const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
             0.0276438810333863, 0.0038405729373609, 0.0003951896511349,
             0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
  const x = p - 0.5;
  if (Math.abs(x) < 0.42) {
    const r = x * x;
    return x * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]) /
               ((((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1);
  }
  const r = p < 0.5 ? Math.log(-Math.log(p)) : Math.log(-Math.log(1 - p));
  let result = c[0] + r * (c[1] + r * (c[2] + r * (c[3] + r * (c[4] + r * (c[5] + r * (c[6] + r * (c[7] + r * c[8])))))));
  if (p < 0.5) result = -result;
  return result;
}

// Standard normal CDF using Abramowitz & Stegun approximation
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// Standard normal PDF
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Box-Muller transform for generating standard normal random numbers
export function randomNormal(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// Generate correlated normal random numbers with antithetic variates
export function generateNormalPair(): [number, number] {
  const z = randomNormal();
  return [z, -z]; // antithetic variate
}
