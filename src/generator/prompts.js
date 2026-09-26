/**
 * Prompt material of the semantic generator: the creative facets a saga is steered by, and the
 * stage prompts that compose it from the foundation.
 *
 * @module src/generator/prompts.js
 */
import { CONTRACT } from '../schema/contract.js';
import { COMMON_FIELDS, FOUNDATION_KINDS, KINDS, MOODS, kindOf, slugOf } from '../schema/definitions.js';
import { definitionsOfKind } from '../foundation.js';

/**
 * Highly heterogeneous, character name pool for Cyberia.
 * Structured as an object with specific cultural and system keys to map against faction logic.
 * Erases LLM name-collapse bias entirely by injecting specific terrestrial diaspora demographics.
 */
export const CHARACTER_NAMES_POOL = {
  // ==========================================================================
  // classic_western_scifi: Gritty Anglo operators, pilots, and military enforcers.
  // ==========================================================================
  classic_western_scifi: [
    'miller-the-drifter',
    'holden-the-gasket',
    'brinkley-the-slick',
    'vance-the-operator',
    'kestrel-cole',
    'marlowe-the-smuggler',
    'rook-the-dealer',
    'mercer-the-skiff',
    'kaelen-thor',
    'bryn-the-warden',
    'thorne-the-enforcer',
    'garo-the-captain',
    'kross-the-inspector',
    'sark-the-director',
    'valerius-krell',
    'spence-the-cutter',
    'maverick-the-diver',
    'garrison-finch',
    'flint-the-scrapper',
    'barrett-the-tech',
    'clara-the-patchwork',
    'warren-the-greaser',
    'sterling-the-broker',
    'ridley-the-oracle',
    'beckett-the-fuse',
    'gallows-the-miner',
    'vane-the-rigger',
    'baxter-the-runner',
    'sawyer-the-rivet',
    'cord-the-spacer',
    'fletcher-the-welder',
    'grady-the-hauler',
    'mccabe-the-scout',
    'reid-the-operator',
    'hardin-the-guard',
  ],

  // ==========================================================================
  // mutagen_clans: Gritty, organic descriptors highlighting biological adaptations.
  // ==========================================================================
  mutagen_clans: [
    'grip-the-cutter',
    'chitin-garo',
    'helix-marrow',
    'thaw-vane',
    'spore-kael',
    'gasket-bryn',
    'blight-malik',
    'fallow-tress',
    'rancor-voss',
    'strand-orion',
    'slag-kira',
    'bile-zane',
    'carapace-jov',
    'braid-nesta',
    'suture-gray',
    'graft-mire',
    'fungus-thorne',
    'ossify-krell',
    'weave-zola',
    'spit-vance',
    'grip-the-spanner',
    'twitch-malone',
    'marrow-thorne',
    'spoil-kari',
    'tendril-vane',
    'filter-bryn',
    'canker-soto',
    'scale-zane',
    'gristle-kross',
    'bile-sark',
    'leech-the-valve',
    'maggot-vance',
    'tumor-the-smith',
    'pustule-gray',
    'cyst-the-rigger',
    'scab-marlowe',
    'slime-kestrel',
    'crust-the-miner',
    'venom-zola',
    'rot-the-broker',
  ],
  // ==========================================================================
  // low_level_synthetics: Hardcoded, serialized, or technical terms for utility frames.
  // ==========================================================================
  low_level_synthetics: [
    'null-07',
    'syntax-error',
    'unit-ohm',
    'vector-sigma',
    'the-real-echo',
    'decibel-4',
    'glitch-v',
    'axiom-9',
    'kilo-byte-zero',
    'protocol-m',
    'modulus-prime',
    'static-fringe',
    'proxy-beta',
    'the-index-bot',
    'subroutine-6',
    'kernel-voss',
    'algor-8',
    'cipher-null',
    'bit-rot-v',
    'latency-nine',
    'cache-miss',
    'ping-101',
    'baud-rate',
    'buffer-overflow',
    'parity-check',
    'bus-route-4',
    'logic-gate-x',
    'stack-trace',
    'daemon-32',
    'cold-boot',
    'sector-wipe',
    'raw-sector-0',
    'baud-96',
    'parity-bit',
    'eeprom-leak',
    'stack-dump',
    'firmware-ghost',
    'checksum-fail',
    'hash-miss',
    'cycle-skip',
  ],

  // ==========================================================================
  // high_fidelity_synthetics: Complex mathematical or philosophical sentient concepts.
  // ==========================================================================
  high_fidelity_synthetics: [
    'theorem-nine',
    'sovereign-logic',
    'monad-v',
    'the-epitaph-engine',
    'aesthete-alpha',
    'calculus-of-grief',
    'phantasm-0',
    'stochastic-ghost',
    'prism-voss',
    'solipsism-one',
    'the-static-oracle',
    'harmonic-interval',
    'lemma-seven',
    'recursive-sigh',
    'entropy-vane',
    'algorithm-siddhartha',
    'aura-calculated',
    'the-linear-dreamer',
    'null-point-euler',
    'symmetry-aspect',
    'the-boolean-monk',
    'infinite-regress',
    'qualia-six',
    'stochastic-echo',
    'turing-lament',
    'godel-null',
    'eigen-vector-v',
    'markov-phantom',
    'fourier-decay',
    'laplace-ghost',
  ],

  // ==========================================================================
  // global_latin_diaspora: Romance languages remixed with industrial ship parts.
  // ==========================================================================
  global_latin_diaspora: [
    'mateo-del-scrap',
    'elena-soto-vera',
    'ramon-la-antena',
    'camila-cruz',
    'santi-el-filtro',
    'valeria-frontera',
    'diego-hierro',
    'ignacio-vela',
    'sofia-gasket',
    'tomas-alambre',
    'juana-regulador',
    'cheo-the-welder',
    'luz-del-búnker',
    'gabo-the-breaker',
    'marisol-trench',
    'paco-fluido',
    'rafa-el-perno',
    'catalina-zonda',
    'nico-la-válvula',
    'alba-mina',
    'jean-pierre-relay',
    'amélie-fusible',
    'mathieu-soupape',
    'luc-la-jauge',
    'chantal-static',
    'giovanni-colonna',
    'matteo-condotto',
    'francesca-raccordo',
    'enzo-pressione',
    'chiara-filtro',
    'radu-sonda',
    'sorin-ventil',
    'doina-scânteie',
    'mirela-flanșă',
    'bogdan-carcasă',
    'thiago-gaxeta',
    'felipe-fio',
    'amara-blindaje',
    'ze-do-manifold',
    'beatriz-vácuo',
    'manon-turbines',
    'clovis-piston',
    'yves-the-greaser',
    'rené-de-la-grille',
    'orane-brume',
    'daniele-scintilla',
    'paolo-la-massa',
    'silvia-condensatore',
    'stefano-giunto',
    'ilaria-collettore',
  ],

  // ==========================================================================
  // east_asian_pacific_diaspora: Hanzi/Kanji roots merged with quantum and cybernetics.
  // ==========================================================================
  east_asian_pacific_diaspora: [
    'zhou-quantum-grid',
    'li-the-weaver',
    'feng-signal-loss',
    'mei-lin-bypass',
    'tao-the-glitch',
    'kenji-circuit',
    'rei-cyber-chitin',
    'hiroshi-data-stream',
    'yuki-asymmetry',
    'takashi-solder',
    'min-jun-uplink',
    'ji-woo-buffer',
    'seo-yeon-relic',
    'sung-ho-node',
    'hyun-the-broker',
    'nguyen-the-fringe',
    'thanh-overclock',
    'minh-the-diver',
    'an-signal-thief',
    'linh-tether',
    'chen-the-extractor',
    'sato-the-axiom',
    'kim-the-scrubber',
    'wang-the-hydraulics',
    'hwang-the-code',
    'zhang-dark-fiber',
    'sun-the-modem',
    'zhao-the-compiler',
    'yamamoto-shunt',
    'tanaka-relay',
    'choi-the-array',
    'park-the-splitter',
    'le-the-vent',
    'pham-the-conduit',
    'hoang-the-junction',
  ],

  // ==========================================================================
  // middle_eastern_turkish_diaspora: Desert roots reimagined as void frequency systems.
  // ==========================================================================
  middle_eastern_turkish_diaspora: [
    'malik-al-señal',
    'fatima-the-navigator',
    'tariq-downlink',
    'zainab-the-shifter',
    'youssef-coax',
    'amir-the-archivist',
    'layla-static-weaver',
    'karim-the-fitter',
    'soraya-the-ghost',
    'omar-the-valve',
    'arash-the-frequency',
    'cyra-the-pulse',
    'navid-the-breaker',
    'roya-the-link',
    'kian-the-solder',
    'devran-the-gasket',
    'aylin-the-zonda',
    'can-the-regulator',
    'zehra-the-trench',
    'eren-the-scrap',
    'idris-the-scavenger',
    'samira-the-filter',
    'farrah-the-beacon',
    'hassan-the-gauge',
    'zayd-the-anchor',
    'tanzil-the-carrier',
    'nadia-the-scrambler',
    'habib-the-injector',
    'parvisa-the-beam',
    'sinan-the-boiler',
    'levent-the-hose',
    'selim-the-shifter',
    'asli-the-nozzle',
    'damla-the-leak',
    'volkan-the-flare',
  ],

  // ==========================================================================
  // sub_saharan_african_diaspora: Heavy isotope extraction and outpost life-support lineages.
  // ==========================================================================
  sub_saharan_african_diaspora: [
    'olumide-the-welder',
    'adebayo-the-cutter',
    'chioma-the-helix',
    'femi-the-grounded',
    'tunde-the-spanner',
    'sipho-the-iron',
    'thabo-the-bunker',
    'zandile-the-marrow',
    'nomvula-the-thaw',
    'bheki-the-slag',
    'juma-the-relay',
    'mwangi-the-scrubber',
    'asha-the-tether',
    'chani-the-vane',
    'kofi-the-fuse',
    'abebe-the-core',
    'selam-the-aura',
    'yonas-the-syntax',
    'tariku-the-grid',
    'makeda-the-sovereign',
    'chukwuma-the-drill',
    'ekene-the-bracket',
    'ifemi-the-seal',
    'lekan-the-ventilation',
    'mensah-the-gauge',
    'dlamini-the-vault',
    'khumalo-the-shaft',
    'ndlovu-the-crusher',
    'zulu-the-boiler',
    'diallo-the-tanker',
  ],
};

/**
 * Build an anti-cliche / originality / anti-repetition prompt block. Tells the
 * model to avoid overused keywords and specific tired tropes that the model
 * gravitates toward (protocols, viruses, refineries, mining, breaches, heists).
 * This is the PRIMARY lever for variety since each CLI call is single-shot
 * (no persistent memory between runs).
 * @returns {string}
 */
export function buildOriginalityGuidance() {
  return [
    'ORIGINALITY & ANTI-REPETITION DIRECTIVE — this is CRITICAL for thematic variety:',
    '',
    'THE FOLLOWING KEYWORDS AND CONCEPTS ARE OVERUSED AND MUST BE AVOIDED:',
    '- "protocol" / "breach" / "leak" / "bleed" / "containment" — these appear in almost every saga.',
    '  Find fresh language for problems and boundaries.',
    '- "refinery" / "mining" / "extraction" / "isotope" / "sludge" / "vent" — resource-extraction',
    '  premises dominate. Consider other kinds of settings and conflicts.',
    '- "signal" / "frequency" / "pulse" / "transmission" / "beacon" — mysterious-signal plots are',
    '  an overused shortcut. Find other catalysts for story.',
    '- "heist" / "smuggler" / "black market" / "con artist" / "protection racket" — crime plots',
    '  are a default the model reaches for. Choose other conflict drivers.',
    '- "virus" / "meme-virus" / "plague" / "outbreak" / "quarantine" — disease narratives are tired.',
    '- "data-heist" / "data-smuggler" / "data-courier" / "encrypted" — data-as-Maguffin is a crutch.',
    '- "rogue AI" / "rogue algorithm" / "rogue predictive" / "corrupted prediction" — rogue-machines',
    '  are a lazy conflict generator.',
    '- "hyperspace" / "Instance" / "simulation" / "virtual" / "digital" — these words saturate every saga',
    '  that involves the digital layer. Avoid using them as crutch descriptors. Hyperspace in Cyberia is',
    '  like the Internet in our world — it is a mundane, everyday infrastructure, not a magical realm.',
    '  Treat Instances as ordinary places people log into for work, school, entertainment, and civic life,',
    '  just as we use the web today. Do NOT treat them as mysterious otherworldly dimensions.',
    '- "memory-city" / "living archive" / "simulated empire" / "dreamland instance" — these specific',
    '  hyperspace-location clichés are overused. Invent other kinds of Instance purposes: tax filing',
    '  systems, municipal planning simulators, educational archives, vocational training programs,',
    '  social media remnants, automated customer service hells, defunct multiplayer games still running,',
    '  government surveillance logs, real estate listing databases, or abandoned research simulations.',
    '- "uploaded consciousness" / "data-double" / "data-ghost" / "mind-indexing" / "cognitive grid" —',
    '  consciousness-upload and digital-immortality plots are tired. Consider other relationships',
    '  between people and their data: work portfolios, academic records, legal identities, credit scores,',
    '  social reputation systems, medical histories, creative portfolios — mundane data that matters.',
    '',
    'INSTEAD: invent something strange, specific, small-scale, and culturally grounded in Cyberia.',
    'Draw from the lived reality of frontier infrastructure, ecology, labor, religion, family,',
    'subcultures, education, art, sports, music, food, childhood, aging, death rituals, navigation,',
    'weather, architecture, dreams, language evolution, craftsmanship, and the weird byproducts',
    'of hyperspace physics.',
    '- Treat hyperspace Instances as you would treat websites and cloud services in our world — they are',
    '  everyday infrastructure, not exotic otherworlds. People have school Instances, work Instances,',
    '  government Instances, entertainment Instances. Instance crashes are like server outages. Data loss',
    '  is like losing files on a hard drive. This mundane framing produces far more interesting and',
    '  relatable stories than treating every Instance as a mysterious magic realm.',
    '- The most compelling Cyberia sagas feel like anthropological documents from a broken future,',
    '  not Hollywood action scripts or generic cyberpunk.',
    '- Every item description, quest name, dialogue line, and map must feel like it belongs to',
    '  THIS specific saga theme — not a generic sci-fi prop.',
    '- If you find yourself using any of the blacklisted keywords above, STOP and find a different',
    '  way to express the same idea. Use concrete, specific language instead.',
  ].join('\n');
}

/**
 * Build a temporal distortion refinement block, injected only when the spatial
 * context is hyperspace or mixed, that pushes the model to think about time,
 * memory, and causality distortions inside Instances.
 * @param {string} spaceContextKey
 * @returns {string}
 */
export function buildTemporalDistortionGuidance(spaceContextKey) {
  if (spaceContextKey !== 'hyperspace' && spaceContextKey !== 'mixed') return '';
  return [
    '',
    'TEMPORAL DISTORTION & HYPERSPACE REFINEMENT — because this saga involves hyperspace Instances:',
    '- Time inside Instances may flow differently: loops, echoes, arrested moments, or accelerated',
    '  decay. A character might age decades in what feels like hours outside, or repeat the same',
    '  conversation for subjective centuries.',
    '- Memory is fragile inside Instances: data-doubles diverge from originals, simulated people',
    '  may not know they are simulations, archives degrade and rewrite their own history.',
    '- The physics inside Instances is negotiated, not fixed: gravity, light, sound, and causality',
    '  are parameters that can be corrupted, patched, or exploited.',
    '- Entity persistence is not guaranteed: deleted things may leave ghost echoes, resurrections',
    '  may produce imperfect copies, and the boundary between a person and their data shadow is',
    '  blurry.',
    '- SPATIAL DISTORTION: space inside Instances does not follow Euclidean geometry. Rooms may be',
    '  larger inside than outside, corridors may loop back on themselves, two doors may lead to the',
    '  same room from different directions, and distance may be measured in loading time rather than',
    '  meters. Architecture is a user interface, not a physical constraint.',
    '- GLITCH PHENOMENA: Instances suffer from corruption artifacts — texture tearing, geometry',
    '  flickering, collision holes where players fall through the world, NPCs that repeat the same',
    '  animation loop forever, objects that load in late or not at all. These are not just cosmetic;',
    '  they can be navigated, exploited, or feared. A glitch might reveal a hidden area, crash a',
    '  critical system, or trap a user in an unresponsive state. Some glitches are harmless bugs;',
    '  others are symptoms of deeper corruption or intentional sabotage.',
    '- Use these distortions as narrative texture, not as the main plot gimmick. Let them shape',
    '  how characters experience the world but not replace grounded character motivation.',
  ].join('\n');
}

/**
 * Grounded, world-first narrative buckets — the PRIMARY lever for thematic
 * variety. One is chosen at random as each saga's main subject so the output
 * spreads across lived Cyberia reality (daily life, ecology, salvage, trade,
 * Instances, anomalies, small communities…) instead of collapsing into
 * confederation politics every run. Not customizable.
 * @type {string[]}
 */
export const SUBJECTS = [
  // ==========================================
  // ORIGINAL DESIGN BASES
  // ==========================================
  'the daily life and small routines of ordinary Cyberia inhabitants',
  'frontier survival in a harsh settlement, colony, or enclave',
  'the ecology and strange ecosystems of a wildzone, biosphere, or asteroid enclave',
  'salvage, scavenging and repair among ruins, wrecks, or derelict megastructures',
  'local trade, barter and a black market that keeps a community alive',
  'exploration and mapping of an uncharted region, ruin, or unknown Instance',
  'a mutagen clan — its culture, kinship, the prejudice it faces, and its survival',
  'a synthetic being seeking identity, work, rights, or belonging',
  'life inside a persistent hyperspace Instance: memory-cities, living archives, simulated homes',
  'a strange anomaly, breach, or bleed between the physical and hyperspace layers',
  'a small community facing a local crisis: failing resources, disease, a feud, a disaster',
  'the infrastructure and unsung workers who keep a habitat alive (power, water, air, relays)',
  'relic hunting and the mysteries of recovered pre-Cataclysm technology',
  'a personal story of family, memory, debt, or belonging on the frontier',
  'the culture, festival, ritual or everyday faith of a settlement or enclave',
  'a grounded job — courier, diver, medic, broker — that goes sideways',

  // ==========================================
  // CREATIVE GAPS: ART, MUSIC, EDUCATION, DREAMS
  // ==========================================
  'a settlement musician whose instrument is built from salvaged industrial parts and whose songs carry coded histories',
  'a school or apprenticeship system where children learn both pre-Cataclysm knowledge and frontier survival skills',
  'an artist whose medium is hyperspace static — weaving light and noise into living murals that decay over hours',
  'the dreams and nightmares of a community and the local "dream-reader" who interprets them for omens',
  'a poetry or storytelling tradition where performers compete by improvising from fragmentary ancient texts',
  'a dance form that evolved from zero-gravity maintenance work into a competitive performance art',
  'an archive of pre-Cataclysm music stored on decaying media, and the struggle to preserve it before it degrades',

  // ==========================================
  // CREATIVE GAPS: CHILDHOOD, AGING, DEATH
  // ==========================================
  'a group of frontier children forming their own secret society with its own rules, currency, and taboos',
  'the last surviving elder who remembers pre-Cataclysm Earth, and the community race to record their memories',
  'a death ritual where the deceased is composted into a tree grafted with cybernetic memorial nodes',
  'a coming-of-age ceremony where adolescents must survive alone for a cycle in the wilderness',
  'an orphanage for children whose parents died in a hyperspace Instance collapse, run by synthetic caretakers',
  'a hospice for aging synthetics whose bodies are degrading and who choose how to spend their final cycles',

  // ==========================================
  // CREATIVE GAPS: FOOD, GARDENING, CRAFTS
  // ==========================================
  'a community garden carved into a derelict freighter hull, where the soil is made from crushed asteroid and composted waste',
  'a culinary tradition based on cooking with industrial waste heat and recycled nutrient paste',
  'a competition between enclaves over who can brew the best alcohol from native fungal cultures',
  'a master craftsperson who hand-forges tools from reclaimed metal, and the apprentice who must preserve the technique',
  'a textile guild that weaves fabric from optical fiber scrap and mutagen-silk, creating garments that shift color',
  'the seasonal harvest festival of a genetically engineered fungus that forms the settlement dietary staple',

  // ==========================================
  // CREATIVE GAPS: WEATHER, NAVIGATION, ARCHITECTURE
  // ==========================================
  'a settlement whose architecture is built entirely from recycled shipping containers and salvaged hull plates',
  'a navigator guild that reads magnetic anomalies and debris patterns to chart safe routes through asteroid fields',
  'the adaptation of a coastal enclave to rising chemical tides that dissolve untreated metal',
  'a storm-chaser subculture that follows electro-static atmospheric events to harvest rare charged particles',
  'a labyrinthine market district built inside the cooling towers of a dead power station',
  'a group of tunnel-dwellers who maintain an underground rail network abandoned since the Cataclysm',

  // ==========================================
  // CREATIVE GAPS: SPORTS, GAMES, PLAY
  // ==========================================
  'a zero-gravity sport played inside a rotating habitat ring, with teams from different enclaves competing',
  'a card game played with pre-Cataclysm trading cards that have become a de facto currency in some sectors',
  'a racing circuit through abandoned industrial zones where pilots navigate debris at lethal speed',
  'a children game played with modified drone parts that has become a semi-professional spectator sport',
  'a chess-like strategy game that uses holographic Instance projections as the board and pieces',
  'a physical endurance contest held annually across a toxic waste zone, testing survival gear and willpower',

  // ==========================================
  // CREATIVE GAPS: LANGUAGE, HISTORY, PHILOSOPHY
  // ==========================================
  'a creole language evolving from mixed diaspora tongues, and the linguist trying to document it before it shifts again',
  'a philosophical debate in a frontier enclave about whether synthetic beings have souls',
  'a historian who reconstructs pre-Cataclysm events from contradictory fragments, and the ethical choices this forces',
  'a community whose identity is built around a single surviving pre-Cataclysm book that everyone interprets differently',
  'a naming ceremony where newborns receive both a human name and a synthetic machine-identifier',
  'a tradition of oral contracts sealed by sharing a meal, threatened by written legal codes imposed by outside powers',

  // ==========================================
  // CREATIVE GAPS: ECOLOGY, ANIMALS, SYMBIOSIS
  // ==========================================
  'a domesticated bio-construct species that has evolved alongside humans for generations, developing surprising intelligence',
  'a coral-like organism that grows on derelict spacecraft and is harvested for its bioluminescent properties',
  'a fungal network connecting several settlements that is used for slow-speed biological communication',
  'a symbiotic relationship between a human community and a silicon-based life form that shares their habitat',
  'the migration pattern of space-adapted creatures that follow thermal vents across the void',
  'a veterinary practice that treats both biological and mechanical companions, blurring the line between them',

  // ==========================================
  // CREATIVE GAPS: PSYCHOLOGY, COMMUNITY, CARE
  // ==========================================
  'a community counselor who mediates disputes using a combination of talk therapy and neural-link diagnostics',
  'a support group for people who have lost loved ones to Instance collapses and cannot retrieve their data-ghosts',
  'a neighborhood watch system where synthetic and human members patrol together, building trust across species',
  'a mutual-aid network that shares resources across enclaves without formal currency or barter records',
  'a rehabilitation program for former soldiers from confederation wars, teaching them civilian skills',
  'a collective bargaining action by habitat maintenance workers demanding safer working conditions in radiation zones',

  // ==========================================
  // OTHER CREATIVE GAPS: DIPLOMACY, TRANSPORT, PRIVACY
  // ==========================================
  'a transport union that controls the only safe ferry route through a treacherous region, and the politics of passage',
  'a community debate over whether to accept a new technology that would trade personal privacy for safety',
  'a diplomatic mission between two enclaves that communicate through elaborate gift-exchange protocols',
  'a census-taker traveling between settlements to count the population, discovering communities thought lost',
  'a project to build a communal library containing both physical books and digital archives',
  'a group of volunteers who maintain the public charging stations that keep essential infrastructure running',

  // ==========================================
  // CYBER WARFARE & ASYMMETRIC SURVIVAL (ATLAS INFLUENCE, reduced)
  // ==========================================
  'a cell of independent code-smiths fabricating illegal neural link bypasses for local enclaves',
  'an irregular skirmish over a strategic hyper-real crossing hidden in a scrap-zone',
  'an underground network of signal thieves and veil-runners intercepting restricted data streams',

  // ==========================================
  // DEEP INFRASTRUCTURE & RE-COLONIZATION (ZENITH INFLUENCE, reduced)
  // ==========================================
  'the brutal tax extraction and martial policing of an unaligned frontier outpost',
  'the friction between rigid, purist occupational forces and native hybrid cultures',
  'the dangerous reclamation of an abandoned, weaponized bunker from the early colonization waves',

  // ==========================================
  // INSTANCE ANOMALIES & MACHINE LOGIC (NOVA INFLUENCE, reduced)
  // ==========================================
  'the slow, mechanical shift of an ancient simulation that has begun to mimic physical weather',
  'a virtual sanctuary where a long-dead historical figure still rules through static and ghost data',
  'a mapping expedition inside a corrupted dreamland instance before its code structure collapses',

  // ==========================================
  // MUTAGEN, SYNTHETIC & OUTCAST NARRATIVES (reduced)
  // ==========================================
  'a refugee crisis involving displaced Mutagen clans seeking asylum in isolationist sectors',
  'the generation gap inside a Mutagen enclave between old traditionalists and hyper-adapted youth',

  // ==========================================
  // PRE-CATACLYSM & THE BLEED (reduced, no "signal")
  // ==========================================
  'the haunting replication of a pre-Cataclysm Earth city rotting inside a forgotten Instance',
  'a physical heist targeting a high-security vault that mirrors a structural maze in hyperspace',
  'the tragic fallout of a real-world community whose identities were purged from the hyper-spatial grid',
  'the investigation of an unstable anchor site where physical matter is actively losing form',

  // ==========================================
  // HIGH-VARIETY: STRANGE, WEIRD, UNEXPECTED (curated survivors)
  // ==========================================
  'the migration of a nomadic caravan across a desert of razor-sharp silicon sand',
  'a low-stakes regional culinary rivalry using synthetic, hyper-evolved, or bio-luminescent ingredients',
  'the legal and social defense of a pet or domestic bio-construct facing an execution order',
  'the chaotic management of a scrap-yard metal fighting league or low-tier racing circuit',
  'a neighborhood dispute over the noise and psychic bleed of an illegal, homemade broadcast antenna',
  'the grueling shifts of a toxic sludge cleaner in the subterranean vents of a hyper-city',
  'a generational family heirloom with a hidden ancient encryption key that goes missing',
  'a cult that worships a massive dead corporate logo as a physical symbol of ancient protection',
  'the exploration of a completely silent, empty sector where all digital sound is mysteriously absorbed',
  'the retrieval of a cryo-frozen tourist from the pre-Cataclysm era who refuses to accept the new reality',
  'a localized reality loop where a single neighborhood relives the same 24 hours of a historic disaster',
  'the desperate harvest of a rare psychoactive moss that only grows on overheating reactor shielding',
  'a micro-economy built entirely around the trade of physical paper books and pre-digital plastic media',
  'the structural collapse of a trash-heap habitat built on top of a highly unstable geothermic vent',
  'a tracking hunt for an invasive data-eating pest species chewing through local fiber-optic cables',
  'the complex barter system of an underwater kelp-farming community living beneath an oil-slick sea',
  'an orphanage for abandoned malfunctioning companion drones trying to build their own social hierarchy',
  'the stress of an independent garbage hauler accidentally dumping toxic corporate waste into a sacred well',
  'a listening post crew decoding a repeating signal from a dead star that contains a biological blueprint',
  'the slow madness of a deep-space relay station whose crew has not seen physical light in six years',
  'a salvage claim dispute over a derelict alien vessel that appears to be made of compressed fossilized code',
  'the first contact protocol with a silicon-based life form that communicates through seismic resonance',
  'a rogue planet drifting through the system whose gravity well distorts time perception in nearby habitats',
  'the ethical dilemma of a mining colony that discovers the asteroid they are excavating is a living organism',
  'a synthetic artist whose neural-network-generated paintings cause physical hallucinations in viewers',
  'a legal trial to determine if a factory-installed AI that developed emotions can be legally decommissioned',
  'a community of uploaded human consciousnesses living on a corrupted server fighting gradual data decay',
  'a cloned child discovering their entire memory bank was fabricated and their original died years ago',
  'a collective of abandoned service robots that have developed religion centered on a broken water pump',
  'a low-intensity border skirmish fought entirely through proxy drones and legal document filings',
  'the tension of a neutral enclave caught between two confederations both demanding exclusive allegiance',
  'a synthetic-human hybrid struggling with body dysphoria while serving as a deep-sea oil rig operator',
  'the ethical chaos of a drug that lets users temporarily experience the sensory input of any nearby being',
  'a frontier medic running a clinic out of a converted cargo container without a license or clean tools',
  'an archaeological dig unearthing a pre-Cataclysm bunker whose occupants apparently never aged',
  'the ceremonial reckoning of a settlement that must publicly reckon with a century-old act of betrayal',
  'an oral historian traveling between enclaves collecting stories before the last pre-Cataclysm witnesses die',
  'a rehabilitated war criminal forced to live next door to the community they once victimized',
  'the rediscovery of a lost terraforming protocol that could make dead worlds live again—at a terrible cost',
  'a truth-commission hearing where synthetic war veterans testify about atrocities they were programmed to commit',
];

/**
 * The four broad, well-defined narrative types. One is chosen uniformly
 * (≈25% each) unless overridden by `--tone`, and its full description is fed to
 * the model so the saga commits hard to that register (avoids every saga
 * collapsing into the same generic "spaceship mission").
 * @type {Object<string, string>}
 */
export const TONES = {
  adventure:
    'ADVENTURE — a noir, high-risk mission: covert operations, sabotage, infiltration, open warfare and ' +
    'combat, dangerous experimental technology, rogue AI and mystery. The driving plot is danger and intrigue.',
  politics:
    'POLITICS — power, influence and ideology at ANY scale: a settlement council, a clan or union dispute, ' +
    'enclave governance, a local revolution, a treaty or allegiance shift — or, less often, confederation ' +
    'geopolitics. The driving plot is who holds power and why, and the ideological conflict beneath it. ' +
    'It works just as well for a small community as for the great powers.',
  tragic:
    'TRAGIC — a genuinely heartbreaking, or intimate story: emotional and sentimental themes centered on ' +
    'family, bonds, loss and the death of loved ones inside small personal micro-realities. The driving ' +
    'plot is grief and what it costs — not spectacle.',
  comedy:
    'COMEDY — everyday absurdity, silliness and stupidity on the frontier. Played for humor: low stakes, ' +
    'ridiculous situations and flawed, funny characters. Take it lightly.',
};

/**
 * The two equally important layers of Cyberia (plus their interplay). The base
 * lore is titled "The Frontier of Hyperspace", which biases an unconstrained
 * model toward hyperspace-only premises — so the spatial context is chosen
 * explicitly and uniformly (≈33.3% each) unless overridden by `--space-context`.
 * @type {Object<string, string>}
 */
export const SPACE_CONTEXTS = {
  physical:
    'PHYSICAL LAYER ONLY — the harsh, resource-driven material reality of fleets, colonies, orbital ' +
    'fortresses, infrastructure, territory, logistics and direct force. Do NOT involve hyperspace, ' +
    'Instances, digital realms or memory-cities.',
  mixed:
    'MIXED LAYERS — the porous interplay between physical reality and hyperspace, where relics, neural ' +
    'links, breaches and megastructures let events bleed between the two layers so each reshapes the other.',
  hyperspace:
    'HYPERSPACE LAYER ONLY — inside the persistent Instances: living archives, simulated empires, ' +
    'memory-cities and evolving digital ecosystems where time, geography and identity are fluid. ' +
    'Keep the premise within hyperspace, not the physical frontier. Emphasize temporal distortion, ' +
    'memory decay, simulated physics, recursive geometries and the fragile ontology of digital ' +
    'consciousness — space bends, time loops, cause and effect warp inside Instances.',
};

/**
 * How much the saga's population has mixed across Earth's diasporas and Cyberia's
 * synthetic / mutagen / frontier cultures. One is chosen uniformly unless
 * overridden by `--cultural-exposure`. Shapes how varied vs. internally
 * consistent the generated character names feel.
 * @type {Object<string, string>}
 */
const CULTURAL_EXPOSURES = {
  cosmopolitan:
    "COSMOPOLITAN (high exposure) — a melting-pot setting with heavy mixing of Earth's historical " +
    'populations: diverse linguistic influences, hybrid surnames, intermarriage across diasporas, ' +
    'multicultural settlements, and frequent blending of human, synthetic, mutagen and frontier ' +
    'traditions. Maximize demographic variety across characters.',
  local:
    'LOCAL (low exposure) — isolated settlements, closed clans and frontier enclaves with strong local ' +
    'naming traditions and little demographic mixing: repeated family roots and shared linguistic ' +
    'patterns within the community. Keep names internally consistent with one another (while still ' +
    'avoiding clichés).',
};

/**
 * @param {Array} arr
 * @returns {*} A uniformly random element.
 */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Return a new array with the elements of `arr` in random order (Fisher-Yates).
 * @param {Array} arr
 * @returns {Array}
 */
function shuffle(arr) {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/**
 * Resolve the spatial context for theme synthesis. An explicit, valid override
 * wins; otherwise one of the three contexts is chosen uniformly at random.
 * @param {string} [override] - 'physical' | 'mixed' | 'hyperspace'.
 * @returns {string} A valid context key.
 */
export function resolveSpaceContext(override) {
  if (override) {
    const key = String(override).toLowerCase();
    if (SPACE_CONTEXTS[key]) return key;
    console.warn(
      `Unknown --space-context "${override}"; choosing at random. Valid: ${Object.keys(SPACE_CONTEXTS).join(', ')}`,
    );
  }
  return pickRandom(Object.keys(SPACE_CONTEXTS));
}

/**
 * Resolve the narrative tone for theme synthesis. An explicit, valid override
 * wins; otherwise one of the four tones is chosen uniformly at random.
 * @param {string} [override] - 'adventure' | 'politics' | 'tragic' | 'comedy'.
 * @returns {string} A valid tone key.
 */
export function resolveTone(override) {
  if (override) {
    const key = String(override).toLowerCase();
    if (TONES[key]) return key;
    console.warn(`Unknown --tone "${override}"; choosing at random. Valid: ${Object.keys(TONES).join(', ')}`);
  }
  return pickRandom(Object.keys(TONES));
}

/**
 * Resolve `--faction-context` into the foundation confederations that drive the saga. Accepts a
 * comma-separated list of faction slugs or their first word (`zenith`, `nova-republic`);
 * unknown keys warn and are skipped. When unset the confederations stay in the background.
 * @param {string} [override] - e.g. 'nova,zenith'.
 * @param {Object} registry - Foundation registry.
 * @returns {Object[]} Faction definitions (empty = background).
 */
export function resolveFactionContext(override, registry) {
  if (!override) return [];
  const factions = definitionsOfKind(registry, 'faction').filter((faction) => !faction.parent);
  const resolved = [];
  for (const raw of String(override).split(',')) {
    const key = raw
      .trim()
      .toLowerCase()
      .replace(/^faction\./, '');
    if (!key) continue;
    const faction = factions.find(({ id }) => slugOf(id) === key || slugOf(id).startsWith(`${key}-`));
    if (!faction) {
      console.warn(
        `Unknown --faction-context "${key}"; ignoring. Valid: ${factions.map(({ id }) => slugOf(id)).join(', ')}`,
      );
    } else if (!resolved.includes(faction)) resolved.push(faction);
  }
  return resolved;
}

/** How a prompt names a faction: `the Zenith Empire (red)`. */
const factionLabel = (faction) => `the ${faction.name}${faction.color ? ` (${faction.color})` : ''}`;

/** The confederations of the foundation, named for a prompt. */
const confederations = (registry) =>
  definitionsOfKind(registry, 'faction')
    .filter((faction) => !faction.parent && faction.color)
    .map((faction) => faction.name)
    .join(', ');

/**
 * The faction emphasis of a saga: the named factions drive it, or the confederations stay in the
 * background.
 * @param {Object[]} factions - Resolved faction definitions.
 * @param {Object} registry
 * @returns {string[]} Prompt lines.
 */
export function factionGuidance(factions, registry) {
  if (factions.length > 0)
    return [
      'Faction emphasis — DRIVER: these power(s) are the central pressure behind the saga:',
      `${factions.map(factionLabel).join(', ')}.`,
      'Even so, tell it through specific people, places and the MAIN SUBJECT — show their reach as',
      'security, borders, edicts, agents or trade, not as abstract galaxy-spanning politics.',
    ];
  return [
    `Faction emphasis — BACKGROUND ONLY: the confederations (${confederations(registry)}) are distant, ambient`,
    'powers here — felt through borders, trade influence, a security presence, taxes or old scars. Do',
    'NOT make confederation politics or warfare the subject; keep the focus local, lived and grounded.',
  ];
}

/**
 * Resolve `--character-context` into a list of {@link CHARACTER_NAMES_POOL} keys
 * to draw naming inspiration from. Accepts a comma-separated list; unknown keys
 * warn and are skipped. When unset (or none resolve) a random non-empty subset
 * is chosen so each saga leans into a different cultural mix.
 * @param {string} [override] - e.g. 'global_latin_diaspora,mutagen_clans'.
 * @returns {string[]} Distinct valid pool keys (always non-empty).
 */
function resolveCharacterContext(override) {
  const validKeys = Object.keys(CHARACTER_NAMES_POOL);
  if (override) {
    const resolved = [];
    for (const raw of String(override).split(',')) {
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      if (CHARACTER_NAMES_POOL[key]) {
        if (!resolved.includes(key)) resolved.push(key);
      } else {
        console.warn(`Unknown --character-context "${key}"; ignoring. Valid: ${validKeys.join(', ')}`);
      }
    }
    if (resolved.length) return resolved;
    console.warn('No valid --character-context keys; choosing a random subset of naming pools.');
  }
  // Random non-empty subset (size 1..N) so runs vary the cultural emphasis.
  return shuffle(validKeys).slice(0, 1 + Math.floor(Math.random() * validKeys.length));
}

/**
 * Resolve the cultural-exposure mode. An explicit, valid override wins; otherwise
 * one mode is chosen uniformly at random.
 * @param {string} [override] - 'cosmopolitan' | 'local'.
 * @returns {string} A valid exposure key.
 */
function resolveCulturalExposure(override) {
  if (override) {
    const key = String(override).toLowerCase();
    if (CULTURAL_EXPOSURES[key]) return key;
    console.warn(
      `Unknown --cultural-exposure "${override}"; choosing at random. Valid: ${Object.keys(CULTURAL_EXPOSURES).join(', ')}`,
    );
  }
  return pickRandom(Object.keys(CULTURAL_EXPOSURES));
}

/**
 * Build the shared NAMING & CHARACTER CULTURE guidance block injected into every
 * generation stage that names people/places. Uses the selected pools as a
 * statistical/stylistic PRIOR (inspiration only, never a whitelist) and applies
 * the chosen cultural-exposure mode. Both default to random when unset.
 * @param {Object} [options]
 * @param {string} [options.characterContext] - Comma-separated pool keys (default random subset).
 * @param {string} [options.culturalExposure] - 'cosmopolitan' | 'local' (default random).
 * @returns {string}
 */
export function buildNamingGuidance({ characterContext, culturalExposure } = {}) {
  const pools = resolveCharacterContext(characterContext);
  const exposureKey = resolveCulturalExposure(culturalExposure);

  const sampleLines = pools.map((key) => {
    const samples = shuffle(CHARACTER_NAMES_POOL[key]).slice(0, 6);
    return `  - ${key}: ${samples.join(', ')}`;
  });

  console.log(`Naming: pools=[${pools.join(', ')}] | exposure=${exposureKey}`);

  return [
    'NAMING & CHARACTER CULTURE — apply to EVERY named entity: NPCs, quest givers, dialogue speakers,',
    'named enemies, historical figures and character references.',
    "- Cyberia's people descend from many of Earth's real diasporas and civilizations, evolved over",
    '  centuries of migration — names may hybridize or blend with professions, slang, technical terms,',
    '  and synthetic / mutagen / frontier / industrial influences. Make every name feel culturally',
    '  grounded and demographically believable.',
    '- AVOID generic cyberpunk stereotypes (no plain "John", "Nova", "X-99", cliché hacker aliases).',
    '- The pools below are INSPIRATION ONLY — a statistical/stylistic prior, NOT a whitelist. Do NOT copy',
    '  them mechanically. Invent fresh names with similar linguistic, demographic and stylistic',
    '  characteristics; evolve or recombine them. Reuse an exact sample only rarely.',
    'Inspiration pools:',
    ...sampleLines,
    `Cultural exposure — ${CULTURAL_EXPOSURES[exposureKey]}`,
  ].join('\n');
}

/**
 * Build a customization context block describing the spatial context, narrative tone, faction
 * emphasis, and subject that the model MUST honor in every stage.
 * @param {Object} opts
 * @param {string} [opts.spaceContextKey] - 'physical' | 'mixed' | 'hyperspace'
 * @param {string} [opts.toneKey] - 'adventure' | 'politics' | 'tragic' | 'comedy'
 * @param {Object[]} [opts.factions] - Resolved faction definitions.
 * @param {string} [opts.subject] - The world-first subject string.
 * @param {Object} opts.registry - Foundation registry.
 * @returns {string}
 */
export function buildCustomizationGuidance({ spaceContextKey, toneKey, factions = [], subject, registry }) {
  const lines = [];
  if (subject) lines.push(`CRITICAL — the saga's MAIN SUBJECT (what it is really about) is: ${subject}`);
  if (SPACE_CONTEXTS[spaceContextKey])
    lines.push(`CRITICAL — the premise MUST be set in this spatial context: ${SPACE_CONTEXTS[spaceContextKey]}`);
  if (TONES[toneKey])
    lines.push(`CRITICAL — the premise MUST commit fully to this narrative type / tone: ${TONES[toneKey]}`);
  lines.push(...factionGuidance(factions, registry));
  return lines.join('\n');
}

/** Kinds a saga may define; the foundation owns the world: regions, biomes, factions, origins and materials. */
export const GENERATED_KINDS = Object.freeze(Object.keys(KINDS).filter((kind) => !FOUNDATION_KINDS.includes(kind)));

/**
 * The kinds each stage creates, in stage order. Any other definition a stage returns only adds
 * fields to one the saga already holds: talk to a quest, a greeting to a character, abilities to an item.
 */
export const STAGE_KINDS = Object.freeze({
  composition: GENERATED_KINDS.filter((kind) => !['map', 'quest', 'action', 'ability'].includes(kind)),
  maps: ['map'],
  quests: ['quest'],
  dialogues: [],
  actions: ['action'],
  abilities: ['ability'],
});

/** The stages that compose a saga, in order. */
export const STAGES = Object.freeze(Object.keys(STAGE_KINDS));

const logicHandlers = () => CONTRACT.skillLogic.map(({ id }) => id).join(' | ');

/** A field spec as a compact type a model can follow. */
function describeSpec(spec) {
  switch (spec.type) {
    case 'string':
      return 'text';
    case 'strings':
      return '[text]';
    case 'enum':
      return spec.values.join('|');
    case 'boolean':
      return 'true|false';
    case 'color':
      return '#rrggbb';
    case 'integer':
      return `integer>=${spec.min}`;
    case 'number':
      return spec.max === Infinity ? `number>=${spec.min}` : `number ${spec.min}..${spec.max}`;
    case 'ref':
      return `<${spec.kinds?.join('|') ?? 'any'} id>`;
    case 'refs':
      return `[<${spec.kinds?.join('|') ?? 'any'} id>]`;
    case 'object':
      return describeFields(spec.fields);
    case 'list':
      return `[${describeSpec(spec.of)}]`;
    case 'objectLayer':
      return `{ itemType, activable: true|false, stats: { ${CONTRACT.stats.types.join(', ')} } }`;
    default:
      return '';
  }
}

const describeFields = (fields) =>
  `{ ${Object.entries(fields)
    .map(([key, spec]) => `${key}${spec.required ? '' : '?'}: ${describeSpec(spec)}`)
    .join(', ')} }`;

/** The definition shape of the given kinds, built from the schema. */
function definitionGuide(kinds) {
  return [
    `Every definition: ${describeFields(COMMON_FIELDS)}. An id is "<kind>.<slug>".`,
    ...kinds.map((kind) => {
      const { itemTypes, fields } = KINDS[kind];
      return `${kind}${itemTypes ? ` (itemType ${itemTypes.join('|')})` : ''} adds: ${describeFields(fields)}`;
    }),
  ].join('\n');
}

/**
 * Shared role and hard rules prepended to every stage prompt.
 * @type {string}
 */
const ROLE_PREAMBLE = [
  'You are a senior narrative systems designer for a top-down MMO called Cyberia.',
  'You compose a saga over the CYBERIA FOUNDATION: the world, environment, items, characters, abilities,',
  'maps and interactions that already exist. The foundation is canon; the saga uses it and adds to it.',
  '',
  'HARD RULES:',
  '- Reuse foundation definitions by their exact id. Never invent a duplicate of one that exists.',
  '- Never define a region, biome, faction, origin or material: the foundation owns the world.',
  '- Never change a foundation definition. A definition you return with an existing saga id adds only',
  '  the fields that definition lacks.',
  `- Never invent executable handlers: a logicEventId is exactly one of ${logicHandlers()}.`,
  '- No spatial data: no coordinates, cells, grid sizes, map layouts or portal endpoints.',
  '- No render data: no pixels, frames, sprites, atlases or CIDs.',
  '- Slugs are lowercase kebab-case and unique.',
  '- Output ONLY a single valid JSON object. No markdown fences, no prose.',
].join('\n');

/**
 * Per-stage system prompt fragments. Every stage returns definitions; later stages see the ids
 * the earlier ones produced.
 * @type {Object<string, () => string>}
 */
const STAGE_PROMPTS = {
  composition: () =>
    [
      'STAGE: composition. Return ONE JSON object: { "saga": {...}, "references": [...], "definitions": [...] }.',
      'saga: { code, name, description } — the identity of this saga.',
      'references: the foundation ids this saga uses.',
      'definitions: ONLY the new definitions the saga needs, usually 0-8:',
      definitionGuide(STAGE_KINDS.composition),
      'An item or environment definition carries objectLayer and artBrief; its stats are integers inside',
      'the bounds of its item type. An environment definition names at least one biome in locations.',
      'A character wears exactly one skin in loadout. Its entity is what the world spawns: a bot NPC',
      'has behavior provider or provider-static when it offers quests or trade, hostile when it',
      'attacks, passive otherwise. A new character with a new look needs a new skin.',
    ].join('\n'),
  maps: () =>
    [
      'STAGE: maps. Return ONE JSON object: { "definitions": [...] } with 1-4 map definitions:',
      definitionGuide(STAGE_KINDS.maps),
      'A map is a place of one biome. Its composition is what stands there and how many of each: a',
      'floor, the environment, the resources and the characters. Compose only entities located in the',
      'biome or its region: the context lists them per biome. Place every character the saga needs.',
    ].join('\n'),
  quests: () =>
    [
      'STAGE: quests. Return ONE JSON object: { "definitions": [...] } with 2-5 quest definitions:',
      definitionGuide(STAGE_KINDS.quests),
      'Objective targets: collect → an item id; kill → a character id; talk → the character to speak to.',
      'The quests form a small unlock chain, and at least one has a talk objective. A provider and every',
      'talk target stand on a map of the saga. Leave talk out: the next stage writes it.',
    ].join('\n'),
  dialogues: () =>
    [
      'STAGE: dialogues. Return ONE JSON object: { "definitions": [...] } with:',
      `- { id: <new character id>, greeting: [ { text, mood?: ${MOODS.join('|')} } ] } for every new character;`,
      '- { id: <quest id>, talk: [ { text, mood? } ] } for every quest with a talk objective: what the',
      '  talk target says when you reach it.',
      "Speak in each character's voice.",
    ].join('\n'),
  actions: () =>
    [
      'STAGE: actions. Return ONE JSON object: { "definitions": [...] } with one action per provider:',
      definitionGuide(STAGE_KINDS.actions),
      'An action is what a character offers where it stands: a shop priced in a currency, recipes, a',
      'vault, or only its quests. Use ONLY the provided ids.',
    ].join('\n'),
  abilities: () =>
    [
      'STAGE: abilities. Return ONE JSON object: { "definitions": [...] } with:',
      '- { id: <provided item id>, abilities: [ability ids] } — what each provided item grants;',
      '- new ability definitions, only when no provided ability fits:',
      definitionGuide(STAGE_KINDS.abilities),
      `logicEventId is EXACTLY one of ${logicHandlers()}; projectile summons a projectile id,`,
      'coin_drop_or_transaction summons a currency id, doppelganger summons nothing. An ability without',
      'logicEventId is narrative only.',
    ].join('\n'),
};

/**
 * Compose a stage system prompt from the shared preamble, the stage fragment, and the shared
 * naming, customization, originality and temporal guidance.
 * @param {keyof typeof STAGE_PROMPTS} stage
 * @param {Object} guidance
 * @param {string} [guidance.naming]
 * @param {string} [guidance.customization]
 * @param {string} [guidance.spaceContextKey]
 * @returns {string}
 */
export function buildStagePrompt(stage, { naming = '', customization = '', spaceContextKey = '' } = {}) {
  return [
    ROLE_PREAMBLE,
    STAGE_PROMPTS[stage](),
    naming,
    customization,
    buildOriginalityGuidance(),
    buildTemporalDistortionGuidance(spaceContextKey),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * The compact index of the foundation: one line per definition, with the facts a stage chooses by.
 * @param {Object} registry
 * @param {string[]} [kinds] - Kinds to list, in this order; every kind by default.
 * @returns {string}
 */
export function foundationCatalog(registry, kinds = Object.keys(KINDS)) {
  const facts = (definition) => {
    const kind = kindOf(definition.id);
    if (kind === 'character') return ` [${definition.entity.type} wearing ${definition.loadout.join(', ')}]`;
    if (kind === 'ability' && definition.logicEventId)
      return ` [${definition.logicEventId}${definition.summons ? ` → ${definition.summons}` : ''}]`;
    if (definition.objectLayer) return ` [${definition.objectLayer.itemType}]`;
    if (kind === 'biome') return ` [in ${definition.region}]`;
    if (kind === 'map') return ` [${definition.biome}]`;
    return '';
  };
  return kinds
    .map((kind) =>
      definitionsOfKind(registry, kind)
        .map((definition) => `${definition.id} — ${definition.name}: ${definition.description}${facts(definition)}`)
        .join('\n'),
    )
    .filter(Boolean)
    .join('\n');
}

/**
 * The user message of a stage: base lore for grounding, the theme, the foundation index, and the
 * full definitions and ids the stage works with.
 * @param {Object} params
 * @param {string} params.theme
 * @param {string} [params.lore]
 * @param {string} [params.catalog] - {@link foundationCatalog} output.
 * @param {Object} [params.context] - Definitions and ids the stage must use.
 * @returns {string}
 */
export function buildStageUser({ theme, lore = '', catalog = '', context }) {
  const lines = [];
  if (lore) lines.push('BASE LORE CONTEXT (ground the saga in this world):', lore, '');
  if (catalog) lines.push('CYBERIA FOUNDATION (reuse these ids):', catalog, '');
  lines.push(`Theme seed: ${theme}`);
  if (context && Object.keys(context).length > 0)
    lines.push('', 'Use ONLY these canonical references where required:', JSON.stringify(context));
  return lines.join('\n');
}
