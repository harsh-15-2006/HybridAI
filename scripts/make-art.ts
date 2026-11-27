// Generates original, brand-free product illustrations on a plain grey sweep.
// They are illustrations, not photographs, and the UI labels them as such.
import { writeFileSync, mkdirSync } from 'node:fs';
import { PRODUCTS } from '../src/data/seed/catalogue.ts';
import type { ArtKind } from '../src/domain/types.ts';

const TONES: Record<string, [body: string, shade: string, accent: string]> = {
  'aeris-q40': ['#2F3C44', '#1F2A30', '#C9B59A'],
  'lumen-nc2': ['#C8CFCB', '#A9B2AD', '#4A5A62'],
  'strata-air-pro': ['#3B3F52', '#2A2D3C', '#8C93B3'],
  'pebble-buds': ['#EDEAE3', '#CFC9BC', '#5B6B66'],
  'hearth-one': ['#8A5A44', '#6E4535', '#E7D8C9'],
  'vela-14': ['#B9C2C7', '#8E999F', '#2D4A5E'],
  'vela-16': ['#4A5258', '#343A3F', '#7C6A8E'],
  'slate-tab-11': ['#2B3338', '#1B2125', '#4F7C82'],
  'breeza-p300': ['#F4F4F1', '#D5D8D4', '#6F8579'],
  'breeza-mini': ['#E8EEF0', '#C6D0D4', '#456C86'],
  'drift-tower': ['#3A4449', '#262E32', '#AEB8BC'],
  'mist-500': ['#EFE9E0', '#D8CDBD', '#6C8A9A'],
  'studio-wired': ['#55453A', '#3D312A', '#C9B59A'],
  'pebble-sport': ['#2D4A5E', '#1F3442', '#D98C4A'],
  'vela-air-13': ['#D8C9BC', '#B8A696', '#5B6F8A'],
  'nova-5': ['#2B3338', '#1B2125', '#3E6C8C'],
  'nova-5-pro': ['#4B4560', '#322E42', '#8A6FA8'],
  'orbit-mini': ['#B9CFC4', '#8FAC9E', '#3F6B63'],
  'tempo-watch': ['#2F3C44', '#1F2A30', '#4F7C82'],
  'stride-band': ['#7C4B55', '#5C3640', '#2B3338'],
  'keyline-75': ['#D9DCD8', '#4A5258', '#C9844A'],
  'glide-mouse': ['#3A4449', '#262E32', '#8FB3C2'],
  'reserve-20k': ['#41586B', '#2C3D4B', '#E1C069'],
  'clear-cam': ['#3A4449', '#262E32', '#4F6F9E'],
  'canvas-27': ['#4A5258', '#2B3338', '#4C6A7A'],
};

function drawing(kind: ArtKind, [body, shade, accent]: [string, string, string]): string {
  switch (kind) {
    case 'phone':
      return `<rect x="305" y="120" width="190" height="385" rx="32" fill="${body}"/><rect x="316" y="134" width="168" height="357" rx="20" fill="${accent}"/>
        <rect x="372" y="146" width="56" height="14" rx="7" fill="${shade}"/><path d="M316 430l70-66 46 38 52-42v111a20 20 0 01-20 20H336a20 20 0 01-20-20z" fill="#fff" opacity=".18"/>`;
    case 'watch':
      return `<rect x="352" y="95" width="96" height="130" rx="30" fill="${shade}"/><rect x="352" y="385" width="96" height="125" rx="30" fill="${shade}"/>
        <circle cx="400" cy="305" r="112" fill="${body}"/><circle cx="400" cy="305" r="88" fill="${accent}"/><path d="M400 250v55l40 24" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/>`;
    case 'band':
      return `<rect x="362" y="95" width="76" height="420" rx="38" fill="${shade}"/><rect x="345" y="215" width="110" height="180" rx="40" fill="${body}"/>
        <rect x="362" y="233" width="76" height="144" rx="26" fill="${accent}"/><path d="M378 305h14l8-22 12 40 9-18h12" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`;
    case 'keyboard':
      return `<rect x="130" y="260" width="540" height="220" rx="24" fill="${body}"/>
        ${Array.from({ length: 44 }, (_, i) => `<rect x="${154 + (i % 11) * 45}" y="${282 + Math.floor(i / 11) * 40}" width="36" height="32" rx="7" fill="${i === 0 ? accent : shade}"/>`).join('')}
        <rect x="262" y="444" width="270" height="24" rx="7" fill="${shade}"/>`;
    case 'mouse':
      return `<path d="M300 300c0-90 45-130 100-130s100 40 100 130v90c0 75-45 115-100 115s-100-40-100-115z" fill="${body}"/>
        <path d="M400 172v128M302 300h196" stroke="${shade}" stroke-width="7"/><rect x="386" y="212" width="28" height="60" rx="14" fill="${accent}"/>`;
    case 'powerbank':
      return `<rect x="265" y="165" width="270" height="340" rx="40" fill="${body}"/><rect x="295" y="195" width="210" height="280" rx="24" fill="${shade}" opacity=".5"/>
        ${[0, 1, 2, 3].map((i) => `<circle cx="${355 + i * 30}" cy="440" r="8" fill="${accent}"/>`).join('')}<path d="M415 255l-50 82h38l-16 68 54-90h-40z" fill="${accent}"/>`;
    case 'webcam':
      return `<circle cx="400" cy="295" r="130" fill="${body}"/><circle cx="400" cy="295" r="82" fill="${shade}"/><circle cx="400" cy="295" r="44" fill="${accent}"/>
        <circle cx="382" cy="277" r="12" fill="#fff" opacity=".6"/><path d="M355 420h90l28 80h-146z" fill="${shade}"/>`;
    case 'monitor':
      return `<rect x="145" y="140" width="510" height="300" rx="18" fill="${shade}"/><rect x="160" y="155" width="480" height="270" rx="6" fill="${accent}"/>
        <path d="M160 425l210-160 90 70 70-52 110 90v52z" fill="#fff" opacity=".18"/><rect x="375" y="440" width="50" height="52" fill="${body}"/><rect x="300" y="488" width="200" height="18" rx="9" fill="${body}"/>`;
    case 'over-ear':
      return `<path d="M245 345v-60a155 155 0 01310 0v60" fill="none" stroke="${body}" stroke-width="30" stroke-linecap="round"/>
        <rect x="205" y="300" width="105" height="165" rx="48" fill="${body}"/><rect x="490" y="300" width="105" height="165" rx="48" fill="${body}"/>
        <rect x="290" y="318" width="38" height="130" rx="19" fill="${accent}"/><rect x="472" y="318" width="38" height="130" rx="19" fill="${accent}"/>
        <circle cx="248" cy="382" r="22" fill="${shade}"/><circle cx="552" cy="382" r="22" fill="${shade}"/>`;
    case 'earbuds':
      return `<rect x="250" y="330" width="300" height="150" rx="70" fill="${body}"/><path d="M250 388h300" stroke="${shade}" stroke-width="6"/>
        <circle cx="315" cy="245" r="52" fill="${body}"/><rect x="298" y="270" width="34" height="92" rx="17" fill="${shade}"/>
        <circle cx="485" cy="245" r="52" fill="${body}"/><rect x="468" y="270" width="34" height="92" rx="17" fill="${shade}"/>
        <circle cx="315" cy="238" r="20" fill="${accent}"/><circle cx="485" cy="238" r="20" fill="${accent}"/><circle cx="400" cy="432" r="7" fill="${accent}"/>`;
    case 'speaker':
      return `<rect x="195" y="210" width="410" height="250" rx="60" fill="${body}"/><rect x="225" y="240" width="350" height="190" rx="40" fill="${shade}"/>
        ${Array.from({ length: 12 }, (_, i) => `<path d="M${250 + i * 27} 258v154" stroke="${body}" stroke-width="8" stroke-linecap="round"/>`).join('')}
        <rect x="360" y="190" width="80" height="22" rx="11" fill="${accent}"/>`;
    case 'laptop':
      return `<rect x="190" y="170" width="420" height="270" rx="18" fill="${shade}"/><rect x="204" y="184" width="392" height="242" rx="6" fill="${accent}"/>
        <path d="M204 426l190-150 80 66 52-40 70 58v66z" fill="#fff" opacity=".18"/>
        <path d="M130 448h540l-26 28a20 20 0 01-15 6H171a20 20 0 01-15-6z" fill="${body}"/><rect x="355" y="448" width="90" height="9" rx="4" fill="${shade}"/>`;
    case 'tablet':
      return `<rect x="250" y="140" width="300" height="370" rx="30" fill="${body}"/><rect x="266" y="158" width="268" height="334" rx="14" fill="${accent}"/>
        <circle cx="400" cy="290" r="64" fill="#fff" opacity=".2"/><path d="M266 440l110-90 70 58 88-70v140a14 14 0 01-14 14H280a14 14 0 01-14-14z" fill="#fff" opacity=".16"/>`;
    case 'purifier':
      return `<rect x="285" y="150" width="230" height="355" rx="60" fill="${body}"/><ellipse cx="400" cy="190" rx="88" ry="22" fill="${shade}"/>
        ${Array.from({ length: 9 }, (_, i) => `<path d="M330 ${300 + i * 19}h140" stroke="${shade}" stroke-width="7" stroke-linecap="round"/>`).join('')}
        <circle cx="400" cy="250" r="16" fill="${accent}"/>`;
    case 'fan':
      return `<rect x="345" y="120" width="110" height="370" rx="52" fill="${body}"/><rect x="368" y="160" width="64" height="270" rx="30" fill="${shade}"/>
        ${Array.from({ length: 13 }, (_, i) => `<path d="M374 ${178 + i * 19}h52" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`).join('')}
        <ellipse cx="400" cy="495" rx="110" ry="20" fill="${shade}"/>`;
    case 'humidifier':
      return `<path d="M295 250h210l-18 235a28 28 0 01-28 25H341a28 28 0 01-28-25z" fill="${body}"/><rect x="305" y="215" width="190" height="45" rx="22" fill="${shade}"/>
        <rect x="370" y="330" width="60" height="120" rx="14" fill="${accent}" opacity=".55"/>
        <path d="M390 200c-30-35 25-50 0-95M425 200c28-30-18-48 8-80" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity=".7"/>`;
  }
}

/** Mix a #rrggbb colour towards white (amount > 0) or black (amount < 0). */
function shift(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const mix = Math.abs(amount);
  return '#' + [1, 3, 5]
    .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - mix) + target * mix).toString(16).padStart(2, '0'))
    .join('');
}

/** Light from the upper left: each flat colour becomes a gradient with a highlight and a shaded side. */
function lit(markup: string, tones: [string, string, string]): { defs: string; body: string } {
  let body = markup;
  let defs = '';
  tones.forEach((colour, i) => {
    const id = `m${i}`;
    defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="180" y1="110" x2="620" y2="520">
      <stop offset="0" stop-color="${shift(colour, 0.24)}"/><stop offset=".35" stop-color="${shift(colour, 0.05)}"/>
      <stop offset=".62" stop-color="${shift(colour, -0.08)}"/><stop offset="1" stop-color="${shift(colour, -0.45)}"/></linearGradient>`;
    body = body.replaceAll(`fill="${colour}"`, `fill="url(#${id})"`).replaceAll(`stroke="${colour}"`, `stroke="url(#${id})"`);
  });
  return { defs, body };
}

mkdirSync('public/products', { recursive: true });
for (const p of PRODUCTS) {
  const tone = TONES[p.id] ?? ['#3A4449', '#262E32', '#AEB8BC'];
  const { defs, body } = lit(drawing(p.art, tone), tone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="Illustration of ${p.name}, ${p.type.toLowerCase()}">
  <defs>
    <radialGradient id="room" cx=".38" cy=".28" r=".95"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#E9EDEB"/><stop offset="1" stop-color="#CDD3D0"/></radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9CFCC" stop-opacity="0"/><stop offset="1" stop-color="#C3CAC6" stop-opacity=".75"/></linearGradient>
    <radialGradient id="shadow"><stop offset="0" stop-color="#1F2A30" stop-opacity=".45"/><stop offset="1" stop-color="#1F2A30" stop-opacity="0"/></radialGradient>
    <filter id="depth" x="-30%" y="-30%" width="160%" height="170%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="soft"/>
      <feSpecularLighting in="soft" surfaceScale="4" specularConstant=".7" specularExponent="60" lighting-color="#ffffff" result="shine">
        <feDistantLight azimuth="225" elevation="48"/>
      </feSpecularLighting>
      <feComposite in="shine" in2="SourceAlpha" operator="in" result="gloss"/>
      <feDropShadow in="SourceGraphic" dx="10" dy="18" stdDeviation="14" flood-color="#1F2A30" flood-opacity=".28" result="cast"/>
      <feMerge><feMergeNode in="cast"/><feMergeNode in="gloss"/></feMerge>
    </filter>
    ${defs}
  </defs>
  <ellipse cx="408" cy="520" rx="250" ry="34" fill="url(#shadow)"/>
  <g filter="url(#depth)">${body}</g>
</svg>\n`;
  writeFileSync(`public/products/${p.id}.svg`, svg);
}
console.log(`Wrote ${PRODUCTS.length} illustrations to public/products`);
