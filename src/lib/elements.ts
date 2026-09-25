// Periodic table data and chemistry helpers (molar mass, electron configurations). Loaded with the tool only.
export type Category = 'alkali' | 'alkaline' | 'transition' | 'post-transition' | 'metalloid' | 'nonmetal' | 'halogen' | 'noble' | 'lanthanide' | 'actinide';
export type Block = 's' | 'p' | 'd' | 'f';

export interface Element {
  z: number;
  symbol: string;
  name: string;
  mass: number; // standard atomic weight (or the most stable isotope's mass number for radioactive elements)
  massIsotope: boolean; // true when `mass` is a mass number in [brackets]
  category: Category;
  period: number;
  group: number | null; // null for the lanthanide/actinide rows
  block: Block;
  state: 'solid' | 'liquid' | 'gas' | 'unknown';
}

export const CATEGORY_LABEL: Record<Category, string> = {
  alkali: 'Alkali metal',
  alkaline: 'Alkaline earth metal',
  transition: 'Transition metal',
  'post-transition': 'Post-transition metal',
  metalloid: 'Metalloid',
  nonmetal: 'Nonmetal',
  halogen: 'Halogen',
  noble: 'Noble gas',
  lanthanide: 'Lanthanide',
  actinide: 'Actinide',
};

// Z|symbol|name|mass|category code  ([mass] = mass number of the most stable isotope)
const C: Record<string, Category> = {
  a: 'alkali',
  e: 'alkaline',
  t: 'transition',
  p: 'post-transition',
  m: 'metalloid',
  n: 'nonmetal',
  h: 'halogen',
  g: 'noble',
  l: 'lanthanide',
  c: 'actinide',
};
const RAW = `H Hydrogen 1.008 n|He Helium 4.0026 g|Li Lithium 6.94 a|Be Beryllium 9.0122 e|B Boron 10.81 m|C Carbon 12.011 n|N Nitrogen 14.007 n|O Oxygen 15.999 n|F Fluorine 18.998 h|Ne Neon 20.180 g|Na Sodium 22.990 a|Mg Magnesium 24.305 e|Al Aluminum 26.982 p|Si Silicon 28.085 m|P Phosphorus 30.974 n|S Sulfur 32.06 n|Cl Chlorine 35.45 h|Ar Argon 39.948 g|K Potassium 39.098 a|Ca Calcium 40.078 e|Sc Scandium 44.956 t|Ti Titanium 47.867 t|V Vanadium 50.942 t|Cr Chromium 51.996 t|Mn Manganese 54.938 t|Fe Iron 55.845 t|Co Cobalt 58.933 t|Ni Nickel 58.693 t|Cu Copper 63.546 t|Zn Zinc 65.38 t|Ga Gallium 69.723 p|Ge Germanium 72.630 m|As Arsenic 74.922 m|Se Selenium 78.971 n|Br Bromine 79.904 h|Kr Krypton 83.798 g|Rb Rubidium 85.468 a|Sr Strontium 87.62 e|Y Yttrium 88.906 t|Zr Zirconium 91.224 t|Nb Niobium 92.906 t|Mo Molybdenum 95.95 t|Tc Technetium [98] t|Ru Ruthenium 101.07 t|Rh Rhodium 102.91 t|Pd Palladium 106.42 t|Ag Silver 107.87 t|Cd Cadmium 112.41 t|In Indium 114.82 p|Sn Tin 118.71 p|Sb Antimony 121.76 m|Te Tellurium 127.60 m|I Iodine 126.90 h|Xe Xenon 131.29 g|Cs Cesium 132.91 a|Ba Barium 137.33 e|La Lanthanum 138.91 l|Ce Cerium 140.12 l|Pr Praseodymium 140.91 l|Nd Neodymium 144.24 l|Pm Promethium [145] l|Sm Samarium 150.36 l|Eu Europium 151.96 l|Gd Gadolinium 157.25 l|Tb Terbium 158.93 l|Dy Dysprosium 162.50 l|Ho Holmium 164.93 l|Er Erbium 167.26 l|Tm Thulium 168.93 l|Yb Ytterbium 173.05 l|Lu Lutetium 174.97 l|Hf Hafnium 178.49 t|Ta Tantalum 180.95 t|W Tungsten 183.84 t|Re Rhenium 186.21 t|Os Osmium 190.23 t|Ir Iridium 192.22 t|Pt Platinum 195.08 t|Au Gold 196.97 t|Hg Mercury 200.59 t|Tl Thallium 204.38 p|Pb Lead 207.2 p|Bi Bismuth 208.98 p|Po Polonium [209] p|At Astatine [210] h|Rn Radon [222] g|Fr Francium [223] a|Ra Radium [226] e|Ac Actinium [227] c|Th Thorium 232.04 c|Pa Protactinium 231.04 c|U Uranium 238.03 c|Np Neptunium [237] c|Pu Plutonium [244] c|Am Americium [243] c|Cm Curium [247] c|Bk Berkelium [247] c|Cf Californium [251] c|Es Einsteinium [252] c|Fm Fermium [257] c|Md Mendelevium [258] c|No Nobelium [259] c|Lr Lawrencium [266] c|Rf Rutherfordium [267] t|Db Dubnium [268] t|Sg Seaborgium [269] t|Bh Bohrium [270] t|Hs Hassium [277] t|Mt Meitnerium [278] t|Ds Darmstadtium [281] t|Rg Roentgenium [282] t|Cn Copernicium [285] t|Nh Nihonium [286] p|Fl Flerovium [289] p|Mc Moscovium [290] p|Lv Livermorium [293] p|Ts Tennessine [294] h|Og Oganesson [294] g`;

export function periodOf(z: number): number {
  return z <= 2 ? 1 : z <= 10 ? 2 : z <= 18 ? 3 : z <= 36 ? 4 : z <= 54 ? 5 : z <= 86 ? 6 : 7;
}

export function groupOf(z: number): number | null {
  const p = periodOf(z);
  if (p === 1) return z === 1 ? 1 : 18;
  if (p <= 3) {
    const i = z - (p === 2 ? 2 : 10); // 1..8
    return i <= 2 ? i : i + 10;
  }
  if (p <= 5) return z - (p === 4 ? 18 : 36);
  const start = p === 6 ? 54 : 86;
  const i = z - start;
  if (i <= 2) return i;
  if ((z >= 57 && z <= 71) || (z >= 89 && z <= 103)) return null;
  return z - (p === 6 ? 68 : 100);
}

function blockOf(z: number, g: number | null): Block {
  if (g === null) return 'f';
  if (z === 2 || g <= 2) return 's';
  return g >= 13 ? 'p' : 'd';
}

const GASES = new Set([1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86]);
const LIQUIDS = new Set([35, 80]);

export const ELEMENTS: Element[] = RAW.split('|').map((row, i) => {
  const [symbol, name, m, c] = row.split(' ');
  const z = i + 1;
  const group = groupOf(z);
  const massIsotope = m.startsWith('[');
  return {
    z,
    symbol,
    name,
    mass: Number(m.replace(/[[\]]/g, '')),
    massIsotope,
    category: C[c],
    period: periodOf(z),
    group,
    block: blockOf(z, group),
    state: GASES.has(z) ? 'gas' : LIQUIDS.has(z) ? 'liquid' : z >= 100 ? 'unknown' : 'solid',
  };
});

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));
export const element = (symbol: string): Element | undefined => BY_SYMBOL.get(symbol);

// ---------- electron configurations ----------
const ORDER = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'];
const CAP: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 };
const NOBLE: [number, string][] = [
  [86, 'Rn'],
  [54, 'Xe'],
  [36, 'Kr'],
  [18, 'Ar'],
  [10, 'Ne'],
  [2, 'He'],
];
// well-known exceptions to the filling order (ground states)
const EXCEPTIONS: Record<number, string> = {
  24: '[Ar] 3d5 4s1',
  29: '[Ar] 3d10 4s1',
  41: '[Kr] 4d4 5s1',
  42: '[Kr] 4d5 5s1',
  44: '[Kr] 4d7 5s1',
  45: '[Kr] 4d8 5s1',
  46: '[Kr] 4d10',
  47: '[Kr] 4d10 5s1',
  57: '[Xe] 5d1 6s2',
  58: '[Xe] 4f1 5d1 6s2',
  64: '[Xe] 4f7 5d1 6s2',
  78: '[Xe] 4f14 5d9 6s1',
  79: '[Xe] 4f14 5d10 6s1',
  89: '[Rn] 6d1 7s2',
  90: '[Rn] 6d2 7s2',
  91: '[Rn] 5f2 6d1 7s2',
  92: '[Rn] 5f3 6d1 7s2',
  93: '[Rn] 5f4 6d1 7s2',
  96: '[Rn] 5f7 6d1 7s2',
  103: '[Rn] 5f14 7s2 7p1',
};

/** Ground-state configuration in noble-gas shorthand, in filling order (e.g. "[Ar] 4s2 3d10 4p3"). */
export function electronConfig(z: number): string {
  if (EXCEPTIONS[z]) return EXCEPTIONS[z];
  const core = NOBLE.find(([nz]) => nz < z);
  let left = z - (core?.[0] ?? 0);
  const filled = new Set<string>();
  // skip the subshells the noble-gas core already holds
  let coreLeft = core?.[0] ?? 0;
  for (const sub of ORDER) {
    const cap = CAP[sub[1]];
    if (coreLeft >= cap) {
      coreLeft -= cap;
      filled.add(sub);
    } else break;
  }
  const parts: string[] = [];
  for (const sub of ORDER) {
    if (filled.has(sub) || left <= 0) continue;
    const n = Math.min(CAP[sub[1]], left);
    parts.push(`${sub}${n}`);
    left -= n;
  }
  return [core ? `[${core[1]}]` : '', ...parts].filter(Boolean).join(' ');
}

// ---------- molar mass ----------
export interface FormulaResult {
  mass: number;
  counts: Record<string, number>; // element symbol → atoms
  percent: { symbol: string; atoms: number; mass: number; percent: number }[];
}

/**
 * Molar mass of a formula like "H2SO4", "Ca(OH)2", "[Cu(NH3)4]SO4" or "CuSO4·5H2O" (also "*" or "." for hydrates).
 * Throws with a readable message for unknown elements or unbalanced brackets.
 */
export function molarMass(formula: string): FormulaResult {
  const src = formula.replace(/\s+/g, '').replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)));
  if (!src) throw new Error('Type a formula, e.g. H2O');
  const counts: Record<string, number> = {};
  for (const part of src.split(/[·•*]|\.(?=\d*[A-Z([])/)) {
    const m = /^(\d+)(.*)$/.exec(part);
    const mult = m ? Number(m[1]) : 1;
    const body = m ? m[2] : part;
    const c = parseGroup(body);
    for (const [k, v] of Object.entries(c)) counts[k] = (counts[k] ?? 0) + v * mult;
  }
  let mass = 0;
  for (const [sym, n] of Object.entries(counts)) mass += element(sym)!.mass * n;
  const percent = Object.entries(counts).map(([symbol, atoms]) => {
    const m = element(symbol)!.mass * atoms;
    return { symbol, atoms, mass: m, percent: (m / mass) * 100 };
  });
  return { mass, counts, percent };
}

function parseGroup(s: string): Record<string, number> {
  const stack: Record<string, number>[] = [{}];
  let i = 0;
  const num = () => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return 1;
    i += m[0].length;
    return Number(m[0]);
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(' || ch === '[') {
      stack.push({});
      i++;
    } else if (ch === ')' || ch === ']') {
      i++;
      const top = stack.pop();
      if (!top || !stack.length) throw new Error('A bracket closes that never opened');
      const n = num();
      const into = stack[stack.length - 1];
      for (const [k, v] of Object.entries(top)) into[k] = (into[k] ?? 0) + v * n;
    } else {
      const m = /^[A-Z][a-z]?/.exec(s.slice(i));
      if (!m) throw new Error(`Unexpected “${ch}” (element symbols start with a capital letter)`);
      const sym = m[0].length === 2 && !element(m[0]) && element(m[0][0]) ? m[0][0] : m[0];
      if (!element(sym)) throw new Error(`“${sym}” isn't an element`);
      i += sym.length;
      const n = num();
      const top = stack[stack.length - 1];
      top[sym] = (top[sym] ?? 0) + n;
    }
  }
  if (stack.length !== 1) throw new Error('A bracket is never closed');
  return stack[0];
}
