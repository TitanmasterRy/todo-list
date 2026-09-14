export interface Topic {
  id: string;
  title: string;
  subject: 'math' | 'science' | 'writing' | 'study' | 'language' | 'cs';
  emoji: string;
  tags: string[];
  sections: { heading: string; items: string[] }[];
}

export const TOPICS: Topic[] = [
  // ───────────────────────── MATH ─────────────────────────
  {
    id: 'algebra-essentials',
    title: 'Algebra essentials',
    subject: 'math',
    emoji: '🔢',
    tags: ['algebra', 'exponents', 'radicals', 'factoring', 'quadratic', 'discriminant', 'polynomials'],
    sections: [
      {
        heading: 'Exponent rules',
        items: [
          '`a^m · a^n = a^(m+n)` — same base, add exponents',
          '`a^m / a^n = a^(m−n)`',
          '`(a^m)^n = a^(mn)`',
          '`(ab)^n = a^n · b^n` and `(a/b)^n = a^n / b^n`',
          '`a^0 = 1` (for a ≠ 0); `a^(−n) = 1 / a^n`',
          '`a^(1/n) = ⁿ√a`; `a^(m/n) = ⁿ√(a^m)`',
        ],
      },
      {
        heading: 'Radical rules',
        items: [
          '`√(ab) = √a · √b` and `√(a/b) = √a / √b` (a, b ≥ 0)',
          '`√a + √b ≠ √(a+b)` — you cannot split a sum',
          'Simplify by pulling out perfect squares: `√50 = √(25·2) = 5√2`',
          'Rationalize: `1/√a = √a / a`; `1/(a+√b)` multiply by conjugate `(a−√b)/(a−√b)`',
          '`(√a)² = a`; `√(a²) = |a|`',
        ],
      },
      {
        heading: 'Factoring patterns',
        items: [
          'Always pull out the GCF first: `6x² + 9x = 3x(2x + 3)`',
          'Difference of squares: `a² − b² = (a − b)(a + b)`',
          'Perfect square: `a² ± 2ab + b² = (a ± b)²`',
          'Sum of cubes: `a³ + b³ = (a + b)(a² − ab + b²)`',
          'Difference of cubes: `a³ − b³ = (a − b)(a² + ab + b²)`',
          'Trinomial `x² + bx + c`: find two numbers that multiply to c and add to b',
          'Trinomial `ax² + bx + c`: find two numbers that multiply to `ac` and add to b, then factor by grouping',
        ],
      },
      {
        heading: 'Quadratic formula & discriminant',
        items: [
          'For `ax² + bx + c = 0`: `x = (−b ± √(b² − 4ac)) / 2a`',
          'Discriminant `D = b² − 4ac`',
          '`D > 0` → two distinct real roots; `D = 0` → one repeated real root; `D < 0` → two complex roots',
          'Vertex form: `y = a(x − h)² + k`, vertex at `(h, k)`; `h = −b / 2a`',
          'Sum of roots `= −b/a`; product of roots `= c/a`',
          'Complete the square: `x² + bx = (x + b/2)² − (b/2)²`',
        ],
      },
      {
        heading: 'Absolute value & inequalities',
        items: [
          '`|x| = a` → `x = a` or `x = −a`',
          '`|x| < a` → `−a < x < a`; `|x| > a` → `x < −a` or `x > a`',
          'Multiplying or dividing an inequality by a negative flips the sign',
          'Solve rational/quadratic inequalities with a sign chart of the critical points',
        ],
      },
    ],
  },
  {
    id: 'linear-equations-functions',
    title: 'Linear equations & functions',
    subject: 'math',
    emoji: '📈',
    tags: ['linear', 'slope', 'intercept', 'systems', 'functions', 'domain', 'range', 'point-slope'],
    sections: [
      {
        heading: 'Slope & line forms',
        items: [
          'Slope: `m = (y₂ − y₁) / (x₂ − x₁)` = rise / run',
          'Slope-intercept: `y = mx + b` (b = y-intercept)',
          'Point-slope: `y − y₁ = m(x − x₁)`',
          'Standard form: `Ax + By = C`; slope `= −A/B`',
          'Horizontal line `y = c` has slope 0; vertical line `x = c` has undefined slope',
          'Parallel lines: same slope. Perpendicular: slopes multiply to −1 (`m₂ = −1/m₁`)',
        ],
      },
      {
        heading: 'Distance & midpoint',
        items: [
          'Distance: `d = √((x₂ − x₁)² + (y₂ − y₁)²)`',
          'Midpoint: `((x₁ + x₂)/2, (y₁ + y₂)/2)`',
        ],
      },
      {
        heading: 'Systems of equations',
        items: [
          '**Substitution:** solve one equation for a variable, plug into the other',
          '**Elimination:** scale equations so a variable cancels when added',
          'One solution → lines cross; none → parallel (false statement like `0 = 5`); infinite → same line (`0 = 0`)',
          '2×2 by Cramer: `x = (c₁b₂ − c₂b₁) / (a₁b₂ − a₂b₁)` for `a₁x + b₁y = c₁`, `a₂x + b₂y = c₂`',
          'Check the answer in **both** original equations',
        ],
      },
      {
        heading: 'Functions',
        items: [
          'A relation is a function if each input has exactly one output (vertical line test)',
          '**Domain:** allowed x-values (exclude division by zero, even roots of negatives). **Range:** possible outputs',
          'Composition: `(f ∘ g)(x) = f(g(x))` — apply g first',
          'Inverse `f⁻¹`: swap x and y, solve for y; graph reflects over `y = x`',
          'Transformations: `f(x) + k` shifts up; `f(x − h)` shifts right; `a·f(x)` stretches vertically; `f(−x)` reflects over y-axis',
          'Even: `f(−x) = f(x)` (symmetric about y-axis). Odd: `f(−x) = −f(x)` (symmetric about origin)',
        ],
      },
    ],
  },
  {
    id: 'logarithms-exponentials',
    title: 'Logarithms & exponentials',
    subject: 'math',
    emoji: '📉',
    tags: ['log', 'logarithm', 'ln', 'exponential', 'growth', 'decay', 'change of base', 'compound interest'],
    sections: [
      {
        heading: 'Definition',
        items: [
          '`log_b(x) = y` means `b^y = x` (b > 0, b ≠ 1, x > 0)',
          '`log x` usually means base 10; `ln x` means base `e ≈ 2.71828`',
          '`log_b(1) = 0`; `log_b(b) = 1`; `b^(log_b x) = x`; `log_b(b^x) = x`',
          'Logs of zero or negatives are undefined',
        ],
      },
      {
        heading: 'Log rules',
        items: [
          'Product: `log(xy) = log x + log y`',
          'Quotient: `log(x/y) = log x − log y`',
          'Power: `log(x^n) = n · log x`',
          'Change of base: `log_b(x) = ln x / ln b = log x / log b`',
          '`log(x + y)` does **not** simplify',
        ],
      },
      {
        heading: 'Solving equations',
        items: [
          'Exponential `b^x = c`: take log of both sides → `x = log c / log b`',
          'Same base: `b^x = b^y` → `x = y`',
          'Log equation: isolate the log, rewrite as an exponential, then **check for extraneous solutions** (arguments must be positive)',
          'Combine logs into one before exponentiating: `log x + log(x − 3) = 1` → `x(x − 3) = 10`',
        ],
      },
      {
        heading: 'Growth & decay models',
        items: [
          'Continuous: `A = A₀ · e^(kt)` (k > 0 growth, k < 0 decay)',
          'Discrete: `A = A₀ · (1 + r)^t` (r as a decimal)',
          'Compound interest: `A = P(1 + r/n)^(nt)`; continuous: `A = P·e^(rt)`',
          'Half-life: `A = A₀ · (1/2)^(t / t½)`; `k = −ln 2 / t½`',
          'Doubling time: `t = ln 2 / k`',
        ],
      },
    ],
  },
  {
    id: 'trigonometry',
    title: 'Trigonometry',
    subject: 'math',
    emoji: '📐',
    tags: ['trig', 'sine', 'cosine', 'tangent', 'unit circle', 'identities', 'law of sines', 'law of cosines', 'radians'],
    sections: [
      {
        heading: 'Basics',
        items: [
          'SOH-CAH-TOA: `sin = opp/hyp`, `cos = adj/hyp`, `tan = opp/adj`',
          'Reciprocals: `csc = 1/sin`, `sec = 1/cos`, `cot = 1/tan`',
          '`tan θ = sin θ / cos θ`',
          'Radians: `180° = π rad`; degrees → radians multiply by `π/180`',
          'Arc length `s = rθ` (θ in radians); sector area `= ½ r² θ`',
        ],
      },
      {
        heading: 'Unit circle (first quadrant)',
        items: [
          '`0` (0°): sin 0, cos 1, tan 0',
          '`π/6` (30°): sin 1/2, cos √3/2, tan √3/3',
          '`π/4` (45°): sin √2/2, cos √2/2, tan 1',
          '`π/3` (60°): sin √3/2, cos 1/2, tan √3',
          '`π/2` (90°): sin 1, cos 0, tan undefined',
          '`π` (180°): sin 0, cos −1, tan 0; `3π/2` (270°): sin −1, cos 0, tan undefined',
          'Signs by quadrant (**A**ll **S**tudents **T**ake **C**alculus): QI all +, QII sin +, QIII tan +, QIV cos +',
        ],
      },
      {
        heading: 'Identities',
        items: [
          'Pythagorean: `sin²θ + cos²θ = 1`; `1 + tan²θ = sec²θ`; `1 + cot²θ = csc²θ`',
          'Even/odd: `sin(−θ) = −sin θ`; `cos(−θ) = cos θ`; `tan(−θ) = −tan θ`',
          'Cofunction: `sin(π/2 − θ) = cos θ`',
          'Sum: `sin(a ± b) = sin a cos b ± cos a sin b`; `cos(a ± b) = cos a cos b ∓ sin a sin b`',
          'Double angle: `sin 2θ = 2 sin θ cos θ`; `cos 2θ = cos²θ − sin²θ = 2cos²θ − 1 = 1 − 2sin²θ`',
          'Half angle / power reduction: `sin²θ = (1 − cos 2θ)/2`; `cos²θ = (1 + cos 2θ)/2`',
        ],
      },
      {
        heading: 'Any triangle',
        items: [
          'Law of Sines: `a / sin A = b / sin B = c / sin C`',
          'Law of Cosines: `c² = a² + b² − 2ab · cos C`',
          'Area: `½ ab · sin C`',
          'Angles sum to 180°; use Law of Sines for AAS/ASA, Law of Cosines for SAS/SSS',
          'Watch the ambiguous case (SSA) with Law of Sines — two triangles may fit',
        ],
      },
      {
        heading: 'Graphs',
        items: [
          '`y = A sin(B(x − C)) + D`: amplitude |A|, period `2π/B`, phase shift C, midline D',
          'sin and cos have period 2π; tan has period π',
          'Inverse functions: `arcsin` range [−π/2, π/2]; `arccos` range [0, π]; `arctan` range (−π/2, π/2)',
        ],
      },
    ],
  },
  {
    id: 'geometry-formulas',
    title: 'Geometry formulas',
    subject: 'math',
    emoji: '⬡',
    tags: ['geometry', 'area', 'perimeter', 'volume', 'surface area', 'circle', 'pythagorean', 'triangle', 'polygon'],
    sections: [
      {
        heading: 'Triangles',
        items: [
          'Pythagorean theorem (right triangle): `a² + b² = c²`, c = hypotenuse',
          'Common triples: 3-4-5, 5-12-13, 8-15-17, 7-24-25',
          'Special right triangles: 45-45-90 sides `x, x, x√2`; 30-60-90 sides `x, x√3, 2x` (short leg opposite 30°)',
          'Area `= ½ · base · height`; Heron: `√(s(s−a)(s−b)(s−c))`, `s = (a+b+c)/2`',
          'Angles sum to 180°; exterior angle = sum of the two remote interior angles',
          'Triangle inequality: any two sides sum to more than the third',
        ],
      },
      {
        heading: 'Quadrilaterals & polygons',
        items: [
          'Rectangle `A = lw`, `P = 2l + 2w`; square `A = s²`',
          'Parallelogram `A = bh`; trapezoid `A = ½ (b₁ + b₂) h`',
          'Rhombus / kite `A = ½ d₁ d₂` (diagonals)',
          'Interior angle sum of n-gon: `(n − 2) · 180°`; each exterior angle of a regular n-gon: `360°/n`',
          'Regular polygon area `= ½ · apothem · perimeter`',
        ],
      },
      {
        heading: 'Circles',
        items: [
          'Circumference `C = 2πr = πd`; area `A = πr²`',
          'Arc length `= (θ/360°) · 2πr`; sector area `= (θ/360°) · πr²`',
          'Inscribed angle = ½ the central angle on the same arc',
          'Tangent is perpendicular to the radius at the point of tangency',
          'Equation: `(x − h)² + (y − k)² = r²`, center `(h, k)`',
        ],
      },
      {
        heading: 'Solids',
        items: [
          'Rectangular prism `V = lwh`, `SA = 2(lw + lh + wh)`; cube `V = s³`, `SA = 6s²`',
          'Any prism or cylinder `V = (base area) · h`; cylinder `V = πr²h`, `SA = 2πr² + 2πrh`',
          'Any pyramid or cone `V = ⅓ (base area) · h`; cone `V = ⅓ πr²h`, lateral `SA = πr·ℓ` (ℓ = slant height)',
          'Sphere `V = (4/3) πr³`, `SA = 4πr²`',
        ],
      },
      {
        heading: 'Similarity & scale',
        items: [
          'Similar figures: corresponding angles equal, sides in ratio k',
          'Scale factor k → perimeters scale by k, areas by `k²`, volumes by `k³`',
          'Triangle similarity shortcuts: AA, SAS, SSS; congruence: SSS, SAS, ASA, AAS, HL',
        ],
      },
    ],
  },
  {
    id: 'limits-continuity',
    title: 'Limits & continuity',
    subject: 'math',
    emoji: '♾️',
    tags: ['limit', 'continuity', 'calculus', 'asymptote', "l'hopital", 'squeeze', 'infinity'],
    sections: [
      {
        heading: 'Evaluating limits',
        items: [
          '1. Plug in. If you get a number, done',
          '2. `0/0` → factor and cancel, multiply by a conjugate, or simplify a complex fraction',
          '3. `c/0` (c ≠ 0) → vertical asymptote; check one-sided limits for ±∞',
          '`lim (x→a) f(x)` exists only if the left and right limits agree',
          'Limit laws: limits of sums, products, quotients (nonzero denominator) follow the arithmetic',
        ],
      },
      {
        heading: 'Special limits',
        items: [
          '`lim (x→0) sin x / x = 1`',
          '`lim (x→0) (1 − cos x) / x = 0`',
          '`lim (x→0) (e^x − 1) / x = 1`',
          '`lim (n→∞) (1 + 1/n)^n = e`',
          'Squeeze theorem: if `g ≤ f ≤ h` near a and `lim g = lim h = L`, then `lim f = L`',
        ],
      },
      {
        heading: 'Limits at infinity',
        items: [
          'Rational functions: compare degrees of numerator (n) and denominator (d)',
          '`n < d` → limit 0; `n = d` → ratio of leading coefficients; `n > d` → ±∞',
          '`lim (x→∞) 1/xⁿ = 0` for n > 0; `e^(−x) → 0`; `ln x → ∞` slowly',
          'Horizontal asymptote `y = L` when `lim (x→±∞) f(x) = L`',
        ],
      },
      {
        heading: "L'Hôpital's rule",
        items: [
          "If the limit has form `0/0` or `∞/∞`: `lim f/g = lim f'/g'` (when the latter exists)",
          'Rewrite `0·∞` as a quotient, `∞ − ∞` with a common denominator, `1^∞` / `0⁰` / `∞⁰` by taking ln first',
          'Check the indeterminate form **every** time before reapplying',
        ],
      },
      {
        heading: 'Continuity',
        items: [
          'f is continuous at a if: `f(a)` is defined, `lim (x→a) f(x)` exists, and they are equal',
          'Discontinuities: removable (hole), jump (one-sided limits differ), infinite (asymptote)',
          'Polynomials, sin, cos, e^x are continuous everywhere; rational functions where defined',
          'Intermediate Value Theorem: continuous on [a, b] → f takes every value between f(a) and f(b)',
        ],
      },
    ],
  },
  {
    id: 'derivatives',
    title: 'Derivatives',
    subject: 'math',
    emoji: '🧮',
    tags: ['derivative', 'differentiation', 'calculus', 'chain rule', 'product rule', 'quotient rule', 'optimization', 'related rates'],
    sections: [
      {
        heading: 'Definition',
        items: [
          "`f'(x) = lim (h→0) [f(x + h) − f(x)] / h`",
          'Derivative = slope of the tangent line = instantaneous rate of change',
          'Differentiable ⇒ continuous (not the reverse — e.g. `|x|` at 0)',
          'Tangent line at a: `y = f(a) + f\'(a)(x − a)`',
        ],
      },
      {
        heading: 'Rules',
        items: [
          'Power: `d/dx xⁿ = n·xⁿ⁻¹`; constant: `d/dx c = 0`',
          "Sum/difference: `(f ± g)' = f' ± g'`; constant multiple: `(cf)' = c·f'`",
          "Product: `(fg)' = f'g + fg'`",
          "Quotient: `(f/g)' = (f'g − fg') / g²` — \"low d-high minus high d-low, over low squared\"",
          "Chain: `d/dx f(g(x)) = f'(g(x)) · g'(x)` — outside derivative times inside derivative",
          'Implicit: differentiate both sides, attach `dy/dx` to every y-term, solve for `dy/dx`',
          "Inverse: `(f⁻¹)'(x) = 1 / f'(f⁻¹(x))`",
        ],
      },
      {
        heading: 'Common derivatives',
        items: [
          '`sin x → cos x`; `cos x → −sin x`; `tan x → sec²x`',
          '`sec x → sec x tan x`; `csc x → −csc x cot x`; `cot x → −csc²x`',
          '`e^x → e^x`; `a^x → a^x · ln a`',
          '`ln x → 1/x`; `log_a x → 1 / (x ln a)`',
          '`arcsin x → 1/√(1 − x²)`; `arccos x → −1/√(1 − x²)`; `arctan x → 1/(1 + x²)`',
          '`√x → 1/(2√x)`; `1/x → −1/x²`',
        ],
      },
      {
        heading: 'Applications',
        items: [
          "`f' > 0` → increasing; `f' < 0` → decreasing; `f'' > 0` → concave up; `f'' < 0` → concave down",
          "Critical points: `f' = 0` or undefined. Inflection: concavity changes (`f''` changes sign)",
          "First derivative test: `f'` changes + → − is a max, − → + is a min",
          "Second derivative test: at a critical point, `f'' > 0` min, `f'' < 0` max, `f'' = 0` inconclusive",
          'Absolute extrema on [a, b]: compare f at critical points **and** endpoints',
          'Position s(t): velocity `v = s\'`, acceleration `a = v\'`; speed = |v|; speeding up when v and a share a sign',
          'Related rates: write an equation relating the quantities, differentiate with respect to t, then substitute values',
          "Mean Value Theorem: some c in (a, b) has `f'(c) = (f(b) − f(a)) / (b − a)`",
          'Linear approximation: `f(x) ≈ f(a) + f\'(a)(x − a)`',
        ],
      },
    ],
  },
  {
    id: 'integrals',
    title: 'Integrals',
    subject: 'math',
    emoji: '∫',
    tags: ['integral', 'antiderivative', 'calculus', 'u-substitution', 'fundamental theorem', 'area', 'integration by parts', 'riemann'],
    sections: [
      {
        heading: 'Rules',
        items: [
          '`∫ xⁿ dx = xⁿ⁺¹ / (n + 1) + C` (n ≠ −1); `∫ 1/x dx = ln|x| + C`',
          '`∫ (f ± g) dx = ∫ f dx ± ∫ g dx`; `∫ c·f dx = c ∫ f dx`',
          '`∫ₐᵃ f = 0`; `∫ₐᵇ f = −∫ᵦᵃ f`; `∫ₐᵇ f = ∫ₐᶜ f + ∫꜀ᵇ f`',
          'Always add `+ C` to an indefinite integral',
        ],
      },
      {
        heading: 'Common antiderivatives',
        items: [
          '`∫ e^x dx = e^x + C`; `∫ a^x dx = a^x / ln a + C`',
          '`∫ sin x dx = −cos x + C`; `∫ cos x dx = sin x + C`',
          '`∫ sec²x dx = tan x + C`; `∫ sec x tan x dx = sec x + C`',
          '`∫ tan x dx = −ln|cos x| + C = ln|sec x| + C`',
          '`∫ 1/(1 + x²) dx = arctan x + C`; `∫ 1/√(1 − x²) dx = arcsin x + C`',
          '`∫ 1/(a² + x²) dx = (1/a) arctan(x/a) + C`',
          '`∫ ln x dx = x ln x − x + C`',
        ],
      },
      {
        heading: 'Fundamental Theorem of Calculus',
        items: [
          'Part 1: if `F(x) = ∫ₐˣ f(t) dt`, then `F\'(x) = f(x)`',
          'Chain version: `d/dx ∫ₐ^(g(x)) f(t) dt = f(g(x)) · g\'(x)`',
          'Part 2: `∫ₐᵇ f(x) dx = F(b) − F(a)` where `F\' = f`',
          'Net change: `∫ₐᵇ v(t) dt` = displacement; `∫ₐᵇ |v(t)| dt` = total distance',
          'Average value of f on [a, b]: `(1 / (b − a)) ∫ₐᵇ f(x) dx`',
        ],
      },
      {
        heading: 'u-substitution',
        items: [
          'Pick u = the "inside" function; compute `du = u\'(x) dx`',
          'Rewrite the whole integrand in u — no leftover x allowed',
          'For definite integrals, change the limits: `x = a → u = u(a)`',
          'Example: `∫ 2x·cos(x²) dx`, `u = x²`, `du = 2x dx` → `∫ cos u du = sin(x²) + C`',
          'Look for a function and (a constant multiple of) its derivative',
        ],
      },
      {
        heading: 'Other techniques',
        items: [
          'By parts: `∫ u dv = uv − ∫ v du`; choose u by LIATE (Log, Inverse trig, Algebraic, Trig, Exponential)',
          'Partial fractions for rational functions with factorable denominators',
          'Trig identities to reduce powers: `sin²x = (1 − cos 2x)/2`',
          'Riemann sums approximate area; `Δx = (b − a)/n`; left/right/midpoint/trapezoid rules',
        ],
      },
      {
        heading: 'Area & volume',
        items: [
          'Area between curves: `∫ₐᵇ (top − bottom) dx` or `∫ (right − left) dy`',
          'Disk: `V = π ∫ r² dx`; washer: `V = π ∫ (R² − r²) dx`',
          'Shell: `V = 2π ∫ (radius)(height) dx`',
          'Known cross-sections: `V = ∫ A(x) dx`',
        ],
      },
    ],
  },
  {
    id: 'statistics-probability',
    title: 'Statistics & probability basics',
    subject: 'math',
    emoji: '🎲',
    tags: ['statistics', 'stats', 'probability', 'mean', 'median', 'standard deviation', 'z-score', 'combinations', 'permutations', 'normal'],
    sections: [
      {
        heading: 'Center & spread',
        items: [
          'Mean `x̄ = Σx / n`; median = middle value (average of the two middles if n is even); mode = most frequent',
          'Range = max − min; IQR = Q3 − Q1; outlier if below `Q1 − 1.5·IQR` or above `Q3 + 1.5·IQR`',
          'Population variance `σ² = Σ(x − μ)² / N`; sample variance `s² = Σ(x − x̄)² / (n − 1)`',
          'Standard deviation = √variance (same units as the data)',
          'Skewed right → mean > median (tail pulls the mean); skewed left → mean < median',
        ],
      },
      {
        heading: 'Normal distribution & z-scores',
        items: [
          'z-score: `z = (x − μ) / σ` — number of standard deviations from the mean',
          'Empirical rule: ~68% within 1σ, ~95% within 2σ, ~99.7% within 3σ',
          'Convert a value to z, then use a table/calculator for the percentile',
          'Unstandardize: `x = μ + z·σ`',
          'Sampling distribution of the mean: `μ_x̄ = μ`, `σ_x̄ = σ / √n` (Central Limit Theorem: approx. normal for large n)',
        ],
      },
      {
        heading: 'Probability rules',
        items: [
          '`0 ≤ P(A) ≤ 1`; `P(not A) = 1 − P(A)`',
          'Addition: `P(A or B) = P(A) + P(B) − P(A and B)`; mutually exclusive → `P(A and B) = 0`',
          'Multiplication: `P(A and B) = P(A) · P(B | A)`; independent → `P(A and B) = P(A) · P(B)`',
          'Conditional: `P(A | B) = P(A and B) / P(B)`',
          'Independence check: `P(A | B) = P(A)`',
          'Expected value: `E[X] = Σ x · P(x)`',
        ],
      },
      {
        heading: 'Counting',
        items: [
          'Fundamental counting principle: multiply the number of choices at each step',
          'Permutations (order matters): `nPr = n! / (n − r)!`',
          'Combinations (order does not matter): `nCr = n! / (r!(n − r)!)`',
          '`0! = 1`; `nC0 = nCn = 1`; `nCr = nC(n−r)`',
          'Binomial probability: `P(k successes in n) = nCk · pᵏ · (1 − p)ⁿ⁻ᵏ`; mean `np`, SD `√(np(1 − p))`',
        ],
      },
      {
        heading: 'Data & inference basics',
        items: [
          'Correlation r in [−1, 1] measures linear strength; correlation ≠ causation',
          'Least-squares line `ŷ = a + bx`, slope `b = r · s_y / s_x`; residual = actual − predicted',
          'Confidence interval = estimate ± (critical value)(standard error)',
          'p-value < α (usually 0.05) → reject H₀; it is the probability of data this extreme if H₀ is true',
          'Random sampling reduces bias; larger samples reduce variability',
        ],
      },
    ],
  },
  // ───────────────────────── SCIENCE ─────────────────────────
  {
    id: 'physics-kinematics-newton',
    title: "Physics: kinematics & Newton's laws",
    subject: 'science',
    emoji: '🚀',
    tags: ['physics', 'kinematics', 'newton', 'force', 'motion', 'acceleration', 'velocity', 'projectile', 'friction', 'free body'],
    sections: [
      {
        heading: 'Kinematics (constant acceleration)',
        items: [
          '`v = v₀ + at` — v final velocity, v₀ initial velocity, a acceleration, t time',
          '`Δx = v₀t + ½at²` — Δx displacement',
          '`v² = v₀² + 2aΔx`',
          '`Δx = ½(v₀ + v)t` (average velocity × time)',
          'Average velocity `= Δx / Δt`; average acceleration `= Δv / Δt`',
          'Free fall: `a = −g`, `g ≈ 9.8 m/s²` downward; at the top of a throw v = 0 but a = g',
          'Graphs: slope of x–t = velocity; slope of v–t = acceleration; area under v–t = displacement',
        ],
      },
      {
        heading: 'Projectiles',
        items: [
          'Split into components: `v₀ₓ = v₀ cos θ`, `v₀ᵧ = v₀ sin θ`',
          'Horizontal: constant velocity, `x = v₀ₓ t`. Vertical: `a = −g`',
          'Time of flight (level ground): `t = 2v₀ᵧ / g`; max height `= v₀ᵧ² / 2g`',
          'Range (level ground): `R = v₀² sin(2θ) / g`, max at 45°',
          'Time is the link between the x and y equations',
        ],
      },
      {
        heading: "Newton's laws",
        items: [
          '1st: an object keeps its velocity unless a net force acts (inertia)',
          '2nd: `ΣF = ma` — net force in newtons (`1 N = 1 kg·m/s²`)',
          '3rd: forces come in equal and opposite pairs acting on **different** objects',
          'Weight `W = mg`; mass is in kg, weight is a force in N',
          'Equilibrium: `ΣF = 0` → constant velocity (which may be zero)',
        ],
      },
      {
        heading: 'Common forces',
        items: [
          'Normal force: perpendicular to the surface; on flat ground with no other vertical forces `N = mg`',
          'On an incline of angle θ: `N = mg cos θ`, component along slope `= mg sin θ`',
          'Kinetic friction `f_k = μ_k N`; static friction `f_s ≤ μ_s N` (adjusts up to its max)',
          'Tension is the same throughout an ideal (massless) rope',
          'Spring (Hooke): `F = −kx`',
          'Gravity between masses: `F = G m₁m₂ / r²`, `G = 6.67×10⁻¹¹ N·m²/kg²`',
        ],
      },
      {
        heading: 'Problem-solving steps',
        items: [
          'Draw a free-body diagram for each object; label every force',
          'Choose axes (along the incline when there is one)',
          'Write `ΣFₓ = maₓ` and `ΣFᵧ = maᵧ` separately',
          'Connected objects share the same acceleration magnitude',
          'Check units and whether the sign/direction makes sense',
        ],
      },
    ],
  },
  {
    id: 'physics-energy-momentum-circular',
    title: 'Physics: energy, momentum, circular motion',
    subject: 'science',
    emoji: '⚡',
    tags: ['physics', 'energy', 'work', 'power', 'momentum', 'impulse', 'collision', 'circular motion', 'centripetal', 'conservation'],
    sections: [
      {
        heading: 'Work & energy',
        items: [
          'Work `W = F d cos θ` (θ between force and displacement); unit joule `J = N·m`',
          'Kinetic energy `KE = ½mv²`',
          'Gravitational PE (near Earth) `PE = mgh`; spring PE `= ½kx²`',
          'Work–energy theorem: `W_net = ΔKE`',
          'Conservation (no friction): `KE₁ + PE₁ = KE₂ + PE₂`; with friction add `W_friction` (energy lost as heat)',
          'Power `P = W / t = F v`; unit watt `W = J/s`',
        ],
      },
      {
        heading: 'Momentum & impulse',
        items: [
          'Momentum `p = mv` (vector, kg·m/s)',
          'Impulse `J = F Δt = Δp`',
          'Conservation of momentum (no external net force): `m₁v₁ + m₂v₂ = m₁v₁\' + m₂v₂\'`',
          'Elastic collision: momentum **and** KE conserved',
          'Inelastic: momentum conserved, KE not; perfectly inelastic → objects stick, `(m₁ + m₂)v\'`',
          'Explosions/recoil: total momentum stays zero if it started at zero',
        ],
      },
      {
        heading: 'Uniform circular motion',
        items: [
          'Centripetal acceleration `a_c = v² / r`, directed toward the center',
          'Centripetal force `F_c = mv² / r` — provided by tension, gravity, friction, normal force, etc. (not a separate force)',
          'Period T and frequency f: `f = 1/T`; speed `v = 2πr / T`',
          'Top of a vertical loop (minimum speed): `v = √(gr)` when N = 0',
          'Orbits: `GMm / r² = mv² / r` → `v = √(GM / r)`',
        ],
      },
      {
        heading: 'Rotation (intro)',
        items: [
          'Angular: `θ` (rad), `ω = Δθ/Δt` (rad/s), `α = Δω/Δt`; `v = rω`, `a_t = rα`',
          'Torque `τ = r F sin θ`; `Στ = Iα`',
          'Rotational KE `= ½Iω²`; angular momentum `L = Iω` (conserved with no external torque)',
        ],
      },
    ],
  },
  {
    id: 'chemistry-moles-stoichiometry-gases',
    title: 'Chemistry: moles, stoichiometry, gas laws, molarity',
    subject: 'science',
    emoji: '⚗️',
    tags: ['chemistry', 'mole', 'stoichiometry', 'gas laws', 'ideal gas', 'molarity', 'concentration', 'limiting reagent', 'percent yield', 'dilution'],
    sections: [
      {
        heading: 'The mole',
        items: [
          "1 mol = `6.022 × 10²³` particles (Avogadro's number)",
          'Molar mass (g/mol) = sum of atomic masses from the periodic table',
          '`moles = mass / molar mass`; `mass = moles × molar mass`',
          'At STP (0 °C, 1 atm) 1 mol of ideal gas occupies `22.4 L`',
          'Percent composition = (mass of element in 1 mol / molar mass) × 100%',
          'Empirical formula: convert % to grams → moles → divide by smallest → whole-number ratio',
        ],
      },
      {
        heading: 'Stoichiometry',
        items: [
          'Balance the equation first — coefficients give mole ratios',
          'Path: grams A → mol A → mol B (ratio) → grams B',
          'Limiting reagent: compute product from each reactant; the smaller amount wins',
          'Theoretical yield = product from the limiting reagent',
          'Percent yield `= actual / theoretical × 100%`',
        ],
      },
      {
        heading: 'Gas laws',
        items: [
          'Ideal gas: `PV = nRT`, `R = 0.08206 L·atm/(mol·K)` or `8.314 J/(mol·K)`; **T in kelvin** (`K = °C + 273.15`)',
          "Boyle: `P₁V₁ = P₂V₂` (constant T); Charles: `V₁/T₁ = V₂/T₂` (constant P); Gay-Lussac: `P₁/T₁ = P₂/T₂`",
          'Combined: `P₁V₁/T₁ = P₂V₂/T₂`',
          "Dalton: `P_total = P₁ + P₂ + …`; partial pressure `Pᵢ = xᵢ · P_total`",
          'Density of a gas: `d = PM / RT` (M = molar mass)',
          '`1 atm = 760 mmHg = 760 torr = 101.325 kPa`',
        ],
      },
      {
        heading: 'Solutions',
        items: [
          'Molarity `M = moles of solute / liters of solution`',
          'Dilution: `M₁V₁ = M₂V₂`',
          'Molality `m = moles solute / kg solvent`',
          'Titration at equivalence: `moles acid = moles base` (adjust for polyprotic acids); `M_a V_a = M_b V_b` for 1:1',
          'pH `= −log[H⁺]`; `[H⁺][OH⁻] = 1.0 × 10⁻¹⁴` at 25 °C; `pH + pOH = 14`',
        ],
      },
    ],
  },
  {
    id: 'chemistry-periodic-trends-bonding',
    title: 'Chemistry: periodic trends & bonding basics',
    subject: 'science',
    emoji: '🧪',
    tags: ['chemistry', 'periodic table', 'trends', 'electronegativity', 'ionization', 'bonding', 'ionic', 'covalent', 'lewis', 'vsepr', 'polarity'],
    sections: [
      {
        heading: 'Periodic trends',
        items: [
          'Atomic radius: **increases** down a group, **decreases** left → right',
          'Ionization energy: decreases down, increases left → right (noble gases highest)',
          'Electronegativity: decreases down, increases left → right (F highest at 4.0; noble gases usually excluded)',
          'Electron affinity: generally more negative (stronger) toward the upper right (halogens)',
          'Metallic character: increases down and to the left',
          'Cations are smaller than their atoms; anions are larger',
        ],
      },
      {
        heading: 'Electron configuration',
        items: [
          'Fill order: `1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p …`',
          'Subshell capacities: s 2, p 6, d 10, f 14',
          'Valence electrons = group number for main-group elements (1, 2, then 13–18 → 3–8)',
          'Exceptions: Cr `[Ar] 4s¹3d⁵`, Cu `[Ar] 4s¹3d¹⁰`',
          "Hund's rule: fill each orbital singly before pairing; Pauli: max 2 electrons per orbital, opposite spins",
        ],
      },
      {
        heading: 'Bond types',
        items: [
          'Ionic: metal + nonmetal, electrons transferred; ΔEN roughly > 1.7; high melting points, conduct when molten/dissolved',
          'Covalent: nonmetals share electrons; polar if ΔEN ≈ 0.4–1.7, nonpolar if < 0.4',
          'Metallic: sea of delocalized electrons; malleable, conductive',
          'Bond strength: triple > double > single; bond length: single > double > triple',
          'Ionic compounds are named cation then anion (NaCl sodium chloride); use Roman numerals for transition-metal charges',
        ],
      },
      {
        heading: 'Lewis structures & VSEPR',
        items: [
          'Count total valence electrons; least electronegative atom is central (never H)',
          'Form single bonds, fill octets on outer atoms, put leftovers on the central atom; make multiple bonds if needed',
          'Formal charge `= valence − nonbonding − ½ bonding`; prefer structures with charges near 0',
          '2 domains: linear 180°; 3: trigonal planar 120°; 4: tetrahedral 109.5°',
          '4 domains with 1 lone pair: trigonal pyramidal (~107°); with 2 lone pairs: bent (~104.5°)',
          '5 domains: trigonal bipyramidal (90°/120°); 6: octahedral (90°)',
          'Molecule is polar if bond dipoles do not cancel (asymmetric shape or lone pairs on the central atom)',
        ],
      },
      {
        heading: 'Intermolecular forces',
        items: [
          'London dispersion (all molecules; grows with size) < dipole–dipole < hydrogen bonding (H bonded to N, O, or F)',
          'Stronger IMFs → higher boiling point, higher viscosity, lower vapor pressure',
          '"Like dissolves like": polar solvents dissolve polar/ionic solutes',
        ],
      },
    ],
  },
  {
    id: 'biology-cell-genetics',
    title: 'Biology: cell & genetics basics',
    subject: 'science',
    emoji: '🧬',
    tags: ['biology', 'cell', 'genetics', 'punnett', 'dna', 'rna', 'protein', 'transcription', 'translation', 'mitosis', 'meiosis', 'organelles'],
    sections: [
      {
        heading: 'Cell structure',
        items: [
          'Prokaryotes (bacteria): no nucleus or membrane-bound organelles. Eukaryotes: nucleus + organelles',
          'Nucleus stores DNA; ribosomes build proteins; rough ER (with ribosomes) processes proteins; smooth ER makes lipids',
          'Golgi packages and ships proteins; lysosomes digest; mitochondria make ATP (cellular respiration)',
          'Plant-only: cell wall (cellulose), chloroplasts (photosynthesis), large central vacuole',
          'Cell membrane: phospholipid bilayer, selectively permeable',
          'Transport: diffusion & osmosis (passive, high → low); active transport needs ATP (low → high)',
        ],
      },
      {
        heading: 'Energy',
        items: [
          'Photosynthesis: `6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂` (chloroplast)',
          'Cellular respiration: `C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP` (glycolysis in cytoplasm → Krebs cycle → electron transport chain in mitochondria)',
          'Aerobic yields ~30–38 ATP per glucose; anaerobic (fermentation) yields 2 ATP',
        ],
      },
      {
        heading: 'Cell division',
        items: [
          'Mitosis: 1 division → 2 identical diploid cells (growth, repair). PMAT: prophase, metaphase, anaphase, telophase',
          'Meiosis: 2 divisions → 4 genetically different haploid gametes; crossing over in prophase I',
          'Humans: 46 chromosomes (diploid, 2n); gametes have 23 (haploid, n)',
          'Cell cycle: G1 → S (DNA replication) → G2 → M',
        ],
      },
      {
        heading: 'DNA → RNA → protein',
        items: [
          'DNA bases pair A–T, C–G; RNA uses U instead of T (so DNA A pairs with RNA U)',
          '**Transcription** (nucleus): DNA template → mRNA by RNA polymerase',
          '**Translation** (ribosome): mRNA codons (3 bases) → amino acids via tRNA anticodons',
          'Start codon AUG (methionine); stop codons UAA, UAG, UGA',
          'DNA replication is semiconservative; DNA polymerase builds 5\' → 3\'',
          'Mutations: point (substitution), frameshift (insertion/deletion); silent, missense, nonsense',
        ],
      },
      {
        heading: 'Mendelian genetics & Punnett squares',
        items: [
          'Genotype = alleles (Aa); phenotype = trait shown. Dominant (A) masks recessive (a)',
          'Homozygous AA or aa; heterozygous Aa',
          'Monohybrid Aa × Aa → genotypes 1 AA : 2 Aa : 1 aa; phenotypes 3 dominant : 1 recessive',
          'Test cross: unknown × aa; any recessive offspring means the unknown is Aa',
          'Dihybrid AaBb × AaBb → 9:3:3:1 phenotype ratio (independent assortment)',
          'Incomplete dominance: blended (red × white → pink). Codominance: both shown (AB blood)',
          'X-linked recessive traits (e.g. color blindness) appear more in males; carrier mothers pass to sons',
          'Pedigrees: circle = female, square = male, shaded = affected',
        ],
      },
    ],
  },
  // ───────────────────────── WRITING ─────────────────────────
  {
    id: 'essay-structure-thesis',
    title: 'Essay structure & thesis statements',
    subject: 'writing',
    emoji: '✍️',
    tags: ['essay', 'thesis', 'writing', 'paragraph', 'argument', 'introduction', 'conclusion', 'evidence', 'outline'],
    sections: [
      {
        heading: 'Thesis statements',
        items: [
          'A thesis is a **debatable claim** + the **reasons** — not a topic or a fact',
          'Weak: "This essay is about social media." Strong: "Schools should limit phone use because it improves focus and reduces anxiety."',
          'Template: "[Subject] [does/should X] because [reason 1], [reason 2], and [reason 3]."',
          'Put it at the end of the introduction; every body paragraph should support it',
          'Revise the thesis after drafting — the essay you wrote may have a sharper claim than the one you planned',
        ],
      },
      {
        heading: 'Structure',
        items: [
          'Introduction: hook → context → thesis',
          'Body paragraphs (PEEL): **P**oint (topic sentence) → **E**vidence (quote/data) → **E**xplanation (how it proves the point) → **L**ink back to the thesis',
          'One idea per paragraph; the topic sentence should be a mini-claim, not a fact',
          'Counterargument paragraph: state the strongest opposing view fairly, then rebut it',
          'Conclusion: restate the thesis in new words, synthesize the points, end with a "so what" — no new evidence',
        ],
      },
      {
        heading: 'Using evidence',
        items: [
          'Sandwich quotes: introduce → quote → explain. Never let a quote stand alone',
          'Keep quotes short; paraphrase when the wording itself does not matter',
          'Explanation should be at least as long as the quote',
          'Cite every quote, paraphrase, and statistic',
        ],
      },
      {
        heading: 'Transitions',
        items: [
          'Add: furthermore, in addition, similarly',
          'Contrast: however, in contrast, although, whereas',
          'Cause/effect: therefore, consequently, as a result',
          'Example: for instance, specifically, to illustrate',
          'Sequence: first, then, finally',
        ],
      },
      {
        heading: 'Process',
        items: [
          'Outline before drafting: thesis + 3 topic sentences + evidence for each',
          'Draft fast, then revise in passes: argument → paragraph order → sentences → proofreading',
          'Read it aloud to catch clunky sentences',
          'Cut "In this essay I will…", "very", "really", "thing", and passive voice where the actor matters',
        ],
      },
    ],
  },
  {
    id: 'citations-mla-apa',
    title: 'Citations: MLA 9 & APA 7',
    subject: 'writing',
    emoji: '📚',
    tags: ['citation', 'mla', 'apa', 'works cited', 'references', 'bibliography', 'in-text', 'plagiarism'],
    sections: [
      {
        heading: 'MLA 9 in-text',
        items: [
          'Author + page, no comma: `(Smith 42)`',
          'Author named in sentence: `Smith argues that … (42)`',
          'Two authors: `(Smith and Lee 42)`; three or more: `(Smith et al. 42)`',
          'No author: shortened title in quotes or italics: `("Climate Report" 3)`',
          'No page numbers (websites): just the author `(Smith)`',
        ],
      },
      {
        heading: 'MLA 9 Works Cited',
        items: [
          'Pattern: Author. *Title of Source*. *Container*, Other contributors, Version, Number, Publisher, Date, Location.',
          'Book: `Last, First. *Title of Book*. Publisher, Year.`',
          'Journal article: `Last, First. "Article Title." *Journal Name*, vol. 12, no. 3, 2020, pp. 45–67. DOI or URL.`',
          'Website: `Last, First. "Page Title." *Site Name*, Day Mon. Year, URL. Accessed Day Mon. Year.`',
          'Alphabetize by author last name; hanging indent (0.5 in); double-space; title the page "Works Cited"',
          'Italicize containers (books, journals, sites); quote smaller pieces (articles, pages, chapters)',
        ],
      },
      {
        heading: 'APA 7 in-text',
        items: [
          'Author–date: `(Smith, 2020)`; with a direct quote add the page: `(Smith, 2020, p. 42)`',
          'Narrative: `Smith (2020) found that …`',
          'Two authors: `(Smith & Lee, 2020)`; three or more: `(Smith et al., 2020)` from the first citation',
          'No author: `("Title of Page," 2020)`; no date: `(Smith, n.d.)`',
          'Group author: `(World Health Organization [WHO], 2020)` then `(WHO, 2020)`',
        ],
      },
      {
        heading: 'APA 7 References',
        items: [
          'Book: `Last, F. M. (Year). *Title of book: Subtitle in sentence case*. Publisher.`',
          'Journal article: `Last, F. M., & Last, F. M. (Year). Article title in sentence case. *Journal Name, 12*(3), 45–67. https://doi.org/xxxx`',
          'Website: `Last, F. M. (Year, Month Day). *Page title*. Site Name. URL`',
          'Title the page "References"; alphabetize; hanging indent; double-space',
          'Sentence case for article/book titles (only first word, proper nouns, and after a colon capitalized); journal names in Title Case and italics',
          'Include the DOI as a URL when available; no "Retrieved from" unless the page changes over time',
        ],
      },
      {
        heading: 'General rules',
        items: [
          'Every in-text citation must match one entry in the reference list and vice versa',
          'Cite paraphrases, not just quotes; common knowledge does not need a citation',
          'Quotes longer than 4 lines (MLA) or 40 words (APA) become an indented block without quotation marks',
          'Use a citation generator, then **check it** against the pattern — generators mangle capitalization and dates',
        ],
      },
    ],
  },
  {
    id: 'grammar-style-quick-fixes',
    title: 'Grammar & style quick fixes',
    subject: 'writing',
    emoji: '🔤',
    tags: ['grammar', 'style', 'punctuation', 'comma', 'semicolon', 'apostrophe', 'passive voice', 'proofreading', 'usage'],
    sections: [
      {
        heading: 'Commas',
        items: [
          'Before a coordinating conjunction (FANBOYS) joining two full sentences: "I studied, but I still felt unsure."',
          'After an introductory phrase: "After the exam, we left."',
          'Around nonessential info: "My brother, who lives in Ohio, called."',
          'In lists (use the Oxford comma for clarity): "eggs, milk, and bread"',
          'Comma splice = two sentences joined by only a comma → fix with a period, semicolon, or conjunction',
        ],
      },
      {
        heading: 'Semicolons, colons, apostrophes',
        items: [
          'Semicolon joins two related complete sentences: "It rained; we stayed in."',
          'Colon introduces a list or explanation after a **complete** sentence: "Bring three things: a pen, paper, and ID."',
          "Apostrophe for possession (the dog's bone; the students' books) and contractions (it's = it is)",
          "`its` = possessive; `it's` = it is. `their/there/they're`, `your/you're`, `whose/who's`",
          'No apostrophe for plurals: "the 1990s", "three cats"',
        ],
      },
      {
        heading: 'Sentence-level errors',
        items: [
          'Fragment: missing a subject or verb ("Because it was late.") → attach it to a sentence',
          'Run-on: two sentences with no punctuation → split or join correctly',
          'Subject–verb agreement: ignore phrases between them ("The box of apples **is** heavy")',
          'Pronoun agreement: "Each student must bring **their** own" is accepted; avoid vague "this" or "it" without a noun',
          'Dangling modifier: "Running late, the bus was missed" → "Running late, I missed the bus"',
          'Parallel structure: "reading, writing, and **to study**" → "reading, writing, and studying"',
        ],
      },
      {
        heading: 'Style',
        items: [
          'Prefer active voice: "The team won the game" not "The game was won by the team"',
          'Cut filler: very, really, basically, in order to, due to the fact that (→ because)',
          'Replace weak verb + noun with a strong verb: "made a decision" → "decided"',
          'Vary sentence length; one short sentence after a long one lands',
          'Use specific nouns and concrete details instead of "things" and "stuff"',
          'Formal writing: no contractions, no second person ("you"), spell out numbers under ten',
        ],
      },
      {
        heading: 'Commonly confused',
        items: [
          '`affect` (verb, to influence) / `effect` (noun, a result)',
          '`than` (comparison) / `then` (time)',
          '`fewer` (countable) / `less` (uncountable)',
          '`lie` (recline; lay/lain) / `lay` (put something down; laid)',
          '`e.g.` = for example; `i.e.` = that is',
          '`who` (subject) / `whom` (object — if you can answer with "him", use whom)',
        ],
      },
    ],
  },
  // ───────────────────────── STUDY ─────────────────────────
  {
    id: 'study-techniques',
    title: 'Study techniques',
    subject: 'study',
    emoji: '🧠',
    tags: ['study', 'active recall', 'spaced repetition', 'pomodoro', 'interleaving', 'flashcards', 'notes', 'memory', 'focus'],
    sections: [
      {
        heading: 'Active recall',
        items: [
          'Test yourself from memory instead of rereading — retrieval is what strengthens memory',
          'Close the book and write everything you remember, then check and fill gaps',
          'Turn headings into questions and answer them out loud',
          'Flashcards: question on the front, short answer on the back; say the answer **before** flipping',
          'Teach it to someone (or a rubber duck) — gaps in your explanation are gaps in your knowledge',
          'Highlighting and rereading feel productive but are among the weakest methods',
        ],
      },
      {
        heading: 'Spaced repetition schedule',
        items: [
          'Review at growing intervals: same day → 1 day → 3 days → 1 week → 2 weeks → 1 month',
          'Cards you miss go back to the start of the ladder; cards you nail move up',
          'For a test in 2 weeks: study day 1, review days 2, 4, 8, 13',
          '10 minutes of review spread over 5 days beats 50 minutes the night before',
          'Keep a running "still shaky" list and hit it every session',
        ],
      },
      {
        heading: 'Pomodoro',
        items: [
          '25 min focused work → 5 min break; after 4 rounds take a 15–30 min break',
          'One task per pomodoro; write down distractions instead of acting on them',
          'Phone in another room or on Do Not Disturb; close unrelated tabs',
          'Adjust the length (e.g. 50/10) once you know your focus span',
          'Track pomodoros per day to estimate future assignments realistically',
        ],
      },
      {
        heading: 'Interleaving & elaboration',
        items: [
          'Mix problem types in one session (e.g. derivatives + integrals) so you practice choosing the method',
          'Alternate subjects across the week instead of one marathon per subject',
          'Ask "why?" and "how does this connect to…?" — link new ideas to what you already know',
          'Make concrete examples for abstract ideas',
          'Dual coding: draw a diagram, timeline, or table alongside the words',
        ],
      },
      {
        heading: 'Notes & environment',
        items: [
          'Cornell notes: cue column (questions) + notes column + summary at the bottom; cover the notes and answer the cues',
          'Rewrite notes in your own words within 24 hours',
          'Same place, same time each day builds the habit; start with the hardest task (eat the frog)',
          'Sleep consolidates memory — all-nighters lose more than they gain',
          'Set a specific goal per session: "do problems 1–15" not "study math"',
        ],
      },
    ],
  },
  {
    id: 'test-taking-strategies',
    title: 'Test-taking strategies',
    subject: 'study',
    emoji: '📝',
    tags: ['test', 'exam', 'quiz', 'strategy', 'multiple choice', 'anxiety', 'time management', 'free response', 'essay exam'],
    sections: [
      {
        heading: 'Before the test',
        items: [
          'Finish new studying 1–2 days before; the last day is for review and self-testing',
          'Do a full practice test under timed conditions',
          'Sleep 7–9 hours; eat breakfast with protein; arrive early',
          'Pack: pencils, calculator (charged, allowed model), ID, water',
          'Make a one-page "brain dump" sheet of formulas and write it from memory the morning of',
        ],
      },
      {
        heading: 'Time management',
        items: [
          'Skim the whole test first; note point values and plan minutes per section',
          'Do the easy questions first — bank points, build confidence, warm up',
          'Mark hard ones and come back; never sit stuck on one question for 5+ minutes',
          'Leave 5 minutes at the end to check for skipped questions and blank answers',
          'Watch the clock at planned checkpoints, not constantly',
        ],
      },
      {
        heading: 'Multiple choice',
        items: [
          'Cover the choices, answer in your head, then look for the match',
          'Eliminate clearly wrong answers first; guess among the rest (unless there is a guessing penalty)',
          'Read every choice — "all of the above" and "best answer" questions punish stopping early',
          'Watch for absolutes (always, never) — often wrong; hedged answers (usually, most) — often right',
          'Underline "NOT", "EXCEPT", "LEAST" in the stem',
          'Change an answer only if you have a concrete reason; first instinct is usually fine',
        ],
      },
      {
        heading: 'Free response & math',
        items: [
          'Restate what is given and what is asked; draw a diagram',
          'Show every step — partial credit is real; box the final answer with units',
          'Check: does the sign, magnitude, and unit make sense? Plug back in',
          'If stuck, write down the relevant formula and what you would do — earns method marks',
          'Essay prompts: outline for 2–3 minutes; thesis first; one clear point per paragraph; answer the actual question',
        ],
      },
      {
        heading: 'Managing nerves',
        items: [
          'Slow breathing: in 4, hold 4, out 6, repeat three times',
          'If you blank, move on — retrieval often works once you relax',
          'Reframe: nerves are energy; a little arousal improves performance',
          'After the test, note which question types cost you points and adjust how you study',
        ],
      },
    ],
  },
  {
    id: 'si-units-conversions',
    title: 'SI units & conversions',
    subject: 'science',
    emoji: '📏',
    tags: ['units', 'si', 'metric', 'conversion', 'prefix', 'dimensional analysis', 'significant figures', 'scientific notation'],
    sections: [
      {
        heading: 'Base units',
        items: [
          'Length meter (m); mass kilogram (kg); time second (s); temperature kelvin (K)',
          'Amount mole (mol); electric current ampere (A); luminous intensity candela (cd)',
          'Derived: newton `N = kg·m/s²`; joule `J = N·m`; watt `W = J/s`; pascal `Pa = N/m²`; volt `V = J/C`; hertz `Hz = 1/s`',
        ],
      },
      {
        heading: 'Prefixes',
        items: [
          'giga G `10⁹`; mega M `10⁶`; kilo k `10³`; hecto h `10²`; deka da `10¹`',
          'deci d `10⁻¹`; centi c `10⁻²`; milli m `10⁻³`; micro µ `10⁻⁶`; nano n `10⁻⁹`; pico p `10⁻¹²`',
          'Ladder: k h da (base) d c m — each step is ×10; move the decimal that many places',
          '`1 km = 1000 m`; `1 m = 100 cm = 1000 mm`; `1 L = 1000 mL`; `1 kg = 1000 g`',
          '`1 mL = 1 cm³`; `1 L = 1 dm³ = 1000 cm³`',
        ],
      },
      {
        heading: 'Common conversions',
        items: [
          '`1 in = 2.54 cm` (exact); `1 ft = 0.3048 m`; `1 mi = 1.609 km`',
          '`1 lb = 0.4536 kg`; `1 kg = 2.205 lb`',
          '`1 gal (US) = 3.785 L`',
          '`1 cal = 4.184 J`; `1 kWh = 3.6 × 10⁶ J`',
          '`1 atm = 101.325 kPa = 760 mmHg`',
          'Temperature: `K = °C + 273.15`; `°F = 1.8·°C + 32`; `°C = (°F − 32) / 1.8`',
          'Speed: `1 m/s = 3.6 km/h`; `1 mph ≈ 1.609 km/h ≈ 0.447 m/s`',
        ],
      },
      {
        heading: 'Dimensional analysis',
        items: [
          'Multiply by fractions equal to 1 so unwanted units cancel: `50 km/h × (1000 m / 1 km) × (1 h / 3600 s) = 13.9 m/s`',
          'Write units on every number; cancel diagonally; the leftover units must match the answer',
          'Squared/cubed units convert the factor squared/cubed: `1 m² = 10⁴ cm²`, `1 m³ = 10⁶ cm³`',
        ],
      },
      {
        heading: 'Significant figures & notation',
        items: [
          'Nonzero digits and zeros between them are significant; leading zeros are not; trailing zeros count only with a decimal point',
          'Multiply/divide: answer has as many sig figs as the least precise input',
          'Add/subtract: answer has as many decimal places as the least precise input',
          'Scientific notation `a × 10ⁿ` with `1 ≤ a < 10`; `0.00042 = 4.2 × 10⁻⁴`',
          'Round only at the end; keep extra digits in intermediate steps',
        ],
      },
    ],
  },
  // ───────────────────────── CS ─────────────────────────
  {
    id: 'programming-basics',
    title: 'Programming basics',
    subject: 'cs',
    emoji: '💻',
    tags: ['programming', 'coding', 'big-o', 'complexity', 'algorithms', 'debugging', 'python', 'java', 'loops', 'recursion', 'data structures'],
    sections: [
      {
        heading: 'Big-O cheat list',
        items: [
          '`O(1)` constant: array index, hash map get/put (average), stack push/pop',
          '`O(log n)`: binary search on sorted data, balanced BST operations, heap insert/remove',
          '`O(n)`: single loop, linear search, sum of a list, hash map building',
          '`O(n log n)`: merge sort, heap sort, quicksort (average), sorting then scanning',
          '`O(n²)`: nested loops over the same data, bubble/insertion/selection sort, quicksort (worst)',
          '`O(2ⁿ)`: naive recursive Fibonacci, subsets; `O(n!)`: permutations',
          'Drop constants and lower terms: `3n² + 10n → O(n²)`; nested loop over n and m → `O(nm)`',
        ],
      },
      {
        heading: 'Data structures',
        items: [
          'Array/list: fast index, slow insert in the middle `O(n)`',
          'Linked list: `O(1)` insert/delete at a known node, `O(n)` search',
          'Stack (LIFO): undo, matching parentheses, DFS. Queue (FIFO): BFS, scheduling',
          'Hash map / dictionary: key → value in `O(1)` average; use for counting and lookups',
          'Set: membership test `O(1)`; dedupe',
          'Binary search tree: sorted order, `O(log n)` if balanced; heap: fast min/max',
        ],
      },
      {
        heading: 'Common patterns',
        items: [
          'Two pointers / sliding window for sorted arrays and substrings',
          'Counting with a hash map: `counts[x] = counts.get(x, 0) + 1`',
          'Accumulator: initialize result, loop, update, return',
          'Recursion: base case first, then the recursive case that shrinks the problem; trust the recursive call',
          'Binary search: `lo`, `hi`, `mid = (lo + hi) // 2`; move the bound that excludes the target',
          'BFS uses a queue (shortest path in unweighted graphs); DFS uses a stack or recursion',
          'Memoization: cache results of expensive pure function calls (turns exponential into polynomial)',
        ],
      },
      {
        heading: 'Debugging steps',
        items: [
          'Read the error message and the line number — it is usually right',
          'Reproduce with the smallest input that fails',
          'Print (or watch) variables at the point of failure; check types and off-by-one bounds',
          'Binary search the bug: comment out or bypass half the code',
          'Explain the code line by line out loud (rubber duck)',
          'Common culprits: `=` vs `==`, integer division, mutating a list while iterating, indexes starting at 0, `None`/`null`, wrong indentation/braces',
          'After fixing, add a test for that input',
        ],
      },
      {
        heading: 'Good habits',
        items: [
          'Run the smallest piece first; build up incrementally',
          'Name things by what they hold (`totalScore`, not `x`); functions do one thing',
          'Write the test cases before or alongside the code: normal, edge (empty, one item), and invalid inputs',
          'Commit often with messages that say why',
          'Read documentation for the exact function signature before guessing',
        ],
      },
    ],
  },
  // ───────────────────────── LANGUAGE ─────────────────────────
  {
    id: 'spanish-french-essentials',
    title: 'Spanish & French essentials',
    subject: 'language',
    emoji: '🗣️',
    tags: ['spanish', 'french', 'language', 'conjugation', 'verbs', 'accents', 'grammar', 'vocabulary', 'ser', 'estar', 'être', 'avoir'],
    sections: [
      {
        heading: 'Spanish: regular present tense',
        items: [
          '-ar (hablar): habl**o**, habl**as**, habl**a**, habl**amos**, habl**áis**, habl**an**',
          '-er (comer): com**o**, com**es**, com**e**, com**emos**, com**éis**, com**en**',
          '-ir (vivir): viv**o**, viv**es**, viv**e**, viv**imos**, viv**ís**, viv**en**',
          'Stem changers (e→ie, o→ue, e→i) change in all forms **except** nosotros/vosotros: pienso, piensas … pensamos',
          'Key irregulars: ser (soy, eres, es, somos, sois, son); estar (estoy, estás, está, estamos, estáis, están); tener (tengo, tienes …); ir (voy, vas, va, vamos, vais, van)',
          'ser = permanent/identity/time/origin; estar = location/condition/ongoing action (estoy comiendo)',
        ],
      },
      {
        heading: 'Spanish: past & future',
        items: [
          'Preterite (completed): -ar `-é, -aste, -ó, -amos, -asteis, -aron`; -er/-ir `-í, -iste, -ió, -imos, -isteis, -ieron`',
          'Imperfect (ongoing/habitual): -ar `-aba, -abas, -aba, -ábamos, -abais, -aban`; -er/-ir `-ía, -ías, -ía, -íamos, -íais, -ían`; irregulars only ser (era), ir (iba), ver (veía)',
          'Future: infinitive + `-é, -ás, -á, -emos, -éis, -án`; near future: ir a + infinitive',
          'Accents in preterite (habló, comí) distinguish tense — hablo (I speak) vs habló (he spoke)',
        ],
      },
      {
        heading: 'Spanish: accents & agreement',
        items: [
          'Words ending in a vowel, n, or s stress the second-to-last syllable; others stress the last; a written accent marks any exception',
          'Accents also distinguish words: `él/el`, `tú/tu`, `sí/si`, `qué/que` (question words always carry accents)',
          'Adjectives agree in gender and number and usually follow the noun: la casa blanca, los libros rojos',
          'Nouns ending in -o are usually masculine, -a feminine (exceptions: el día, la mano, el problema)',
        ],
      },
      {
        heading: 'French: regular present tense',
        items: [
          '-er (parler): parl**e**, parl**es**, parl**e**, parl**ons**, parl**ez**, parl**ent**',
          '-ir (finir): fin**is**, fin**is**, fin**it**, fin**issons**, fin**issez**, fin**issent**',
          '-re (vendre): vend**s**, vend**s**, vend, vend**ons**, vend**ez**, vend**ent**',
          'Key irregulars: être (suis, es, est, sommes, êtes, sont); avoir (ai, as, a, avons, avez, ont); aller (vais, vas, va, allons, allez, vont); faire (fais, fais, fait, faisons, faites, font)',
          'Negation wraps the verb: `ne … pas` (je ne parle pas)',
        ],
      },
      {
        heading: 'French: past & future',
        items: [
          'Passé composé = avoir/être (present) + past participle: -er → -é (parlé), -ir → -i (fini), -re → -u (vendu)',
          'Use être with movement/change verbs (aller, venir, arriver, partir, naître, mourir …) and reflexives; the participle agrees with the subject (elle est allée)',
          'Imparfait: nous-form stem + `-ais, -ais, -ait, -ions, -iez, -aient` (only être is irregular: ét-)',
          'Futur simple: infinitive (drop final e for -re) + `-ai, -as, -a, -ons, -ez, -ont`; near future: aller + infinitive',
        ],
      },
      {
        heading: 'French: accents & agreement',
        items: [
          'é (acute) = "ay" sound; è/ê (grave/circumflex) = "eh"; ç makes a soft s before a, o, u (garçon); ï/ë split vowels (naïve)',
          'Accents can change meaning: `a` (has) / `à` (to); `ou` (or) / `où` (where)',
          'Adjectives agree: add -e for feminine, -s for plural (petit, petite, petits, petites); most follow the noun, but BAGS adjectives (beauty, age, goodness, size) go before',
          'Articles: le/la/les (the), un/une/des (a/some); du/de la/des (some, partitive)',
        ],
      },
      {
        heading: 'Study tips for languages',
        items: [
          'Say the vocabulary out loud; record yourself and compare with a native speaker',
          'Learn verbs with a full conjugation chart, not one form at a time',
          'Practice with short daily sessions; label objects around your room',
          'Write 3 sentences per day using new words; get corrections',
        ],
      },
    ],
  },
];

function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s\-']/gu, ' ').replace(/\s+/g, ' ').trim();
}

function stripMarkdown(s: string): string {
  return s.replace(/[*`_]/g, '');
}

function scoreTopic(topic: Topic, terms: string[]): number {
  const title = topic.title.toLowerCase();
  const tags = topic.tags.map((t) => t.toLowerCase());
  const headings = topic.sections.map((s) => s.heading.toLowerCase());
  const items = topic.sections.flatMap((s) => s.items.map((i) => stripMarkdown(i).toLowerCase()));
  const subject = topic.subject.toLowerCase();
  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    if (title === term) termScore += 100;
    else if (title.startsWith(term)) termScore += 60;
    else if (title.includes(term)) termScore += 40;
    if (tags.some((t) => t === term)) termScore += 30;
    else if (tags.some((t) => t.startsWith(term))) termScore += 20;
    else if (tags.some((t) => t.includes(term))) termScore += 12;
    if (subject === term) termScore += 15;
    if (headings.some((h) => h.includes(term))) termScore += 10;
    const itemHits = items.filter((i) => i.includes(term)).length;
    termScore += Math.min(itemHits, 8);
    if (termScore === 0) return 0; // every term must match somewhere
    score += termScore;
  }
  return score;
}

export function searchTopics(query: string): Topic[] {
  const q = normalizeQuery(query ?? '');
  if (!q) return TOPICS.slice();
  const terms = q.split(' ').filter(Boolean);
  const scored = TOPICS.map((topic, index) => ({ topic, index, score: scoreTopic(topic, terms) })).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((s) => s.topic);
}
