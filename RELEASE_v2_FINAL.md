# GenePool v2.0.0 Release

## 🧬 Evolution in Action

Gene Pool is a life simulation where creatures evolve through natural selection. You don't program intelligence—you create an environment and watch as life solves its own survival problems over generations.

**This v2.0 rewrite adds the missing piece: ecology.**

The original had creatures competing in a vacuum. This version adds predators, disease, climate zones, and food chains. Suddenly, speciation becomes possible. Ecological niches emerge. Predator-prey cycles create oscillating diversity. The simulation comes alive.

**Status**: Core systems working. Main scientific question unsolved: **Why do all forms converge to identical worms by ~100k steps?** We're open-sourcing to crowdsource the solution.

---

## ✨ What's New

### Complete Ecological Overhaul
- **Predators** with independent evolution and hunting strategy
- **Disease** system (key-lock immunity model) — keeps rare forms alive
- **Temperature zones** with seasonal cycles — creates geographic niches
- **Plant evolution** — plants inherit growth & dispersal traits; coevolve with herbivores
- **Soil nutrients** & detritus cycling — localized food scarcity
- **Water currents** — optional navigation challenge
- **Disease** spreads through population, creating frequency-dependent selection

### Advanced Brain & Behavior
- Neural networks are now **evolvable** — 30 sensory inputs, inheritable weights
- Creatures develop complex strategies (hunting tactics, social behavior, migration)
- Brain no longer hard-coded; behavior emerges through natural selection

### Scientific Tools
- **Map editor** — paint barriers, create experimental zones
- **Save/load** entire ecosystems — continue/compare simulations
- **Reproducible runs** — same seed = identical evolution (perfect for A/B testing)
- **Headless mode** — run 60k steps in seconds for statistical analysis
- **Multithreading** — physics & rendering separated for performance

### Code Quality
- **TypeScript** with full type safety (original was untyped JavaScript)
- **Vite** modern bundler, fast dev server
- **50+ tunable parameters** — scientific reproducibility
- **Well-documented** for contributors

---

## 🚀 Quick Start

### Browser
```bash
npm install
npm run dev
# Opens http://localhost:5173
```

### Headless (Research)
```bash
# Run 60,000 steps, log stats every 1000 steps
node tools/headless.cjs --steps 60000 --every 1000 --seed 42

# Compare two algorithm variants
node tools/variant.cjs 60000 1 INITIAL_PREDATOR_FRACTION=0.1
```

---

## 🤔 The Mystery: Why Convergence?

**The Problem**: By ~100,000 steps, all creatures become identical tiny worms.

**The Setup for Success**:
- ✅ Disease system prevents common forms from dominating (rare forms get advantage)
- ✅ Temperature zones create geographic niches (different forms excel in different zones)
- ✅ Predators hunt common prey harder (apostatic selection)
- ✅ Plant evolution creates feedback loops (heavy grazing selects for fast growers)

**The Result**: Still converges. Why?

**Theories**:
- Temperature system currently disabled (`TEMPERATURE_ENABLED=false`)
- Niche differentiation not strong enough
- Predators going extinct before creating sustained pressure
- Inbreeding in small populations
- Single fitness peak too sharp

**We don't know.** Help us find out.

---

## 📊 What Changed from Original

### Added (New Systems)
✨ Predators with independent evolution  
✨ Disease (key-lock immunity model)  
✨ Temperature zones & climate  
✨ Plant genetics & coevolution  
✨ Soil nutrient cycling  
✨ Evolvable neural networks  
✨ Map editor & experimentation zones  
✨ Full ecosystem serialization  
✨ Multithreading & headless mode  
✨ Real-time population diversity tracking  

### Rewritten (Major Upgrades)
📝 JavaScript → **TypeScript** (type safety)  
📝 8-state FSM → **30-input neural network** (behavior evolves)  
📝 112 genes → **112 body + 57 ecology genes** (separate domains)  
📝 1 food type → **2 types + meat slots** (niche separation)  
📝 Flat world → **Temperature map, biomes, seasons** (geography matters)  
📝 Instant predation → **Search image, attack rolls, size limits** (realistic cycles)  
📝 Random mating → **Evolving choosiness** (sexual selection)  
📝 Single-threaded → **Multithreaded** (5x+ speedup)  

### Still Unsolved
❌ Convergence problem (main research question)  
❌ Predator extinction timing  
❌ Limited speciation (1-2 species instead of 5+)  

---

## 📚 Documentation

- **[README.md](README.md)** — Full overview & quick start
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Developer guide, testing workflow
- **[ROADMAP.md](ROADMAP.md)** — Feature roadmap & research questions
- **[FEATURE_COMPARISON.md](FEATURE_COMPARISON.md)** — Detailed v1 vs v2 technical breakdown
- **[README_RU.md](README_RU.md)** — Русская документация

---

## 💬 Community

**Chat with the author**: [@Lionsmane96 on Telegram](https://t.me/Lionsmane96)  
**Report bugs / features**: [GitHub Issues](https://github.com/shamichvolga/genepool/issues)  
**Contribute code**: See [CONTRIBUTING.md](CONTRIBUTING.md)  

---

## 🙏 Credits

- **Original concept**: Jeffrey Ventrella (Gene Pool, 1994)
- **This rewrite**: @Lionsmane96
- **Built with**: TypeScript, Vite, Canvas API, Web Workers

---

## 📜 License

Non-commercial. Free for education & research. See [LICENSE](LICENSE).

---

## 🎯 Next Steps

1. **Try it**: `npm run dev` and watch evolution unfold
2. **Run experiments**: Change one parameter, see if it helps with convergence
3. **Report findings**: [Open an issue](https://github.com/shamichvolga/genepool/issues) with your seed and results
4. **Contribute**: Submit a PR with your improvements

**Help us solve the convergence mystery.** 🧬
