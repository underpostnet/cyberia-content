# Graph Report - cyberia-content  (2026-11-07)

## Corpus Check
- 18 files · ~23,965 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 259 nodes · 758 edges · 8 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `744ad6a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.js
- schema/definitions.js
- content.js
- compiler.js
- validation/definitions.js
- package.js
- validation/procedural.js
- gemini-client.js

## God Nodes (most connected - your core abstractions)
1. `kindOf()` - 42 edges
2. `slugOf()` - 35 edges
3. `compileDefinitions()` - 19 edges
4. `checkDefinition()` - 17 edges
5. `compileSaga()` - 16 edges
6. `isLabeled()` - 16 edges
7. `readContent()` - 16 edges
8. `validateDefinitions()` - 13 edges
9. `normalizePackage()` - 12 edges
10. `validatePackage()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `readProcedural()` --indirect_call--> `slugOf()`  [INFERRED]
  src/procedural.js → src/schema/definitions.js
- `skinOf()` --calls--> `kindOf()`  [EXTRACTED]
  src/compiler.js → src/schema/definitions.js
- `labelOf()` --calls--> `kindOf()`  [EXTRACTED]
  src/compiler.js → src/schema/definitions.js
- `entityTypeDefault()` --calls--> `kindOf()`  [EXTRACTED]
  src/compiler.js → src/schema/definitions.js
- `entitySignature()` --calls--> `slugOf()`  [EXTRACTED]
  src/compiler.js → src/schema/definitions.js

## Import Cycles
- None detected.

## Communities (8 total, 0 thin omitted)

### Community 0 - "index.js"
Cohesion: 0.09
Nodes (46): definitionsOfKind(), fullDefinitions(), generateSaga(), GENERATION_STEPS, generationState(), nextStep(), nonEmpty(), runStep() (+38 more)

### Community 1 - "schema/definitions.js"
Cohesion: 0.07
Nodes (36): abilities, ART_BRIEF_FIELDS, artBrief(), boolean(), bounded(), CATEGORIES, CHARACTER_ARCHETYPES, color() (+28 more)

### Community 2 - "content.js"
Cohesion: 0.09
Nodes (41): compileContext(), FAMILIES, IGNORED_SAGAS, CONTENT_ROOT, CONTENT_VERSION, ContentError, createRegistry(), extendRegistry() (+33 more)

### Community 3 - "compiler.js"
Cohesion: 0.20
Nodes (28): compileBaseline(), compileDefinitions(), compileFoundation(), compileSaga(), defaultKey(), dialogues(), economyDocument(), entityRow() (+20 more)

### Community 4 - "validation/definitions.js"
Cohesion: 0.17
Nodes (27): entitySignature(), validateStats(), kindOf(), checkAbility(), checkCarriedAbilities(), checkCharacter(), checkComposition(), checkDefinition() (+19 more)

### Community 6 - "package.js"
Cohesion: 0.20
Nodes (22): ACTIVABLE_TYPES, asArray(), completeInteractions(), isPlainObject(), nonEmpty(), normalizeDefinition(), normalizeFields(), normalizeObjectLayer() (+14 more)

### Community 7 - "validation/procedural.js"
Cohesion: 0.14
Nodes (20): readProcedural(), readTemplates(), CONTRACT, CONTRACT_FILE, ENTITY_TYPES, COLOR_PATTERN, SLUG_PATTERN, checkDirections() (+12 more)

### Community 8 - "gemini-client.js"
Cohesion: 0.31
Nodes (5): GEMINI_API_BASE, GEMINI_DEFAULT_MODEL, GeminiClient, parseJsonLoose(), retryDelayOf()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `kindOf()` connect `validation/definitions.js` to `index.js`, `schema/definitions.js`, `content.js`, `compiler.js`, `package.js`, `validation/procedural.js`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `compileDefinitions()` (e.g. with `economyDocument()` and `itemStack()`) actually correct?**
  _`compileDefinitions()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09268707482993198 - nodes in this community are weakly interconnected._
- **Why does `slugOf()` connect `compiler.js` to `index.js`, `schema/definitions.js`, `content.js`, `validation/definitions.js`, `package.js`, `validation/procedural.js`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `schema/definitions.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06852497096399536 - nodes in this community are weakly interconnected._
- **Why does `GeminiClient` connect `gemini-client.js` to `index.js`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `content.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09216255442670537 - nodes in this community are weakly interconnected._