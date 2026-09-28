// Orebelt: the factory idle game in Play. Static game data: items, buildings, recipes, belts,
// the map's resource nodes, milestones, Launch Tower phases and research. Everything here is plain data.

export type ItemId =
  | 'ironOre'
  | 'copperOre'
  | 'limestone'
  | 'coal'
  | 'crudeOil'
  | 'quartz'
  | 'sulfur'
  | 'goldOre'
  | 'biomass'
  | 'ironIngot'
  | 'copperIngot'
  | 'ironPlate'
  | 'ironRod'
  | 'screw'
  | 'wire'
  | 'cable'
  | 'concrete'
  | 'reinforcedPlate'
  | 'rotor'
  | 'trussFrame'
  | 'steelIngot'
  | 'steelBeam'
  | 'steelPipe'
  | 'copperSheet'
  | 'concreteBeam'
  | 'stator'
  | 'motor'
  | 'plastic'
  | 'rubber'
  | 'fuel'
  | 'heavyChassis'
  | 'silica'
  | 'crystal'
  | 'circuitBoard'
  | 'computer'
  | 'goldIngot'
  | 'fineWire'
  | 'controlUnit'
  | 'blackPowder'
  | 'oscillator'
  | 'supercomputer'
  | 'heavyMotor'
  | 'bauxite'
  | 'alumina'
  | 'aluminiumIngot'
  | 'aluminiumSheet'
  | 'heatSink'
  | 'fusedFrame'
  | 'radioUnit'
  | 'uranium'
  | 'encasedCell'
  | 'uraniumRod';

export type Shape =
  | 'ore'
  | 'leaf'
  | 'drop'
  | 'ingot'
  | 'plate'
  | 'rod'
  | 'screw'
  | 'coil'
  | 'cable'
  | 'block'
  | 'beam'
  | 'pipe'
  | 'frame'
  | 'rotor'
  | 'stator'
  | 'motor'
  | 'pellet'
  | 'canister'
  | 'crystal'
  | 'powder'
  | 'chip'
  | 'box';

export interface ItemDef {
  id: ItemId;
  name: string;
  tier: number;
  shape: Shape;
  color: string;
  /** Coins per unit at the market (0 = not sellable). */
  value?: number;
}

export type Inv = Partial<Record<ItemId, number>>;

const item = (id: ItemId, name: string, tier: number, shape: Shape, color: string, value = 0): ItemDef => ({ id, name, tier, shape, color, value });

export const ITEMS: ItemDef[] = [
  item('ironOre', 'Iron ore', 0, 'ore', '#9a6b5b'),
  item('copperOre', 'Copper ore', 0, 'ore', '#c77a4a'),
  item('limestone', 'Limestone', 0, 'ore', '#cfc6b0'),
  item('coal', 'Coal', 0, 'ore', '#3b3f45'),
  item('crudeOil', 'Crude oil', 0, 'drop', '#2a2230'),
  item('quartz', 'Raw quartz', 0, 'crystal', '#e7b8d8'),
  item('sulfur', 'Sulfur', 0, 'ore', '#e6d34a'),
  item('goldOre', 'Gold ore', 0, 'ore', '#d9a93a'),
  item('biomass', 'Biomass', 0, 'leaf', '#5fa84b'),
  item('ironIngot', 'Iron ingot', 1, 'ingot', '#a7b0ba'),
  item('copperIngot', 'Copper ingot', 1, 'ingot', '#d4834e'),
  item('ironPlate', 'Iron plate', 1, 'plate', '#b8c0c9'),
  item('ironRod', 'Iron rod', 1, 'rod', '#8f9aa6'),
  item('screw', 'Screw', 1, 'screw', '#c3cad2'),
  item('wire', 'Wire', 1, 'coil', '#e08a4c'),
  item('cable', 'Cable', 1, 'cable', '#3d4550'),
  item('concrete', 'Concrete', 1, 'block', '#bdb8ad'),
  item('reinforcedPlate', 'Reinforced plate', 2, 'plate', '#7e8a96', 0.05),
  item('rotor', 'Rotor', 2, 'rotor', '#8e99a3', 0.08),
  item('trussFrame', 'Truss frame', 2, 'frame', '#9aa6b2', 0.2),
  item('steelIngot', 'Steel ingot', 2, 'ingot', '#5e6873'),
  item('steelBeam', 'Steel beam', 2, 'beam', '#56606b', 0.03),
  item('steelPipe', 'Steel pipe', 2, 'pipe', '#6c7782', 0.02),
  item('copperSheet', 'Copper sheet', 3, 'plate', '#cf7a45', 0.03),
  item('concreteBeam', 'Concrete beam', 3, 'beam', '#a9a497', 0.12),
  item('stator', 'Stator', 3, 'stator', '#b4763c', 0.15),
  item('motor', 'Motor', 3, 'motor', '#e0701a', 0.5),
  item('plastic', 'Plastic', 3, 'pellet', '#58b6d8', 0.02),
  item('rubber', 'Rubber', 3, 'pellet', '#33383f', 0.02),
  item('fuel', 'Fuel canister', 3, 'canister', '#d44b3a', 0.02),
  item('heavyChassis', 'Heavy chassis', 3, 'frame', '#48525d', 3),
  item('silica', 'Silica', 4, 'powder', '#e8e2f2', 0.01),
  item('crystal', 'Quartz crystal', 4, 'crystal', '#f09ad0', 0.05),
  item('circuitBoard', 'Circuit board', 4, 'chip', '#2f9b5a', 0.3),
  item('computer', 'Computer', 4, 'box', '#3d8fb3', 2),
  item('goldIngot', 'Gold ingot', 4, 'ingot', '#e8b84a', 0.05),
  item('fineWire', 'Fine wire', 4, 'coil', '#f0c85a', 0.01),
  item('controlUnit', 'Control unit', 4, 'chip', '#8a5cc7', 1),
  item('blackPowder', 'Black powder', 4, 'powder', '#2b2b2b', 0.02),
  item('oscillator', 'Crystal oscillator', 5, 'crystal', '#b15fd6', 2),
  item('supercomputer', 'Supercomputer', 5, 'box', '#14a3b1', 10),
  item('heavyMotor', 'Heavy motor', 5, 'motor', '#c24d1a', 8),
  item('bauxite', 'Bauxite', 6, 'ore', '#c4623a', 0.01),
  item('alumina', 'Alumina', 6, 'powder', '#f3f0e6', 0.02),
  item('aluminiumIngot', 'Aluminium ingot', 6, 'ingot', '#d9dde3', 0.03),
  item('aluminiumSheet', 'Aluminium sheet', 6, 'plate', '#e6eaf0', 0.05),
  item('heatSink', 'Heat sink', 6, 'block', '#9fb3c8', 0.5),
  item('fusedFrame', 'Fused frame', 6, 'frame', '#5b6b7c', 12),
  item('uranium', 'Uranium', 7, 'ore', '#7bc043', 0.02),
  item('encasedCell', 'Encased uranium cell', 7, 'canister', '#9ad64b', 0.5),
  item('uraniumRod', 'Uranium fuel rod', 7, 'rod', '#c8f06a', 20),
  item('radioUnit', 'Radio unit', 7, 'chip', '#e3b341', 15),
];
export const ITEM: Record<ItemId, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<ItemId, ItemDef>;

// ---------- resources on the map ----------
export type Resource = 'iron' | 'copper' | 'limestone' | 'coal' | 'oil' | 'quartz' | 'sulfur' | 'gold' | 'grove' | 'bauxite' | 'uranium';
export type Purity = 'impure' | 'normal' | 'pure';
export const PURITY: Record<Purity, number> = { impure: 0.5, normal: 1, pure: 2 };
export const RESOURCE_ITEM: Record<Resource, ItemId> = {
  iron: 'ironOre',
  copper: 'copperOre',
  limestone: 'limestone',
  coal: 'coal',
  oil: 'crudeOil',
  quartz: 'quartz',
  sulfur: 'sulfur',
  gold: 'goldOre',
  grove: 'biomass',
  bauxite: 'bauxite',
  uranium: 'uranium',
};
export const RESOURCE_NAME: Record<Resource, string> = {
  iron: 'Iron deposit',
  copper: 'Copper deposit',
  limestone: 'Limestone deposit',
  coal: 'Coal seam',
  oil: 'Oil well',
  quartz: 'Quartz deposit',
  sulfur: 'Sulfur vent',
  gold: 'Gold vein',
  grove: 'Grove',
  bauxite: 'Bauxite deposit',
  uranium: 'Uranium deposit',
};

export interface ResourceNode {
  x: number;
  y: number;
  res: Resource;
  purity: Purity;
}

export const MAP_W = 32;
export const MAP_H = 18;
export const CAMP = { x: 2, y: 5 };

/** A rectangle of the map that has to be surveyed (parts + insight) before you can build in it. */
export interface Sector {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cost: Inv;
  insight: number;
  /** Launch Tower tier needed before it can be surveyed. */
  tier: number;
}
/** The home sector is the original 20×12 map; the others open up more nodes (and the only bauxite and uranium). */
export const SECTORS: Sector[] = [
  { id: 'home', name: 'Home Basin', x: 0, y: 0, w: 20, h: 12, cost: {}, insight: 0, tier: 0 },
  { id: 'east', name: 'East Ridge', x: 20, y: 0, w: 12, h: 12, cost: { ironPlate: 100, concrete: 50 }, insight: 1, tier: 1 },
  { id: 'south', name: 'South Flats', x: 0, y: 12, w: 20, h: 6, cost: { steelBeam: 100, concrete: 200 }, insight: 2, tier: 2 },
  { id: 'southeast', name: 'Far Marsh', x: 20, y: 12, w: 12, h: 6, cost: { motor: 30, concreteBeam: 50 }, insight: 3, tier: 3 },
];
export const SECTOR: Record<string, Sector> = Object.fromEntries(SECTORS.map((s) => [s.id, s]));
export function sectorAt(x: number, y: number): Sector | undefined {
  return SECTORS.find((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
}

/** The resource nodes of the (fixed, hand-made) map. The starting area on the left is iron, copper, limestone and groves. */
export const NODES: ResourceNode[] = [
  { x: 4, y: 3, res: 'iron', purity: 'normal' },
  { x: 5, y: 8, res: 'iron', purity: 'impure' },
  { x: 1, y: 2, res: 'grove', purity: 'normal' },
  { x: 3, y: 10, res: 'grove', purity: 'pure' },
  { x: 8, y: 6, res: 'grove', purity: 'impure' },
  { x: 6, y: 1, res: 'copper', purity: 'normal' },
  { x: 7, y: 10, res: 'copper', purity: 'impure' },
  { x: 0, y: 8, res: 'limestone', purity: 'normal' },
  { x: 9, y: 3, res: 'limestone', purity: 'pure' },
  { x: 11, y: 1, res: 'coal', purity: 'normal' },
  { x: 12, y: 8, res: 'coal', purity: 'pure' },
  { x: 14, y: 4, res: 'coal', purity: 'impure' },
  { x: 10, y: 10, res: 'iron', purity: 'pure' },
  { x: 13, y: 0, res: 'copper', purity: 'pure' },
  { x: 16, y: 3, res: 'oil', purity: 'normal' },
  { x: 17, y: 9, res: 'oil', purity: 'pure' },
  { x: 15, y: 7, res: 'quartz', purity: 'normal' },
  { x: 18, y: 1, res: 'quartz', purity: 'pure' },
  { x: 19, y: 6, res: 'sulfur', purity: 'normal' },
  { x: 11, y: 5, res: 'sulfur', purity: 'impure' },
  { x: 17, y: 11, res: 'gold', purity: 'normal' },
  { x: 13, y: 11, res: 'gold', purity: 'impure' },
  { x: 18, y: 4, res: 'iron', purity: 'pure' },
  { x: 15, y: 10, res: 'limestone', purity: 'normal' },
  { x: 9, y: 0, res: 'copper', purity: 'normal' },
  // east ridge
  { x: 22, y: 2, res: 'iron', purity: 'pure' },
  { x: 25, y: 5, res: 'copper', purity: 'pure' },
  { x: 28, y: 1, res: 'oil', purity: 'pure' },
  { x: 30, y: 4, res: 'quartz', purity: 'normal' },
  { x: 23, y: 9, res: 'coal', purity: 'pure' },
  { x: 27, y: 8, res: 'bauxite', purity: 'normal' },
  { x: 30, y: 10, res: 'sulfur', purity: 'pure' },
  { x: 21, y: 6, res: 'limestone', purity: 'pure' },
  { x: 29, y: 7, res: 'gold', purity: 'normal' },
  // south flats
  { x: 2, y: 14, res: 'iron', purity: 'pure' },
  { x: 6, y: 16, res: 'coal', purity: 'normal' },
  { x: 9, y: 13, res: 'oil', purity: 'normal' },
  { x: 12, y: 16, res: 'bauxite', purity: 'pure' },
  { x: 15, y: 13, res: 'gold', purity: 'pure' },
  { x: 18, y: 16, res: 'quartz', purity: 'pure' },
  { x: 4, y: 12, res: 'grove', purity: 'pure' },
  { x: 16, y: 15, res: 'sulfur', purity: 'normal' },
  // far marsh
  { x: 22, y: 13, res: 'uranium', purity: 'normal' },
  { x: 27, y: 16, res: 'uranium', purity: 'pure' },
  { x: 30, y: 13, res: 'bauxite', purity: 'pure' },
  { x: 24, y: 16, res: 'sulfur', purity: 'pure' },
  { x: 29, y: 15, res: 'oil', purity: 'pure' },
  { x: 20, y: 17, res: 'copper', purity: 'pure' },
  { x: 25, y: 12, res: 'gold', purity: 'pure' },
];
export function nodeAt(x: number, y: number): ResourceNode | undefined {
  return NODES.find((n) => n.x === x && n.y === y);
}

// ---------- buildings ----------
export type BuildingId =
  | 'camp'
  | 'miner1'
  | 'miner2'
  | 'miner3'
  | 'pump'
  | 'smelter'
  | 'foundry'
  | 'constructor'
  | 'assembler'
  | 'manufacturer'
  | 'refinery'
  | 'biomassBurner'
  | 'coalGenerator'
  | 'fuelGenerator'
  | 'depot'
  | 'storage'
  | 'loader'
  | 'blender'
  | 'nuclearPlant';
export type BuildingKind = 'camp' | 'miner' | 'producer' | 'generator' | 'depot' | 'storage' | 'loader';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  kind: BuildingKind;
  desc: string;
  /** Power use at 100% clock, in MW. */
  power: number;
  cost: Inv;
  /** Miners: items per minute on a normal node at 100%. Loaders: items per minute pulled from stock. */
  rate?: number;
  /** Miners: which resources they can sit on. */
  mines?: Resource[];
  /** Generators: MW at 100% and the fuel burned per minute. */
  gen?: { fuel: ItemId; mw: number; burn: number };
  /** Max belts in / out. */
  ins: number;
  outs: number;
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'camp', name: 'Base Camp', kind: 'camp', desc: 'Your landing site. Belt anything in to stock it. Provides 20 MW.', power: 0, cost: {}, ins: 6, outs: 0 },
  {
    id: 'miner1',
    name: 'Miner Mk1',
    kind: 'miner',
    desc: 'Drills a resource node. 30/min on a normal node.',
    power: 5,
    rate: 30,
    mines: ['iron', 'copper', 'limestone', 'coal', 'quartz', 'sulfur', 'gold', 'grove'],
    cost: { ironPlate: 10, ironRod: 5 },
    ins: 0,
    outs: 3,
  },
  {
    id: 'miner2',
    name: 'Miner Mk2',
    kind: 'miner',
    desc: 'Twice as fast as the Mk1. 60/min on a normal node.',
    power: 12,
    rate: 60,
    mines: ['iron', 'copper', 'limestone', 'coal', 'quartz', 'sulfur', 'gold', 'grove'],
    cost: { trussFrame: 5, steelPipe: 15, concrete: 20 },
    ins: 0,
    outs: 3,
  },
  {
    id: 'miner3',
    name: 'Miner Mk3',
    kind: 'miner',
    desc: 'Heavy drill. 120/min on a normal node.',
    power: 30,
    rate: 120,
    mines: ['iron', 'copper', 'limestone', 'coal', 'quartz', 'sulfur', 'gold', 'grove', 'bauxite', 'uranium'],
    cost: { computer: 4, heavyChassis: 4, steelPipe: 40 },
    ins: 0,
    outs: 3,
  },
  {
    id: 'pump',
    name: 'Oil Pump',
    kind: 'miner',
    desc: 'Pumps crude oil from a well. 60/min on a normal well.',
    power: 30,
    rate: 60,
    mines: ['oil'],
    cost: { motor: 8, concreteBeam: 8, cable: 40 },
    ins: 0,
    outs: 3,
  },
  { id: 'smelter', name: 'Smelter', kind: 'producer', desc: 'Melts ore into ingots. 1 input.', power: 4, cost: { ironPlate: 6, ironRod: 6 }, ins: 2, outs: 3 },
  { id: 'foundry', name: 'Foundry', kind: 'producer', desc: 'Alloys two materials. 2 inputs.', power: 16, cost: { trussFrame: 8, rotor: 8, concrete: 20 }, ins: 3, outs: 3 },
  { id: 'constructor', name: 'Constructor', kind: 'producer', desc: 'Shapes one part into another. 1 input.', power: 4, cost: { ironPlate: 8, ironRod: 8 }, ins: 2, outs: 3 },
  { id: 'assembler', name: 'Assembler', kind: 'producer', desc: 'Joins two parts. 2 inputs.', power: 15, cost: { ironPlate: 30, screw: 80, cable: 20 }, ins: 3, outs: 3 },
  {
    id: 'manufacturer',
    name: 'Manufacturer',
    kind: 'producer',
    desc: 'Builds complex parts from up to 4 inputs.',
    power: 55,
    cost: { motor: 8, trussFrame: 15, cable: 50, plastic: 50 },
    ins: 5,
    outs: 3,
  },
  {
    id: 'refinery',
    name: 'Refinery',
    kind: 'producer',
    desc: 'Cracks crude oil into plastic, rubber or fuel.',
    power: 30,
    cost: { motor: 8, concreteBeam: 8, steelPipe: 30, concrete: 40 },
    ins: 2,
    outs: 3,
  },
  {
    id: 'biomassBurner',
    name: 'Biomass Burner',
    kind: 'generator',
    desc: 'Burns biomass: 30 MW for 18 biomass/min.',
    power: 0,
    gen: { fuel: 'biomass', mw: 30, burn: 18 },
    cost: { ironPlate: 12, ironRod: 8 },
    ins: 2,
    outs: 0,
  },
  {
    id: 'coalGenerator',
    name: 'Coal Generator',
    kind: 'generator',
    desc: 'Burns coal: 75 MW for 15 coal/min.',
    power: 0,
    gen: { fuel: 'coal', mw: 75, burn: 15 },
    cost: { reinforcedPlate: 15, rotor: 8, cable: 30 },
    ins: 2,
    outs: 0,
  },
  {
    id: 'fuelGenerator',
    name: 'Fuel Generator',
    kind: 'generator',
    desc: 'Burns fuel canisters: 150 MW for 12 fuel/min.',
    power: 0,
    gen: { fuel: 'fuel', mw: 150, burn: 12 },
    cost: { motor: 12, rubber: 40, plastic: 40, concreteBeam: 15 },
    ins: 2,
    outs: 0,
  },
  {
    id: 'blender',
    name: 'Blender',
    kind: 'producer',
    desc: 'Mixes up to 3 inputs: fused frames and uranium cells.',
    power: 75,
    cost: { supercomputer: 5, heavyMotor: 5, concreteBeam: 20, plastic: 100 },
    ins: 4,
    outs: 3,
  },
  {
    id: 'nuclearPlant',
    name: 'Nuclear Plant',
    kind: 'generator',
    desc: 'Burns uranium fuel rods: 600 MW for 1 rod/min.',
    power: 0,
    gen: { fuel: 'uraniumRod', mw: 600, burn: 1 },
    cost: { fusedFrame: 20, heatSink: 50, supercomputer: 10, concreteBeam: 100 },
    ins: 2,
    outs: 0,
  },
  { id: 'depot', name: 'Depot', kind: 'depot', desc: 'A drop-off point: anything belted in goes to your stock.', power: 0, cost: { ironPlate: 10, ironRod: 4 }, ins: 6, outs: 0 },
  {
    id: 'storage',
    name: 'Storage',
    kind: 'storage',
    desc: 'Buffers up to 500 of each item and passes them on: soaks up bursts.',
    power: 0,
    cost: { ironPlate: 20, screw: 20 },
    ins: 3,
    outs: 3,
  },
  {
    id: 'loader',
    name: 'Loader',
    kind: 'loader',
    desc: 'Pulls one item from your stock onto belts, 60/min.',
    power: 4,
    rate: 60,
    cost: { ironPlate: 15, wire: 20 },
    ins: 0,
    outs: 3,
  },
];
export const BUILDING: Record<BuildingId, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingId, BuildingDef>;

export const CAMP_POWER = 20;
/** Most of one item a Storage holds (input and output buffers together). */
export const STORAGE_CAP = 500;

// ---------- recipes ----------
export interface Recipe {
  id: string;
  name: string;
  building: BuildingId;
  /** Seconds per cycle at 100% clock. */
  time: number;
  in: Inv;
  out: Inv;
  alt?: boolean;
}

const r = (id: string, name: string, building: BuildingId, time: number, inp: Inv, out: Inv, alt = false): Recipe => ({ id, name, building, time, in: inp, out, alt });

export const RECIPES: Recipe[] = [
  // smelter
  r('ironIngot', 'Iron ingot', 'smelter', 2, { ironOre: 1 }, { ironIngot: 1 }),
  r('copperIngot', 'Copper ingot', 'smelter', 2, { copperOre: 1 }, { copperIngot: 1 }),
  r('goldIngot', 'Gold ingot', 'smelter', 4, { goldOre: 2 }, { goldIngot: 1 }),
  // foundry
  r('steelIngot', 'Steel ingot', 'foundry', 4, { ironOre: 3, coal: 3 }, { steelIngot: 3 }),
  // constructor
  r('ironPlate', 'Iron plate', 'constructor', 6, { ironIngot: 3 }, { ironPlate: 2 }),
  r('ironRod', 'Iron rod', 'constructor', 4, { ironIngot: 1 }, { ironRod: 1 }),
  r('screw', 'Screw', 'constructor', 6, { ironRod: 1 }, { screw: 4 }),
  r('wire', 'Wire', 'constructor', 4, { copperIngot: 1 }, { wire: 2 }),
  r('cable', 'Cable', 'constructor', 2, { wire: 2 }, { cable: 1 }),
  r('concrete', 'Concrete', 'constructor', 4, { limestone: 3 }, { concrete: 1 }),
  r('copperSheet', 'Copper sheet', 'constructor', 6, { copperIngot: 2 }, { copperSheet: 1 }),
  r('steelBeam', 'Steel beam', 'constructor', 4, { steelIngot: 4 }, { steelBeam: 1 }),
  r('steelPipe', 'Steel pipe', 'constructor', 6, { steelIngot: 3 }, { steelPipe: 2 }),
  r('fineWire', 'Fine wire', 'constructor', 5, { goldIngot: 1 }, { fineWire: 5 }),
  r('silica', 'Silica', 'constructor', 8, { quartz: 3 }, { silica: 5 }),
  r('crystal', 'Quartz crystal', 'constructor', 8, { quartz: 5 }, { crystal: 3 }),
  // assembler
  r('reinforcedPlate', 'Reinforced plate', 'assembler', 12, { ironPlate: 6, screw: 12 }, { reinforcedPlate: 1 }),
  r('rotor', 'Rotor', 'assembler', 15, { ironRod: 5, screw: 25 }, { rotor: 1 }),
  r('trussFrame', 'Truss frame', 'assembler', 60, { reinforcedPlate: 3, ironRod: 12 }, { trussFrame: 2 }),
  r('concreteBeam', 'Concrete beam', 'assembler', 10, { steelBeam: 3, concrete: 6 }, { concreteBeam: 1 }),
  r('stator', 'Stator', 'assembler', 12, { steelPipe: 3, wire: 8 }, { stator: 1 }),
  r('motor', 'Motor', 'assembler', 12, { rotor: 2, stator: 2 }, { motor: 1 }),
  r('circuitBoard', 'Circuit board', 'assembler', 8, { copperSheet: 2, plastic: 4 }, { circuitBoard: 1 }),
  r('controlUnit', 'Control unit', 'assembler', 12, { circuitBoard: 3, fineWire: 12 }, { controlUnit: 1 }),
  r('blackPowder', 'Black powder', 'assembler', 4, { coal: 1, sulfur: 1 }, { blackPowder: 2 }),
  // refinery
  r('plastic', 'Plastic', 'refinery', 6, { crudeOil: 3 }, { plastic: 2 }),
  r('rubber', 'Rubber', 'refinery', 6, { crudeOil: 3 }, { rubber: 2 }),
  r('fuel', 'Fuel', 'refinery', 6, { crudeOil: 6 }, { fuel: 4 }),
  // manufacturer
  r('heavyChassis', 'Heavy chassis', 'manufacturer', 30, { trussFrame: 5, steelPipe: 15, concreteBeam: 5, screw: 100 }, { heavyChassis: 1 }),
  r('computer', 'Computer', 'manufacturer', 24, { circuitBoard: 4, cable: 8, plastic: 16 }, { computer: 1 }),
  r('oscillator', 'Crystal oscillator', 'manufacturer', 60, { crystal: 18, cable: 14, reinforcedPlate: 3 }, { oscillator: 1 }),
  r('supercomputer', 'Supercomputer', 'manufacturer', 32, { computer: 2, controlUnit: 2, oscillator: 2, plastic: 28 }, { supercomputer: 1 }),
  r('heavyMotor', 'Heavy motor', 'manufacturer', 32, { motor: 4, rubber: 12, heavyChassis: 1, controlUnit: 2 }, { heavyMotor: 1 }),
  r('radioUnit', 'Radio unit', 'manufacturer', 24, { heatSink: 4, computer: 2, crystal: 10, fineWire: 20 }, { radioUnit: 1 }),
  r('uraniumRod', 'Uranium fuel rod', 'manufacturer', 30, { encasedCell: 25, fusedFrame: 3, heatSink: 5 }, { uraniumRod: 1 }),
  // aluminium (foundry, constructor, assembler)
  r('alumina', 'Alumina', 'foundry', 6, { bauxite: 6, limestone: 2 }, { alumina: 4 }),
  r('aluminiumIngot', 'Aluminium ingot', 'foundry', 4, { alumina: 3, coal: 1 }, { aluminiumIngot: 2 }),
  r('aluminiumSheet', 'Aluminium sheet', 'constructor', 6, { aluminiumIngot: 3 }, { aluminiumSheet: 2 }),
  r('heatSink', 'Heat sink', 'assembler', 8, { aluminiumSheet: 5, copperSheet: 3 }, { heatSink: 1 }),
  // blender
  r('fusedFrame', 'Fused frame', 'blender', 20, { heavyChassis: 1, aluminiumIngot: 30, rubber: 10 }, { fusedFrame: 1 }),
  r('encasedCell', 'Encased uranium cell', 'blender', 12, { uranium: 10, concrete: 3, sulfur: 8 }, { encasedCell: 5 }),
  // alternates (unlocked through research)
  r('castScrew', 'Cast screw', 'constructor', 24, { ironIngot: 5 }, { screw: 20 }, true),
  r('ironAlloy', 'Iron alloy ingot', 'foundry', 6, { ironOre: 2, copperOre: 2 }, { ironIngot: 5 }, true),
  r('stitchedPlate', 'Stitched plate', 'assembler', 32, { ironPlate: 10, wire: 20 }, { reinforcedPlate: 3 }, true),
  r('steelRotor', 'Steel rotor', 'assembler', 15, { steelPipe: 2, wire: 6 }, { rotor: 1 }, true),
  r('solidSteel', 'Solid steel ingot', 'foundry', 3, { ironIngot: 2, coal: 2 }, { steelIngot: 3 }, true),
  r('fusedWire', 'Fused wire', 'assembler', 20, { copperIngot: 4, goldIngot: 1 }, { wire: 30 }, true),
  r('fineConcrete', 'Fine concrete', 'assembler', 12, { silica: 3, limestone: 12 }, { concrete: 10 }, true),
  r('siliconCircuit', 'Silicon circuit board', 'assembler', 24, { copperSheet: 11, silica: 11 }, { circuitBoard: 5 }, true),
  r('rubberCable', 'Rubber cable', 'assembler', 20, { wire: 9, rubber: 6 }, { cable: 20 }, true),
  r('steelScrew', 'Steel screw', 'constructor', 12, { steelBeam: 1 }, { screw: 52 }, true),
  r('wetAlumina', 'Wet alumina', 'refinery', 6, { bauxite: 6, crudeOil: 2 }, { alumina: 8 }, true),
  r('alcladSheet', 'Alclad sheet', 'assembler', 6, { aluminiumIngot: 3, copperIngot: 1 }, { aluminiumSheet: 3 }, true),
  r('infusedCell', 'Infused uranium cell', 'blender', 12, { uranium: 5, sulfur: 5, silica: 5, quartz: 5 }, { encasedCell: 4 }, true),
];
export const RECIPE: Record<string, Recipe> = Object.fromEntries(RECIPES.map((x) => [x.id, x]));

/** Items per minute for one recipe input/output at 100% clock. */
export function perMin(recipe: Recipe, amount: number): number {
  return (amount * 60) / recipe.time;
}

// ---------- belts ----------
export interface BeltTier {
  tier: number;
  name: string;
  rate: number;
  /** Cost per tile of belt. */
  cost: Inv;
}
export const BELTS: BeltTier[] = [
  { tier: 1, name: 'Belt Mk1', rate: 60, cost: { ironPlate: 1 } },
  { tier: 2, name: 'Belt Mk2', rate: 120, cost: { ironPlate: 1, screw: 4 } },
  { tier: 3, name: 'Belt Mk3', rate: 270, cost: { steelBeam: 1 } },
  { tier: 4, name: 'Belt Mk4', rate: 480, cost: { steelBeam: 1, rubber: 2 } },
  { tier: 5, name: 'Belt Mk5', rate: 780, cost: { concreteBeam: 1, plastic: 2 } },
  { tier: 6, name: 'Belt Mk6', rate: 1200, cost: { aluminiumSheet: 1, plastic: 2 } },
];
export const MAX_BELT_LEN = 24;

// ---------- clock speed & power ----------
export const MIN_CLOCK = 0.01;
export const MAX_CLOCK = 2.5;
/** Power grows faster than speed: overclocking costs extra power, underclocking saves some. */
export const POWER_EXP = 1.6;
/** Shards needed to run at a clock: one per 50% above 100%. */
export function shardsFor(clock: number): number {
  return clock <= 1.0001 ? 0 : Math.ceil((clock - 1) / 0.5 - 1e-6);
}
export function powerAt(base: number, clock: number): number {
  return base * Math.pow(clock, POWER_EXP);
}

// ---------- progression ----------
export interface Unlocks {
  buildings?: BuildingId[];
  recipes?: string[];
  resources?: Resource[];
  belt?: number;
  shards?: number;
}

export const START_UNLOCKS: Required<Omit<Unlocks, 'shards'>> = {
  buildings: ['miner1', 'smelter', 'constructor', 'biomassBurner', 'depot'],
  recipes: ['ironIngot', 'ironPlate', 'ironRod'],
  resources: ['iron', 'grove'],
  belt: 1,
};
export const START_INV: Inv = { ironPlate: 60, ironRod: 40 };

export interface Milestone {
  id: string;
  name: string;
  tier: number;
  desc: string;
  cost: Inv;
  unlock: Unlocks;
}

export const MILESTONES: Milestone[] = [
  { id: 'fasteners', name: 'Fasteners', tier: 0, desc: 'Screws for everything that follows.', cost: { ironPlate: 20, ironRod: 20 }, unlock: { recipes: ['screw'] } },
  {
    id: 'copper',
    name: 'Copper Line',
    tier: 0,
    desc: 'Copper deposits, wire and cable.',
    cost: { ironPlate: 40, ironRod: 20 },
    unlock: { resources: ['copper'], recipes: ['copperIngot', 'wire', 'cable'] },
  },
  {
    id: 'quarry',
    name: 'Quarry',
    tier: 0,
    desc: 'Limestone deposits and concrete.',
    cost: { ironPlate: 50, wire: 40 },
    unlock: { resources: ['limestone'], recipes: ['concrete'] },
  },
  {
    id: 'assembly',
    name: 'Assembly Line',
    tier: 1,
    desc: 'The Assembler joins two parts into one.',
    cost: { ironPlate: 150, screw: 200, concrete: 60 },
    unlock: { buildings: ['assembler'], recipes: ['reinforcedPlate', 'rotor'] },
  },
  {
    id: 'logistics',
    name: 'Logistics',
    tier: 1,
    desc: 'Storage buffers a belt; the Loader puts stock back onto belts.',
    cost: { ironPlate: 40, screw: 40, wire: 20 },
    unlock: { buildings: ['storage', 'loader'] },
  },
  { id: 'belts2', name: 'Faster Belts', tier: 1, desc: 'Belt Mk2 carries 120/min.', cost: { reinforcedPlate: 15, screw: 300 }, unlock: { belt: 2, shards: 1 } },
  {
    id: 'coalPower',
    name: 'Coal Power',
    tier: 1,
    desc: 'Coal seams and the 75 MW coal generator.',
    cost: { reinforcedPlate: 25, rotor: 10, cable: 100 },
    unlock: { resources: ['coal'], buildings: ['coalGenerator'] },
  },
  { id: 'frames', name: 'Truss Frames', tier: 1, desc: 'Sturdy frames for bigger machines.', cost: { reinforcedPlate: 40, rotor: 20 }, unlock: { recipes: ['trussFrame'] } },
  {
    id: 'steel',
    name: 'Steel Works',
    tier: 2,
    desc: 'The Foundry, steel ingots, beams and pipes.',
    cost: { trussFrame: 20, rotor: 40, concrete: 200 },
    unlock: { buildings: ['foundry'], recipes: ['steelIngot', 'steelBeam', 'steelPipe'] },
  },
  { id: 'miner2', name: 'Mk2 Miners', tier: 2, desc: 'Miner Mk2: twice the output.', cost: { trussFrame: 25, steelPipe: 100 }, unlock: { buildings: ['miner2'], shards: 1 } },
  { id: 'belts3', name: 'Belt Mk3', tier: 2, desc: 'Belt Mk3 carries 270/min.', cost: { steelBeam: 100, reinforcedPlate: 50 }, unlock: { belt: 3 } },
  {
    id: 'motors',
    name: 'Motors',
    tier: 2,
    desc: 'Stators, motors and concrete beams.',
    cost: { steelPipe: 200, wire: 800, concrete: 300 },
    unlock: { recipes: ['stator', 'motor', 'concreteBeam', 'copperSheet'] },
  },
  {
    id: 'oil',
    name: 'Crude Processing',
    tier: 3,
    desc: 'Oil wells, the Oil Pump and the Refinery: plastic, rubber and fuel.',
    cost: { motor: 40, concreteBeam: 50, cable: 500 },
    unlock: { resources: ['oil'], buildings: ['pump', 'refinery'], recipes: ['plastic', 'rubber', 'fuel'] },
  },
  {
    id: 'fuelPower',
    name: 'Fuel Power',
    tier: 3,
    desc: 'The 150 MW fuel generator.',
    cost: { motor: 50, plastic: 100, rubber: 100 },
    unlock: { buildings: ['fuelGenerator'], shards: 1 },
  },
  {
    id: 'heavy',
    name: 'Heavy Industry',
    tier: 3,
    desc: 'The Manufacturer and heavy chassis.',
    cost: { motor: 80, trussFrame: 100, plastic: 200 },
    unlock: { buildings: ['manufacturer'], recipes: ['heavyChassis'] },
  },
  { id: 'belts4', name: 'Belt Mk4', tier: 3, desc: 'Belt Mk4 carries 480/min.', cost: { rubber: 200, steelBeam: 300 }, unlock: { belt: 4 } },
  {
    id: 'quartz',
    name: 'Quartz Refining',
    tier: 4,
    desc: 'Quartz deposits, silica and quartz crystal.',
    cost: { heavyChassis: 10, plastic: 300 },
    unlock: { resources: ['quartz'], recipes: ['silica', 'crystal'] },
  },
  {
    id: 'circuits',
    name: 'Circuitry',
    tier: 4,
    desc: 'Circuit boards and computers.',
    cost: { plastic: 400, rubber: 300, cable: 1000 },
    unlock: { recipes: ['circuitBoard', 'computer'] },
  },
  {
    id: 'gold',
    name: 'Gold Refining',
    tier: 4,
    desc: 'Gold veins, gold ingots, fine wire and control units.',
    cost: { computer: 20, heavyChassis: 20 },
    unlock: { resources: ['gold'], recipes: ['goldIngot', 'fineWire', 'controlUnit'] },
  },
  {
    id: 'miner3',
    name: 'Mk3 Miners',
    tier: 4,
    desc: 'Miner Mk3: 120/min on a normal node.',
    cost: { computer: 25, heavyChassis: 25 },
    unlock: { buildings: ['miner3'], shards: 2 },
  },
  {
    id: 'sulfur',
    name: 'Sulfur',
    tier: 4,
    desc: 'Sulfur vents and black powder.',
    cost: { computer: 10, steelBeam: 500 },
    unlock: { resources: ['sulfur'], recipes: ['blackPowder'] },
  },
  { id: 'oscillators', name: 'Oscillators', tier: 5, desc: 'Crystal oscillators.', cost: { computer: 50, controlUnit: 50 }, unlock: { recipes: ['oscillator'] } },
  { id: 'super', name: 'Supercomputing', tier: 5, desc: 'Supercomputers.', cost: { computer: 100, oscillator: 20 }, unlock: { recipes: ['supercomputer'] } },
  { id: 'heavyMotors', name: 'Heavy Motors', tier: 5, desc: 'Heavy motors.', cost: { motor: 300, controlUnit: 100 }, unlock: { recipes: ['heavyMotor'] } },
  { id: 'belts5', name: 'Belt Mk5', tier: 5, desc: 'Belt Mk5 carries 780/min.', cost: { concreteBeam: 500, plastic: 1000 }, unlock: { belt: 5, shards: 2 } },
  {
    id: 'aluminium',
    name: 'Aluminium',
    tier: 6,
    desc: 'Bauxite deposits, the Blender, alumina, aluminium ingots and sheets.',
    cost: { supercomputer: 10, heavyMotor: 10, concreteBeam: 200 },
    unlock: { resources: ['bauxite'], buildings: ['blender'], recipes: ['alumina', 'aluminiumIngot', 'aluminiumSheet'] },
  },
  {
    id: 'heatSinks',
    name: 'Heat Sinks',
    tier: 6,
    desc: 'Heat sinks and fused frames.',
    cost: { aluminiumSheet: 200, heavyMotor: 20 },
    unlock: { recipes: ['heatSink', 'fusedFrame'] },
  },
  { id: 'belts6', name: 'Belt Mk6', tier: 6, desc: 'Belt Mk6 carries 1200/min.', cost: { aluminiumSheet: 300, plastic: 1500 }, unlock: { belt: 6, shards: 2 } },
  {
    id: 'nuclear',
    name: 'Nuclear Power',
    tier: 7,
    desc: 'Uranium deposits, encased cells, fuel rods and the 600 MW Nuclear Plant.',
    cost: { fusedFrame: 20, heatSink: 100, supercomputer: 20 },
    unlock: { resources: ['uranium'], buildings: ['nuclearPlant'], recipes: ['encasedCell', 'uraniumRod'], shards: 2 },
  },
  {
    id: 'radio',
    name: 'Deep Space Radio',
    tier: 7,
    desc: 'Radio units for the probe.',
    cost: { heatSink: 100, oscillator: 50, fusedFrame: 10 },
    unlock: { recipes: ['radioUnit'] },
  },
];
export const MILESTONE: Record<string, Milestone> = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

/** Launch Tower phases: deliver parts to reach the next tier. Phase i unlocks tier i + 1. */
export interface Phase {
  name: string;
  cost: Inv;
  shards: number;
}
export const PHASES: Phase[] = [
  { name: 'Survey Beacon', cost: { ironPlate: 150, wire: 150, concrete: 80 }, shards: 1 },
  { name: 'Relay Mast', cost: { reinforcedPlate: 150, rotor: 50, trussFrame: 20 }, shards: 1 },
  { name: 'Orbital Dish', cost: { motor: 50, concreteBeam: 100, trussFrame: 100 }, shards: 1 },
  { name: 'Uplink Spire', cost: { heavyChassis: 20, motor: 200, plastic: 500 }, shards: 2 },
  { name: 'Launch Gantry', cost: { computer: 100, controlUnit: 100, blackPowder: 500 }, shards: 2 },
  { name: 'Launch!', cost: { supercomputer: 50, heavyMotor: 50, oscillator: 100 }, shards: 3 },
  { name: 'Orbital Station', cost: { heatSink: 100, aluminiumSheet: 500, supercomputer: 25 }, shards: 3 },
  { name: 'Deep Space Probe', cost: { radioUnit: 25, fusedFrame: 40, uraniumRod: 10 }, shards: 4 },
];
export const MAX_TIER = PHASES.length - 1;

export interface Research {
  id: string;
  recipe: string;
  tier: number;
  cost: Inv;
  insight: number;
  note: string;
}
export const RESEARCH: Research[] = [
  { id: 'r-castScrew', recipe: 'castScrew', tier: 0, cost: { ironPlate: 30 }, insight: 1, note: 'Screws straight from ingots: skip the rods.' },
  { id: 'r-stitchedPlate', recipe: 'stitchedPlate', tier: 1, cost: { reinforcedPlate: 10, wire: 100 }, insight: 1, note: 'Reinforced plates held with wire instead of screws.' },
  { id: 'r-ironAlloy', recipe: 'ironAlloy', tier: 2, cost: { steelIngot: 50 }, insight: 2, note: 'Mix iron and copper ore: 2.5× the ingots per ore.' },
  { id: 'r-solidSteel', recipe: 'solidSteel', tier: 2, cost: { steelIngot: 100 }, insight: 2, note: 'Steel from iron ingots and coal.' },
  { id: 'r-steelRotor', recipe: 'steelRotor', tier: 2, cost: { steelPipe: 100 }, insight: 2, note: 'Rotors from steel pipe and wire: no screws.' },
  { id: 'r-steelScrew', recipe: 'steelScrew', tier: 2, cost: { steelBeam: 50 }, insight: 2, note: '52 screws per steel beam.' },
  { id: 'r-rubberCable', recipe: 'rubberCable', tier: 3, cost: { rubber: 100 }, insight: 3, note: 'Rubber-coated cable: 20 cable per cycle.' },
  { id: 'r-fineConcrete', recipe: 'fineConcrete', tier: 4, cost: { silica: 100 }, insight: 3, note: 'Silica-bound concrete, ten at a time.' },
  { id: 'r-siliconCircuit', recipe: 'siliconCircuit', tier: 4, cost: { circuitBoard: 20, silica: 100 }, insight: 3, note: 'Circuit boards without plastic.' },
  { id: 'r-fusedWire', recipe: 'fusedWire', tier: 4, cost: { goldIngot: 50 }, insight: 3, note: 'A little gold makes 30 wire.' },
  { id: 'r-wetAlumina', recipe: 'wetAlumina', tier: 6, cost: { alumina: 100 }, insight: 4, note: 'Alumina from the refinery: twice as much per bauxite.' },
  { id: 'r-alcladSheet', recipe: 'alcladSheet', tier: 6, cost: { aluminiumSheet: 100, copperSheet: 50 }, insight: 4, note: 'A copper backing: 3 sheets per cycle.' },
  { id: 'r-infusedCell', recipe: 'infusedCell', tier: 7, cost: { encasedCell: 50, silica: 200 }, insight: 5, note: 'Uranium cells with half the uranium.' },
];

// ---------- homework tie-in ----------
export const REWARD = {
  /** Per completed task. */
  task: { shards: 1, insight: 1, boost: 10 * 60 },
  /** Per notecard session or pomodoro. */
  study: { shards: 0, insight: 1, boost: 5 * 60 },
  /** Per daily ring closed or streak milestone. */
  day: { shards: 1, insight: 2, boost: 15 * 60 },
  /** Production boost multiplier and the most boost that can be banked. */
  boostMult: 1.25,
  boostCap: 2 * 60 * 60,
};
export const MARKET_DAILY_CAP = 20;
export const OFFLINE_CAP = 8 * 60 * 60;
