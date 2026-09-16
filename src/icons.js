// SVG paths keep functional symbols monochrome on iOS and Android; no font or
// emoji presentation selector is involved.
const svg = (content) =>
  `<svg class="vector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
export const arrowDown = svg('<path d="M5 5 19 19M7 19h12V7"/>');
export const arrowUp = svg('<path d="M5 19 19 5M7 5h12v12"/>');
export const asterisk = svg('<path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/>');
export const orbitIcon = svg(
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/>',
);
