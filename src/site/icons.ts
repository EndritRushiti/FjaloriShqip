/** Small inline SVG icons (no external icon font or CDN). */
const svg = (d: string, size = 20) =>
  `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const icon = {
  search: (s?: number) => svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', s),
  book: (s?: number) => svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>', s),
  code: (s?: number) => svg('<path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m13.5 5-3 14"/>', s),
  download: (s?: number) => svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>', s),
  map: (s?: number) => svg('<path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>', s),
  layers: (s?: number) => svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>', s),
  sparkle: (s?: number) => svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>', s),
  clock: (s?: number) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
  shuffle: (s?: number) => svg('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>', s),
  copy: (s?: number) => svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', s),
  check: (s?: number) => svg('<path d="m5 12 5 5 9-10"/>', s),
  arrowRight: (s?: number) => svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', s),
  arrowLeft: (s?: number) => svg('<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>', s),
  menu: (s?: number) => svg('<path d="M4 7h16M4 12h16M4 17h16"/>', s),
  sun: (s?: number) => svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', s),
  moon: (s?: number) => svg('<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>', s),
  shield: (s?: number) => svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>', s),
  external: (s?: number) => svg('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>', s),
};
