# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] — November 2026

### Initial TypeScript Release
- **Rewritten from scratch** in TypeScript + Vite, replacing older JavaScript versions
- Built on the mechanics of the classic Gene Pool (SwimBots) simulation
- Full physics simulation: swimming, energy metabolism, predation, reproduction

### Core Features
- **Neural networks**: 30-input perceptrons drive creature behavior
- **Genetic system**: 112 body morphology genes + 57 ecology genes (hunger, mate preference, armor, autotomy)
- **Predation**: Realistic food webs with parasites (key-lock system)
- **Serialization**: Save and restore world snapshots with full genetic state
- **Headless mode**: Run 60,000+ step experiments without browser overhead
- **Hot-reloading**: Edit code and parameters without restarting world

### Environment
- **Spatial**: 2D toroidal world with food distribution
- **Climate**: Baseline temperature (TEMPERATURE_ENABLED=false in current build)
- **Food**: Plant growth and consumption mechanics

### Dev Tools
- **Vite bundler** with source maps and fast refresh
- **TypeScript strict mode** for correctness
- **GitHub Actions**: Automated deployment to GitHub Pages
- **Batch scripts**: Windows convenience scripts for launching

### Browser Support
- Tested on Chrome/Chromium, Firefox, Edge
- Requires ES2020+ JavaScript support
- Playable live at https://shamichvolga.github.io/genepool/

### Known Issues
- **Convergence**: Population tends toward single body morph after 50k–100k steps
- **Predator collapse**: Top predators extinct by generation 50–100
- **Limited speciation**: Biodiversity metrics plateau despite genetic variation

### Documentation
- English README with feature highlights
- Russian README (native language of author)
- Contributing guidelines
- Roadmap for future work

---

## [1.x] — Pre-2026 (Legacy)

Earlier versions existed as Python prototypes, JavaScript experiments, and partially-ported Gene Pool derivatives. This changelog begins with the TypeScript v2.0 unified release.

---

**Repository**: https://github.com/shamichvolga/genepool  
**License**: MIT + Commons Clause  
**Author**: Lionsman (shamichvolga)
