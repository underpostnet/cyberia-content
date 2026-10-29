# Graph Report - cyberia-content  (2026-10-29)

## Corpus Check
- 18 files · ~22,102 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 245 nodes · 704 edges · 9 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `682bf161`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.js
- schema/definitions.js
- build.js
- compiler.js
- validation/definitions.js
- content.js
- package.js
- validation/procedural.js
- gemini-client.js

## God Nodes (most connected - your core abstractions)
1. `kindOf()` - 40 edges
2. `slugOf()` - 35 edges
3. `compileDefinitions()` - 19 edges
4. `isLabeled()` - 17 edges
5. `checkDefinition()` - 17 edges
6. `compileSaga()` - 14 edges
7. `readContent()` - 14 edges
8. `generateSaga()` - 13 edges
9. `composeSemantics()` - 12 edges
10. `validateDefinitions()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `readProcedural()` --indirect_call--> `slugOf()`  [INFERRED]
  src/procedural.js → src/schema/definitions.js
- `compileDefinitions()` --calls--> `validateStats()`  [EXTRACTED]
  src/compiler.js → src/schema/contract.js
- `compileFoundation()` --calls--> `slugOf()`  [EXTRACTED]
  src/compiler.js → src/schema/definitions.js
- `artifactContent()` --calls--> `compileSaga()`  [EXTRACTED]
  src/packaging/build.js → src/compiler.js
- `sagaInstanceBackup()` --calls--> `compileSaga()`  [EXTRACTED]
  src/saga-instance.js → src/compiler.js

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "index.js"
Cohesion: 0.11
Nodes (39): ContentError, definitionsOfKind(), composeSemantics(), fullDefinitions(), generateSaga(), synthesizeTheme(), buildCustomizationGuidance(), buildNamingGuidance() (+31 more)

### Community 1 - "schema/definitions.js"
Cohesion: 0.07
Nodes (35): abilities, ART_BRIEF_FIELDS, artBrief(), boolean(), bounded(), CHARACTER_ARCHETYPES, color(), EFFECT_CATEGORIES (+27 more)

### Community 2 - "build.js"
Cohesion: 0.11
Nodes (24): compileFoundation(), defaultKey(), FAMILIES, ARTIFACT_SCHEMA_VERSION, artifactContent(), artifactManifest(), PACKAGE_ROOT, writeArtifact() (+16 more)

### Community 3 - "compiler.js"
Cohesion: 0.22
Nodes (29): compileBaseline(), compileContext(), compileDefinitions(), compileSaga(), dialogues(), economyDocument(), entityRow(), entitySignature() (+21 more)

### Community 4 - "validation/definitions.js"
Cohesion: 0.18
Nodes (23): validateStats(), checkAbility(), checkCarriedAbilities(), checkCharacter(), checkComposition(), checkDefinition(), checkEconomy(), checkFields() (+15 more)

### Community 5 - "content.js"
Cohesion: 0.18
Nodes (19): IGNORED_SAGAS, CONTENT_ROOT, CONTENT_VERSION, createRegistry(), foundationFindings(), readFoundation(), readJson(), CATEGORIES (+11 more)

### Community 6 - "package.js"
Cohesion: 0.20
Nodes (21): ACTIVABLE_TYPES, asArray(), completeInteractions(), isPlainObject(), nonEmpty(), normalizeDefinition(), normalizeFields(), normalizeObjectLayer() (+13 more)

### Community 7 - "validation/procedural.js"
Cohesion: 0.19
Nodes (17): readProcedural(), readTemplates(), COLOR_PATTERN, SLUG_PATTERN, checkDirections(), checkFrame(), checkIdentity(), checkRoles() (+9 more)

### Community 8 - "gemini-client.js"
Cohesion: 0.32
Nodes (4): GEMINI_API_BASE, GEMINI_DEFAULT_MODEL, GeminiClient, parseJsonLoose()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `kindOf()` connect `compiler.js` to `index.js`, `schema/definitions.js`, `validation/definitions.js`, `content.js`, `package.js`, `validation/procedural.js`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `compileDefinitions()` (e.g. with `economyDocument()` and `itemStack()`) actually correct?**
  _`compileDefinitions()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10963455149501661 - nodes in this community are weakly interconnected._
- **Why does `slugOf()` connect `compiler.js` to `index.js`, `schema/definitions.js`, `build.js`, `validation/definitions.js`, `content.js`, `package.js`, `validation/procedural.js`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Should `schema/definitions.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06829268292682927 - nodes in this community are weakly interconnected._
- **Why does `GeminiClient` connect `gemini-client.js` to `index.js`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `build.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11229946524064172 - nodes in this community are weakly interconnected._