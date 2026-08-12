# TormiSketch

TormiSketch is a playful browser-based drawing canvas by [Tormius](https://tormius.com). It supports freehand and pixel drawing, multiple brush sizes and opacity levels, erasing, clearing, transparent PNG export, and sharing a downloaded drawing by email.

This repository is the standalone, open-source extraction of the original TormiSketch page from the Tormius website.

## Run locally

Requirements: Node.js 20 or newer and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
pnpm build
pnpm start
```

## Project structure

- `src/app/page.tsx` contains the drawing application.
- `src/app/layout.tsx` loads the local typefaces and page metadata.
- `public/icons` contains the drawing controls.
- `public/fonts` contains the typefaces used by the original interface.
- `public/bliss.jpg` is the interface background.

## Contributing

Bug reports and pull requests are welcome. Please run `pnpm lint` and `pnpm build` before opening a pull request.

## License

The source code is available under the MIT License. Visual assets and bundled fonts are excluded from the MIT grant unless their respective rights holders state otherwise; review their redistribution rights before publishing a fork.
