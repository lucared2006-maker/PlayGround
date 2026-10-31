// Static game data: religions, cultures, goods, terrain, buildings, units, tech, trade, reforms, events.

export const START_DATE = { y: 1444, m: 1, d: 1 };
export const END_YEAR = 1821;

export const RELIGIONS = {
  catholic:   { name: 'Catholic',   group: 'christian', color: '#e8d9a0', symbol: '✝' },
  orthodox:   { name: 'Orthodox',   group: 'christian', color: '#8fb8d8', symbol: '☦' },
  protestant: { name: 'Protestant', group: 'christian', color: '#7fb0d0', symbol: '✝' },
  coptic:     { name: 'Coptic',     group: 'christian', color: '#c9b06a', symbol: '☧' },
  sunni:      { name: 'Sunni',      group: 'muslim',    color: '#5fae72', symbol: '☪' },
  shia:       { name: 'Shia',       group: 'muslim',    color: '#3f8f6f', symbol: '☪' },
  jewish:     { name: 'Jewish',     group: 'abrahamic', color: '#b9a0d8', symbol: '✡' },
  hindu:      { name: 'Hindu',      group: 'eastern',   color: '#e0a05a', symbol: 'ॐ' },
  buddhist:   { name: 'Buddhist',   group: 'eastern',   color: '#d8b04a', symbol: '☸' },
  confucian:  { name: 'Confucian',  group: 'eastern',   color: '#c8b898', symbol: '儒' },
  shinto:     { name: 'Shinto',     group: 'eastern',   color: '#d88a8a', symbol: '⛩' },
  tengri:     { name: 'Tengri',     group: 'pagan',     color: '#9fc8b8', symbol: '☾' },
  animist:    { name: 'Animist',    group: 'pagan',     color: '#a8b878', symbol: '✦' },
  zoroastrian:{ name: 'Zoroastrian',group: 'abrahamic', color: '#e0b060', symbol: '☼' },
};

export const CULTURES = {
  english:    { name: 'English',    group: 'west european', color: '#c86a6a' },
  scottish:   { name: 'Scottish',   group: 'west european', color: '#8a7ac8' },
  irish:      { name: 'Irish',      group: 'west european', color: '#5aa87a' },
  french:     { name: 'French',     group: 'west european', color: '#6a8ac8' },
  occitan:    { name: 'Occitan',    group: 'west european', color: '#9a7ac8' },
  breton:     { name: 'Breton',     group: 'west european', color: '#6aa8a8' },
  castilian:  { name: 'Castilian',  group: 'iberian', color: '#d8b04a' },
  catalan:    { name: 'Catalan',    group: 'iberian', color: '#e08a4a' },
  portuguese: { name: 'Portuguese', group: 'iberian', color: '#5aa86a' },
  basque:     { name: 'Basque',     group: 'iberian', color: '#a8a86a' },
  galician:   { name: 'Galician',   group: 'iberian', color: '#b8a87a' },
  andalusian: { name: 'Andalusian', group: 'iberian', color: '#c8a87a' },
  dutch:      { name: 'Dutch',      group: 'west european', color: '#e0a050' },
  flemish:    { name: 'Flemish',    group: 'west european', color: '#d89060' },
  walloon:    { name: 'Walloon',    group: 'west european', color: '#b89070' },
  german:     { name: 'German',     group: 'germanic', color: '#a8a8b8' },
  austrian:   { name: 'Austrian',   group: 'germanic', color: '#d8d0c0' },
  bavarian:   { name: 'Bavarian',   group: 'germanic', color: '#8aa8c8' },
  saxon:      { name: 'Saxon',      group: 'germanic', color: '#a8c8a8' },
  swiss:      { name: 'Swiss',      group: 'germanic', color: '#c85a5a' },
  polish:     { name: 'Polish',     group: 'slavic', color: '#d86a7a' },
  lithuanian: { name: 'Lithuanian', group: 'baltic', color: '#8a5a8a' },
  ruthenian:  { name: 'Ruthenian',  group: 'slavic', color: '#c8a05a' },
  russian:    { name: 'Russian',    group: 'slavic', color: '#6a9a6a' },
  novgorodian:{ name: 'Novgorodian',group: 'slavic', color: '#7aaa8a' },
  hungarian:  { name: 'Hungarian',  group: 'ugric', color: '#8ac87a' },
  romanian:   { name: 'Romanian',   group: 'latin', color: '#c8b06a' },
  bulgarian:  { name: 'Bulgarian',  group: 'slavic', color: '#9a8a5a' },
  serbian:    { name: 'Serbian',    group: 'slavic', color: '#b87a6a' },
  croatian:   { name: 'Croatian',   group: 'slavic', color: '#c89a7a' },
  albanian:   { name: 'Albanian',   group: 'balkan', color: '#a85a5a' },
  greek:      { name: 'Greek',      group: 'balkan', color: '#6a8ad8' },
  turkish:    { name: 'Turkish',    group: 'turkic', color: '#4a9a6a' },
  arabic:     { name: 'Arabic',     group: 'semitic', color: '#7ab87a' },
  berber:     { name: 'Berber',     group: 'berber', color: '#b8a06a' },
  persian:    { name: 'Persian',    group: 'iranian', color: '#6ab8a8' },
  kurdish:    { name: 'Kurdish',    group: 'iranian', color: '#a8b86a' },
  armenian:   { name: 'Armenian',   group: 'caucasian', color: '#c87a8a' },
  georgian:   { name: 'Georgian',   group: 'caucasian', color: '#a87a5a' },
  hebrew:     { name: 'Hebrew',     group: 'semitic', color: '#b8a8d8' },
  egyptian:   { name: 'Egyptian',   group: 'semitic', color: '#c8b87a' },
  ethiopian:  { name: 'Ethiopian',  group: 'african', color: '#c8a85a' },
  somali:     { name: 'Somali',     group: 'african', color: '#b8905a' },
  songhai:    { name: 'Songhai',    group: 'african', color: '#d8b06a' },
  mande:      { name: 'Mande',      group: 'african', color: '#c8a06a' },
  yoruba:     { name: 'Yoruba',     group: 'african', color: '#a8c06a' },
  bantu:      { name: 'Bantu',      group: 'african', color: '#8ab87a' },
  swahili:    { name: 'Swahili',    group: 'african', color: '#7ac8a8' },
  hindi:      { name: 'Hindustani', group: 'indian', color: '#e0a06a' },
  bengali:    { name: 'Bengali',    group: 'indian', color: '#d8b86a' },
  punjabi:    { name: 'Punjabi',    group: 'indian', color: '#d8c06a' },
  gujarati:   { name: 'Gujarati',   group: 'indian', color: '#c8c07a' },
  dravidian:  { name: 'Dravidian',  group: 'indian', color: '#c8905a' },
  sinhalese:  { name: 'Sinhalese',  group: 'indian', color: '#c8a87a' },
  tibetan:    { name: 'Tibetan',    group: 'eastern', color: '#c8b0a0' },
  mongol:     { name: 'Mongol',     group: 'steppe', color: '#b8c8a8' },
  chinese:    { name: 'Chinese',    group: 'eastern', color: '#e0c86a' },
  korean:     { name: 'Korean',     group: 'eastern', color: '#c8a8c8' },
  japanese:   { name: 'Japanese',   group: 'eastern', color: '#e0a8a8' },
  manchu:     { name: 'Manchu',     group: 'steppe', color: '#b8a8c8' },
  vietnamese: { name: 'Vietnamese', group: 'eastern', color: '#a8c88a' },
  thai:       { name: 'Thai',       group: 'eastern', color: '#c8c88a' },
  khmer:      { name: 'Khmer',      group: 'eastern', color: '#b8a87a' },
  malay:      { name: 'Malay',      group: 'maritime', color: '#7ac8c8' },
  javanese:   { name: 'Javanese',   group: 'maritime', color: '#8ac8a8' },
  aztec:      { name: 'Nahuatl',    group: 'mesoamerican', color: '#c88a6a' },
  maya:       { name: 'Maya',       group: 'mesoamerican', color: '#a8c87a' },
  inca:       { name: 'Quechua',    group: 'andean', color: '#d8c05a' },
  iroquoian:  { name: 'Iroquoian',  group: 'north american', color: '#8ab8c8' },
  cherokee:   { name: 'Cherokee',   group: 'north american', color: '#a8b88a' },
  pueblo:     { name: 'Pueblo',     group: 'north american', color: '#c8a87a' },
  polynesian: { name: 'Polynesian', group: 'oceanic', color: '#7ac8b8' },
  aboriginal: { name: 'Aboriginal', group: 'oceanic', color: '#b8a87a' },
  italian:    { name: 'Italian',    group: 'latin', color: '#7aa87a' },
  czech:      { name: 'Czech',      group: 'slavic', color: '#b8a8c8' },
  danish:     { name: 'Danish',     group: 'norse', color: '#c87a7a' },
  swedish:    { name: 'Swedish',    group: 'norse', color: '#6a8ac8' },
  norwegian:  { name: 'Norwegian',  group: 'norse', color: '#8a9aa8' },
  finnish:    { name: 'Finnish',    group: 'uralic', color: '#8ac8c8' },
  estonian:   { name: 'Estonian',   group: 'baltic', color: '#a8c8a8' },
  latvian:    { name: 'Latvian',    group: 'baltic', color: '#b8c8a8' },
};

export const GOODS = {
  grain:   { name: 'Grain',   price: 2.0, color: '#c8b06a' },
  wine:    { name: 'Wine',    price: 3.0, color: '#a85a6a' },
  wool:    { name: 'Wool',    price: 2.5, color: '#d8d0b8' },
  cloth:   { name: 'Cloth',   price: 4.0, color: '#c88a5a' },
  fish:    { name: 'Fish',    price: 2.2, color: '#8ab8c8' },
  salt:    { name: 'Salt',    price: 2.6, color: '#e0e0e0' },
  timber:  { name: 'Timber',  price: 2.4, color: '#8a7a5a' },
  iron:    { name: 'Iron',    price: 3.0, color: '#8a8a9a' },
  copper:  { name: 'Copper',  price: 3.2, color: '#c88a5a' },
  gold:    { name: 'Gold',    price: 6.0, color: '#e8c84a' },
  silver:  { name: 'Silver',  price: 5.0, color: '#c8c8d8' },
  spices:  { name: 'Spices',  price: 6.0, color: '#d87a4a' },
  silk:    { name: 'Silk',    price: 6.0, color: '#c8a0c8' },
  cotton:  { name: 'Cotton',  price: 3.5, color: '#e0d8c8' },
  ivory:   { name: 'Ivory',   price: 5.0, color: '#e8e0c8' },
  livestock:{ name: 'Livestock', price: 2.5, color: '#b89a6a' },
  naval:   { name: 'Naval Supplies', price: 3.0, color: '#6a8a9a' },
  glass:   { name: 'Glass',   price: 5.0, color: '#a8d8e0' },
  paper:   { name: 'Paper',   price: 4.0, color: '#e0d8b8' },
  sugar:   { name: 'Sugar',   price: 4.5, color: '#e8d8a8' },
  tobacco: { name: 'Tobacco', price: 4.5, color: '#a87a5a' },
  cocoa:   { name: 'Cocoa',   price: 5.0, color: '#8a5a3a' },
  fur:     { name: 'Fur',     price: 3.0, color: '#a87a4a' },
  tea:     { name: 'Tea',     price: 5.0, color: '#8ab86a' },
  coffee:  { name: 'Coffee',  price: 5.0, color: '#7a5a3a' },
  olive:   { name: 'Olive Oil', price: 3.2, color: '#9aa85a' },
  rice:    { name: 'Rice',    price: 2.6, color: '#d8d8a8' },
  leather: { name: 'Leather', price: 3.0, color: '#9a6a4a' },
};

export const TERRAIN = {
  plains:   { name: 'Plains',   color: '#a8b878', move: 4, defense: 0,   supply: 1.0 },
  farmland: { name: 'Farmland', color: '#b8c078', move: 4, defense: -0.05, supply: 1.2 },
  forest:   { name: 'Forest',   color: '#7a9a68', move: 6, defense: 0.1, supply: 0.8 },
  hills:    { name: 'Hills',    color: '#a0a070', move: 6, defense: 0.2, supply: 0.8 },
  mountains:{ name: 'Mountains',color: '#8a8070', move: 9, defense: 0.35, supply: 0.5 },
  marsh:    { name: 'Marsh',    color: '#7a9a88', move: 8, defense: 0.15, supply: 0.6 },
  desert:   { name: 'Desert',   color: '#d8c088', move: 7, defense: 0.05, supply: 0.4 },
  steppe:   { name: 'Steppe',   color: '#b8b878', move: 4, defense: 0,   supply: 0.7 },
  tundra:   { name: 'Tundra',   color: '#b8c0b0', move: 7, defense: 0.1, supply: 0.4 },
  jungle:   { name: 'Jungle',   color: '#6a8a58', move: 8, defense: 0.2, supply: 0.5 },
};

export const BUILDINGS = {
  market:    { name: 'Market',     cost: 60,  months: 8,  desc: '+12% tax income, +1 trade power', icon: '⚖' },
  workshop:  { name: 'Workshop',   cost: 70,  months: 10, desc: '+20% production, +1 goods produced', icon: '⚒' },
  temple:    { name: 'Temple',     cost: 50,  months: 8,  desc: '−2 unrest, +1 missionary strength', icon: '⛪' },
  barracks:  { name: 'Barracks',   cost: 60,  months: 8,  desc: '+25% manpower, +500 garrison', icon: '🛡' },
  dock:      { name: 'Dock',       cost: 60,  months: 8,  desc: '+2 trade power, +10% sailors', icon: '⚓', port: true },
  courthouse:{ name: 'Courthouse', cost: 80,  months: 12, desc: '−0.03 autonomy, −1 unrest', icon: '🏛' },
  university:{ name: 'University', cost: 150, months: 18, desc: '+0.5 monarch points, tech 5', icon: '📖' },
  fort:      { name: 'Fortress',   cost: 120, months: 14, desc: '+1 fort level', icon: '🏰' },
};

export const UNIT_TYPES = {
  infantry: { name: 'Infantry', short: 'INF', cost: 10, men: 1000, upkeep: 0.5, icon: '⚔', tech: 1 },
  cavalry:  { name: 'Cavalry',  short: 'CAV', cost: 16, men: 1000, upkeep: 0.85, icon: '🐎', tech: 1 },
  archer:   { name: 'Archers',  short: 'ARC', cost: 8,  men: 1000, upkeep: 0.4,  icon: '🏹', tech: 1 },
  artillery:{ name: 'Artillery',short: 'ART', cost: 28, men: 1000, upkeep: 1.1, icon: '💣', tech: 7 },
  mercenary:{ name: 'Mercenaries', short: 'MER', cost: 30, men: 1000, upkeep: 1.2, icon: '🗡', tech: 1 },
};

export const SHIP_TYPES = {
  galley:  { name: 'Galley',  cost: 8,  upkeep: 0.1, power: 2, tech: 1 },
  cog:     { name: 'Cog',     cost: 12, upkeep: 0.16, power: 3, tech: 3 },
  caravel: { name: 'Caravel', cost: 20, upkeep: 0.24, power: 4, tech: 7 },
};

export const TECH_LEVELS = 20;
export const TECH_COST = (level) => Math.round(90 * Math.pow(1.42, Math.max(0, level - 1)));
export const TECH_NAMES = {
  adm: ['Tribal Administration', 'Feudal Administration', 'Royal Courts', 'Bureaucracy', 'Professional Army', 'Centralized State', 'Standing Bureaucracy', 'Enlightened Absolutism'],
  dip: ['Local Customs', 'Trade Posts', 'Merchant Guilds', 'Chartered Companies', 'Diplomatic Corps', 'Global Trade', 'Colonial Empires', 'Age of Revolutions'],
  mil: ['Feudal Levies', 'Retinues', 'Pike and Shot', 'Field Artillery', 'Tercio', 'Line Infantry', 'Napoleonic Corps', 'Total War'],
};

export const GOVERNMENTS = {
  monarchy:   { name: 'Monarchy',   legitimacy: true,  desc: 'Rule by hereditary right. Royal marriages and personal unions.' },
  republic:   { name: 'Republic',   legitimacy: false, desc: 'Rule by elected council. Trade and tolerance bonuses.' },
  theocracy:  { name: 'Theocracy',  legitimacy: true,  desc: 'Rule by faith. Conversion and stability bonuses.' },
  oligarchy:  { name: 'Oligarchy',  legitimacy: false, desc: 'Rule by patricians. Economy and trade bonuses.' },
  empire:     { name: 'Empire',     legitimacy: true,  desc: 'A universal claim to rule. Large force limit and prestige.' },
  tribal:     { name: 'Tribal',     legitimacy: true,  desc: 'Rule by clan and custom. Cheap armies, weak economy.' },
  horde:      { name: 'Steppe Horde',legitimacy: true, desc: 'Rule by the horse. Devastating cavalry, fragile state.' },
};

export const REFORMS = {
  centralization: { name: 'Centralize the Realm', cost: 100, desc: '−0.05 autonomy, +10% tax, −5% manpower', effects: { autonomy: -0.05, tax: 0.1, manpower: -0.05 }, centralization: 10 },
  decentralization:{ name: 'Empower the Estates', cost: 80, desc: '+0.05 autonomy, +10% manpower, +5% trade', effects: { autonomy: 0.05, manpower: 0.1, trade: 0.05 }, centralization: -10 },
  standing_army:  { name: 'Standing Army', cost: 120, desc: '+5% discipline, +10% army upkeep', effects: { discipline: 0.05, armyCost: 0.1 } },
  militia:        { name: 'Citizen Militia', cost: 80, desc: '−20% army cost, −5% discipline', effects: { armyCost: -0.2, discipline: -0.05 } },
  religious_unity:{ name: 'Religious Unity', cost: 100, desc: '+1 missionary strength, −2 tolerance', effects: { missionary: 0.02, tolerance: -1 } },
  tolerance:      { name: 'Edict of Tolerance', cost: 100, desc: '+2 tolerance, −10% unrest', effects: { tolerance: 2, unrest: -0.1 } },
  trade_policy:   { name: 'Mercantilism', cost: 90, desc: '+15% trade power, −5% production', effects: { tradePower: 0.15, production: -0.05 } },
  free_trade:     { name: 'Free Trade', cost: 90, desc: '+10% production, +10% trade', effects: { production: 0.1, trade: 0.1 } },
  conscription:   { name: 'Conscription', cost: 110, desc: '+20% manpower, −1 stability', effects: { manpower: 0.2, stability: -1 } },
  meritocracy:    { name: 'Meritocracy', cost: 110, desc: '+1 monarch point, −10% legitimacy', effects: { points: 1, legitimacy: -10 } },
  colonial_charter:{ name: 'Colonial Charters', cost: 140, desc: '−25% colonization cost, +10% trade range', effects: { colonize: -0.25, tradeRange: 0.1 } },
  absolute_rule:  { name: 'Absolute Rule', cost: 180, desc: '+15% tax, −2 tolerance, +1 unrest', effects: { tax: 0.15, tolerance: -2, unrest: 0.1 } },
};

export const LAWS = {
  succession_salic:    { name: 'Salic Law', desc: 'Only men may inherit. +10 legitimacy, −5 relations with female rulers.' },
  succession_primogeniture: { name: 'Primogeniture', desc: 'Eldest child inherits. +5 legitimacy.' },
  succession_elective: { name: 'Elective Monarchy', desc: 'Nobles elect the monarch. +0.1 noble influence, +5 legitimacy.' },
  army_serf:           { name: 'Serf Levies', desc: '−25% army cost, −10% discipline.' },
  army_professional:   { name: 'Professional Army', desc: '+10% discipline, +15% upkeep.' },
  navy_merchant:       { name: 'Merchant Navy', desc: '+20% trade power, −10% ship cost.' },
  navy_war:            { name: 'War Fleet', desc: '+15% naval power, +10% ship upkeep.' },
  tolerance_none:      { name: 'One Faith', desc: '+1 missionary strength, −3 tolerance, +1 unrest.' },
  tolerance_plural:    { name: 'Pluralist Society', desc: '+3 tolerance, −1 missionary strength, −1 unrest.' },
  economy_mercantile:  { name: 'Mercantile Economy', desc: '+10% tax, −5% production.' },
  economy_agrarian:    { name: 'Agrarian Economy', desc: '+15% production, −5% tax.' },
};

export const ESTATES = {
  nobles:  { name: 'Nobility',  icon: '⚜', desc: 'Landowners and knights. Manpower and discipline.' },
  clergy:  { name: 'Clergy',    icon: '✝', desc: 'The Church. Stability and conversion.' },
  burghers:{ name: 'Burghers',  icon: '⚖', desc: 'Merchants and guilds. Trade and tax.' },
  peasants:{ name: 'Peasantry', icon: '🌾', desc: 'The tillers of the soil. Manpower and unrest.' },
};

export const TRADE_NODES = [
  { id: 'london',     name: 'English Channel', lon: 0.5,   lat: 50.5, down: 'amsterdam', goods: ['cloth', 'wool', 'fish'] },
  { id: 'bordeaux',   name: 'Bordeaux',        lon: -0.5,  lat: 45.0, down: 'london',    goods: ['wine', 'salt'] },
  { id: 'seville',    name: 'Seville',         lon: -5.5,  lat: 37.5, down: 'london',    goods: ['gold', 'wool', 'sugar'] },
  { id: 'lisbon',     name: 'Lisbon',          lon: -9.0,  lat: 39.0, down: 'seville',   goods: ['fish', 'wine', 'gold'] },
  { id: 'amsterdam',  name: 'Low Countries',   lon: 4.5,   lat: 52.0, down: 'london',    goods: ['cloth', 'fish', 'naval'] },
  { id: 'lubeck',     name: 'Lübeck',          lon: 10.5,  lat: 54.0, down: 'amsterdam', goods: ['timber', 'fur', 'naval'] },
  { id: 'novgorod',   name: 'Novgorod',        lon: 31.5,  lat: 58.0, down: 'lubeck',    goods: ['fur', 'timber', 'silk'] },
  { id: 'krakow',     name: 'Kraków',          lon: 19.0,  lat: 50.0, down: 'vienna',    goods: ['grain', 'copper', 'salt'] },
  { id: 'vienna',     name: 'Vienna',          lon: 16.0,  lat: 48.0, down: 'venice',    goods: ['wine', 'iron', 'cloth'] },
  { id: 'venice',     name: 'Venice',          lon: 12.3,  lat: 45.4, down: 'genoa',     goods: ['spices', 'silk', 'glass'] },
  { id: 'genoa',      name: 'Genoa',           lon: 8.9,   lat: 44.4, down: 'seville',   goods: ['silk', 'cloth', 'gold'] },
  { id: 'constantinople', name: 'Constantinople', lon: 29.0, lat: 41.0, down: 'venice', goods: ['silk', 'spices', 'grain'] },
  { id: 'aleppo',     name: 'Aleppo',          lon: 37.0,  lat: 36.0, down: 'constantinople', goods: ['silk', 'cotton', 'spices'] },
  { id: 'alexandria', name: 'Alexandria',      lon: 30.0,  lat: 31.2, down: 'venice',    goods: ['cotton', 'spices', 'grain'] },
  { id: 'basra',      name: 'Basra',           lon: 47.5,  lat: 30.5, down: 'hormuz',    goods: ['spices', 'coffee', 'ivory'] },
  { id: 'hormuz',     name: 'Hormuz',          lon: 56.5,  lat: 26.5, down: 'basra',     goods: ['spices', 'silk', 'ivory'] },
  { id: 'goa',        name: 'Goa',             lon: 74.0,  lat: 15.0, down: 'hormuz',    goods: ['spices', 'cotton', 'tea'] },
  { id: 'malacca',    name: 'Malacca',         lon: 102.0, lat: 2.0,  down: 'goa',       goods: ['spices', 'silk', 'tea'] },
  { id: 'canton',     name: 'Canton',          lon: 113.5, lat: 23.0, down: 'malacca',   goods: ['silk', 'tea', 'paper'] },
  { id: 'kyoto',      name: 'Japan',           lon: 135.0, lat: 35.0, down: 'canton',    goods: ['silk', 'copper', 'fish'] },
  { id: 'timbuktu',   name: 'Timbuktu',        lon: -3.0,  lat: 16.8, down: 'fez',       goods: ['gold', 'salt', 'ivory'] },
  { id: 'fez',        name: 'Fez',             lon: -5.0,  lat: 34.0, down: 'seville',   goods: ['gold', 'salt', 'leather'] },
  { id: 'tunis',      name: 'Tunis',           lon: 10.2,  lat: 36.8, down: 'genoa',     goods: ['grain', 'olive', 'cloth'] },
  { id: 'kongo',      name: 'Kongo',           lon: 14.0,  lat: -4.0, down: 'timbuktu',  goods: ['ivory', 'copper', 'gold'] },
  { id: 'kilwa',      name: 'Kilwa',           lon: 39.5,  lat: -8.9, down: 'hormuz',    goods: ['gold', 'ivory', 'spices'] },
];

export const HISTORICAL_EVENTS = [
  {
    id: 'fall_constantinople', year: 1453, month: 5, title: 'The Fall of Constantinople',
    text: 'The guns of the Sultan thunder against the Theodosian Walls. The Queen of Cities trembles. If the city falls, the last Roman emperor will pass into legend and a new age will dawn.',
    scope: 'world', condition: (s) => s.provinces.find(p => p.name === 'Constantinople')?.owner === 'OTT',
    effects: { prestigeAll: 5, ottomanPrestige: 25, byzStability: -2 },
  },
  {
    id: 'reformation', year: 1517, month: 10, title: 'The Ninety-Five Theses',
    text: 'A German monk named Martin Luther has challenged the sale of indulgences. Across Christendom, princes and peasants debate the true faith. The unity of the Church may not survive.',
    scope: 'christian', condition: () => true,
    effects: { spawnProtestant: true, catholicUnrest: 8 },
  },
  {
    id: 'italian_wars', year: 1494, month: 9, title: 'The Italian Wars',
    text: 'The King of France marches into Italy to claim the throne of Naples. The peninsula, rich and divided, becomes the battlefield of Europe.',
    scope: 'italy', condition: () => true,
    effects: { war: ['FRA', 'NAP'], italianUnrest: 10 },
  },
  {
    id: 'columbus', year: 1492, month: 10, title: 'A New World',
    text: 'A Genoese captain in the service of Castile has made landfall across the Atlantic. A vast unknown world lies open to conquest, conversion and trade.',
    scope: 'iberia', condition: () => true,
    effects: { colonization: true, prestige: { CAS: 15, POR: 15 } },
  },
  {
    id: 'thirty_years', year: 1618, month: 5, title: 'The Defenestration of Prague',
    text: 'Protestant nobles have thrown the Emperor\'s representatives from a castle window. The confessional tensions of the Empire ignite into a continental war.',
    scope: 'hre', condition: () => true,
    effects: { religiousWar: true, imperialUnrest: 15 },
  },
  {
    id: 'westphalia', year: 1648, month: 10, title: 'Peace of Westphalia',
    text: 'After thirty years of slaughter, the princes of Europe recognize one another\'s sovereignty. The age of religious wars gives way to the age of reason of state.',
    scope: 'world', condition: () => true,
    effects: { peace: true, toleranceAll: 1, stabilityAll: 1 },
  },
  {
    id: 'vienna', year: 1683, month: 7, title: 'The Siege of Vienna',
    text: 'The armies of the Sublime Porte have encircled the Habsburg capital. All Christendom watches to see whether the gates of Europe will hold.',
    scope: 'world', condition: () => true,
    effects: { war: ['OTT', 'AUS'], ottomanPrestige: -10 },
  },
  {
    id: 'french_revolution', year: 1789, month: 7, title: 'The French Revolution',
    text: 'The Bastille has fallen. The old order in France is swept away by the cry of liberty, equality and fraternity. The kings of Europe fear the contagion.',
    scope: 'world', condition: () => true,
    effects: { revolution: 'FRA', stabilityAll: -1 },
  },
  {
    id: 'napoleon', year: 1804, month: 12, title: 'The Emperor of the French',
    text: 'A Corsican artillery officer has crowned himself Emperor. The armies of France march under eagles, and the map of Europe will be redrawn once more.',
    scope: 'world', condition: () => true,
    effects: { napoleon: true, prestige: { FRA: 30 } },
  },
  {
    id: 'age_of_discovery', year: 1460, month: 1, title: 'The Age of Discovery',
    text: 'Caravels return from the African coast laden with gold and ivory. The ocean, once the edge of the world, is becoming a highway.',
    scope: 'world', condition: () => true,
    effects: { colonization: true, tradeBonus: 0.1 },
  },
  {
    id: 'gunpowder_empires', year: 1500, month: 1, title: 'Gunpowder Empires',
    text: 'Cannon and musketry transform the art of war. Fortified castles that once defied kings now crumble before the siege train.',
    scope: 'world', condition: () => true,
    effects: { techBonus: 1, fortCost: -0.15 },
  },
  {
    id: 'price_revolution', year: 1540, month: 1, title: 'The Price Revolution',
    text: 'Silver from the New World floods the markets of Europe. Prices rise, wages lag, and the old certainties of the economy are shaken.',
    scope: 'world', condition: () => true,
    effects: { inflationAll: 2, tradeBonus: 0.1 },
  },
  {
    id: 'scientific_revolution', year: 1543, month: 1, title: 'The Scientific Revolution',
    text: 'A canon astronomer has placed the sun at the center of the heavens. Reason begins to challenge revelation, and knowledge becomes power.',
    scope: 'world', condition: () => true,
    effects: { techBonus: 1, institution: 'printing' },
  },
  {
    id: 'glorious_revolution', year: 1688, month: 11, title: 'The Glorious Revolution',
    text: 'A Dutch prince has landed in England at the invitation of Parliament. The crowns of Europe are learning that kings may be made and unmade by consent.',
    scope: 'world', condition: () => true,
    effects: { stability: { ENG: -1, NED: 1 }, toleranceAll: 1 },
  },
];

export const RANDOM_EVENTS = [
  {
    id: 'good_harvest', weight: 10, title: 'A Bountiful Harvest',
    text: 'Favorable weather and honest labor have filled the granaries. The people give thanks.',
    choices: [
      { label: 'Distribute the surplus', effects: { stability: 1, treasury: -20, unrest: -3 } },
      { label: 'Sell it to the cities', effects: { treasury: 60, unrest: 2 } },
    ],
  },
  {
    id: 'bad_harvest', weight: 10, title: 'Crop Failure',
    text: 'Rain and frost have ruined the harvest. Bread prices soar and tempers fray.',
    choices: [
      { label: 'Open the royal granaries', effects: { treasury: -60, unrest: -5, stability: 1 } },
      { label: 'Let the market decide', effects: { unrest: 6, stability: -1 } },
    ],
  },
  {
    id: 'noble_conspiracy', weight: 6, title: 'A Noble Conspiracy',
    text: 'Great lords whisper against the crown, jealous of its growing power.',
    choices: [
      { label: 'Crush the plot', effects: { stability: -1, noblesLoyalty: -15, prestige: 5 } },
      { label: 'Buy their loyalty', effects: { treasury: -80, noblesLoyalty: 15, legitimacy: 5 } },
    ],
  },
  {
    id: 'merchant_petition', weight: 8, title: 'Petition of the Merchants',
    text: 'The merchant guilds ask for privileges and lower tolls, promising prosperity in return.',
    choices: [
      { label: 'Grant the charter', effects: { burghersLoyalty: 15, trade: 5, treasury: -30 } },
      { label: 'Refuse', effects: { burghersLoyalty: -10, treasury: 20 } },
    ],
  },
  {
    id: 'plague', weight: 4, title: 'Plague',
    text: 'A pestilence has appeared in the crowded quarters. The dead carts roll through the streets.',
    choices: [
      { label: 'Quarantine the city', effects: { treasury: -50, unrest: 3, pop: -0.02 } },
      { label: 'Trust in providence', effects: { pop: -0.06, unrest: 8, stability: -1 } },
    ],
  },
  {
    id: 'court_scandal', weight: 5, title: 'Court Scandal',
    text: 'A scandal at court has become the talk of every tavern. The crown\'s dignity suffers.',
    choices: [
      { label: 'Punish the guilty', effects: { legitimacy: 5, prestige: -5 } },
      { label: 'Cover it up', effects: { treasury: -40, legitimacy: -5 } },
    ],
  },
  {
    id: 'frontier_skirmish', weight: 6, title: 'Frontier Skirmish',
    text: 'Soldiers on the frontier have clashed with a neighbor. Hotheads demand satisfaction.',
    choices: [
      { label: 'Seek compensation', effects: { treasury: 30, prestige: 3, relationNeighbors: -5 } },
      { label: 'Apologize', effects: { prestige: -5, relationNeighbors: 5 } },
    ],
  },
  {
    id: 'heroic_commander', weight: 5, title: 'A Hero Rises',
    text: 'A young officer has distinguished himself in a skirmish. The army sings his praises.',
    choices: [
      { label: 'Promote him', effects: { armyMorale: 5, prestige: 5 } },
      { label: 'Reward the regiment', effects: { treasury: -30, armyMorale: 3, manpower: 500 } },
    ],
  },
  {
    id: 'religious_revival', weight: 7, title: 'Religious Revival',
    text: 'A wandering preacher has stirred the faithful. Crowds fill the churches and demand reform.',
    choices: [
      { label: 'Embrace the revival', effects: { stability: 1, clergyLoyalty: 15, tolerance: -1 } },
      { label: 'Suppress the movement', effects: { unrest: 5, clergyLoyalty: -10, tolerance: 1 } },
    ],
  },
  {
    id: 'new_trade_route', weight: 6, title: 'A New Trade Route',
    text: 'Merchants have opened a profitable route to distant markets. The customs houses are busy.',
    choices: [
      { label: 'Invest in the route', effects: { treasury: -40, trade: 8 } },
      { label: 'Tax it heavily', effects: { treasury: 50, burghersLoyalty: -10 } },
    ],
  },
  {
    id: 'peasant_revolt', weight: 6, title: 'Peasant Unrest',
    text: 'Heavy dues and bad years have driven the peasantry to the edge. Bands of armed men gather in the countryside.',
    choices: [
      { label: 'Lower their dues', effects: { treasury: -50, peasantsLoyalty: 15, unrest: -4 } },
      { label: 'Send in the soldiers', effects: { unrest: 5, peasantsLoyalty: -15, manpower: -500 } },
    ],
  },
  {
    id: 'great_fire', weight: 4, title: 'Great Fire',
    text: 'Fire has consumed a whole quarter of the capital. Rebuilding will be costly.',
    choices: [
      { label: 'Rebuild with stone', effects: { treasury: -100, development: 1, prestige: 3 } },
      { label: 'Leave it to the owners', effects: { unrest: 6, treasury: 10 } },
    ],
  },
];

export const MAP_MODES = {
  political: { name: 'Political', icon: '▣' },
  terrain: { name: 'Terrain', icon: '⛰' },
  religion: { name: 'Religion', icon: '✝' },
  culture: { name: 'Culture', icon: '☷' },
  economy: { name: 'Development', icon: '⚖' },
  military: { name: 'Military', icon: '⚔' },
  trade: { name: 'Trade', icon: '⛵' },
};

export const DIFFICULTY = {
  easy:   { name: 'Easy', aiAggression: 0.7, aiBonus: 0.85, playerBonus: 1.15 },
  normal: { name: 'Normal', aiAggression: 1.0, aiBonus: 1.0, playerBonus: 1.0 },
  hard:   { name: 'Hard', aiAggression: 1.25, aiBonus: 1.15, playerBonus: 0.9 },
};

export const AI_PERSONALITIES = {
  conqueror: { name: 'Conqueror', aggression: 1.5, economy: 0.8, diplomacy: 0.6 },
  diplomat:  { name: 'Diplomat',  aggression: 0.7, economy: 1.0, diplomacy: 1.4 },
  builder:   { name: 'Builder',   aggression: 0.6, economy: 1.3, diplomacy: 0.9 },
  trader:    { name: 'Trader',    aggression: 0.5, economy: 1.2, diplomacy: 1.0 },
  zealot:    { name: 'Zealot',    aggression: 1.2, economy: 0.9, diplomacy: 0.7 },
};

export const COLORS = {
  gold: '#c9a54a',
  parchment: '#e8dcc0',
  ink: '#1b1712',
  red: '#a33a3a',
  green: '#5a8a5a',
};
