// Unit conversions for science and everyday homework. Each unit has a factor to the category's base unit;
// temperature uses explicit formulas.
export interface Unit {
  id: string;
  label: string;
  factor?: number; // base units per 1 of this unit
}
export interface Category {
  id: string;
  label: string;
  units: Unit[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'length',
    label: 'Length',
    units: [
      { id: 'mm', label: 'millimeters (mm)', factor: 0.001 },
      { id: 'cm', label: 'centimeters (cm)', factor: 0.01 },
      { id: 'm', label: 'meters (m)', factor: 1 },
      { id: 'km', label: 'kilometers (km)', factor: 1000 },
      { id: 'in', label: 'inches (in)', factor: 0.0254 },
      { id: 'ft', label: 'feet (ft)', factor: 0.3048 },
      { id: 'yd', label: 'yards (yd)', factor: 0.9144 },
      { id: 'mi', label: 'miles (mi)', factor: 1609.344 },
      { id: 'nm', label: 'nanometers (nm)', factor: 1e-9 },
      { id: 'um', label: 'micrometers (µm)', factor: 1e-6 },
      { id: 'ly', label: 'light-years', factor: 9.4607304725808e15 },
      { id: 'au', label: 'astronomical units (AU)', factor: 1.495978707e11 },
    ],
  },
  {
    id: 'mass',
    label: 'Mass',
    units: [
      { id: 'mg', label: 'milligrams (mg)', factor: 1e-6 },
      { id: 'g', label: 'grams (g)', factor: 0.001 },
      { id: 'kg', label: 'kilograms (kg)', factor: 1 },
      { id: 't', label: 'metric tons (t)', factor: 1000 },
      { id: 'oz', label: 'ounces (oz)', factor: 0.028349523125 },
      { id: 'lb', label: 'pounds (lb)', factor: 0.45359237 },
      { id: 'st', label: 'stone', factor: 6.35029318 },
      { id: 'ton', label: 'US tons', factor: 907.18474 },
      { id: 'u', label: 'atomic mass units (u)', factor: 1.6605390666e-27 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    units: [
      { id: 'ml', label: 'milliliters (mL)', factor: 1e-6 },
      { id: 'l', label: 'liters (L)', factor: 0.001 },
      { id: 'm3', label: 'cubic meters (m³)', factor: 1 },
      { id: 'cm3', label: 'cubic centimeters (cm³)', factor: 1e-6 },
      { id: 'tsp', label: 'teaspoons (US)', factor: 4.92892159375e-6 },
      { id: 'tbsp', label: 'tablespoons (US)', factor: 1.478676478125e-5 },
      { id: 'floz', label: 'fluid ounces (US)', factor: 2.95735295625e-5 },
      { id: 'cup', label: 'cups (US)', factor: 2.365882365e-4 },
      { id: 'pt', label: 'pints (US)', factor: 4.73176473e-4 },
      { id: 'qt', label: 'quarts (US)', factor: 9.46352946e-4 },
      { id: 'gal', label: 'gallons (US)', factor: 3.785411784e-3 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      { id: 'c', label: 'Celsius (°C)' },
      { id: 'f', label: 'Fahrenheit (°F)' },
      { id: 'k', label: 'Kelvin (K)' },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    units: [
      { id: 'ms', label: 'milliseconds', factor: 0.001 },
      { id: 's', label: 'seconds', factor: 1 },
      { id: 'min', label: 'minutes', factor: 60 },
      { id: 'h', label: 'hours', factor: 3600 },
      { id: 'd', label: 'days', factor: 86400 },
      { id: 'wk', label: 'weeks', factor: 604800 },
      { id: 'yr', label: 'years (365.25 d)', factor: 31557600 },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    units: [
      { id: 'mps', label: 'meters/second', factor: 1 },
      { id: 'kph', label: 'kilometers/hour', factor: 1 / 3.6 },
      { id: 'mph', label: 'miles/hour', factor: 0.44704 },
      { id: 'fps', label: 'feet/second', factor: 0.3048 },
      { id: 'kn', label: 'knots', factor: 0.514444444 },
      { id: 'c', label: 'speed of light', factor: 299792458 },
    ],
  },
  {
    id: 'area',
    label: 'Area',
    units: [
      { id: 'cm2', label: 'cm²', factor: 1e-4 },
      { id: 'm2', label: 'm²', factor: 1 },
      { id: 'km2', label: 'km²', factor: 1e6 },
      { id: 'ha', label: 'hectares', factor: 1e4 },
      { id: 'in2', label: 'in²', factor: 6.4516e-4 },
      { id: 'ft2', label: 'ft²', factor: 0.09290304 },
      { id: 'ac', label: 'acres', factor: 4046.8564224 },
      { id: 'mi2', label: 'mi²', factor: 2589988.110336 },
    ],
  },
  {
    id: 'energy',
    label: 'Energy',
    units: [
      { id: 'j', label: 'joules (J)', factor: 1 },
      { id: 'kj', label: 'kilojoules (kJ)', factor: 1000 },
      { id: 'cal', label: 'calories (cal)', factor: 4.184 },
      { id: 'kcal', label: 'kilocalories (Cal)', factor: 4184 },
      { id: 'wh', label: 'watt-hours (Wh)', factor: 3600 },
      { id: 'kwh', label: 'kilowatt-hours (kWh)', factor: 3.6e6 },
      { id: 'ev', label: 'electronvolts (eV)', factor: 1.602176634e-19 },
      { id: 'btu', label: 'BTU', factor: 1055.05585262 },
    ],
  },
  {
    id: 'pressure',
    label: 'Pressure',
    units: [
      { id: 'pa', label: 'pascals (Pa)', factor: 1 },
      { id: 'kpa', label: 'kilopascals (kPa)', factor: 1000 },
      { id: 'atm', label: 'atmospheres (atm)', factor: 101325 },
      { id: 'bar', label: 'bar', factor: 1e5 },
      { id: 'mmhg', label: 'mmHg (torr)', factor: 133.322387415 },
      { id: 'psi', label: 'psi', factor: 6894.757293168 },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    units: [
      { id: 'bit', label: 'bits', factor: 0.125 },
      { id: 'b', label: 'bytes', factor: 1 },
      { id: 'kb', label: 'kilobytes (kB)', factor: 1e3 },
      { id: 'mb', label: 'megabytes (MB)', factor: 1e6 },
      { id: 'gb', label: 'gigabytes (GB)', factor: 1e9 },
      { id: 'tb', label: 'terabytes (TB)', factor: 1e12 },
      { id: 'kib', label: 'kibibytes (KiB)', factor: 1024 },
      { id: 'mib', label: 'mebibytes (MiB)', factor: 1024 ** 2 },
      { id: 'gib', label: 'gibibytes (GiB)', factor: 1024 ** 3 },
    ],
  },
];

export function convert(value: number, categoryId: string, from: string, to: string): number {
  if (categoryId === 'temperature') {
    const c = from === 'c' ? value : from === 'f' ? ((value - 32) * 5) / 9 : value - 273.15;
    return to === 'c' ? c : to === 'f' ? (c * 9) / 5 + 32 : c + 273.15;
  }
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const a = cat?.units.find((u) => u.id === from)?.factor;
  const b = cat?.units.find((u) => u.id === to)?.factor;
  if (a === undefined || b === undefined) return NaN;
  return (value * a) / b;
}

/** Readable number: up to `sig` significant digits, scientific notation for very large/small values. */
export function formatNumber(n: number, sig = 6): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9 || abs < 1e-4) {
    const [m, e] = n.toExponential(sig - 1).split('e');
    return `${String(Number(m))} × 10^${Number(e)}`;
  }
  return String(Number(n.toPrecision(sig)));
}
