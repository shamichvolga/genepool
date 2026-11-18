# Contributing to GenePool

Thank you for your interest in contributing to GenePool! This project welcomes contributors of all skill levels.

## Getting Started

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/shamichvolga/genepool.git
   cd genepool
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```
   The game will open at `http://localhost:5173/`

## Development Workflow

### Code Structure
- `src/` — main simulation and UI code (TypeScript)
- `src/simulation/` — evolution, genetics, physics
- `src/ui/` — browser interface and controls
- `css/` — styling
- `tools/` — utility scripts (headless mode, serialization)

### Type Checking
Before committing, run:
```bash
npm run typecheck
```

### Building for Production
```bash
npm run build
```

## Important Notes

### Evolution Mechanics
This is a **physics-based simulation**, not a game with scripted progression:
- Neural networks (30 inputs) drive behavior
- 112 body morphology genes + 57 ecology genes
- Natural selection is driven by hunger, predation, parasites
- No artificial balancing — let the ecosystem find its own equilibrium

### Key Parameters
Tunable constants live in `src/simulation/Parameters.ts`. Changes take effect instantly in dev mode thanks to hot-module reloading that preserves world state.

### Testing Long Runs
For 60,000+ steps without HMR interruptions, use headless mode:
```bash
node tools/headless.cjs
```

## Pull Request Guidelines

1. Keep changes focused and explain *why* you made them
2. Ensure TypeScript type checking passes (`npm run typecheck`)
3. Test in both dev mode (with HMR) and production build
4. Include brief notes on what you observed (emergent behaviors, regressions, surprises)

## Questions?

- Open an issue on GitHub
- Contact: [shamichvolga@gmail.com](mailto:shamichvolga@gmail.com)
- Telegram: [@LionsMane96](https://t.me/LionsMane96)

## License

GenePool is released under the MIT License (see [LICENSE](../LICENSE)).

This project is a TypeScript reimplementation of Jeffrey Ventrella's SwimBots / Gene Pool (1994) with improvements toward solving the convergence problem in artificial life simulations.
