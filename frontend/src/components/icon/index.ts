/*
 * Project-native inline SVG icons.
 *
 * Generated once from the icon set this UI was designed around, then vendored
 * here so the app carries no icon-library dependency at runtime. Each icon is
 * a plain <svg> built from the primitives below — there is nothing to install
 * and nothing to tree-shake around.
 *
 * Geometry originates from Lucide (https://lucide.dev), ISC License,
 * Copyright (c) Lucide Icons and Contributors:
 *   Permission to use, copy, modify, and/or distribute this software for any
 *   purpose with or without fee is hereby granted, provided that the above
 *   copyright notice and this permission notice appear in all copies.
 *
 * To add an icon, append a `makeIcon` call below with its node data. Keep the
 * 24x24 viewBox and the shared stroke attributes so a new icon matches the rest
 * at every size.
 */
import { createElement, forwardRef, type SVGProps } from 'react';

type Node = [string, Record<string, string | number>];

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Overrides the 24px default; any CSS size utility also works. */
  size?: number | string;
}

/** The shape every icon component in this module has. */
export type IconComponent = ReturnType<typeof makeIcon>;

function makeIcon(name: string, nodes: Node[]) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 24, strokeWidth = 2, className, children, ...rest },
    ref,
  ) {
    /* Decorative by default: these icons sit beside text that already carries
       the meaning, so they are hidden from assistive tech unless the caller
       gives one an accessible name, in which case it becomes an image. */
    const labelled = rest['aria-label'] != null || rest['aria-labelledby'] != null;
    return createElement(
      'svg',
      {
        ref,
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className,
        focusable: 'false',
        role: labelled ? 'img' : undefined,
        'aria-hidden': labelled ? undefined : true,
        ...rest,
      },
      ...nodes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs })),
      children,
    );
  });
  Icon.displayName = name;
  return Icon;
}

export const Activity = makeIcon('Activity', [
  [
    'path',
    {
      d: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2',
    },
  ],
] as Node[]);
export const AlertCircle = makeIcon('AlertCircle', [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['line', { x1: '12', x2: '12', y1: '8', y2: '12' }],
  ['line', { x1: '12', x2: '12.01', y1: '16', y2: '16' }],
] as Node[]);
export const AlertTriangle = makeIcon('AlertTriangle', [
  ['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }],
  ['path', { d: 'M12 9v4' }],
  ['path', { d: 'M12 17h.01' }],
] as Node[]);
export const ArrowLeftRight = makeIcon('ArrowLeftRight', [
  ['path', { d: 'M8 3 4 7l4 4' }],
  ['path', { d: 'M4 7h16' }],
  ['path', { d: 'm16 21 4-4-4-4' }],
  ['path', { d: 'M20 17H4' }],
] as Node[]);
export const ArrowRight = makeIcon('ArrowRight', [
  ['path', { d: 'M5 12h14' }],
  ['path', { d: 'm12 5 7 7-7 7' }],
] as Node[]);
export const Bell = makeIcon('Bell', [
  ['path', { d: 'M10.268 21a2 2 0 0 0 3.464 0' }],
  [
    'path',
    {
      d: 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
    },
  ],
] as Node[]);
export const Box = makeIcon('Box', [
  [
    'path',
    {
      d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
    },
  ],
  ['path', { d: 'm3.3 7 8.7 5 8.7-5' }],
  ['path', { d: 'M12 22V12' }],
] as Node[]);
export const CalendarCheck2 = makeIcon('CalendarCheck2', [
  ['path', { d: 'M 19 3 L 5 3' }],
  ['path', { d: 'M 21 13 L 21 5' }],
  ['path', { d: 'M 21 5 A2 2 0 0 0 19 3' }],
  ['path', { d: 'M 3 19 A2 2 0 0 0 5 21' }],
  ['path', { d: 'M 3 5 L 3 19' }],
  ['path', { d: 'M 5 3 A2 2 0 0 0 3 5' }],
  ['path', { d: 'm16 19 2 2 4-4' }],
  ['path', { d: 'M16 2v3' }],
  ['path', { d: 'M3 9h18' }],
  ['path', { d: 'M5 21 L12.5 21' }],
  ['path', { d: 'M8 2v3' }],
] as Node[]);
export const CalendarClock = makeIcon('CalendarClock', [
  ['path', { d: 'M16 14v2.2l1.6 1' }],
  ['path', { d: 'M16 2v3' }],
  ['path', { d: 'M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338' }],
  ['path', { d: 'M3 9h5.859' }],
  ['path', { d: 'M8 2v3' }],
  ['circle', { cx: '16', cy: '16', r: '6' }],
] as Node[]);
export const CalendarDays = makeIcon('CalendarDays', [
  ['path', { d: 'M8 2v3' }],
  ['path', { d: 'M16 2v3' }],
  ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }],
  ['path', { d: 'M3 9h18' }],
  ['path', { d: 'M8 13h.01' }],
  ['path', { d: 'M12 13h.01' }],
  ['path', { d: 'M16 13h.01' }],
  ['path', { d: 'M8 17h.01' }],
  ['path', { d: 'M12 17h.01' }],
  ['path', { d: 'M16 17h.01' }],
] as Node[]);
export const Camera = makeIcon('Camera', [
  [
    'path',
    {
      d: 'M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z',
    },
  ],
  ['circle', { cx: '12', cy: '13', r: '3' }],
] as Node[]);
export const ChartNoAxesCombined = makeIcon('ChartNoAxesCombined', [
  ['path', { d: 'M12 16v5' }],
  ['path', { d: 'M16 14.639V21' }],
  ['path', { d: 'M20 10.656V21' }],
  ['path', { d: 'm22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15' }],
  ['path', { d: 'M4 18.463V21' }],
  ['path', { d: 'M8 14.656V21' }],
] as Node[]);
export const Check = makeIcon('Check', [['path', { d: 'M20 6 9 17l-5-5' }]] as Node[]);
export const CheckCircle2 = makeIcon('CheckCircle2', [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'm16 9-5.5 5.5L8 12' }],
] as Node[]);
export const ChevronDown = makeIcon('ChevronDown', [['path', { d: 'm6 9 6 6 6-6' }]] as Node[]);
export const Circle = makeIcon('Circle', [['circle', { cx: '12', cy: '12', r: '10' }]] as Node[]);
export const ClipboardCheck = makeIcon('ClipboardCheck', [
  ['rect', { width: '8', height: '4', x: '8', y: '2', rx: '1', ry: '1' }],
  ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }],
  ['path', { d: 'm9 14 2 2 4-4' }],
] as Node[]);
export const ClipboardList = makeIcon('ClipboardList', [
  ['rect', { width: '8', height: '4', x: '8', y: '2', rx: '1', ry: '1' }],
  ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }],
  ['path', { d: 'M12 11h4' }],
  ['path', { d: 'M12 16h4' }],
  ['path', { d: 'M8 11h.01' }],
  ['path', { d: 'M8 16h.01' }],
] as Node[]);
export const CreditCard = makeIcon('CreditCard', [
  ['rect', { width: '20', height: '14', x: '2', y: '5', rx: '2' }],
  ['line', { x1: '2', x2: '22', y1: '10', y2: '10' }],
  ['path', { d: 'M6 14h2' }],
] as Node[]);
export const FileText = makeIcon('FileText', [
  [
    'path',
    {
      d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
    },
  ],
  ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
  ['path', { d: 'M10 9H8' }],
  ['path', { d: 'M16 13H8' }],
  ['path', { d: 'M16 17H8' }],
] as Node[]);
export const Gauge = makeIcon('Gauge', [
  ['path', { d: 'm12 14 4-4' }],
  ['path', { d: 'M3.34 19a10 10 0 1 1 17.32 0' }],
] as Node[]);
export const GitBranch = makeIcon('GitBranch', [
  ['path', { d: 'M15 6a9 9 0 0 0-9 9V3' }],
  ['circle', { cx: '18', cy: '6', r: '3' }],
  ['circle', { cx: '6', cy: '18', r: '3' }],
] as Node[]);
export const GitCompareArrows = makeIcon('GitCompareArrows', [
  ['circle', { cx: '5', cy: '6', r: '3' }],
  ['path', { d: 'M12 6h5a2 2 0 0 1 2 2v7' }],
  ['path', { d: 'm15 9-3-3 3-3' }],
  ['circle', { cx: '19', cy: '18', r: '3' }],
  ['path', { d: 'M12 18H7a2 2 0 0 1-2-2V9' }],
  ['path', { d: 'm9 15 3 3-3 3' }],
] as Node[]);
export const HeartPulse = makeIcon('HeartPulse', [
  [
    'path',
    {
      d: 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5',
    },
  ],
  ['path', { d: 'M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27' }],
] as Node[]);
export const Home = makeIcon('Home', [
  ['path', { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' }],
  [
    'path',
    {
      d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    },
  ],
] as Node[]);
export const Info = makeIcon('Info', [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'M12 16v-4' }],
  ['path', { d: 'M12 8h.01' }],
] as Node[]);
export const ListChecks = makeIcon('ListChecks', [
  ['path', { d: 'M13 5h8' }],
  ['path', { d: 'M13 12h8' }],
  ['path', { d: 'M13 19h8' }],
  ['path', { d: 'm3 17 2 2 4-4' }],
  ['path', { d: 'm3 7 2 2 4-4' }],
] as Node[]);
export const LoaderCircle = makeIcon('LoaderCircle', [
  ['path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }],
] as Node[]);
export const LockKeyhole = makeIcon('LockKeyhole', [
  ['circle', { cx: '12', cy: '16', r: '1' }],
  ['rect', { x: '3', y: '10', width: '18', height: '12', rx: '2' }],
  ['path', { d: 'M7 10V7a5 5 0 0 1 10 0v3' }],
] as Node[]);
export const LogOut = makeIcon('LogOut', [
  ['path', { d: 'm16 17 5-5-5-5' }],
  ['path', { d: 'M21 12H9' }],
  ['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }],
] as Node[]);
export const Mail = makeIcon('Mail', [
  ['path', { d: 'm22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7' }],
  ['rect', { x: '2', y: '4', width: '20', height: '16', rx: '2' }],
] as Node[]);
export const Menu = makeIcon('Menu', [
  ['path', { d: 'M4 5h16' }],
  ['path', { d: 'M4 12h16' }],
  ['path', { d: 'M4 19h16' }],
] as Node[]);
export const MessageCircle = makeIcon('MessageCircle', [
  [
    'path',
    {
      d: 'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
    },
  ],
] as Node[]);
export const Minus = makeIcon('Minus', [['path', { d: 'M5 12h14' }]] as Node[]);
export const Palette = makeIcon('Palette', [
  [
    'path',
    {
      d: 'M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z',
    },
  ],
  ['circle', { cx: '13.5', cy: '6.5', r: '.5', fill: 'currentColor' }],
  ['circle', { cx: '17.5', cy: '10.5', r: '.5', fill: 'currentColor' }],
  ['circle', { cx: '6.5', cy: '12.5', r: '.5', fill: 'currentColor' }],
  ['circle', { cx: '8.5', cy: '7.5', r: '.5', fill: 'currentColor' }],
] as Node[]);
export const PanelLeftClose = makeIcon('PanelLeftClose', [
  ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
  ['path', { d: 'M9 3v18' }],
  ['path', { d: 'm16 15-3-3 3-3' }],
] as Node[]);
export const PanelLeftOpen = makeIcon('PanelLeftOpen', [
  ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
  ['path', { d: 'M9 3v18' }],
  ['path', { d: 'm14 9 3 3-3 3' }],
] as Node[]);
export const Pause = makeIcon('Pause', [
  ['rect', { x: '14', y: '3', width: '5', height: '18', rx: '1' }],
  ['rect', { x: '5', y: '3', width: '5', height: '18', rx: '1' }],
] as Node[]);
export const Play = makeIcon('Play', [
  [
    'path',
    { d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z' },
  ],
] as Node[]);
export const Radio = makeIcon('Radio', [
  ['path', { d: 'M16.247 7.761a6 6 0 0 1 0 8.478' }],
  ['path', { d: 'M19.075 4.933a10 10 0 0 1 0 14.134' }],
  ['path', { d: 'M4.925 19.067a10 10 0 0 1 0-14.134' }],
  ['path', { d: 'M7.753 16.239a6 6 0 0 1 0-8.478' }],
  ['circle', { cx: '12', cy: '12', r: '2' }],
] as Node[]);
export const Repeat = makeIcon('Repeat', [
  ['path', { d: 'm17 2 4 4-4 4' }],
  ['path', { d: 'M3 11v-1a4 4 0 0 1 4-4h14' }],
  ['path', { d: 'm7 22-4-4 4-4' }],
  ['path', { d: 'M21 13v1a4 4 0 0 1-4 4H3' }],
] as Node[]);
export const Settings = makeIcon('Settings', [
  [
    'path',
    {
      d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
    },
  ],
  ['circle', { cx: '12', cy: '12', r: '3' }],
] as Node[]);
export const ShieldAlert = makeIcon('ShieldAlert', [
  [
    'path',
    {
      d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    },
  ],
  ['path', { d: 'M12 8v4' }],
  ['path', { d: 'M12 16h.01' }],
] as Node[]);
export const ShieldCheck = makeIcon('ShieldCheck', [
  [
    'path',
    {
      d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    },
  ],
  ['path', { d: 'm9 12 2 2 4-4' }],
] as Node[]);
export const SlidersHorizontal = makeIcon('SlidersHorizontal', [
  ['path', { d: 'M10 5H3' }],
  ['path', { d: 'M12 19H3' }],
  ['path', { d: 'M14 3v4' }],
  ['path', { d: 'M16 17v4' }],
  ['path', { d: 'M21 12h-9' }],
  ['path', { d: 'M21 19h-5' }],
  ['path', { d: 'M21 5h-7' }],
  ['path', { d: 'M8 10v4' }],
  ['path', { d: 'M8 12H3' }],
] as Node[]);
export const Stethoscope = makeIcon('Stethoscope', [
  ['path', { d: 'M11 2v2' }],
  ['path', { d: 'M5 2v2' }],
  ['path', { d: 'M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1' }],
  ['path', { d: 'M8 15a6 6 0 0 0 12 0v-3' }],
  ['circle', { cx: '20', cy: '10', r: '2' }],
] as Node[]);
export const TableProperties = makeIcon('TableProperties', [
  ['path', { d: 'M15 3v18' }],
  ['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }],
  ['path', { d: 'M21 9H3' }],
  ['path', { d: 'M21 15H3' }],
] as Node[]);
export const Timer = makeIcon('Timer', [
  ['line', { x1: '10', x2: '14', y1: '2', y2: '2' }],
  ['line', { x1: '12', x2: '15', y1: '14', y2: '11' }],
  ['circle', { cx: '12', cy: '14', r: '8' }],
] as Node[]);
export const TrendingDown = makeIcon('TrendingDown', [
  ['path', { d: 'M16 17h6v-6' }],
  ['path', { d: 'm22 17-8.5-8.5-5 5L2 7' }],
] as Node[]);
export const TrendingUp = makeIcon('TrendingUp', [
  ['path', { d: 'M16 7h6v6' }],
  ['path', { d: 'm22 7-8.5 8.5-5-5L2 17' }],
] as Node[]);
export const Users = makeIcon('Users', [
  ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
  ['path', { d: 'M16 3.128a4 4 0 0 1 0 7.744' }],
  ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
  ['circle', { cx: '9', cy: '7', r: '4' }],
] as Node[]);
export const Video = makeIcon('Video', [
  ['path', { d: 'm16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5' }],
  ['rect', { x: '2', y: '6', width: '14', height: '12', rx: '2' }],
] as Node[]);
export const X = makeIcon('X', [
  ['path', { d: 'M18 6 6 18' }],
  ['path', { d: 'm6 6 12 12' }],
] as Node[]);
export const XCircle = makeIcon('XCircle', [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'm15 9-6 6' }],
  ['path', { d: 'm9 9 6 6' }],
] as Node[]);

/* Hand-authored in the same 24x24 stroke language as the generated set above:
   the viewer controls needed a zoom pair and a reset affordance. */
export const ZoomIn = makeIcon('ZoomIn', [
  ['circle', { cx: '11', cy: '11', r: '8' }],
  ['path', { d: 'm21 21-4.3-4.3' }],
  ['path', { d: 'M11 8v6' }],
  ['path', { d: 'M8 11h6' }],
] as Node[]);
export const ZoomOut = makeIcon('ZoomOut', [
  ['circle', { cx: '11', cy: '11', r: '8' }],
  ['path', { d: 'm21 21-4.3-4.3' }],
  ['path', { d: 'M8 11h6' }],
] as Node[]);
export const RotateCcw = makeIcon('RotateCcw', [
  ['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }],
  ['path', { d: 'M3 3v5h5' }],
] as Node[]);
