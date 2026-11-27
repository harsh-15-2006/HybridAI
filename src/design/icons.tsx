// Small line icons drawn for this app. Decorative: the control that holds one carries the label.
const paths = {
  search: 'M11 4a7 7 0 105 12 7 7 0 00-5-12zm5 12l4 4',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8c1-4 4-5.5 7-5.5s6 1.5 7 5.5',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  compare: 'M4 8h13l-3-3M20 16H7l3 3',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  back: 'M9 7l-5 5 5 5M4 12h11a5 5 0 000-10',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
  laptop: 'M5 5h14v11H5zM2 19h20',
  cloud: 'M7 18h10a4 4 0 000-8 6 6 0 00-11.6 1.5A3.5 3.5 0 007 18z',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  weight: 'M7 8h10l2 12H5zM12 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  screen: 'M3 5h18v12H3zM9 21h6M12 17v4',
  wave: 'M3 12h2M8 8v8M12 4v16M16 8v8M19 12h2',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  drop: 'M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 113.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

/** Picks an icon for a spec by its key, for highlight strips and gallery cards. */
export function specIcon(key: string): IconName {
  if (/battery|capacity/.test(key)) return 'bolt';
  if (/weight|height/.test(key)) return 'weight';
  if (/screen|nits|resolution|view/.test(key)) return 'screen';
  if (/anc|noise|mics/.test(key)) return 'wave';
  if (/water|tank|output|cadr|filter/.test(key)) return 'drop';
  if (/ram|storage|chip|dpi|camera/.test(key)) return 'chip';
  return 'check';
}
