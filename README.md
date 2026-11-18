# 🧬 GenePool: Community Evolution Edition

> *"If you ever sat in front of a fish tank as a kid, mesmerized for hours just watching tiny lives unfold without a script—you already understand what this project is."*

[![Play in browser](https://img.shields.io/badge/Play-in_browser-2ea44f?style=for-the-badge)](https://shamichvolga.github.io/genepool/)
[![License](https://img.shields.io/badge/license-MIT_+_Commons_Clause-blue?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/shamichvolga/genepool?style=for-the-badge)](https://github.com/shamichvolga/genepool/stargazers)
[![Discussions](https://img.shields.io/github/discussions/shamichvolga/genepool?style=for-the-badge)](https://github.com/shamichvolga/genepool/discussions)

🌐 **[▶ Play Live in Browser](https://shamichvolga.github.io/genepool/)** · 🇷🇺 [Русская версия](README_RU.md)

**A complete TypeScript ecological overhaul of the classic artificial-life sandbox *Gene Pool (SwimBots)*—built over a 10-year obsession by a non-programmer pushing AI agents to the absolute limit of imagination. Now, I need your imagination, traveler.**

---

## 🌌 What Is GenePool, and Why Is It Endlessly Replayable?

Most "evolution" games fake it: you pick upgrades from a tech tree, or watch pre-animated sprites follow scripted behaviors. **GenePool is a true Darwinian physics sandbox.**

Every creature in this pool is an articulated, physics-driven swimmer whose body segments, fins, colors, muscle rhythms, and neural brain are encoded in its genes:
* **No "God Hand" Breeding:** Nobody clicks a button to select the winners. Creatures must physically swim through water resistance, find food, judge potential mates by their traits, court them, and survive long enough to pass on their DNA.
* **Infinite Replayability:** Because hydrodynamics, neural wiring, predation, and climate interact organically, **no two runs ever play out the same way**. In one world, sleek serpentine speedsters dominate the open water; in another, armored tanks or coordinated pack-hunters take over. You can leave it running on a second monitor for hours and come back to an ecosystem you have never seen before.

---

## 📖 The Story: A 10-Year Obsession with Living Worlds

I have been coming back to *GenePool* for nearly **10 years**, ever since version 6 on PC. What fascinated me wasn't winning or scoring points—it was the **unscripted naturalness** of it. Every run told a different story. Like Conway's *Game of Life* or a real aquarium, you could watch creatures struggle, adapt, and surprise you.

For years, I dreamed of making that world deeper. I wanted **real, unscripted evolution**—not fake variety where you lazily add 10 types of food for 10 hardcoded species. Unlike Conway's Game of Life (where rules are simple and exhaustible), and unlike modern tech-tree games (where winning is obvious), it offered something rare: **genuine uncertainty. Natural selection, not optimization.**

### The AI Breakthrough

Before modern AI agents existed, I tried to mod the game by feeding files one by one into early chatbots and manually stitching code snippets together. It was clunky, frustrating, and led nowhere.

When agentic AI finally arrived, a miracle happened: **despite not being a programmer, I was finally able to bring my ideas to life.** I could describe an ecosystem rule ("they should sense hunger differently based on body size"), and an AI agent would implement it, debug it, and weave it into the existing codebase. For the first time, imagination was the bottleneck—not keyboard skills.

### Hitting the Ceiling

Then, I hit two walls simultaneously:
1. The ceiling of what AI can figure out on its own (even the smartest agents plateau on unsolved problems)
2. A genuine scientific puzzle in evolutionary design: **the convergence problem**

**That is why I am opening this world to you, traveler.** You don't need to be a coder to be part of this. Launch the tank, watch the creatures, enjoy the beauty of natural selection—and if something sparks an idea, tell me what you see.

---

## 🌊 What Makes This Ecosystem Alive?

In the original simulation, many behaviors were fixed rules. In **v2.0**, almost everything is handed over to **natural selection** via a **30-input neural network**, **112 body morphology genes**, and **57 ecology genes**:

* **🧬 True Genetic Instincts:** Hunger thresholds and **mate preferences** are no longer hardcoded—creatures evolve whom they are attracted to and when they seek food.
* **🦈 Predators, Armor & Autotomy (Limb Shedding):** Predation is now part of the food web. Prey can evolve armor, burst fleeing speed, or even **shed their own limbs to escape a predator's jaws**—if they carry the right genes.
* **🐺 Emergent Pack Hunting:** Nobody scripted teamwork, yet if you watch closely, you will see predators naturally begin to move and hunt in coordinated packs.
* **🦠 Key-Lock Pathogens:** Diseases spread dynamically through dense populations, punishing monocultures and rewarding genetic diversity.
* **🌡️ Seasons, Climate & Migration:** Temperature gradients force creatures to adapt their bodies or migrate—staying in the wrong climate burns precious energy.
* **Haploid Genetics (Simplicity):** Creatures carry one gene copy per locus (no dominance/recessiveness). Mutation is the only source of novelty, making evolutionary pathways clear to observe.

*(Want the full technical breakdown? See [FEATURE_COMPARISON.md](FEATURE_COMPARISON.md).)*

---

## 🔬 The Unsolved Mystery: The Convergence Problem (Help Wanted!)

Right now, the simulation faces a fascinating evolutionary bottleneck—and **I need biologists, mathematicians, coders, and keen observers to help crack it:**

1. **Everything Merges Into One Species:** Over long runs, instead of branching into a rich tree of distinct species, creatures tend to converge toward a single "jack-of-all-trades" phenotype (usually a small, fast, flexible worm).
2. **Predator Collapse:** Top predators often either wipe out their prey and starve, or die out within the first few thousand steps.

### 🧪 The Giant Petri Dish Inspiration

To solve speciation without artificial crutches, I tried recreating the famous real-world **giant Petri dish antibiotic experiment**—where bacteria fill a safe zone, hit a chemical barrier, and only advance to the next zone once rare, step-by-step mutations unlock resistance.

I built **temperature gradients** and **food specialization niches** into the tank hoping to trigger that exact step-by-step speciation. It partially works, yet true, stable branching into multiple species still slips away.

**How do we make nature diverge naturally?** This is not a technical bug—it is a genuine puzzle in evolutionary ecology. Your observations, ideas, and wild hypotheses are exactly what we need.

---

## 🚀 Quick Start: Three Ways to Play

### Option 1: Play in Your Browser (Recommended)
No installation needed. Just click and watch:
👉 **[Play GenePool Live](https://shamichvolga.github.io/genepool/)**

### Option 2: Run Locally on Windows
1. Download this repository (click **`<> Code`** → **`Download ZIP`**)
2. Extract the folder
3. Double-click **`start-windows.bat`** (or `start-windows-long-run.bat` for long uninterrupted runs)
4. Your browser will open automatically with the game running on `http://localhost:5173/`
5. *(Requires [Node.js](https://nodejs.org/) installed—the batch script will prompt you if missing)*

#### Camera Controls
* **`W / A / S / D`** or **Arrow Keys** — Pan across the pool
* **Mouse Wheel** — Zoom in to inspect individual creatures or zoom out to watch migration patterns

### Option 3: Headless Research Mode (Advanced)
Want to test evolutionary theories fast? Run 60,000-step simulations without graphics, export data for analysis:
```bash
npm install
node tools/headless.cjs
```

---

## 💡 Ideas Over Money

This project exists because I love it, not because I expect to make money from it. **Donations are completely optional.**

The best way to support GenePool is simply to:
- **Download it, run it, and watch it**
- **Share what you observe** in [Discussions](https://github.com/shamichvolga/genepool/discussions) — weird behaviors, surprising outcomes, ideas that come to mind
- **Suggest features or changes** (no programming experience needed)

If you do feel like contributing financially to help with AI subscription costs (which power the development), here are the options:

### Support Links
- **Telegram**: [@LionsMane96](https://t.me/LionsMane96) — Fastest way to reach me with observations or ideas
- **Email**: [shamichvolga@gmail.com](mailto:shamichvolga@gmail.com)
- **USDT (Ethereum ERC-20)**: `0x66f90b1e932cb11939c4644c2aeae54f47117a7b`
- **Bitcoin (BTC)**: `bc1qm2pq8me0cyl722s4yg3zq02cfsaq20p9jlac6c`

---

## 📚 Documentation

- **[CHANGELOG.md](CHANGELOG.md)** — Version history and recent updates
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — How to suggest features or submit code
- **[ROADMAP.md](ROADMAP.md)** — Planned features and research directions
- **[FEATURE_COMPARISON.md](FEATURE_COMPARISON.md)** — Detailed mechanics vs. the original SwimBots
- **[LICENSE](LICENSE)** — MIT License with the Commons Clause

---

## 🔧 For Developers

### Project Structure
```
src/
├── simulation/       # Evolution, genetics, physics engine
├── ui/              # Browser UI and controls
├── workers/         # Simulation threads
└── ...
tools/
├── headless.cjs     # Batch simulation mode (no browser)
└── run-report.mjs   # Data export helpers
```

### Quick Dev Setup
```bash
npm install          # Install dependencies
npm run dev          # Start dev server with hot reload (keeps world state)
npm run typecheck    # Type-check TypeScript
npm run build        # Production build for deployment
```

---

## 🎯 What You'll See (First Few Minutes)

1. **A 2D pool with creatures** (small, colorful worms with fins and segments)
2. **Green dots** (food/plants) scattered around
3. **Creatures swimming, eating, reproducing** in real-time
4. **Predators hunting prey** (if predators evolve and persist)
5. **Slow changes over time:** body shapes shifting, sizes changing, new behaviors emerging

By hour 2–3, you might see:
- Distinct "species" clustered in different areas
- Coordinated hunting behavior in packs
- Creatures fleeing when threatened
- Migration patterns during harsh seasons

By 100,000 steps (hours of real-time watching on fast playback):
- Everything often converges to one dominant morph
- Predators extinct or extremely rare
- Final ecosystem either stable or chaotic

**Your job: watch, notice patterns, and tell us what surprises you.**

---

## 🌍 Browser Support

- ✅ Chrome / Chromium (recommended)
- ✅ Firefox
- ✅ Edge
- ⚠️ Safari (works, but performance may vary)

Requires ES2020+ JavaScript support (all modern browsers).

---

## 📖 Learn More About Artificial Life

- **Related Fields**: Artificial Life, Neuroevolution, Evolutionary Algorithms, Complex Systems
- **Modern References**: NEAT (Neuroevolution of Augmenting Topologies), HyperNEAT, OpenAI's evolutionary strategies

---

## ⚖️ License

GenePool is released under the **MIT License with the Commons Clause**: free to use, modify and share, but not to sell. See [LICENSE](LICENSE).

Contains code derived from the original browser version of Gene Pool (© 2021 Jeffrey Ventrella, swimbots.com), used under the MIT License with the Commons Clause.

---

**Last Updated**: November 2026  
**Maintainer**: Lionsman / shamichvolga

---

**Questions? Ideas? Observations?**  
📧 [shamichvolga@gmail.com](mailto:shamichvolga@gmail.com) | 💬 [@LionsMane96](https://t.me/LionsMane96)
