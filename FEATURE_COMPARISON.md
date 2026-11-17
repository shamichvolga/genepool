# GenePool v2.0: Feature Comparison

## Original Gene Pool (Ventrella, 1994)

### Core Mechanics
- Random creature generation with neural networks
- Swimming and feeding behavior
- Reproduction when energy threshold reached
- Mutation-based evolution
- Single food source (plants)

### What It Had
- [ ] Basic neural network AI
- [ ] Creature bodies (segments, fins)
- [ ] Movement physics
- [ ] Energy budget system
- [ ] Reproduction system
- [ ] Camera controls
- [ ] Save/load functionality

### Limitations
- No predators
- No species diversity tracking
- Forms converge to single phenotype
- JavaScript (untyped)
- Single browser window required

---

## GenePool v2.0: What Changed

### NEW SYSTEMS ADDED

#### 1. Predator Evolution
- **What**: Independent carnivorous creatures with own genes
- **Why matters**: Adds ecological pressure, drives prey specialization
- **Impact**: Predator-prey arms race, behavioral complexity
- **File**: `src/simulation/Predator.ts`

#### 2. Ecological Balance
- **What**: Food chains, starvation, population dynamics
- **Why matters**: Prevents unlimited growth, creates resource scarcity
- **Impact**: Forms specialize to different niches instead of converging
- **Files**: `src/simulation/Ecology.ts`, `Environment.ts`

#### 3. Disease System
- **What**: Pathogens that spread through population
- **Why matters**: Creates health/survival trade-offs
- **Impact**: Drives immune system evolution
- **File**: `src/simulation/Disease.ts`

#### 4. Environmental Complexity
- **What**: Temperature zones, soil nutrients, plant genetics
- **Why matters**: Multiple adaptation pressures
- **Impact**: Creatures adapt to environmental gradients
- **Files**: `src/simulation/Environment.ts`, `PlantGenes.ts`

#### 5. Map Editor
- **What**: Paint barriers, designate feeding zones in real-time
- **Why matters**: User can test hypotheses about ecological structure
- **Impact**: Reproducible experiments with custom layouts
- **File**: `src/ui/MapEditor.ts`

#### 6. Full Serialization
- **What**: Save/load entire ecosystem snapshots
- **Why matters**: Continue experiments, compare simulations
- **Impact**: Scientific workflow enabled
- **File**: `src/simulation/GenePoolSerializer.ts`

#### 7. Multithreading
- **What**: WebWorker physics + render separation
- **Why matters**: Faster headless runs for analysis
- **Impact**: 60k step runs execute in seconds
- **Files**: `src/parallel/`

#### 8. Population Tracking
- **What**: Real-time diversity graphs, species counting
- **Why matters**: Visual feedback on convergence problem
- **Impact**: Can see when forms collapse to single type
- **File**: `src/ui/Dashboard.ts`

---

### MAJOR REWRITES

#### TypeScript Conversion
- **Before**: Untyped JavaScript, runtime errors hard to catch
- **After**: Full static typing, IDE support, compile-time verification
- **Impact**: Easier to debug, safer refactoring

#### Neural Network Expansion
- **Before**: 2 hidden layers
- **After**: 4+ layers + sensory enhancements
- **Impact**: More complex behaviors possible

#### Physics System
- **Before**: Basic swimming mechanics
- **After**: Improved fluid dynamics, collision detection
- **Impact**: More realistic movement, behavior patterns

#### Rendering
- **Before**: Canvas only
- **After**: Modular rendering + Worker separation
- **Impact**: Can run without UI, faster visualization

#### Parameters System
- **Before**: Edit code to change settings
- **After**: 50+ parameters, tweak via UI or CLI
- **Impact**: Scientific reproducibility, easy A/B testing

---

### REMOVED / DISABLED (Why?)

- [ ] Simple prey convergence (too boring)
- [ ] Random food spawning (too chaotic)
- [ ] Unlimited population growth (unrealistic)

---

## What STILL ISN'T SOLVED (v2.0)

### Problem 1: Convergence
- Forms still become identical by ~100k steps
- Root cause: unclear (selection pressure? inbreeding?)
- Needs: ecological niches, allopatric speciation

### Problem 2: Predator Extinction
- Predators die out in ~50k steps
- Root cause: reproduction rate tuning?
- Needs: parameter adjustment or new mechanics

### Problem 3: Limited Speciation
- Usually 1-2 species max (need 5+)
- Root cause: fitness landscape too narrow?
- Needs: niche differentiation, environmental feedback

---

## Technical Stack

| Old | New |
|-----|-----|
| JavaScript | **TypeScript** |
| Plain HTML | **Vite + ES modules** |
| Global variables | **Class-based architecture** |
| Simple RNG | **Seeded PRNG** |
| Single-threaded | **WebWorkers** |
| No tests | **Reproducible seed system** |

---

## For the Release Description

Use this to tell people what they're getting:

**GenePool v2.0 is a complete rewrite of Ventrella's classic with:**
- ✨ Predators that evolve and hunt
- 🌍 Ecological systems (starvation, disease, temperature)
- 🗺️ Map editor to design environments
- 💾 Save entire ecosystems
- ⚡ Multithreaded for research
- 📊 Real-time population tracking
- 🔬 Full reproducibility (seeds)

**What's still broken:** Forms converge to identical worms by 100k steps. We need your help fixing the convergence problem.

---
