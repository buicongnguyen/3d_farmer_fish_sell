// Expanded room-framing check, retained at the original phone-home test entry point.
// Phone rooms now centre on their occupants; the prior whole-house phone overview is superseded.
// ONLY can narrow the screen list; OUT remains supported for screenshots.
process.env.ONLY ??= '390x844,360x800,412x915,430x932,844x390,932x430,768x1024,1024x768,1440x900';
process.env.EVIDENCE ??= process.env.OUT ?? 'test-results/home-mobile';
await import('./room-focus-browser.mjs');
