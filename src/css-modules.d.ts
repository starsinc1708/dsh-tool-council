/**
 * Ambient declaration for CSS-module imports, so `tsc` can typecheck the card
 * while the actual class-name hashing happens in `tsdown.config.ts`.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
