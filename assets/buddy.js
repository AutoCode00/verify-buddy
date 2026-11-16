// Buddy 🔍 — a small round robot shaped like a checkmark badge, holding a big magnifying glass.
// Clean line-art with flat fills. Poses: read (leans in), sweat (compiling), thumbs (match), point (explorer field), sad (no match).
// Also: the {✓} logo and small line icons.

const INK = 'var(--ink)';

// scalloped badge outline (12 bumps) around (60,62)
function badgePath(cx = 60, cy = 62, r = 34, bumps = 12, depth = 3.2) {
  let d = '';
  const steps = bumps * 8;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const rr = r + Math.cos(a * bumps) * depth;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + 'Z';
}
const BADGE = badgePath();

/**
 * @param {'read'|'sweat'|'thumbs'|'point'|'sad'|'idle'} pose
 * @param {{size?:number, title?:string, cls?:string}} opts
 */
export function buddy(pose = 'idle', { size = 120, title = 'Buddy, the Verify Buddy robot', cls = '' } = {}) {
  const lean = pose === 'read' ? 'rotate(-6 60 96)' : pose === 'point' ? 'rotate(4 60 96)' : '';
  const eyes = pose === 'thumbs'
    ? `<path d="M46 58q4-5 8 0M66 58q4-5 8 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`
    : pose === 'sad'
      ? `<circle cx="50" cy="59" r="3.2" fill="${INK}"/><circle cx="70" cy="59" r="3.2" fill="${INK}"/><path d="M45 52l8 2M75 52l-8 2" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
      : pose === 'read'
        ? `<circle cx="52" cy="59" r="3.4" fill="${INK}"/><circle cx="72" cy="59" r="3.4" fill="${INK}"/>`
        : `<circle cx="50" cy="59" r="3.4" fill="${INK}"/><circle cx="70" cy="59" r="3.4" fill="${INK}"/><circle cx="51.2" cy="57.8" r="1" fill="#fff"/><circle cx="71.2" cy="57.8" r="1" fill="#fff"/>`;
  const mouth = pose === 'thumbs' ? `<path d="M52 67q8 7 16 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
    : pose === 'sad' ? `<path d="M53 70q7-5 14 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
      : pose === 'sweat' ? `<path d="M54 68h12" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
        : `<path d="M54 67q6 4 12 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  const sweat = pose === 'sweat' ? `<g class="bd-sweat"><path d="M86 40c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="var(--indigo-soft)" stroke="${INK}" stroke-width="1.8"/><path d="M93 52c2 3 3 4 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 3-5.5z" fill="var(--indigo-soft)" stroke="${INK}" stroke-width="1.6"/></g>` : '';

  // right arm: magnifier (read/sweat/idle/sad) · thumbs up · pointing
  let right;
  if (pose === 'thumbs') {
    right = `<path d="M91 70q10-2 12-14" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><g class="bd-thumb"><rect x="96" y="44" width="13" height="12" rx="4" fill="var(--paper)" stroke="${INK}" stroke-width="2.4"/><path d="M100 44v-7a3 3 0 0 1 6 0v7" fill="var(--paper)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/></g>`;
  } else if (pose === 'point') {
    right = `<path d="M91 66l20-12" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><g class="bd-point"><circle cx="113" cy="53" r="4.5" fill="var(--paper)" stroke="${INK}" stroke-width="2.4"/><path d="M116 51l7-4" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/></g>`;
  } else {
    const glassX = pose === 'read' ? 0 : 0;
    right = `<path d="M91 72q8 0 12-8" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <g class="bd-glass" transform="translate(${glassX} 0)">
        <path d="M100 66l10 14" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
        <path d="M100 66l10 14" stroke="var(--butter)" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="94" cy="55" r="14" fill="rgba(255,255,255,.55)" stroke="${INK}" stroke-width="3"/>
        <path d="M86 50a9 9 0 0 1 7-5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      </g>`;
  }
  const left = pose === 'sad'
    ? `<path d="M29 72q-9 4-10 12" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
    : `<path d="M29 70q-10 2-12 10" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="81" r="3.6" fill="var(--paper)" stroke="${INK}" stroke-width="2.2"/>`;

  return `<svg class="buddy buddy--${pose} ${cls}" viewBox="0 0 128 124" width="${size}" height="${Math.round(size * 124 / 128)}" role="img" aria-label="${title}">
  <g class="bd-body" transform="${lean}">
    <ellipse cx="60" cy="116" rx="26" ry="3.5" fill="rgba(20,20,19,.08)"/>
    <path d="M50 96v12M70 96v12" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M44 109h10M66 109h10" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M60 28v-10" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <circle class="bd-antenna" cx="60" cy="15" r="4" fill="var(--ember)" stroke="${INK}" stroke-width="2.2"/>
    ${left}
    <path d="${BADGE}" fill="var(--emerald)" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
    <rect x="39" y="48" width="42" height="28" rx="12" fill="var(--paper)" stroke="${INK}" stroke-width="2.4"/>
    ${eyes}${mouth}
    <path d="M51 85l6 5 12-11" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    ${right}
    ${sweat}
  </g>
</svg>`;
}

/** {✓} logo mark */
export const logo = (size = 28) => `<svg class="logo-mark" viewBox="0 0 44 32" width="${Math.round(size * 44 / 32)}" height="${size}" aria-hidden="true">
  <path d="M10 3c-4 0-5 2-5 5v4c0 2-1 3.5-3.5 4C4 16.5 5 18 5 20v4c0 3 1 5 5 5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M34 3c4 0 5 2 5 5v4c0 2 1 3.5 3.5 4-2.5.5-3.5 2-3.5 4v4c0 3-1 5-5 5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="logo-check" d="M14.5 16.5l5 5 10-11" fill="none" stroke="var(--emerald)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const I = (d, extra = '') => `<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const icons = {
  chevron: I('<path d="M9 6l6 6-6 6"/>'),
  arrowUpRight: I('<path d="M7 17L17 7M8 7h9v9"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  download: I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  file: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  upload: I('<path d="M12 16V5M7 9.5L12 5l5 4.5M5 20h14"/>'),
  cpu: I('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  layers: I('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>'),
  shield: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  bytes: I('<path d="M4 7h4M10 7h4M16 7h4M4 12h4M10 12h4M16 12h4M4 17h4M10 17h4"/>'),
  sliders: I('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  stamp: I('<circle cx="12" cy="9" r="5"/><path d="M8 14l-2 6h12l-2-6M5 20h14"/>'),
  wallet: I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 9h18"/>'),
  play: I('<path d="M8 5v14l11-7z"/>'),
  stop: I('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  refresh: I('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>'),
  clock: I('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
};
