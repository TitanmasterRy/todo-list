export interface Topic {
  id: string;
  title: string;
  subject: 'math' | 'science' | 'writing' | 'study' | 'language' | 'cs';
  emoji: string;
  tags: string[];
  sections: { heading: string; items: string[] }[];
  /** Fully worked examples with real numbers, textbook style. */
  examples?: { problem: string; steps: string[]; answer: string }[];
  /** Paragraph-length explanations of *why* the rules work. */
  deeper?: { heading: string; text: string }[];
  /** Free OpenStax textbooks that cover the topic in depth. */
  textbook?: { title: string; url: string; chapter?: string }[];
}

const BASE_TOPICS: Topic[] = [
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

// ───────────────────────── TEXTBOOK-LEVEL DEPTH ─────────────────────────
// Worked examples, "why it works" explanations and links to free OpenStax
// textbooks. Kept separate from the quick-reference sections above so the
// cheat-sheet stays scannable; merged into TOPICS below.

type Depth = Required<Pick<Topic, 'examples' | 'deeper' | 'textbook'>>;

const OSX = 'https://openstax.org/details/books/';
const PDF = 'free PDF on the book page';

const DEPTH: Record<string, Depth> = {
  'algebra-essentials': {
    examples: [
      {
        problem: 'Factor 2x² + 7x + 3.',
        steps: [
          'a = 2, b = 7, c = 3, so ac = 6. Find two numbers that multiply to 6 and add to 7: 6 and 1.',
          'Split the middle term: 2x² + 6x + x + 3.',
          'Group: 2x(x + 3) + 1(x + 3).',
          'Factor out the common binomial: (2x + 1)(x + 3).',
          'Check by expanding: 2x² + 6x + x + 3 = 2x² + 7x + 3 ✓',
        ],
        answer: '(2x + 1)(x + 3)',
      },
      {
        problem: 'Solve 3x² − 5x − 2 = 0.',
        steps: [
          'a = 3, b = −5, c = −2. Discriminant D = b² − 4ac = 25 − 4(3)(−2) = 25 + 24 = 49.',
          'D > 0 and is a perfect square, so there are two rational roots.',
          'x = (5 ± √49) / (2·3) = (5 ± 7) / 6.',
          'x = 12/6 = 2 or x = −2/6 = −1/3.',
          'Check x = 2: 3(4) − 10 − 2 = 0 ✓. Check x = −1/3: 3(1/9) + 5/3 − 2 = 1/3 + 5/3 − 6/3 = 0 ✓',
        ],
        answer: 'x = 2 or x = −1/3',
      },
      {
        problem: 'Simplify (2x³y⁻²)² / (4x⁴y).',
        steps: [
          'Apply the power to each factor in the numerator: 2² · x⁶ · y⁻⁴ = 4x⁶y⁻⁴.',
          'Divide coefficients: 4/4 = 1.',
          'Subtract exponents for each base: x^(6−4) = x², y^(−4−1) = y⁻⁵.',
          'Rewrite the negative exponent as a reciprocal: x² / y⁵.',
        ],
        answer: 'x² / y⁵',
      },
      {
        problem: 'Solve |2x − 3| ≤ 7.',
        steps: [
          '|expression| ≤ 7 means −7 ≤ expression ≤ 7.',
          '−7 ≤ 2x − 3 ≤ 7.',
          'Add 3 everywhere: −4 ≤ 2x ≤ 10.',
          'Divide by 2 (positive, so the signs stay): −2 ≤ x ≤ 5.',
        ],
        answer: '−2 ≤ x ≤ 5, or [−2, 5]',
      },
    ],
    deeper: [
      {
        heading: 'Why factoring solves equations',
        text: 'Factoring works because of the zero-product property: if a product of two real numbers is zero, at least one of the factors must be zero. That is why we always move everything to one side to get "= 0" before factoring; an equation like (x − 2)(x + 5) = 3 tells you nothing useful, but (x − 2)(x + 5) = 0 splits cleanly into x = 2 or x = −5. Factoring is just undoing the distributive property, so any factorization can be checked by multiplying it back out. If a quadratic will not factor with integers, the discriminant tells you why: the roots are irrational or complex, and the quadratic formula is the tool to use.',
      },
      {
        heading: 'Where the quadratic formula comes from',
        text: 'The quadratic formula is completing the square done once, in general. Start with ax² + bx + c = 0, divide by a, and move the constant over: x² + (b/a)x = −c/a. Add (b/2a)² to both sides so the left becomes a perfect square, (x + b/2a)² = b²/4a² − c/a = (b² − 4ac)/4a². Take square roots and solve for x, and the formula falls out. The expression under the root, b² − 4ac, is the discriminant: it is the only part that can be negative, which is exactly why it decides whether the roots are real or complex, and whether they are distinct or repeated.',
      },
      {
        heading: 'Why the exponent rules are what they are',
        text: 'Every exponent rule is a shortcut for counting factors. a³ · a² is (a·a·a)(a·a), five factors of a, so exponents add. (a³)² is (a·a·a)(a·a·a), six factors, so exponents multiply. Division cancels factors, so exponents subtract, and a³/a³ = 1 forces a⁰ = 1. Negative exponents are what you get when subtraction goes below zero, a²/a⁵ = 1/a³, so a⁻³ must equal 1/a³ for the subtraction rule to keep working. Fractional exponents are defined so the multiplication rule holds: (a^(1/2))² = a¹, which means a^(1/2) must be the square root of a.',
      },
    ],
    textbook: [
      { title: 'Intermediate Algebra 2e (OpenStax)', url: `${OSX}intermediate-algebra-2e`, chapter: `Ch. 5 Polynomials and Polynomial Functions, Ch. 6 Factoring, Ch. 9 Quadratic Equations — ${PDF}` },
      { title: 'College Algebra 2e (OpenStax)', url: `${OSX}college-algebra-2e`, chapter: `Ch. 1 Prerequisites, Ch. 2 Equations and Inequalities — ${PDF}` },
    ],
  },
  'linear-equations-functions': {
    examples: [
      {
        problem: 'Find the equation of the line through (2, 5) and (6, 13).',
        steps: [
          'Slope m = (13 − 5) / (6 − 2) = 8 / 4 = 2.',
          'Use point-slope form with (2, 5): y − 5 = 2(x − 2).',
          'Simplify: y − 5 = 2x − 4, so y = 2x + 1.',
          'Check the other point: 2(6) + 1 = 13 ✓',
        ],
        answer: 'y = 2x + 1',
      },
      {
        problem: 'Solve the system 2x + y = 7 and x − y = 2.',
        steps: [
          'The y terms have opposite signs, so add the equations: 3x = 9.',
          'x = 3.',
          'Substitute into x − y = 2: 3 − y = 2, so y = 1.',
          'Check in the first equation: 2(3) + 1 = 7 ✓',
        ],
        answer: '(x, y) = (3, 1)',
      },
      {
        problem: 'Find the domain of f(x) = √(x − 4) / (x − 9).',
        steps: [
          'The square root needs x − 4 ≥ 0, so x ≥ 4.',
          'The denominator cannot be zero, so x ≠ 9.',
          'Combine both conditions: x ≥ 4 but x ≠ 9.',
        ],
        answer: '[4, 9) ∪ (9, ∞)',
      },
      {
        problem: 'Write the line perpendicular to y = −3x + 2 that passes through (3, 4).',
        steps: [
          'The given slope is −3; a perpendicular slope is the negative reciprocal, 1/3.',
          'Point-slope: y − 4 = (1/3)(x − 3).',
          'Simplify: y = (1/3)x − 1 + 4 = (1/3)x + 3.',
          'Check: (1/3)(3) + 3 = 4 ✓',
        ],
        answer: 'y = (1/3)x + 3',
      },
    ],
    deeper: [
      {
        heading: 'Why slope is "rise over run"',
        text: 'A line is the graph of a relationship with a constant rate of change: every time x increases by 1, y changes by the same amount, and that amount is the slope. Dividing the change in y by the change in x between any two points gives that constant rate no matter which two points you pick, which is exactly why the slope formula works. Point-slope form, y − y₁ = m(x − x₁), is just the slope formula rearranged with one point left as a variable. Slope-intercept form is the same equation solved for y, and the intercept b is simply the value of y when x = 0.',
      },
      {
        heading: 'What solving a system really means',
        text: 'Each linear equation in two variables describes a line, and a solution to the system is a point that lies on both lines at once. Two distinct lines in a plane either cross at exactly one point (one solution), are parallel (no solution), or are the same line (infinitely many solutions). Elimination and substitution are algebraic ways of finding that intersection without drawing. When elimination produces a false statement like 0 = 5, the lines are parallel; when it produces 0 = 0, the equations were the same line in disguise. Checking the answer in both original equations catches most arithmetic slips.',
      },
      {
        heading: 'Functions, domain and the vertical line test',
        text: 'A function is a rule that assigns exactly one output to each input. The vertical line test is a picture of that rule: if a vertical line hits a graph twice, one x-value has two y-values, so it is not a function. The domain is every input the rule can accept. For formulas, the domain is usually "all real numbers" minus anything that breaks the arithmetic: division by zero, even roots of negatives, and logarithms of non-positive numbers. The range is the set of outputs that actually occur, which is often easier to read from a graph than to compute algebraically.',
      },
    ],
    textbook: [
      { title: 'Intermediate Algebra 2e (OpenStax)', url: `${OSX}intermediate-algebra-2e`, chapter: `Ch. 3 Graphs and Functions, Ch. 4 Systems of Linear Equations — ${PDF}` },
      { title: 'College Algebra 2e (OpenStax)', url: `${OSX}college-algebra-2e`, chapter: `Ch. 3 Functions, Ch. 4 Linear Functions — ${PDF}` },
    ],
  },
  'logarithms-exponentials': {
    examples: [
      {
        problem: 'Solve 5ˣ = 40.',
        steps: [
          'Take the natural log of both sides: ln(5ˣ) = ln 40.',
          'Bring the exponent down: x · ln 5 = ln 40.',
          'x = ln 40 / ln 5 ≈ 3.6889 / 1.6094 ≈ 2.292.',
          'Sanity check: 5² = 25 and 5³ = 125, so an answer between 2 and 3 makes sense.',
        ],
        answer: 'x = ln 40 / ln 5 ≈ 2.29',
      },
      {
        problem: 'Solve log₂(x) + log₂(x − 2) = 3.',
        steps: [
          'Combine with the product rule: log₂[x(x − 2)] = 3.',
          'Rewrite in exponential form: x(x − 2) = 2³ = 8.',
          'x² − 2x − 8 = 0, which factors as (x − 4)(x + 2) = 0.',
          'x = 4 or x = −2. Reject x = −2 because log₂(−2) is undefined.',
          'Check x = 4: log₂ 4 + log₂ 2 = 2 + 1 = 3 ✓',
        ],
        answer: 'x = 4',
      },
      {
        problem: '$2,000 is invested at 6% compounded monthly. What is it worth after 5 years?',
        steps: [
          'Use A = P(1 + r/n)^(nt) with P = 2000, r = 0.06, n = 12, t = 5.',
          'A = 2000(1 + 0.005)^60 = 2000(1.005)^60.',
          '(1.005)^60 ≈ 1.34885.',
          'A ≈ 2000 × 1.34885 ≈ 2697.70.',
        ],
        answer: 'About $2,697.70',
      },
      {
        problem: 'A sample decays from 80 g to 10 g in 24 hours. What is its half-life?',
        steps: [
          'Count halvings: 80 → 40 → 20 → 10 is three half-lives.',
          'Three half-lives take 24 hours, so one half-life is 24 / 3 = 8 hours.',
          'Formula check: 10 = 80(1/2)^(24/h) gives (1/2)^(24/h) = 1/8 = (1/2)³, so 24/h = 3 and h = 8.',
        ],
        answer: 'Half-life = 8 hours',
      },
    ],
    deeper: [
      {
        heading: 'A logarithm is an exponent',
        text: 'The statement log_b(x) = y means exactly the same thing as bʸ = x: the logarithm answers the question "what power of b gives x?" Every log rule is an exponent rule read backwards. Because bᵐ · bⁿ = b^(m+n), multiplying numbers adds their logs. Because (bᵐ)ⁿ = bᵐⁿ, raising to a power multiplies the log. The domain restriction, x > 0, exists because a positive base raised to any real power is always positive, so there is no exponent that produces zero or a negative number. Keeping the exponential form in mind makes the rules feel obvious instead of arbitrary.',
      },
      {
        heading: 'Why we take logs to solve exponential equations',
        text: 'When the unknown is in the exponent, ordinary algebra cannot reach it: you cannot divide or subtract your way past a power. Logarithms are the inverse of exponentiation, so applying a log to both sides "undoes" the power and lets the exponent come down as a multiplier. Any base works, because the change-of-base formula shows all logs are proportional, but ln and log₁₀ are the ones on calculators. The same idea runs the other way: when the unknown is inside a log, rewrite the equation in exponential form to free it. Always check answers, since combining logs can introduce solutions outside the original domain.',
      },
      {
        heading: 'Why e shows up everywhere',
        text: 'The number e ≈ 2.71828 appears whenever something grows in proportion to its current size and compounding is continuous. Compounding $1 at 100% interest n times per year gives (1 + 1/n)ⁿ, and as n grows without bound that expression approaches e. In calculus, eˣ is the only function that is its own derivative, so it is the natural building block for population growth, radioactive decay, cooling and interest. Any exponential bˣ can be rewritten as e^(kx) with k = ln b, which is why models are usually written with e and a growth or decay constant k.',
      },
    ],
    textbook: [
      { title: 'College Algebra 2e (OpenStax)', url: `${OSX}college-algebra-2e`, chapter: `Ch. 6 Exponential and Logarithmic Functions — ${PDF}` },
      { title: 'Intermediate Algebra 2e (OpenStax)', url: `${OSX}intermediate-algebra-2e`, chapter: `Ch. 10 Exponential and Logarithmic Functions — ${PDF}` },
    ],
  },
  trigonometry: {
    examples: [
      {
        problem: 'A right triangle has legs 5 (opposite θ) and 12 (adjacent θ). Find sin θ, cos θ and tan θ.',
        steps: [
          'Hypotenuse = √(5² + 12²) = √(25 + 144) = √169 = 13.',
          'sin θ = opposite / hypotenuse = 5/13.',
          'cos θ = adjacent / hypotenuse = 12/13.',
          'tan θ = opposite / adjacent = 5/12.',
          'Check: sin² + cos² = 25/169 + 144/169 = 169/169 = 1 ✓',
        ],
        answer: 'sin θ = 5/13, cos θ = 12/13, tan θ = 5/12',
      },
      {
        problem: 'Convert 150° to radians and find the exact values of sin 150° and cos 150°.',
        steps: [
          '150° × (π / 180°) = 150π/180 = 5π/6.',
          '150° is in quadrant II; its reference angle is 180° − 150° = 30°.',
          'In quadrant II, sine is positive and cosine is negative.',
          'sin 150° = sin 30° = 1/2; cos 150° = −cos 30° = −√3/2.',
        ],
        answer: '5π/6; sin = 1/2, cos = −√3/2',
      },
      {
        problem: 'Two sides of a triangle are a = 7 and b = 9 with included angle C = 60°. Find side c.',
        steps: [
          'Law of Cosines: c² = a² + b² − 2ab cos C.',
          'c² = 49 + 81 − 2(7)(9)(cos 60°) = 130 − 126(0.5) = 130 − 63 = 67.',
          'c = √67 ≈ 8.19.',
        ],
        answer: 'c = √67 ≈ 8.19',
      },
      {
        problem: 'Solve 2 sin x − 1 = 0 for 0 ≤ x < 2π.',
        steps: [
          'Isolate: sin x = 1/2.',
          'Reference angle with sin = 1/2 is π/6.',
          'Sine is positive in quadrants I and II: x = π/6 and x = π − π/6 = 5π/6.',
        ],
        answer: 'x = π/6, 5π/6',
      },
    ],
    deeper: [
      {
        heading: 'Why the unit circle replaces the triangle',
        text: 'Right-triangle definitions only work for angles between 0° and 90°, but we need sine and cosine for any angle, including negative ones and angles past 360°. The unit circle fixes that: place the angle with its vertex at the origin, and define cos θ and sin θ as the x- and y-coordinates where the terminal side meets the circle of radius 1. For acute angles this agrees with the triangle definitions, since the hypotenuse is 1. For other angles it extends them smoothly, explains the signs in each quadrant, and shows why the functions repeat every 2π: going around the circle once returns you to the same point.',
      },
      {
        heading: 'Where the Pythagorean identity comes from',
        text: 'Every point on the unit circle satisfies x² + y² = 1 because that is the equation of the circle. Since x = cos θ and y = sin θ, the identity sin² θ + cos² θ = 1 is literally the Pythagorean theorem applied to a triangle with hypotenuse 1. Dividing that identity by cos² θ gives tan² θ + 1 = sec² θ, and dividing by sin² θ gives 1 + cot² θ = csc² θ. So the three Pythagorean identities are one fact in three costumes, and remembering the unit circle picture lets you rebuild them instead of memorizing them.',
      },
      {
        heading: 'When to use the Law of Sines vs the Law of Cosines',
        text: 'Both laws solve triangles that are not right triangles. The Law of Sines relates each side to the sine of its opposite angle, so it needs a known side-angle pair; use it for ASA, AAS and (carefully) SSA. The Law of Cosines generalizes the Pythagorean theorem, adding a correction term −2ab cos C that vanishes when C = 90°; use it for SAS and SSS, where you have no opposite pair yet. The SSA case can have two valid triangles, because sine is positive in two quadrants, so always check whether the supplement of the angle you found also fits.',
      },
    ],
    textbook: [
      { title: 'Algebra and Trigonometry 2e (OpenStax)', url: `${OSX}algebra-and-trigonometry-2e`, chapter: `Ch. 7 The Unit Circle, Ch. 9 Trigonometric Identities and Equations, Ch. 10 Further Applications of Trigonometry — ${PDF}` },
      { title: 'Precalculus 2e (OpenStax)', url: `${OSX}precalculus-2e`, chapter: `Ch. 5 Trigonometric Functions, Ch. 7 Trigonometric Identities and Equations — ${PDF}` },
    ],
  },
  'geometry-formulas': {
    examples: [
      {
        problem: 'A circle has diameter 10 cm. Find its area and circumference.',
        steps: [
          'Radius r = diameter / 2 = 5 cm.',
          'Area = πr² = π(5²) = 25π ≈ 78.54 cm².',
          'Circumference = 2πr = 10π ≈ 31.42 cm.',
        ],
        answer: 'Area 25π ≈ 78.5 cm²; circumference 10π ≈ 31.4 cm',
      },
      {
        problem: 'Find the volume and total surface area of a cylinder with radius 3 and height 10.',
        steps: [
          'Volume = πr²h = π(9)(10) = 90π ≈ 282.74.',
          'Lateral area = 2πrh = 2π(3)(10) = 60π.',
          'Two circular ends = 2πr² = 2π(9) = 18π.',
          'Total surface area = 60π + 18π = 78π ≈ 245.04.',
        ],
        answer: 'V = 90π ≈ 282.7; SA = 78π ≈ 245.0',
      },
      {
        problem: 'A right triangle has legs 8 and 15. Find the hypotenuse.',
        steps: [
          'Pythagorean theorem: c² = a² + b² = 8² + 15² = 64 + 225 = 289.',
          'c = √289 = 17.',
          'This is the 8-15-17 Pythagorean triple.',
        ],
        answer: 'c = 17',
      },
      {
        problem: 'Find the distance and midpoint between (1, 2) and (7, 10), and the interior angle sum of a hexagon.',
        steps: [
          'Distance = √[(7 − 1)² + (10 − 2)²] = √(36 + 64) = √100 = 10.',
          'Midpoint = ((1 + 7)/2, (2 + 10)/2) = (4, 6).',
          'Hexagon has n = 6 sides: angle sum = (6 − 2) × 180° = 720°; each angle of a regular hexagon is 720°/6 = 120°.',
        ],
        answer: 'Distance 10, midpoint (4, 6); hexagon angles sum to 720°',
      },
    ],
    deeper: [
      {
        heading: 'Why area formulas look the way they do',
        text: 'Every area formula is built from the rectangle, whose area is base × height because it is literally counting unit squares in rows. A parallelogram is a rectangle with a triangle sliced off one side and moved to the other, so it keeps base × height. A triangle is half of a parallelogram, giving ½bh. A trapezoid is two triangles sharing the height, so its area averages the two bases. The circle formula πr² comes from cutting a circle into many thin wedges and rearranging them into a near-rectangle with height r and base equal to half the circumference, πr. Seeing the derivations lets you rebuild a forgotten formula.',
      },
      {
        heading: 'Why the Pythagorean theorem is true',
        text: 'Draw a square with side a + b, and inside it place four copies of a right triangle with legs a and b so that a tilted square with side c is left in the middle. The big square has area (a + b)² = a² + 2ab + b². It is also four triangles, 4 × ½ab = 2ab, plus the inner square c². Setting these equal and cancelling 2ab gives a² + b² = c². The distance formula is the same theorem placed on a coordinate grid, with the legs being the horizontal and vertical differences between the two points.',
      },
      {
        heading: 'Volume: prisms vs pyramids',
        text: 'A prism or cylinder is a stack of identical cross-sections, so its volume is the area of one slice times the height, V = Bh. Pyramids and cones taper to a point, and it turns out that exactly three of them fill the prism or cylinder with the same base and height, which is where the ⅓ comes from; you can verify this by pouring water between models or with calculus. The sphere formula V = (4/3)πr³ is related: a sphere fits inside a cylinder of radius r and height 2r and takes up exactly two-thirds of it, a fact Archimedes was so proud of that he had it carved on his tomb.',
      },
    ],
    textbook: [
      { title: 'Contemporary Mathematics (OpenStax)', url: `${OSX}contemporary-mathematics`, chapter: `Ch. 10 Geometry (perimeter, area, volume, Pythagorean theorem) — ${PDF}` },
      { title: 'Prealgebra 2e (OpenStax)', url: `${OSX}prealgebra-2e`, chapter: `Ch. 9 Math Models and Geometry — ${PDF}` },
    ],
  },
  'limits-continuity': {
    examples: [
      {
        problem: 'Evaluate lim (x→3) (x² − 9) / (x − 3).',
        steps: [
          'Plugging in x = 3 gives 0/0, an indeterminate form, so simplify first.',
          'Factor the numerator: (x − 3)(x + 3) / (x − 3).',
          'Cancel the common factor (allowed because x ≠ 3 in a limit): x + 3.',
          'Now substitute: 3 + 3 = 6.',
        ],
        answer: '6',
      },
      {
        problem: 'Evaluate lim (x→∞) (3x² + 5x) / (2x² − 1).',
        steps: [
          'Highest power in numerator and denominator is x², so divide every term by x².',
          '(3 + 5/x) / (2 − 1/x²).',
          'As x → ∞, 5/x → 0 and 1/x² → 0.',
          'The limit is 3/2.',
        ],
        answer: '3/2',
      },
      {
        problem: 'Evaluate lim (x→0) sin(4x) / x.',
        steps: [
          'Use the standard limit lim (u→0) sin(u)/u = 1 with u = 4x.',
          'Rewrite: sin(4x)/x = 4 · sin(4x)/(4x).',
          'As x → 0, 4x → 0, so sin(4x)/(4x) → 1.',
          'Limit = 4 · 1 = 4.',
        ],
        answer: '4',
      },
      {
        problem: 'Find k so that f(x) = x² + 1 for x < 2 and f(x) = kx − 1 for x ≥ 2 is continuous at x = 2.',
        steps: [
          'Left-hand limit: 2² + 1 = 5.',
          'Right-hand limit and f(2): k(2) − 1 = 2k − 1.',
          'Continuity requires both sides to match: 2k − 1 = 5.',
          '2k = 6, so k = 3.',
        ],
        answer: 'k = 3',
      },
    ],
    deeper: [
      {
        heading: 'What a limit actually says',
        text: 'A limit describes where a function is heading, not where it is. lim (x→a) f(x) = L means you can make f(x) as close to L as you like by taking x close enough to a, without ever needing x to equal a. That is why 0/0 is not an answer but a signal: the function may be undefined at the point while still approaching a definite value nearby. Algebraic tricks such as factoring, rationalizing and dividing by the highest power do not change the function anywhere except at the troublesome point, so they reveal the limit without altering it. If the two one-sided limits disagree, the limit does not exist.',
      },
      {
        heading: 'Why continuity matters',
        text: 'A function is continuous at a point when the limit exists, the function is defined there, and the two agree, so you can draw the graph through that point without lifting your pen. Continuity is what makes the Intermediate Value Theorem work: a continuous function that is negative at one end of an interval and positive at the other must cross zero somewhere between, which is the logic behind bisection root-finding. Polynomials, exponentials, sine and cosine are continuous everywhere; rational functions, logs and roots are continuous wherever they are defined. Most of calculus assumes continuity, so recognizing the three kinds of discontinuity (hole, jump, infinite) is a core skill.',
      },
      {
        heading: 'Limits at infinity and end behavior',
        text: 'A limit as x → ∞ asks what the function settles toward for huge inputs, which is the same as finding a horizontal asymptote. For rational functions, only the highest-power terms matter in the long run, because everything else becomes negligible by comparison: dividing top and bottom by the largest power makes that visible. Exponentials eventually dominate any polynomial, and polynomials dominate logarithms, so eˣ/x¹⁰⁰ still goes to infinity. Understanding these hierarchies lets you predict the shape of a graph and the behavior of algorithms and models without a calculator.',
      },
    ],
    textbook: [
      { title: 'Calculus Volume 1 (OpenStax)', url: `${OSX}calculus-volume-1`, chapter: `Ch. 2 Limits (2.2 The Limit of a Function, 2.3 The Limit Laws, 2.4 Continuity) — ${PDF}` },
    ],
  },
  derivatives: {
    examples: [
      {
        problem: 'Differentiate f(x) = x³ · sin x.',
        steps: [
          'This is a product, so use (uv)′ = u′v + uv′ with u = x³ and v = sin x.',
          'u′ = 3x², v′ = cos x.',
          'f′(x) = 3x² sin x + x³ cos x.',
        ],
        answer: 'f′(x) = 3x² sin x + x³ cos x',
      },
      {
        problem: 'Differentiate g(x) = (2x + 1)⁵.',
        steps: [
          'Chain rule: outer function u⁵, inner function u = 2x + 1.',
          'Derivative of the outer: 5u⁴; derivative of the inner: 2.',
          'g′(x) = 5(2x + 1)⁴ · 2 = 10(2x + 1)⁴.',
        ],
        answer: 'g′(x) = 10(2x + 1)⁴',
      },
      {
        problem: 'Find the tangent line to f(x) = x² − 3x at x = 2.',
        steps: [
          'Point: f(2) = 4 − 6 = −2, so the point is (2, −2).',
          'Slope: f′(x) = 2x − 3, so f′(2) = 1.',
          'Point-slope: y − (−2) = 1(x − 2).',
          'y = x − 4.',
        ],
        answer: 'y = x − 4',
      },
      {
        problem: 'Find the absolute max and min of f(x) = x³ − 3x² on [−1, 3].',
        steps: [
          'f′(x) = 3x² − 6x = 3x(x − 2), so critical points are x = 0 and x = 2 (both inside the interval).',
          'Evaluate at critical points and endpoints: f(−1) = −1 − 3 = −4; f(0) = 0; f(2) = 8 − 12 = −4; f(3) = 27 − 27 = 0.',
          'Largest value is 0, smallest is −4.',
        ],
        answer: 'Absolute max 0 (at x = 0 and x = 3); absolute min −4 (at x = −1 and x = 2)',
      },
    ],
    deeper: [
      {
        heading: 'The derivative is a limit of slopes',
        text: 'The slope between two points on a curve, [f(x + h) − f(x)] / h, is an average rate of change over the interval of width h. As h shrinks toward zero, the second point slides toward the first and the secant line tips into the tangent line. The derivative is defined as that limit, so f′(a) is the instantaneous rate of change and the slope of the tangent at a. Every differentiation rule, including the power rule, was proved by evaluating this limit once in general so you never have to do it again. When the limit fails, at a corner, cusp or vertical tangent, the function is not differentiable there.',
      },
      {
        heading: 'Why the chain rule multiplies',
        text: 'The chain rule handles a function inside a function, like sin(x²). Think of rates: if y changes 3 times as fast as u, and u changes 2 times as fast as x, then y changes 6 times as fast as x. Rates of change compound by multiplication, which is exactly dy/dx = (dy/du)(du/dx). In practice, differentiate the outside function while leaving the inside alone, then multiply by the derivative of the inside. Most student errors are forgetting that last factor. The product and quotient rules exist for the same reason: they describe how small changes in each factor combine, and they can be derived from the limit definition.',
      },
      {
        heading: 'What the first and second derivatives tell you',
        text: 'Because f′ is the slope, f′ > 0 means the function is climbing and f′ < 0 means it is falling; extremes can only happen where f′ is zero or undefined, which is why we find critical points. The second derivative measures how the slope itself is changing: f″ > 0 means the graph curves upward like a cup (concave up), and f″ < 0 means it curves downward. Combining them gives the second derivative test, and locating where f″ changes sign gives inflection points. In physics the same ideas read as position, velocity and acceleration, which is why kinematics and calculus are studied together.',
      },
    ],
    textbook: [
      { title: 'Calculus Volume 1 (OpenStax)', url: `${OSX}calculus-volume-1`, chapter: `Ch. 3 Derivatives, Ch. 4 Applications of Derivatives — ${PDF}` },
    ],
  },
  integrals: {
    examples: [
      {
        problem: 'Find ∫ (3x² − 4x + 1) dx.',
        steps: [
          'Integrate term by term with the power rule ∫xⁿ dx = x^(n+1)/(n+1).',
          '∫3x² dx = x³; ∫−4x dx = −2x²; ∫1 dx = x.',
          'Add the constant of integration.',
          'Check by differentiating: (x³ − 2x² + x)′ = 3x² − 4x + 1 ✓',
        ],
        answer: 'x³ − 2x² + x + C',
      },
      {
        problem: 'Evaluate ∫₀² x·e^(x²) dx.',
        steps: [
          'Let u = x², so du = 2x dx and x dx = du/2.',
          'Change the limits: x = 0 → u = 0; x = 2 → u = 4.',
          'Integral becomes (1/2)∫₀⁴ eᵘ du = (1/2)[eᵘ]₀⁴ = (1/2)(e⁴ − 1).',
          'e⁴ ≈ 54.598, so the value is about (1/2)(53.598) ≈ 26.80.',
        ],
        answer: '(e⁴ − 1)/2 ≈ 26.80',
      },
      {
        problem: 'Find the area under y = 4 − x² from x = −2 to x = 2.',
        steps: [
          'The curve is above the x-axis on this interval (its zeros are at ±2), so area = ∫₋₂² (4 − x²) dx.',
          'Antiderivative: 4x − x³/3.',
          'Evaluate: (8 − 8/3) − (−8 + 8/3) = 16 − 16/3 = 32/3.',
        ],
        answer: '32/3 ≈ 10.67 square units',
      },
      {
        problem: 'Find ∫ x cos x dx.',
        steps: [
          'Integration by parts: ∫u dv = uv − ∫v du. Choose u = x (gets simpler) and dv = cos x dx.',
          'Then du = dx and v = sin x.',
          '∫x cos x dx = x sin x − ∫sin x dx = x sin x + cos x + C.',
          'Check: (x sin x + cos x)′ = sin x + x cos x − sin x = x cos x ✓',
        ],
        answer: 'x sin x + cos x + C',
      },
    ],
    deeper: [
      {
        heading: 'Why area is a limit of rectangles',
        text: 'To measure the area under a curve, slice the interval into n thin strips, approximate each strip with a rectangle whose height is the function value, and add them up. This Riemann sum is only approximate, but as n grows the rectangles hug the curve more closely, and the limit of the sums is defined to be the definite integral. The ∫ sign is a stretched S for "sum", and dx is the vanishing width of a strip. Because the height can be negative, the integral counts area below the axis as negative, which is why "area" questions may need the integrand split at its zeros.',
      },
      {
        heading: 'The Fundamental Theorem: why antiderivatives compute areas',
        text: 'Define A(x) as the area under f from a to x. Moving x a tiny bit further, by h, adds a thin strip of area roughly f(x)·h, so A(x + h) − A(x) ≈ f(x)·h and the derivative of A is f. That is the Fundamental Theorem of Calculus: the accumulated area function is an antiderivative of the integrand. It follows that any antiderivative F differs from A by a constant, so the area from a to b is F(b) − F(a). This single idea links the two halves of calculus and turns a limit of sums into simple subtraction whenever an antiderivative can be found.',
      },
      {
        heading: 'Substitution and parts are the chain and product rules in reverse',
        text: 'Every integration technique undoes a differentiation rule. u-substitution reverses the chain rule: if you can spot an inner function u whose derivative du also appears (up to a constant), the integral collapses to a simpler one in u. Integration by parts reverses the product rule: rearranging (uv)′ = u′v + uv′ and integrating gives ∫u dv = uv − ∫v du, which trades one integral for a hopefully easier one. The LIATE order (Log, Inverse trig, Algebraic, Trig, Exponential) is a heuristic for choosing u so that the new integral simplifies. Partial fractions and trig substitution are further specializations of the same idea.',
      },
    ],
    textbook: [
      { title: 'Calculus Volume 1 (OpenStax)', url: `${OSX}calculus-volume-1`, chapter: `Ch. 5 Integration, Ch. 6 Applications of Integration — ${PDF}` },
      { title: 'Calculus Volume 2 (OpenStax)', url: `${OSX}calculus-volume-2`, chapter: `Ch. 1 Integration, Ch. 3 Techniques of Integration — ${PDF}` },
    ],
  },
  'statistics-probability': {
    examples: [
      {
        problem: 'For the sample 4, 8, 6, 5, 12 find the mean, median, sample variance and standard deviation.',
        steps: [
          'Mean = (4 + 8 + 6 + 5 + 12) / 5 = 35 / 5 = 7.',
          'Sorted: 4, 5, 6, 8, 12 → median is the middle value, 6.',
          'Deviations from the mean: −3, 1, −1, −2, 5. Squares: 9, 1, 1, 4, 25. Sum = 40.',
          'Sample variance s² = 40 / (n − 1) = 40 / 4 = 10.',
          's = √10 ≈ 3.16.',
        ],
        answer: 'Mean 7, median 6, s² = 10, s ≈ 3.16',
      },
      {
        problem: 'Test scores are normal with mean 70 and standard deviation 8. What is the z-score of 82, and what percent of students scored below it?',
        steps: [
          'z = (x − μ) / σ = (82 − 70) / 8 = 12 / 8 = 1.5.',
          'From a z-table, P(Z < 1.5) ≈ 0.9332.',
          'About 93.3% scored below 82, so 82 is roughly the 93rd percentile.',
        ],
        answer: 'z = 1.5; about 93.3% below',
      },
      {
        problem: 'Two fair dice are rolled. Find P(sum = 7) and P(at least one die shows a 6).',
        steps: [
          'There are 6 × 6 = 36 equally likely outcomes.',
          'Sum 7: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) → 6 outcomes → 6/36 = 1/6.',
          'At least one 6: use the complement. P(no 6 on either die) = (5/6)(5/6) = 25/36.',
          'P(at least one 6) = 1 − 25/36 = 11/36.',
        ],
        answer: 'P(sum 7) = 1/6; P(at least one 6) = 11/36 ≈ 0.306',
      },
      {
        problem: 'A fair coin is flipped 5 times. What is the probability of exactly 3 heads?',
        steps: [
          'Binomial with n = 5, k = 3, p = 1/2.',
          'Number of ways to choose which 3 flips are heads: C(5,3) = 10.',
          'Each specific sequence has probability (1/2)⁵ = 1/32.',
          'P = 10 × 1/32 = 10/32 = 5/16.',
        ],
        answer: '5/16 = 0.3125',
      },
    ],
    deeper: [
      {
        heading: 'Why we divide by n − 1 for a sample',
        text: 'Variance measures average squared distance from the mean. When you compute it from a sample, you have to use the sample mean, which was itself chosen to sit in the middle of your data; that makes the deviations slightly smaller, on average, than deviations from the true population mean would be. Dividing by n − 1 instead of n inflates the result just enough to correct that bias, so the sample variance is an unbiased estimate of the population variance. The n − 1 is called the degrees of freedom: once the mean is fixed, only n − 1 of the deviations are free to vary, because they must sum to zero.',
      },
      {
        heading: 'Why the normal distribution is everywhere',
        text: 'The Central Limit Theorem says that if you add up many small, independent random effects, the total is approximately normally distributed no matter what the individual effects look like. Heights, measurement errors and test scores are each the sum of many small influences, which is why bell curves are so common. The same theorem explains why sample means are approximately normal for large samples, with standard deviation σ/√n; that fact underlies confidence intervals and hypothesis tests. Standardizing to a z-score lets one table serve every normal distribution, because it measures distance from the mean in units of standard deviations.',
      },
      {
        heading: 'Independence, conditional probability and the complement',
        text: 'Two events are independent when knowing one happened does not change the probability of the other, which is exactly when P(A and B) = P(A)·P(B). Dice rolls and coin flips are independent; drawing cards without replacement is not, so you must use conditional probability, P(B | A). The complement rule, P(not A) = 1 − P(A), is the most useful shortcut in probability: "at least one" problems are almost always easier to solve as 1 minus "none". Binomial probabilities combine all three ideas: independence gives the pᵏ(1 − p)ⁿ⁻ᵏ factor, and counting arrangements gives the C(n, k).',
      },
    ],
    textbook: [
      { title: 'Introductory Statistics 2e (OpenStax)', url: `${OSX}introductory-statistics-2e`, chapter: `Ch. 2 Descriptive Statistics, Ch. 3 Probability Topics, Ch. 4 Discrete Random Variables, Ch. 6 The Normal Distribution — ${PDF}` },
    ],
  },
  'physics-kinematics-newton': {
    examples: [
      {
        problem: 'A car starts from rest and accelerates at 3 m/s² for 8 s. Find its final speed and distance traveled.',
        steps: [
          'Known: v₀ = 0, a = 3 m/s², t = 8 s.',
          'v = v₀ + at = 0 + 3(8) = 24 m/s.',
          'd = v₀t + ½at² = 0 + ½(3)(64) = 96 m.',
          'Check with v² = v₀² + 2ad: 24² = 576 = 2(3)(96) = 576 ✓',
        ],
        answer: 'v = 24 m/s, d = 96 m',
      },
      {
        problem: 'A ball is dropped from a 45 m building (g = 9.8 m/s²). How long does it fall and how fast is it moving at impact?',
        steps: [
          'Down is positive; v₀ = 0, a = 9.8, d = 45.',
          'd = ½gt² → t² = 2(45)/9.8 = 9.18 → t ≈ 3.03 s.',
          'v = gt = 9.8(3.03) ≈ 29.7 m/s.',
          'Check: v² = 2gd = 2(9.8)(45) = 882, √882 ≈ 29.7 ✓',
        ],
        answer: 't ≈ 3.03 s, v ≈ 29.7 m/s',
      },
      {
        problem: 'A 12 kg box is pulled with 50 N while friction is 14 N. Find the acceleration.',
        steps: [
          'Draw the free-body diagram: 50 N forward, 14 N backward, weight and normal force cancel vertically.',
          'Net horizontal force = 50 − 14 = 36 N.',
          'a = F_net / m = 36 / 12 = 3 m/s².',
        ],
        answer: 'a = 3 m/s² in the direction of the pull',
      },
      {
        problem: 'A projectile is launched at 20 m/s at 30° above horizontal on level ground. Find max height, time of flight and range.',
        steps: [
          'Components: vₓ = 20 cos 30° ≈ 17.32 m/s; v_y = 20 sin 30° = 10 m/s.',
          'Time to peak: t = v_y / g = 10 / 9.8 ≈ 1.02 s; total flight ≈ 2.04 s.',
          'Max height: H = v_y² / (2g) = 100 / 19.6 ≈ 5.10 m.',
          'Range: R = vₓ · t_total ≈ 17.32 × 2.04 ≈ 35.3 m (formula check: v² sin 60° / g = 400(0.866)/9.8 ≈ 35.3 m ✓).',
        ],
        answer: 'H ≈ 5.1 m, T ≈ 2.04 s, R ≈ 35.3 m',
      },
    ],
    deeper: [
      {
        heading: 'Where the kinematic equations come from',
        text: 'The kinematic equations are not separate facts; they all follow from the definition of constant acceleration. Acceleration is the rate of change of velocity, so v = v₀ + at is just "velocity grows steadily". Displacement is the area under the velocity-time graph, and for a straight line that area is a trapezoid, giving d = ½(v₀ + v)t. Substituting the first equation into the second yields d = v₀t + ½at², and eliminating t instead yields v² = v₀² + 2ad. Knowing which variable each equation omits tells you which one to use: pick the equation that does not contain the quantity you neither know nor need.',
      },
      {
        heading: "Newton's laws as one idea",
        text: "Newton's second law, ΣF = ma, contains the other two. If the net force is zero, the acceleration is zero and velocity stays constant, which is the first law; inertia is simply the m in the equation. The third law says forces come in pairs acting on different objects, which is why the pair never cancels in a single free-body diagram. Nearly every mistake in dynamics comes from summing forces on the wrong object or forgetting one, so the discipline is: isolate one body, draw every force acting on it, choose axes (tilt them along an incline), and write ΣF = ma separately for each axis.",
      },
      {
        heading: 'Why projectile motion splits into two problems',
        text: 'Gravity acts only vertically, so it changes the vertical velocity while leaving the horizontal velocity alone. That independence lets you treat a projectile as two simultaneous one-dimensional problems sharing the same clock: constant velocity horizontally, constant acceleration g vertically. The time of flight is set entirely by the vertical motion, and the range is simply horizontal speed times that time. At the peak the vertical velocity is zero, but the acceleration is still g, a favorite conceptual test question. Air resistance breaks the symmetry, which is why real trajectories are shorter and steeper on the way down.',
      },
    ],
    textbook: [
      { title: 'College Physics 2e (OpenStax)', url: `${OSX}college-physics-2e`, chapter: `Ch. 2 Kinematics, Ch. 3 Two-Dimensional Kinematics, Ch. 4 Dynamics: Force and Newton's Laws of Motion — ${PDF}` },
      { title: 'University Physics Volume 1 (OpenStax)', url: `${OSX}university-physics-volume-1`, chapter: `Ch. 3 Motion Along a Straight Line, Ch. 4 Motion in Two and Three Dimensions, Ch. 5 Newton's Laws of Motion — ${PDF}` },
    ],
  },
  'physics-energy-momentum-circular': {
    examples: [
      {
        problem: 'A 500 kg roller-coaster car starts from rest 30 m above the bottom of a hill. Ignoring friction, how fast is it moving at the bottom?',
        steps: [
          'Energy conservation: PE_top = KE_bottom, so mgh = ½mv².',
          'Mass cancels: v = √(2gh) = √(2 × 9.8 × 30) = √588.',
          'v ≈ 24.2 m/s.',
        ],
        answer: 'v ≈ 24.2 m/s (independent of mass)',
      },
      {
        problem: 'A 2 kg cart moving at 6 m/s collides with a 4 kg cart at rest and they stick together. Find the final speed and the kinetic energy lost.',
        steps: [
          'Momentum is conserved: (2)(6) + (4)(0) = (2 + 4)v.',
          '12 = 6v, so v = 2 m/s.',
          'KE before = ½(2)(6²) = 36 J. KE after = ½(6)(2²) = 12 J.',
          'Energy lost to heat, sound and deformation = 36 − 12 = 24 J.',
        ],
        answer: 'v = 2 m/s; 24 J of kinetic energy is lost',
      },
      {
        problem: 'A 1200 kg car rounds a curve of radius 50 m at 15 m/s. Find the centripetal acceleration and the friction force required.',
        steps: [
          'a_c = v² / r = 15² / 50 = 225 / 50 = 4.5 m/s².',
          'The friction force supplies the centripetal force: F = m a_c = 1200 × 4.5 = 5400 N.',
          'Direction: toward the center of the curve.',
        ],
        answer: 'a_c = 4.5 m/s², F = 5400 N toward the center',
      },
      {
        problem: 'A student lifts a 20 kg box 3 m straight up in 4 s at constant speed. Find the work done and the power.',
        steps: [
          'Force needed equals the weight: F = mg = 20 × 9.8 = 196 N.',
          'Work = F d = 196 × 3 = 588 J (force and displacement are parallel).',
          'Power = W / t = 588 / 4 = 147 W.',
        ],
        answer: 'W = 588 J, P = 147 W',
      },
    ],
    deeper: [
      {
        heading: 'Why energy is conserved (and when it is not)',
        text: 'The work-energy theorem, W_net = ΔKE, follows directly from Newton\'s second law and the kinematic equation v² = v₀² + 2ad: multiply both sides by ½m and you have the theorem. Gravity and springs are conservative forces, meaning the work they do depends only on start and end points, so their work can be bookkept as potential energy. That is why mechanical energy (KE + PE) stays constant when only conservative forces act. Friction and air drag are not conservative; they turn mechanical energy into thermal energy, so with them present you write KE₀ + PE₀ + W_friction = KE + PE, where the friction work is negative.',
      },
      {
        heading: 'Momentum vs kinetic energy in collisions',
        text: 'Momentum is always conserved in a collision because the forces the objects exert on each other are an equal-and-opposite pair whose impulses cancel, no matter how violent or brief the contact. Kinetic energy, however, can be converted into other forms, so it is conserved only in perfectly elastic collisions. That is why every collision problem starts with momentum, and only elastic problems get a second equation from energy. In perfectly inelastic collisions the objects stick together and the energy loss is as large as momentum conservation allows. Impulse, FΔt = Δp, explains airbags: stretching the stopping time reduces the force.',
      },
      {
        heading: 'Centripetal force is not a new force',
        text: 'An object moving in a circle at constant speed is still accelerating, because its velocity vector keeps changing direction. That acceleration, v²/r, points toward the center, and Newton\'s second law says something must supply a net inward force of mv²/r. The "centripetal force" is just the name for whatever real force plays that role: string tension for a whirling ball, friction for a car on a flat curve, gravity for a satellite, or the normal force at the bottom of a loop. Never draw a separate centripetal force on a free-body diagram; instead, set the net inward force equal to mv²/r.',
      },
    ],
    textbook: [
      { title: 'College Physics 2e (OpenStax)', url: `${OSX}college-physics-2e`, chapter: `Ch. 6 Uniform Circular Motion and Gravitation, Ch. 7 Work, Energy, and Energy Resources, Ch. 8 Linear Momentum and Collisions — ${PDF}` },
      { title: 'University Physics Volume 1 (OpenStax)', url: `${OSX}university-physics-volume-1`, chapter: `Ch. 7 Work and Kinetic Energy, Ch. 8 Potential Energy and Conservation of Energy, Ch. 9 Linear Momentum and Collisions — ${PDF}` },
    ],
  },
  'chemistry-moles-stoichiometry-gases': {
    examples: [
      {
        problem: 'How many moles are in 25.0 g of calcium carbonate, CaCO₃?',
        steps: [
          'Molar mass: Ca 40.08 + C 12.01 + 3 × O 16.00 = 40.08 + 12.01 + 48.00 = 100.09 g/mol.',
          'n = mass / molar mass = 25.0 g / 100.09 g/mol.',
          'n ≈ 0.250 mol.',
        ],
        answer: '0.250 mol CaCO₃',
      },
      {
        problem: 'How many grams of water form when 4.0 g of H₂ burns in excess O₂? (2H₂ + O₂ → 2H₂O)',
        steps: [
          'Moles of H₂ = 4.0 g / 2.016 g/mol ≈ 1.98 mol.',
          'Mole ratio from the equation: 2 mol H₂ → 2 mol H₂O, so 1.98 mol H₂O forms.',
          'Mass of water = 1.98 mol × 18.02 g/mol ≈ 35.8 g.',
        ],
        answer: 'About 35.8 g H₂O',
      },
      {
        problem: '2.00 mol of an ideal gas is held at 300 K in a 10.0 L container. What is the pressure?',
        steps: [
          'PV = nRT with R = 0.08206 L·atm/(mol·K).',
          'P = nRT / V = (2.00)(0.08206)(300) / 10.0.',
          'Numerator: 2.00 × 0.08206 × 300 = 49.24.',
          'P = 49.24 / 10.0 ≈ 4.92 atm.',
        ],
        answer: 'P ≈ 4.92 atm',
      },
      {
        problem: '5.85 g of NaCl is dissolved to make 250 mL of solution. What is the molarity?',
        steps: [
          'Molar mass of NaCl = 22.99 + 35.45 = 58.44 g/mol.',
          'Moles = 5.85 / 58.44 ≈ 0.100 mol.',
          'Volume in liters = 0.250 L.',
          'M = 0.100 mol / 0.250 L = 0.400 M.',
        ],
        answer: '0.400 M NaCl',
      },
    ],
    deeper: [
      {
        heading: 'Why the mole is the chemist\'s counting unit',
        text: 'Atoms are far too small to count or weigh one at a time, so chemists count them by the group. A mole is 6.022 × 10²³ particles, chosen so that one mole of an element has a mass in grams numerically equal to its atomic mass in atomic mass units. That link is what lets a balance measure the number of atoms: weigh a sample, divide by the molar mass, and you know how many moles, and therefore how many particles, you have. Balanced equations describe ratios of particles, so converting every mass to moles first is the only way to compare reactants and products correctly.',
      },
      {
        heading: 'The logic of every stoichiometry problem',
        text: 'Every stoichiometry problem follows the same road: convert what you are given into moles, use the coefficients of the balanced equation as a mole ratio to get moles of what you want, then convert those moles into the units asked for (grams, liters of gas, molecules, or molarity). When two reactant amounts are given, the limiting reactant is the one that produces the smallest amount of product, and the calculation must be based on it; the other reactant is in excess. Percent yield compares what you actually collected with this theoretical maximum, and is a measure of technique, not of the reaction itself.',
      },
      {
        heading: 'Why the ideal gas law works',
        text: 'Gases are mostly empty space, with tiny molecules in constant random motion. Pressure comes from those molecules hitting the walls, so it rises when they hit more often (smaller volume or more moles) or harder (higher temperature). PV = nRT captures all of these in one equation, and Boyle\'s, Charles\'s and Avogadro\'s laws are just special cases with two variables held constant. The law is "ideal" because it ignores molecular size and attractions; real gases deviate at high pressure and low temperature, where molecules are crowded and slow enough for those effects to matter. Temperature must be in kelvin because pressure is proportional to absolute temperature, not Celsius.',
      },
    ],
    textbook: [
      { title: 'Chemistry 2e (OpenStax)', url: `${OSX}chemistry-2e`, chapter: `Ch. 3 Composition of Substances and Solutions, Ch. 4 Stoichiometry of Chemical Reactions, Ch. 9 Gases — ${PDF}` },
    ],
  },
  'chemistry-periodic-trends-bonding': {
    examples: [
      {
        problem: 'Write the electron configuration of sulfur (Z = 16) and predict its most common ion.',
        steps: [
          'Fill orbitals in order: 1s² 2s² 2p⁶ 3s² 3p⁴ (2 + 2 + 6 + 2 + 4 = 16 electrons ✓).',
          'Valence electrons are in the n = 3 shell: 3s² 3p⁴ → 6 valence electrons.',
          'Sulfur needs 2 more electrons to reach an octet, so it gains 2 to form S²⁻ (same configuration as argon).',
        ],
        answer: '[Ne] 3s² 3p⁴; 6 valence electrons; forms S²⁻',
      },
      {
        problem: 'Rank Na, Mg and K from largest to smallest atomic radius.',
        steps: [
          'Radius increases down a group: K (period 4) is larger than Na (period 3).',
          'Radius decreases across a period: Na (group 1) is larger than Mg (group 2) because Mg has more protons pulling on the same shell.',
          'Combine: K > Na > Mg.',
        ],
        answer: 'K > Na > Mg',
      },
      {
        problem: 'Classify the bonds Na–Cl, H–Cl and C–H using electronegativity (Na 0.93, H 2.20, C 2.55, Cl 3.16).',
        steps: [
          'Na–Cl: ΔEN = 3.16 − 0.93 = 2.23 → greater than ~1.7 → ionic.',
          'H–Cl: ΔEN = 3.16 − 2.20 = 0.96 → between ~0.4 and 1.7 → polar covalent.',
          'C–H: ΔEN = 2.55 − 2.20 = 0.35 → less than ~0.4 → nonpolar covalent.',
        ],
        answer: 'NaCl ionic; HCl polar covalent; C–H nonpolar covalent',
      },
      {
        problem: 'Draw the Lewis structure of NH₃ and predict its shape and polarity.',
        steps: [
          'Valence electrons: N has 5, each H has 1 → 5 + 3 = 8 electrons (4 pairs).',
          'N is central; three N–H single bonds use 6 electrons; the remaining 2 form a lone pair on N.',
          'Electron-domain geometry with 4 domains is tetrahedral; with one lone pair the molecular shape is trigonal pyramidal (~107°).',
          'N–H bonds are polar and the shape is not symmetric, so the dipoles do not cancel: NH₃ is polar.',
        ],
        answer: 'Trigonal pyramidal, polar molecule with one lone pair on N',
      },
    ],
    deeper: [
      {
        heading: 'Effective nuclear charge explains the trends',
        text: 'Almost every periodic trend comes from two competing effects: the pull of the nucleus and the shielding of inner electrons. Moving across a period adds protons to the nucleus while new electrons go into the same shell, which shields poorly; the effective nuclear charge felt by the outer electrons rises, so atoms shrink, hold their electrons more tightly (higher ionization energy) and attract bonding electrons more strongly (higher electronegativity). Moving down a group adds a whole new shell farther from the nucleus and better shielded, so atoms grow and their outer electrons are easier to remove. Noble gases end each period with a full, stable shell.',
      },
      {
        heading: 'Why atoms bond at all',
        text: 'Atoms bond because the bonded arrangement has lower energy than the separated atoms. Metals with low ionization energy give up electrons cheaply, and nonmetals with high electron affinity gain them readily, so metal-plus-nonmetal pairs form ions that pack into a lattice held by electrostatic attraction. Two nonmetals both hold their electrons tightly, so neither can take from the other; instead they share, and the shared pair sits between the nuclei, attracting both. Unequal sharing produces polar bonds and partial charges. The octet rule is a shorthand for the observation that filled s and p sublevels are especially stable.',
      },
      {
        heading: 'From Lewis structure to molecular shape',
        text: 'A Lewis structure shows which atoms are connected and where the electron pairs are, but it is flat. VSEPR turns it into a 3-D shape by assuming electron domains around the central atom spread as far apart as possible. Two domains give linear, three trigonal planar, four tetrahedral, five trigonal bipyramidal and six octahedral electron geometries. Lone pairs occupy space but are invisible in the molecular shape, so water (four domains, two lone pairs) is bent even though its electron geometry is tetrahedral. Shape plus bond polarity determines whether a molecule is polar, which controls boiling points, solubility and how molecules interact.',
      },
    ],
    textbook: [
      { title: 'Chemistry 2e (OpenStax)', url: `${OSX}chemistry-2e`, chapter: `Ch. 6 Electronic Structure and Periodic Properties of Elements, Ch. 7 Chemical Bonding and Molecular Geometry — ${PDF}` },
    ],
  },
  'biology-cell-genetics': {
    examples: [
      {
        problem: 'Two heterozygous tall pea plants (Tt × Tt) are crossed. What are the genotype and phenotype ratios?',
        steps: [
          'Each parent makes gametes T or t with equal probability.',
          'Punnett square: TT, Tt, Tt, tt.',
          'Genotype ratio 1 TT : 2 Tt : 1 tt.',
          'Since T is dominant, TT and Tt are tall: phenotype ratio 3 tall : 1 short. P(short) = 1/4.',
        ],
        answer: '1:2:1 genotypes; 3:1 tall:short; 25% short',
      },
      {
        problem: 'In a dihybrid cross RrYy × RrYy, what fraction of offspring are wrinkled and green (rryy)? Round and green (R_yy)?',
        steps: [
          'Treat each gene separately (independent assortment).',
          'P(rr) = 1/4, P(R_) = 3/4, P(yy) = 1/4.',
          'P(rryy) = 1/4 × 1/4 = 1/16.',
          'P(R_yy) = 3/4 × 1/4 = 3/16. (Full phenotype ratio is 9:3:3:1.)',
        ],
        answer: 'rryy = 1/16; round & green = 3/16',
      },
      {
        problem: 'A human cell has 46 chromosomes. How many chromosomes and chromatids are present after S phase, in each daughter cell after mitosis, and in a gamete after meiosis?',
        steps: [
          'S phase copies each chromosome, so there are still 46 chromosomes but each has 2 sister chromatids: 92 chromatids.',
          'Mitosis separates sister chromatids, giving two identical daughter cells with 46 chromosomes each.',
          'Meiosis halves the number: gametes have 23 chromosomes (haploid).',
        ],
        answer: 'After S: 46 chromosomes / 92 chromatids; after mitosis: 46 each; gamete: 23',
      },
      {
        problem: 'A father with blood type A (genotype IᴬI⁰) and a mother with type B (IᴮI⁰) have a child. What is the chance the child is type O?',
        steps: [
          'Father\'s gametes: Iᴬ or I⁰. Mother\'s gametes: Iᴮ or I⁰.',
          'Punnett square: IᴬIᴮ (AB), IᴬI⁰ (A), IᴮI⁰ (B), I⁰I⁰ (O).',
          'Each box is 1/4, so P(type O) = 1/4; all four blood types are possible.',
        ],
        answer: '25% type O (AB, A, B and O each 25%)',
      },
    ],
    deeper: [
      {
        heading: 'Why Punnett squares work',
        text: 'A Punnett square is a probability table. Meiosis separates the two alleles of a gene into different gametes (Mendel\'s law of segregation), so each gamete carries one allele chosen at random. Fertilization pairs a random gamete from each parent, and the square simply lists every combination with equal probability. For two genes on different chromosomes the alleles sort independently, so a dihybrid outcome is just the product of two monohybrid probabilities; that is faster than drawing a 16-box square. The ratios are predictions for large numbers of offspring, so a family of four children will often not match 3:1 exactly.',
      },
      {
        heading: 'Mitosis vs meiosis: the point of each',
        text: 'Mitosis exists for growth and repair: it makes an exact genetic copy, so every body cell has the same 46 chromosomes. Meiosis exists for sexual reproduction: it halves the chromosome number so that fertilization restores it, and it shuffles the genes. Two events create that variation. Crossing over in prophase I swaps segments between homologous chromosomes, producing new allele combinations on a single chromosome. Independent assortment in metaphase I lines up each homologous pair randomly, giving 2²³ possible chromosome combinations per gamete in humans. Errors in separation (nondisjunction) explain conditions like trisomy 21.',
      },
      {
        heading: 'Structure follows function in the cell',
        text: 'Every organelle\'s structure suits its job. Mitochondria have folded inner membranes to pack in more surface area for the electron transport chain, which is why active cells such as muscle have so many. The rough ER is studded with ribosomes so proteins can be threaded into it as they are made, then shipped through the Golgi for packaging. The phospholipid bilayer is fluid and selectively permeable because its hydrophobic core blocks ions and polar molecules, forcing them through protein channels; that selectivity is what makes gradients, and therefore nerve signals and ATP synthesis, possible. Plant cells add a rigid wall and chloroplasts for photosynthesis.',
      },
    ],
    textbook: [
      { title: 'Biology 2e (OpenStax)', url: `${OSX}biology-2e`, chapter: `Ch. 4 Cell Structure, Ch. 10 Cell Reproduction, Ch. 11 Meiosis and Sexual Reproduction, Ch. 12 Mendel's Experiments and Heredity — ${PDF}` },
      { title: 'Concepts of Biology (OpenStax)', url: `${OSX}concepts-biology`, chapter: `Ch. 3 Cell Structure and Function, Ch. 8 Patterns of Inheritance — ${PDF}` },
    ],
  },
  'essay-structure-thesis': {
    examples: [
      {
        problem: 'Turn the topic "social media and teenagers" into an arguable thesis.',
        steps: [
          'Start with a fact-like statement: "Social media affects teenagers." This is not arguable; everyone agrees.',
          'Take a position: "Social media harms teenagers."',
          'Narrow the claim and add reasons that preview the body paragraphs: mental health, comparison, sleep.',
          'Acknowledge the other side with an "although" clause to show nuance.',
        ],
        answer: '"Although social media helps teens stay connected, its algorithm-driven feeds harm adolescent mental health by encouraging constant comparison, disrupting sleep, and rewarding outrage over conversation."',
      },
      {
        problem: 'Outline a five-paragraph argumentative essay on later school start times.',
        steps: [
          'Intro: hook (a statistic on teen sleep), context (typical 7:30 start), thesis: "High schools should start no earlier than 8:30 a.m. because later starts improve attendance, grades and safety."',
          'Body 1 (attendance): claim → evidence (district data after a schedule change) → explanation → link to thesis.',
          'Body 2 (grades): claim → evidence (study on test scores) → explanation.',
          'Body 3 (safety + counterargument): later starts reduce drowsy-driving crashes; address bus-schedule cost objection and rebut.',
          'Conclusion: restate thesis in new words, synthesize the three reasons, end with a call to action.',
        ],
        answer: 'A thesis with three previewed reasons, one body paragraph per reason (claim, evidence, explanation, link), a counterargument paragraph, and a conclusion that ends with a call to action.',
      },
      {
        problem: 'Fix this weak topic sentence: "This paragraph is about how Gatsby uses money."',
        steps: [
          'Remove the announcement ("this paragraph is about") — state the point instead.',
          'Make it a claim that supports the thesis, not a description of the paragraph.',
          'Use a specific, analytical verb.',
        ],
        answer: '"Gatsby\'s lavish spending reveals that he treats wealth as a costume for winning Daisy rather than as a source of security."',
      },
    ],
    deeper: [
      {
        heading: 'Why a thesis must be arguable',
        text: 'An essay is a sustained act of persuasion, so its central claim must be something a reasonable reader could doubt. If the thesis is a fact ("The Civil War ended in 1865") or a pure opinion ("Pizza is the best food") there is nothing to prove and nowhere for the essay to go. An arguable thesis makes a specific claim, takes a stance, and hints at the reasoning, which gives the body paragraphs a job: each one supplies one reason with evidence. That is why strong theses often contain "because" or "although": those words build in the reasons and the counterargument that structure the whole paper.',
      },
      {
        heading: 'Paragraphs are units of argument, not length',
        text: 'A body paragraph should make exactly one point and prove it. The topic sentence states the point as a claim; the evidence (a quotation, a statistic, an example) supports it; the analysis explains how the evidence proves the claim, which is the step students most often skip; and the final sentence ties the point back to the thesis or bridges to the next idea. If you can delete a paragraph and the argument still stands, that paragraph was not working. If a paragraph contains two claims, split it. Writing the topic sentences first and reading them in order is a fast way to test whether the essay actually builds.',
      },
      {
        heading: 'Introductions and conclusions do different work',
        text: 'The introduction moves the reader from the wide world to your specific claim: a hook that earns attention, a few sentences of context so the claim makes sense, and then the thesis, usually as the last sentence. The conclusion does the reverse: it restates the thesis in fresh words, shows how the reasons combined to prove it, and then widens out to the "so what" — an implication, a recommendation, or a question the argument raises. Avoid introducing new evidence in the conclusion and avoid the phrase "in conclusion"; if the reader cannot tell it is the conclusion, the paragraph needs rewriting rather than labeling.',
      },
    ],
    textbook: [
      { title: 'Writing Guide with Handbook (OpenStax)', url: `${OSX}writing-guide`, chapter: `Ch. 10 Position Argument: Practicing the Art of Rhetoric, Ch. 11 Reasoning Strategies, Handbook on paragraphs and thesis — ${PDF}` },
    ],
  },
  'citations-mla-apa': {
    examples: [
      {
        problem: 'Cite a print book in MLA 9: Beloved by Toni Morrison, published by Vintage in 2004, quoting page 45.',
        steps: [
          'Works Cited pattern: Author. Title of Book. Publisher, Year.',
          'Author is Last, First; the title is italicized.',
          'In-text citation is (Author Page) with no comma.',
        ],
        answer: 'Works Cited: Morrison, Toni. Beloved. Vintage, 2004.  In-text: (Morrison 45)',
      },
      {
        problem: 'Cite a journal article in APA 7 by two authors, J. A. Smith and K. Lee, published in 2020 in volume 12, issue 3, pages 45–60 of a journal, with a DOI.',
        steps: [
          'Reference pattern: Author, A. A., & Author, B. B. (Year). Title of article in sentence case. Journal Name in Title Case, Volume(Issue), pages. https://doi.org/xx',
          'Use initials, an ampersand before the last author, and italics for the journal name and volume number.',
          'In-text: (Smith & Lee, 2020) for a paraphrase; add p. 47 for a direct quote.',
        ],
        answer: 'Smith, J. A., & Lee, K. (2020). Sleep and adolescent memory. Journal of Educational Research, 12(3), 45–60. https://doi.org/10.0000/example  In-text: (Smith & Lee, 2020, p. 47)',
      },
      {
        problem: 'Cite a web page in MLA 9 with an author, page title, site name, publication date and URL.',
        steps: [
          'Pattern: Author. "Title of Page." Website Name, Publisher (if different from site), Day Month Year, URL.',
          'Put the page title in quotation marks and the site name in italics; drop "https://".',
          'If there is no author, start with the title and use a short form of it in the in-text citation.',
        ],
        answer: 'Rivera, Ana. "How Sleep Shapes Learning." Science Daily Notes, 4 Mar. 2023, www.example.org/sleep-learning.  In-text: (Rivera)',
      },
      {
        problem: 'How do you cite a source with three or more authors in APA 7 and MLA 9 in-text?',
        steps: [
          'APA 7: use the first author followed by "et al." from the very first citation: (Garcia et al., 2019).',
          'MLA 9: also first author plus "et al.", but with a page number and no comma or year: (Garcia et al. 112).',
          'In the reference list, APA lists up to 20 authors; MLA lists the first author followed by "et al."',
        ],
        answer: 'APA: (Garcia et al., 2019)  MLA: (Garcia et al. 112)',
      },
    ],
    deeper: [
      {
        heading: 'Why citation styles differ',
        text: 'MLA and APA were designed by different disciplines with different priorities. The humanities (MLA) value the exact words and where they appear, so the in-text citation gives the author and page number and the reference list gives the full title first. The sciences (APA) value how recent a finding is, so the year sits right next to the author\'s name in every citation and the date comes second in the reference. Once you see the logic, the formats stop looking arbitrary: each style front-loads whatever its readers care about most, and both exist so a reader can find the exact source you used.',
      },
      {
        heading: 'What must be cited and why',
        text: 'Cite any idea, data, image or phrasing that came from someone else, whether you quoted it, paraphrased it or summarized it. Paraphrasing without citation is still plagiarism because the idea is borrowed even if the words are new. Common knowledge, facts that appear in many general sources and that no one would dispute, does not need a citation. Citation is not only about avoiding penalties: it lets readers check your evidence, shows how your argument fits into an ongoing conversation, and separates your contribution from your sources. When unsure, cite; an unnecessary citation costs nothing, a missing one can cost a grade.',
      },
      {
        heading: 'Building a citation from any source',
        text: 'Every citation answers the same questions: who made it, what is it called, where does it live, and when was it made. MLA 9 formalizes this as "core elements": author, title of source, title of container, other contributors, version, number, publisher, date, location. Identify each element from your source, skip the ones that do not apply, and arrange them in that order with the punctuation the style specifies. This is why you can cite a podcast episode, a tweet or a museum placard without a special template. Citation generators are fine for a draft, but always verify against the official pattern because they frequently mis-capitalize or omit elements.',
      },
    ],
    textbook: [
      { title: 'Writing Guide with Handbook (OpenStax)', url: `${OSX}writing-guide`, chapter: `Ch. 13 Research Process, Ch. 14 Annotated Bibliography, Handbook: MLA and APA Documentation and Format — ${PDF}` },
    ],
  },
  'grammar-style-quick-fixes': {
    examples: [
      {
        problem: 'Fix the comma splice: "The lab ran late, we missed lunch."',
        steps: [
          'Identify two independent clauses joined only by a comma.',
          'Option 1: period — "The lab ran late. We missed lunch."',
          'Option 2: comma + coordinating conjunction — "The lab ran late, so we missed lunch."',
          'Option 3: semicolon — "The lab ran late; we missed lunch."',
          'Option 4: subordinate one clause — "Because the lab ran late, we missed lunch."',
        ],
        answer: 'Any of: period, ", so", semicolon, or "Because … ," — the subordinated version reads best.',
      },
      {
        problem: 'Correct the agreement error: "The list of supplies are on the desk."',
        steps: [
          'Find the true subject by stripping prepositional phrases: "The list [of supplies]".',
          'The subject is "list", which is singular.',
          'Change the verb to match: "is".',
        ],
        answer: '"The list of supplies is on the desk."',
      },
      {
        problem: 'Rewrite in active voice: "The experiment was conducted by the students, and the results were recorded."',
        steps: [
          'Find the actor hiding in the "by" phrase: the students.',
          'Make the actor the subject and use a strong verb: "The students conducted the experiment."',
          'The second clause has no actor; supply one or keep passive if the actor is truly unknown: "…and recorded the results."',
        ],
        answer: '"The students conducted the experiment and recorded the results."',
      },
      {
        problem: 'Choose the right word: "The weather will (affect/effect) (its/it\'s) outcome, and (their/there/they\'re) sure the rain (affects/effects) the data."',
        steps: [
          '"affect" is usually the verb (to influence); "effect" is usually the noun (a result).',
          '"its" is possessive; "it\'s" means "it is".',
          '"their" is possessive; "there" is a place; "they\'re" means "they are".',
        ],
        answer: '"The weather will affect its outcome, and they\'re sure the rain affects the data."',
      },
    ],
    deeper: [
      {
        heading: 'Why comma rules are really clause rules',
        text: 'Most comma errors come from not recognizing an independent clause, a group of words with a subject and a verb that can stand alone as a sentence. Two independent clauses need a strong connector: a period, a semicolon, or a comma paired with one of the seven coordinating conjunctions (for, and, nor, but, or, yet, so). A comma alone is too weak, which produces a comma splice; nothing at all produces a run-on. A dependent clause, one starting with a word like because, although or when, cannot stand alone, so it attaches to a main clause with a comma if it comes first and usually without one if it comes second.',
      },
      {
        heading: 'Active voice and why it usually wins',
        text: 'In an active sentence the subject performs the action ("The committee approved the plan"); in a passive one the subject receives it ("The plan was approved by the committee"). Passive voice is grammatical and sometimes right, especially when the actor is unknown or unimportant, as in lab reports. But it is longer, hides responsibility, and pushes the interesting verb to the end, so readers work harder. A quick test: if you can add "by zombies" after the verb and it makes sense, the sentence is passive. Convert it by asking "who did this?", making that the subject, and choosing a vivid verb.',
      },
      {
        heading: 'Concision is a form of respect for the reader',
        text: 'Wordiness usually comes from nominalizations (turning verbs into nouns: "make a decision" instead of "decide"), empty openers ("There are many reasons that"), and redundant pairs ("each and every", "basic fundamentals"). Every extra word is a small tax on attention, and readers will not pay it forever. Edit in passes: first cut phrases that add no meaning, then replace weak verb-plus-noun combinations with a single strong verb, then check that each sentence has a clear subject doing a clear action near its start. Reading aloud exposes what the eye skims past, especially repeated words and sentences that run out of breath.',
      },
    ],
    textbook: [
      { title: 'Writing Guide with Handbook (OpenStax)', url: `${OSX}writing-guide`, chapter: `Handbook: Grammar, Punctuation, Sentence Structure and Style — ${PDF}` },
    ],
  },
  'study-techniques': {
    examples: [
      {
        problem: 'You have a biology test in 14 days. Build a spaced-repetition schedule.',
        steps: [
          'Day 1: first pass — read notes and write retrieval questions (not a re-read).',
          'Day 2 (1 day later): first review — answer the questions from memory, mark misses.',
          'Day 4 (2 days later): second review of everything, extra focus on misses.',
          'Day 8 (4 days later): third review; add mixed practice questions from the chapter.',
          'Day 13 (day before the test): final full retrieval run; sleep, do not cram.',
          'Gaps grow roughly 1 → 2 → 4 → 5 days: each review comes just as forgetting would set in.',
        ],
        answer: 'Review on days 1, 2, 4, 8 and 13 with expanding gaps, testing yourself rather than re-reading.',
      },
      {
        problem: 'Turn the note "Mitochondria produce ATP via cellular respiration in the inner membrane" into retrieval-practice questions.',
        steps: [
          'Ask what: "What molecule do mitochondria produce?" → ATP.',
          'Ask where: "Where in the mitochondrion does the electron transport chain run?" → inner membrane.',
          'Ask why: "Why is the inner membrane folded into cristae?" → more surface area for more ATP production.',
          'Ask a connection: "How would a cell with damaged mitochondria differ in energy use?"',
        ],
        answer: 'Four flashcards ranging from recall (what/where) to explanation (why/what-if), which is what tests actually ask.',
      },
      {
        problem: 'Plan a 2-hour homework block using the Pomodoro technique.',
        steps: [
          'One pomodoro = 25 minutes of focused work + 5-minute break.',
          'Four pomodoros = 4 × 25 = 100 minutes of work plus 3 short breaks = 15 minutes, totaling 115 minutes.',
          'After the fourth pomodoro take a longer 15–30 minute break.',
          'Assign tasks: pomodoros 1–2 math problem set, pomodoro 3 history reading with notes, pomodoro 4 flashcard review.',
        ],
        answer: '4 pomodoros (100 min focused work) with three 5-minute breaks fit in the 2-hour block, then a long break.',
      },
    ],
    deeper: [
      {
        heading: 'Why testing yourself beats re-reading',
        text: 'Re-reading feels productive because the text becomes familiar, but familiarity is not memory: recognizing an idea on the page is a different skill from producing it on a blank exam. Retrieval practice, pulling information out of your head, strengthens the memory trace each time you succeed and exposes gaps each time you fail. Decades of studies show students who quiz themselves recall far more a week later than students who re-read for the same amount of time, even though the re-readers feel more confident. The effort is the point: the harder a successful retrieval is, the more it strengthens the memory.',
      },
      {
        heading: 'Why spacing works',
        text: 'Memory fades along a predictable forgetting curve: steeply at first, then more slowly. Reviewing just before you would have forgotten resets the curve and makes the next decline slower, so each successive review can be spaced further apart. Cramming packs all the reviews into one night, when the material is already fresh, so the extra repetitions add almost nothing and everything fades together after the test. Spacing also forces you to reconstruct the context each time, which builds more retrieval routes. The practical rule: study the same material on several different days rather than for the same total hours in one sitting.',
      },
      {
        heading: 'Interleaving and desirable difficulties',
        text: 'Doing twenty problems of the same type in a row (blocked practice) lets you stop thinking about which method to use, so you get faster but do not learn to choose. Mixing problem types (interleaving) feels slower and more frustrating, but it trains the skill exams actually demand: recognizing what kind of problem is in front of you. Psychologists call spacing, interleaving and retrieval "desirable difficulties" because the extra effort during practice produces better long-term learning. The trap is that easier-feeling methods produce more confidence, so judge a study technique by test results, not by how smooth the session felt.',
      },
    ],
    textbook: [
      { title: 'College Success (OpenStax)', url: `${OSX}college-success`, chapter: `Ch. 3 Managing Your Time and Priorities, Ch. 4 Reading and Note-Taking, Ch. 5 Studying, Memory, and Test Taking — ${PDF}` },
    ],
  },
  'test-taking-strategies': {
    examples: [
      {
        problem: 'A test has 50 multiple-choice questions in 75 minutes. Build a time budget.',
        steps: [
          'Reserve 5 minutes at the end to review flagged questions: 75 − 5 = 70 minutes.',
          '70 / 50 = 1.4 minutes per question, about 84 seconds.',
          'Set checkpoints: question 25 by the 35-minute mark, question 40 by the 56-minute mark.',
          'If a question passes 2 minutes, mark a best guess, flag it, and move on.',
        ],
        answer: 'About 1.4 min/question with checkpoints at 25 and 40, plus a 5-minute review reserve.',
      },
      {
        problem: 'Is guessing worth it? Compare a test with no penalty to one with a −1/4 point penalty per wrong answer (5 choices).',
        steps: [
          'No penalty: expected gain from a blind guess = 1/5 > 0, so always answer.',
          'With −1/4 penalty and 5 choices: EV = (1/5)(1) + (4/5)(−1/4) = 0.2 − 0.2 = 0, break-even.',
          'Eliminate one choice: EV = (1/4)(1) + (3/4)(−1/4) = 0.25 − 0.1875 = 0.0625 > 0.',
          'So even with a penalty, guessing pays as soon as you can rule out a single option.',
        ],
        answer: 'Always answer when there is no penalty; with a penalty, guess once you have eliminated at least one choice.',
      },
      {
        problem: 'A 10-point free-response question has parts (a) 2 pts, (b) 3 pts, (c) 5 pts and you are short on time. What do you do?',
        steps: [
          'Read all parts first; (c) is worth half the points, so it deserves half the time.',
          'Do (a) and (b) quickly since they are often setup for (c).',
          'For (c), write the governing equation, define variables and show the method even if the arithmetic is unfinished; partial credit follows the method.',
          'Never leave a part blank: a labeled diagram or a stated formula can earn a point.',
        ],
        answer: 'Allocate time by point value, show method for partial credit, and leave nothing blank.',
      },
    ],
    deeper: [
      {
        heading: 'Why test anxiety hurts performance and how to blunt it',
        text: 'Anxiety loads working memory with worries, leaving less capacity for the problem in front of you; that is why students "blank" on material they knew the night before. Two evidence-backed fixes: expressive writing, spending five minutes before the test writing about your worries, which offloads them; and reinterpreting the racing heart as readiness rather than fear, which has been shown to improve scores. Preparation matters too: practicing under timed, test-like conditions makes the real thing familiar, and a slow exhale for a few breaths lowers physiological arousal enough to think. The first minute of the test is for settling, not solving.',
      },
      {
        heading: 'Reading questions the way graders write them',
        text: 'Every question contains instructions hidden in its wording. Command words tell you what a full answer looks like: "describe" wants features, "explain" wants causes or mechanisms, "compare" needs both similarities and differences, and "evaluate" wants a judgment plus reasons. Qualifiers such as always, never, only and except change the meaning of an entire multiple-choice stem, so underline them. Free-response rubrics award points for specific elements, so a well-organized answer that names the concept, applies it and states a conclusion collects more points than a long unfocused one. Answer the question that was asked, not the one you studied for.',
      },
      {
        heading: 'Multiple choice is a reasoning task, not a recognition task',
        text: 'Well-written distractors are designed to look right to someone with partial knowledge, so recognizing a familiar phrase is not evidence. Cover the choices and answer the stem in your own words first; then look for the option that matches. Eliminate options that are true statements but do not answer the question, options with absolute words, and options that contradict the stem. When two choices are opposites, one is often correct. Change an answer only for a concrete reason, such as a misread word; research shows that reasoned changes are more often from wrong to right, but impulsive second-guessing is not.',
      },
    ],
    textbook: [
      { title: 'College Success (OpenStax)', url: `${OSX}college-success`, chapter: `Ch. 5 Studying, Memory, and Test Taking (test-taking strategies and test anxiety) — ${PDF}` },
    ],
  },
  'si-units-conversions': {
    examples: [
      {
        problem: 'Convert 72 km/h to m/s.',
        steps: [
          'Write the conversion factors so unwanted units cancel: 72 km/h × (1000 m / 1 km) × (1 h / 3600 s).',
          '72 × 1000 / 3600 = 72000 / 3600 = 20.',
          'Shortcut: divide km/h by 3.6 to get m/s.',
        ],
        answer: '20 m/s',
      },
      {
        problem: 'Convert a density of 2.5 g/cm³ to kg/m³.',
        steps: [
          '2.5 g/cm³ × (1 kg / 1000 g) × (100 cm / 1 m)³.',
          '(100)³ = 1,000,000, so the factor is 1,000,000 / 1000 = 1000.',
          '2.5 × 1000 = 2500 kg/m³.',
          'Rule to remember: 1 g/cm³ = 1000 kg/m³ (water).',
        ],
        answer: '2500 kg/m³',
      },
      {
        problem: 'Express 0.00045 m in scientific notation and in micrometers.',
        steps: [
          'Move the decimal 4 places right: 0.00045 = 4.5 × 10⁻⁴ m.',
          '1 µm = 10⁻⁶ m, so divide by 10⁻⁶: 4.5 × 10⁻⁴ / 10⁻⁶ = 4.5 × 10² µm.',
          'That is 450 µm (or 0.45 mm).',
        ],
        answer: '4.5 × 10⁻⁴ m = 450 µm',
      },
      {
        problem: 'Apply significant-figure rules: (a) 12.11 + 0.3, (b) 4.56 × 1.4, (c) 3 h 20 min in seconds.',
        steps: [
          '(a) Addition keeps the fewest decimal places: 12.11 + 0.3 = 12.41 → 12.4 (one decimal place).',
          '(b) Multiplication keeps the fewest significant figures: 4.56 × 1.4 = 6.384 → 6.4 (two sig figs).',
          '(c) 3 h 20 min = 200 min × 60 s/min = 12,000 s = 1.2 × 10⁴ s (exact conversions do not limit sig figs).',
        ],
        answer: '(a) 12.4  (b) 6.4  (c) 1.2 × 10⁴ s',
      },
    ],
    deeper: [
      {
        heading: 'Why dimensional analysis always works',
        text: 'A conversion factor such as 1000 m / 1 km equals exactly 1, because the numerator and denominator are the same length written two ways. Multiplying by 1 never changes a quantity, only its appearance, so you can chain as many factors as you like as long as each one is a true equality. Writing the units and cancelling them like algebraic variables is what makes the method self-checking: if the leftover units are not the ones you want, you flipped a factor. Squared and cubed units need the factor raised to the same power, which is the most common source of error in area, volume and density conversions.',
      },
      {
        heading: 'What significant figures actually represent',
        text: 'Significant figures are a rough way of tracking measurement uncertainty. A ruler marked in millimeters gives 12.3 cm, three sig figs, because the last digit is an estimate; writing 12.300 would claim precision the ruler does not have. When you add, the answer cannot be more precise than the least precise decimal place; when you multiply, it cannot be more precise, relatively, than the least precise factor. Exact numbers, like 60 s in a minute or the 2 in a diameter formula, are not measurements and never limit sig figs. Keep extra digits during intermediate steps and round only at the end.',
      },
      {
        heading: 'Why the SI base units are what they are',
        text: 'The SI system defines seven base units (metre, kilogram, second, ampere, kelvin, mole, candela) and builds every other unit from them, so a newton is kg·m/s² and a joule is a newton-metre. Since 2019 all seven are defined by fixing the values of natural constants such as the speed of light and Planck\'s constant, rather than by physical artifacts, so any lab can reproduce them. Checking that both sides of an equation have the same base units, called dimensional analysis, catches wrong formulas before you compute: if you derive a speed and the units come out as m/s², something is missing.',
      },
    ],
    textbook: [
      { title: 'College Physics 2e (OpenStax)', url: `${OSX}college-physics-2e`, chapter: `Ch. 1 Introduction: The Nature of Science and Physics (units, unit conversion, accuracy and significant figures) — ${PDF}` },
      { title: 'Chemistry 2e (OpenStax)', url: `${OSX}chemistry-2e`, chapter: `Ch. 1 Essential Ideas (measurements, measurement uncertainty, dimensional analysis) — ${PDF}` },
    ],
  },
  'programming-basics': {
    examples: [
      {
        problem: 'Trace this Python code and state the output: total = 0; for i in range(1, 5): total += i * i; print(total)',
        steps: [
          'range(1, 5) produces 1, 2, 3, 4 (the stop value is excluded).',
          'i = 1: total = 0 + 1 = 1. i = 2: total = 1 + 4 = 5.',
          'i = 3: total = 5 + 9 = 14. i = 4: total = 14 + 16 = 30.',
          'The loop ends and print shows 30.',
        ],
        answer: '30',
      },
      {
        problem: 'Write a function that returns the largest number in a non-empty list without using max().',
        steps: [
          'Start with the first element as the current best: best = nums[0].',
          'Loop over the remaining elements; if an element is larger than best, replace best.',
          'Return best after the loop. Python: def largest(nums): best = nums[0]; for n in nums[1:]: if n > best: best = n; return best',
          'Test: largest([3, 9, 2]) → 9; largest([−5, −1]) → −1 (starting at 0 would fail this case); largest([7]) → 7.',
        ],
        answer: 'Track a running best starting from the first element; O(n) time. Edge cases: negatives and single-element lists.',
      },
      {
        problem: 'Find the bug: for i in range(1, len(items)): print(items[i])  — it is supposed to print every item.',
        steps: [
          'range(1, len(items)) starts at index 1, so items[0] is skipped: a classic off-by-one error.',
          'Fix by starting at 0: range(len(items)), or better, loop directly: for item in items: print(item).',
          'Test with a one-element list: the buggy version prints nothing; the fixed version prints the item.',
        ],
        answer: 'Start the range at 0 (or iterate over the list directly).',
      },
      {
        problem: 'What is the Big-O time of: (a) checking whether a list of n items contains a value, (b) binary search on a sorted list, (c) a nested loop over all pairs?',
        steps: [
          '(a) Worst case looks at every element once: O(n).',
          '(b) Each step halves the remaining range; halving n down to 1 takes log₂ n steps: O(log n). For n = 1,000,000 that is only about 20 comparisons.',
          '(c) The inner loop runs n times for each of n outer iterations: n × n = O(n²). For n = 10,000 that is 100 million steps.',
        ],
        answer: '(a) O(n)  (b) O(log n)  (c) O(n²)',
      },
    ],
    deeper: [
      {
        heading: 'Why Big-O ignores constants',
        text: 'Big-O describes how running time grows as the input gets large, not how fast one run is. An algorithm that takes 5n steps and one that takes 100n steps are both O(n) because, as n grows, doubling the input doubles the work for both; the constant only shifts the line. What matters is the shape of the curve: O(n²) will eventually lose to O(n log n) no matter how well it is optimized, because squaring grows faster than any constant multiple. That is why you choose the algorithm first and micro-optimize second, and why a sort that is fine for 100 items can freeze a program at 100,000.',
      },
      {
        heading: 'Variables, references and why lists surprise beginners',
        text: 'A variable is a name bound to a value. For numbers and strings, assignment copies the value, so changing one variable cannot affect another. Lists, dictionaries and objects are different: the variable holds a reference to a container, so b = a makes both names point at the same list and appending through b shows up through a. Passing a list into a function passes that same reference, which is why functions can modify their arguments. If you need an independent copy, make one explicitly (list(a), a[:], copy.deepcopy). Most "the variable changed by itself" bugs are two names sharing one object.',
      },
      {
        heading: 'How recursion actually works',
        text: 'A recursive function calls itself on a smaller version of the problem and trusts that the smaller call returns the right answer. Two parts are non-negotiable: a base case that returns without recursing, and a recursive step that moves strictly toward the base case; without both the function recurses forever and overflows the call stack. Each call gets its own local variables on the stack, which is why factorial(5) can be waiting on factorial(4) without confusion. Recursion is natural for trees, nested structures and divide-and-conquer algorithms, but any recursion can be rewritten as a loop with an explicit stack when depth or performance is a concern.',
      },
    ],
    textbook: [
      { title: 'Introduction to Python Programming (OpenStax)', url: `${OSX}introduction-python-programming`, chapter: `Ch. 2–6 Variables, Expressions, Conditionals, Loops, Functions; Ch. 8–9 Lists and Dictionaries — ${PDF}` },
      { title: 'Introduction to Computer Science (OpenStax)', url: `${OSX}introduction-computer-science`, chapter: `Ch. 3 Data Structures and Algorithms (Big-O, searching, sorting) — ${PDF}` },
    ],
  },
  'spanish-french-essentials': {
    examples: [
      {
        problem: 'Conjugate the Spanish verb hablar (to speak) in the present tense and use it in a sentence.',
        steps: [
          'Remove the -ar ending to get the stem habl-.',
          'Add the present -ar endings: -o, -as, -a, -amos, -áis, -an.',
          'hablo, hablas, habla, hablamos, habláis, hablan.',
          'Sentence: "Nosotros hablamos español en clase." (We speak Spanish in class.)',
        ],
        answer: 'hablo, hablas, habla, hablamos, habláis, hablan',
      },
      {
        problem: 'Choose ser or estar: "Ella ___ médica." and "Ella ___ cansada hoy."',
        steps: [
          'Profession is a permanent characteristic (DOCTOR: description, occupation, characteristic, time, origin, relationship) → ser: "Ella es médica."',
          'Being tired is a temporary condition (PLACE: position, location, action, condition, emotion) → estar: "Ella está cansada hoy."',
          'Contrast: "es aburrida" = she is boring; "está aburrida" = she is bored.',
        ],
        answer: '"Ella es médica." / "Ella está cansada hoy."',
      },
      {
        problem: 'Put the French verbs manger (to eat) and aller (to go) into the passé composé for "je" and "elle".',
        steps: [
          'Most verbs use avoir + past participle: manger → mangé. "J\'ai mangé", "Elle a mangé".',
          'Verbs of motion (the DR & MRS VANDERTRAMP list) use être, and the participle agrees with the subject: aller → allé.',
          '"Je suis allé" (male speaker) or "Je suis allée" (female speaker); "Elle est allée".',
        ],
        answer: 'J\'ai mangé / Elle a mangé; Je suis allé(e) / Elle est allée',
      },
      {
        problem: 'Translate "the red cars" into Spanish and French, checking gender and number agreement.',
        steps: [
          'Spanish: coche is masculine, plural coches; the article and adjective must also be masculine plural: los coches rojos.',
          'French: voiture is feminine, plural voitures; the adjective rouge adds -s for the plural: les voitures rouges.',
          'Note the adjective follows the noun in both languages (most color adjectives do).',
        ],
        answer: 'los coches rojos / les voitures rouges',
      },
    ],
    deeper: [
      {
        heading: 'Why verb endings carry so much information',
        text: 'English relies on separate subject pronouns because its verbs barely change ("I speak, you speak, we speak"). Spanish and French verbs encode the subject in the ending, which is why Spanish can drop the pronoun entirely: hablamos can only mean "we speak". Learning the endings as a pattern rather than as isolated words pays off quickly, because thousands of regular verbs follow the same three or four templates. Irregular verbs are almost always the most frequent ones (ser, ir, tener, être, avoir, aller), so they are worth memorizing as a set early, since they also serve as helping verbs for other tenses.',
      },
      {
        heading: 'Grammatical gender is a sorting system, not a meaning',
        text: 'Every noun in Spanish and French belongs to a gender class, and that class controls the form of its articles and adjectives. The gender rarely says anything about the object: a table is feminine (la mesa, la table) and a book is masculine (el libro, le livre). Because gender is arbitrary, learn each noun with its article as a single chunk ("la mesa", never just "mesa"). Word endings give strong hints (Spanish -o/-a, -ción, -dad; French -eau, -ment, -tion, -ette), and agreement is what makes sentences sound right to native speakers, so an adjective in the wrong gender is heard immediately even when the meaning is clear.',
      },
      {
        heading: 'Why accents are not optional',
        text: 'In Spanish, written accents mark which syllable is stressed when the word breaks the default rules, and they distinguish words that are otherwise identical: hablo (I speak) versus habló (he spoke), and el (the) versus él (he). In French, accents change vowel sounds (é vs è) and separate homophones such as ou (or) and où (where). Leaving them off is a spelling error, and on exams it can change the tense of your answer. Learn accent placement together with pronunciation, saying words aloud, so that the written mark and the spoken stress reinforce each other rather than being memorized separately.',
      },
    ],
    textbook: [
      { title: 'College Success (OpenStax)', url: `${OSX}college-success`, chapter: `Ch. 5 Studying, Memory, and Test Taking (memory and spaced review strategies for vocabulary) — ${PDF}; OpenStax has no Spanish or French course text, so pair this with your class textbook` },
    ],
  },
};

export const TOPICS: Topic[] = BASE_TOPICS.map((t) => ({ ...t, ...DEPTH[t.id] }));

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
