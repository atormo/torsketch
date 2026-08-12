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
- `src/app/layout.tsx` loads the local open-source typefaces and page metadata.
- `public/icons` contains the drawing controls.
- `src/fonts` contains Space Grotesk and Michroma together with their OFL licences.
- `public/tormisketch-hills.png` is the original, AI-generated interface background.

## Contributing

Bug reports and pull requests are welcome. Please run `pnpm lint` and `pnpm build` before opening a pull request.

## License

The source code is available under the MIT License.

The landscape in `public/tormisketch-hills.png` was generated specifically for TormiSketch with OpenAI image generation. It is not an edit of, nor derived from, the Windows XP “Bliss” photograph. To the extent the project authors hold rights in the generated output, it is distributed under the same MIT License as the source code.

Space Grotesk and Michroma are distributed under the SIL Open Font License 1.1. Their complete licence texts are included in `src/fonts`.
