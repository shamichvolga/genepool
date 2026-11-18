# Roadmap

## Vision

GenePool aims to create a **self-sustaining artificial ecosystem** where speciation and biodiversity emerge naturally, solving the classic "convergence problem" — the tendency of all SwimBots to evolve into a single optimal morph.

## Current Status (v2.0)

### ✅ Complete
- **TypeScript rewrite** of the classic 1994 SwimBot engine
- **Neural networks**: 30-input perceptron-style brains driving behavior
- **Genetic architecture**: 112 body morphology genes + 57 ecology genes (hunger, reproduction, parasites, armor)
- **Physics**: Swimming, predation, energy metabolism, starvation
- **Serialization**: Save/load world snapshots
- **Dev tools**: Headless simulation, hot code reloading (preserves world state across code edits)
- **GitHub Pages**: Playable online at https://shamichvolga.github.io/genepool/

### 🔄 In Progress
- **Environmental gradients**: Temperature zones, chemical gradients to promote habitat specialization
- **Parasite mechanics**: Pathogenic key-lock system to prevent universal dominance
- **Seasonal cycles**: Birth/death seasons to drive temporal niche formation
- **Predator diversity**: Preventing predator extinction when food runs low

## Future (Speculative)

### Short Term (v2.1–2.2)
- [ ] Multi-generational trait tracking (phylogenetic trees)
- [ ] Visualization of genetic lineages
- [ ] Export/import population snapshots
- [ ] Performance profiling and optimization for 100k+ step runs
- [ ] Mobile touch controls

### Medium Term (v2.5)
- [ ] Spatial separation of species (multiple pools with migration)
- [ ] Energy flow visualization (food web diagrams)
- [ ] Machine learning analysis of emergent strategies
- [ ] Replay system (record/playback mutations and behavioral innovations)

### Long Term (v3.0+)
- [ ] Multi-threaded simulation (SharedArrayBuffer workers)
- [ ] Distributed runs (cloud-based ensemble evolution)
- [ ] User-uploaded custom parameter sets / "evolution challenges"
- [ ] Integration with academic artificial life frameworks

## Known Limitations

1. **Convergence**: Despite best efforts, all morphs tend to evolve toward the same "optimal" body plan (small flexible swimmer).
2. **Predator extinction**: Top predators often die out as prey diversifies, leaving only herbivorous types.
3. **Niche saturation**: Environmental gradients alone don't guarantee stable speciation without aggressive parameter tuning.

## Research Questions

- Can **dynamic heterogeneity** (changing environments, shifting fitness landscapes) maintain speciation without intervention?
- Do **realistic developmental constraints** (ontogeny) lead to stable radiation of forms?
- How does **social learning** or **epigenetic inheritance** affect speciation rates?

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to submit ideas, bug reports, and pull requests.

## References

- Artificial Life textbooks: Brooks & Maes, Levy & Goldberg
- Modern approaches: Neural architecture search, neuroevolution (NEAT, HyperNEAT)

---

**Last updated**: November 2026  
**Maintainer**: Lionsman / shamichvolga
