# GenePool: Evolution Simulator

A TypeScript rewrite of Jeffrey Ventrella's classic **Gene Pool** with a complete ecological overhaul. Watch randomly created creatures evolve through natural selection — but this time, they face predators, disease, climate, and competing for resources. **No behavior is pre-programmed. Everything emerges.**

> "They started as meaningless shapes. No one taught them to swim or hunt. They figured it out." — Jeffrey Ventrella

## What Is GenePool?

GenePool is a **life simulation sandbox** where:

1. **Creatures are born random** — random body shape, random neural network
2. **They must survive** — eat plants, avoid predators, escape disease, reproduce
3. **They evolve** — winning genes spread; losing genes disappear
4. **Diversity emerges** — instead of one super-species, you get predators, specialists, generalists competing

The core insight: **You don't need to program intelligence. Just simulate survival.**

## What's New in v2.0

This is a complete rewrite. The original had creatures competing in a vacuum. This version adds **ecology**.

### ✨ Major Systems Added

| System | What It Does | Why It Matters |
|--------|-------------|-----------------|
| **Predators** | Independent creatures that hunt prey. Have their own genes, evolve, use strategy | Prey develop anti-predator traits (speed, armor, fleeing). Arms race drives complexity. |
| **Disease** | Pathogens that spread through population. "Key-lock" immunity model. Common forms hit harder | Prevents convergence. Rare phenotypes get advantage (frequency-dependent selection). |
| **Temperature Zones** | World has latitude. Creatures evolve thermal preference. Seasonal cycles. | Forms specialize to niches instead of all becoming identical. |
| **Plant Evolution** | Plants inherit genes for growth speed and seed dispersal. Coevolve with herbivores. | Creates feedback: heavy grazing → selection for fast-growing plants; light grazing → slow persistence. |
| **Soil Nutrients** | Dead bodies become soil. Plants grow from it. Nutrient cycles. | Localized food scarcity; migration becomes necessary. |
| **Neural Evolution** | Creature brains are neural networks. Brain weights are heritable genes. | Behavior now evolves, not just morphology. Social strategies, hunting tactics emerge. |
| **Map Editor** | Paint barriers, create feeding zones. Run experiments. | Scientific reproducibility. Test "what if?" hypotheses. |
| **Save/Load** | Snapshot entire ecosystems. Resume later. | Continue experiments. Compare simulations. |
| **Multithreading** | Physics + rendering run in parallel. Headless mode for analysis. | 60k-step runs finish in seconds. |

### 🔬 What Changed Under the Hood

| Component | Before | After | Result |
|-----------|--------|-------|--------|
| **Language** | JavaScript (untyped) | TypeScript | Compile-time safety, easier refactoring |
| **Brain** | 8 hard-coded behavior states | 30-input neural network (weights evolve) | Complex strategies, behavioral diversity |
| **Genes** | 112 body morphology genes | 112 body + 57 ecology genes | Predation & morphology no longer compete for genes |
| **Food** | 1 type (static items) | 2 types (warm/cold plants) + meat | Niche separation, plant coevolution |
| **World** | Flat (all locations identical) | Temperature map, biomes, seasons | Geographic niches, migration incentives |
| **Predation** | Instant energy transfer | Search image learning, attack rolls, size limits, autotomy | Realistic predator-prey cycles |
| **Reproduction** | Random mating | Evolving mate choosiness | Sexual selection reinforces divergence |
| **Energy** | Fixed food energy | Climate-adjusted (thermal mismatch costs energy) | Body size now coupled to energy budget |

## How It Works: The Convergence Problem (And Why We Can't Solve It Yet)

### What Happens (Current Behavior)
1. **0-10k steps**: Random creatures, chaos, high death rate
2. **10-50k steps**: Some forms survive better, start reproducing faster
3. **50-100k steps**: Population converges — almost everyone becomes identical tiny herbivores
4. **100k+ steps**: Stasis — same form persists indefinitely

### Why This Happens (Theories)
- **Inbreeding depression** — population too small, loses diversity
- **Single peak fitness landscape** — there's only one "best" body shape, so everyone converges to it
- **No ecological niches** — nothing prevents best-form from dominating everything
- **Predators go extinct** — without predation pressure, size/speed race collapses

### What We Added to Fix It (Partially Works)
- ✅ Disease keeps rare forms alive (frequency-dependent selection)
- ✅ Temperature zones create geographic niches (different zones favor different forms)
- ✅ Predators hunt common prey harder (apostatic selection)
- ❌ **But forms still converge by 100k steps**

### The Mystery
We have all the pieces for coexistence. Why isn't it working?

**Possibilities:**
1. Temperature zone disabled (`TEMPERATURE_ENABLED=false`) — not using niche system
2. Plant evolution too weak — coevolution not driving herbivore diversity
3. Disease transmission too rare — can't maintain diversity pressure
4. Predator reproduction wrong — predators die before creating sustained pressure
5. Thermal fitness curve wrong — niches not distinct enough

**We don't know.** We're open-sourcing to crowdsource the answer.

## Quick Start

### Browser (Recommended)
```bash
npm install
npm run dev
# Opens http://localhost:5173
# Watch creatures evolve in real-time
```

Double-click **`Start GenePool.bat`** on Windows (requires [Node.js](https://nodejs.org)).

### Headless (Research/Analysis)
```bash
# Run 60,000 steps, log stats every 1000 steps
node tools/headless.cjs --steps 60000 --every 1000 --seed 42

# Compare two code variants with identical seed
node tools/variant.cjs 60000 1 INITIAL_PREDATOR_FRACTION=0.1

# Seed 42 is reproducible — run it twice, get identical evolution
```

## Camera Controls

| Action | Key |
|--------|-----|
| Pan camera | W/A/S/D or arrow keys |
| Zoom | Mouse wheel or E/Q or +/− |
| Pan view | Hold middle mouse button |
| Toggle auto-follow | Space |

## Project Structure

```
src/
├── simulation/
│   ├── GenePool.ts           # Main simulation loop
│   ├── Swimbot.ts            # Creature morphology & genetics
│   ├── Predator.ts           # Carnivore AI & evolution
│   ├── Brain.ts              # Decision-making (prey/mate/flee)
│   ├── NeuralBrain.ts        # Evolvable neural network (30→12)
│   ├── Environment.ts        # Temperature map, biomes, seasons
│   ├── Ecology.ts            # Thermal fit, food bonuses, digestion
│   ├── PlantGenes.ts         # Plant evolution (growth, spread)
│   ├── Disease.ts            # Key-lock immunity, strains
│   ├── Currents.ts           # Water gyres (optional challenge)
│   ├── Food.ts               # Plants & meat slot system
│   ├── Parameters.ts         # 50+ tunable settings
│   ├── GenePoolSerializer.ts # Save/load entire ecosystems
│   └── ...
├── ui/
│   ├── Dashboard.ts          # Controls & population graphs
│   ├── MapEditor.ts          # Paint barriers, zones
│   └── SaveLoad.ts           # File I/O
├── parallel/
│   ├── sim.worker.ts         # Physics thread
│   ├── simhost.worker.ts     # Render thread
│   └── ParallelWork.ts       # Work distribution
└── main.ts                   # Entry point

tools/
├── headless.cjs              # CLI runner (no browser)
└── variant.cjs               # A/B testing harness

docs/
├── ROADMAP.md                # Feature roadmap
├── CONTRIBUTING.md           # Developer guide
└── FEATURE_COMPARISON.md     # Detailed v1 vs v2 breakdown
```

## Known Issues (Help Wanted!)

### 🔴 Critical: Convergence
**Problem**: Forms become identical by ~100k steps.  
**Impact**: Limits simulation length, reduces diversity.  
**Your contribution**: Run experiments. Change one parameter. See if diversity persists. Report results.

### 🟠 Major: Predator Extinction
**Problem**: Predators die out by ~50k steps.  
**Impact**: No sustained predation pressure.  
**Your contribution**: Tune predator reproduction rates, energy costs, or hunting strategy.

### 🟡 Medium: Limited Speciation
**Problem**: Usually only 1-2 species coexist (should be 5+).  
**Impact**: Less ecological complexity.  
**Your contribution**: Enhance niche differentiation (temperature zones, food types, disease pressure).

## For Contributors

### Workflow
1. **Read** [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup
2. **Pick a problem** — convergence, predators, or features
3. **Run a baseline** — `node tools/headless.cjs --steps 60000 --seed 42` (note the numbers)
4. **Make your change**
5. **Run with same seed** — does it improve? (different numbers = success)
6. **Submit PR** with reproducibility data

### Key Files to Know
- **Convergence work**: `src/simulation/Ecology.ts` (niche system), `Environment.ts` (temperature), `PlantGenes.ts` (coevolution)
- **Predator work**: `src/simulation/Predator.ts`, `src/simulation/Brain.ts` (hunting logic)
- **Feature work**: See [ROADMAP.md](ROADMAP.md) for planned systems

## Documentation

- **[ROADMAP.md](ROADMAP.md)** — Planned features, research questions, and development phases
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — How to develop, test, and submit changes
- **[CHANGELOG.md](CHANGELOG.md)** — Version history and what changed
- **[FEATURE_COMPARISON.md](FEATURE_COMPARISON.md)** — Detailed breakdown of original vs v2.0
- **[README_RU.md](README_RU.md)** — Русская документация (Russian)

## Support

**Questions? Ideas?**
- **Telegram**: [@Lionsmane96](https://t.me/Lionsmane96) — chat about evolution, biology, design
- **GitHub Issues**: [Report bugs, request features](https://github.com/shamichvolga/genepool/issues)
- **Discussions**: Ask about convergence mystery or evolutionary dynamics

**Want to support development?**
- **Donate** (contact via Telegram for Bitcoin/Ethereum addresses)
- **Contribute code** (fork, modify, submit PR)
- **Spread the word** (star ⭐, share with biologists & coders)

## Credits

- **Original concept & design**: Jeffrey Ventrella (Gene Pool, 1994)
- **2.0 TypeScript rewrite**: Complete overhaul with predators, ecology, multithreading
- **Maintained by**: [@Lionsmane96](https://github.com/shamichvolga)
- **Built with**: TypeScript, Vite, Canvas API, Web Workers

## License

**Non-commercial use only.** 

Free to use, modify, and distribute for education and research. See [LICENSE](LICENSE) for details.

You may:
- ✅ Run, modify, fork for educational purposes
- ✅ Contribute improvements
- ✅ Use in research publications (with attribution)

You may not:
- ❌ Use commercially without permission
- ❌ Relicense under a different license

---

**Welcome to evolutionary simulation.** 🧬

Start with `npm run dev` and watch life unfold. Then break it, fix it, and help us solve the convergence mystery.
