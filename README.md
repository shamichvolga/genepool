# 🧬 GenePool: Community Evolution Edition

> *"If you ever sat in front of a fish tank as a kid, mesmerized for hours just watching tiny lives unfold without a script—you already understand what this project is."*

**A complete TypeScript ecological overhaul of Jeffrey Ventrella’s classic *GenePool (SwimBots)*—built over a 10-year obsession by a non-programmer pushing AI agents to the absolute limit of imagination. Now, I need your imagination, traveler.**

---

## 🌌 What Is GenePool, and Why Is It Endlessly Replayable?

Most "evolution" games fake it: you pick upgrades from a tech tree, or watch pre-animated sprites follow scripted behaviors. **GenePool is a true Darwinian physics sandbox.**

Every creature in this pool is an articulated, physics-driven swimmer whose body segments, fins, colors, muscle rhythms, and neural brain are encoded in its genes:
* **No "God Hand" Breeding:** Nobody clicks a button to select the winners. Creatures must physically swim through water resistance, find food, judge potential mates by their traits, court them, and survive long enough to pass on their DNA.
* **Infinite Replayability:** Because hydrodynamics, neural wiring, predation, and climate interact organically, **no two runs ever play out the same way**. In one world, sleek serpentine speedsters dominate the open water; in another, armored tanks or coordinated pack-hunters take over. You can leave it running on a second monitor for hours and come back to an ecosystem you have never seen before.

---

## 📖 The Story: Why I Built This

I have been coming back to *GenePool* for nearly **10 years**, ever since version 6 on PC. What fascinated me wasn't winning or scoring points—it was the **unscripted naturalness** of it. Every run told a different story. Like Conway’s *Game of Life* or a real aquarium, you could watch creatures struggle, adapt, and surprise you.

For years, I dreamed of making that world deeper. I wanted **real, unscripted evolution**—not fake variety where you lazily add 10 types of food for 10 hardcoded species. 

Before modern AI agents existed, I tried to mod the game by feeding files one by one into early chatbots and manually stitching code snippets together. When agentic AI finally arrived, a miracle happened: **despite not being a programmer, I was finally able to bring my ideas to life.**

Then, I hit a wall—both the ceiling of what AI can figure out on its own, and a genuine scientific puzzle in evolutionary design.

**That is why I am opening this world to you, traveler.** You don't need to be a coder to be part of this. Launch the tank, watch the creatures, enjoy the beauty of natural selection—and if something sparks an idea, tell me what you see.

---

## 🌊 What Makes This Ecosystem Alive?

In the original simulation, many behaviors were fixed rules. In **v2.0**, almost everything is handed over to **natural selection** via a **30-input neural network**, **112 body morphology genes**, and **57 ecology genes**:

* **🧬 True Genetic Instincts:** Hunger thresholds and **mate preferences** are no longer hardcoded—creatures evolve whom they are attracted to and when they seek food.
* **🦈 Predators, Armor & Autotomy (Limb Shedding):** Predation is now part of the food web. Prey can evolve armor, burst fleeing speed, or even **shed their own limbs to escape a predator’s jaws**—if they carry the right genes.
* **🐺 Emergent Pack Hunting:** Nobody scripted teamwork, yet if you watch closely, you will see predators naturally begin to move and hunt in coordinated packs.
* **🦠 Key-Lock Pathogens:** Diseases spread dynamically through dense populations, punishing monocultures and rewarding genetic diversity.
* **🌡️ Seasons, Climate & Migration:** Temperature zones and seasonal shifts force creatures to adapt their bodies or migrate—staying in the wrong climate burns precious energy.

*(Want the full technical breakdown? See [FEATURE_COMPARISON.md](FEATURE_COMPARISON.md).)*

---

## 🔬 The Unsolved Mystery: The Convergence Problem (Help Wanted!)

Right now, the simulation faces a fascinating evolutionary bottleneck—and **I need biologists, mathematicians, coders, and keen observers to help crack it:**

1. **Everything Merges Into One Species:** Over long runs, instead of branching into a rich tree of distinct species, creatures tend to converge toward a single "jack-of-all-trades" phenotype.
2. **Predator Collapse:** Top predators often either wipe out their prey and starve, or die out within the first few thousand steps.

### 🧪 The Giant Petri Dish Inspiration
To solve speciation without artificial crutches, I tried recreating the famous real-world **giant Petri dish antibiotic experiment**—where bacteria fill a safe zone, hit a chemical barrier, and only advance to the next zone once rare, step-by-step mutations unlock resistance.

I built **temperature gradients** and **food specialization niches** into the tank hoping to trigger that exact step-by-step speciation. It partially works, yet true, stable branching into multiple species still slips away. **How do we make nature diverge naturally?**

---

## 🚀 Quick Start

### 1. Watch in Your Browser (Windows)
1. Click the green **`<> Code`** button at the top of this page → **`Download ZIP`** and extract the folder.
2. Double-click **`Запустить GenePool.bat`** (starts a local Vite server and opens your browser automatically).
3. *(Note: Requires [Node.js](https://nodejs.org/) installed on your PC).*

### 2. Camera Controls
* **`W / A / S / D`** or **Arrow Keys** — Pan across the pool
* **Mouse Wheel** — Zoom in to inspect individual creatures or zoom out to watch migration patterns

### 3. Headless Research Mode
Want to test evolutionary theories fast? Run 60,000-step simulations without graphics for data analysis:
```bash
node tools/headless.cjs
