// Pixel icons from pixelarticons by Gerrit Halfmann (MIT License,
// https://github.com/halfmage/pixelarticons): 24x24 SVG paths, vendored so the app
// stays offline. LES.icon(name, size) returns inline SVG markup.
(function (LES) {
  'use strict';
  const P = LES.ICON_PATHS = {
    'user': 'M9 2h6v2H9zm0 8h6v2H9zm6-6h2v6h-2zM7 4h2v6H7zM4 18h2v4H4zm14 0h2v4h-2zM8 14h8v2H8zm-2 2h2v2H6zm10 0h2v2h-2z',
    'users': 'M5 2h6v2H5zm10 0h4v2h-4zM5 10h6v2H5zm10 0h4v2h-4zm4-6h2v6h-2zm-8 0h2v6h-2zM3 4h2v6H3zM0 18h2v4H0zm14 0h2v4h-2zm8 0h2v4h-2zM4 14h8v2H4zm12 0h4v2h-4zM2 16h2v2H2zm10 0h2v2h-2zm8 0h2v2h-2z',
    'trophy': 'M16 17H13V19H15V21H9V19H11V17H8V15H16V17ZM18 5H22V11H20V7H18V11H20V13H18V15H16V5H8V15H6V13H4V11H6V7H4V11H2V5H6V3H18V5Z',
    'notes': 'M6 8h2v12H6zM2 4h2v12H2zm18 4h2v8h-2zM8 6h12v2H8zM4 2h12v2H4zm14 14h2v2h-2zm-2 2h2v2h-2zm-8 2h8v2H8zm6-6h6v2h-6z M14 14h2v6h-2zm2-10h2v2h-2zM4 16h2v2H4z',
    'home': 'M4 20h16v2H4zm16-10h2v10h-2zM2 10h2v10H2zm2-2h2v2H4zm2-2h2v2H6zm2-2h2v2H8zm2-2h4v2h-4zm4 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zM8 14h2v6H8zm2-2h4v2h-4zm4 2h2v6h-2z',
    'building': 'M5 2h14v2H5zm0 18h14v2H5zM3 4h2v16H3zm16 0h2v16h-2zM7 6h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm-8 4h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm-8 4h2v2H7zm4 0h2v2h-2zm-1 4h4v2h-4zm5-4h2v2h-2z',
    'chart': 'M4 2h16v2H4zm0 18h16v2H4zM2 4h2v16H2zm18 0h2v16h-2zM7 11h2v6H7zm4-4h2v10h-2zm4 6h2v4h-2z',
    'shield': 'M4 2h16v2H4zM2 4h2v10H2zm18 0h2v10h-2zM4 14h2v2H4zm2 2h2v2H6zm4 4h4v2h-4zm10-6h-2v2h2zm-2 2h-2v2h2zm-2 2h-2v2h2zm-6 0H8v2h2z',
    'flag': 'M4 2h2v20H4z M4 4h16v2H4zm12 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zM4 12h16v2H4z',
    'globe': 'M6 2h12v2H6zm0 18h12v2H6zM4 4h2v2H4zm5 0h2v2H9zm0 14h2v2H9zm4 0h2v2h-2zM7 6h2v12H7zm8 0h2v12h-2zm-2-2h2v2h-2zm7 0h-2v2h2zM2 6h2v12H2zm20 0h-2v12h2zM4 18h2v2H4zm16 0h-2v2h2z M3 11h18v2H3z',
    'book-open': 'M2 3h9v2H2zM0 19h11v2H0zM13 3h9v2h-9zm0 16h11v2H13zM11 5h2v18h-2zM0 5h2v14H0zm22 0h2v14h-2zm-7 2h5v2h-5zm0 4h5v2h-5zm0 4h2v2h-2z',
    'reload': 'M16 4h2v6h-2zm-2-2h2v2h-2zm0 2h2v8h-2zM4 8H2v5h2z M4 6h16v2H4zm4 14H6v-6h2zm2 2H8v-2h2zm0-2H8v-8h2zm10-4h2v-5h-2z M20 18H4v-2h16z',
    'infinity': 'M8 18H4V16H8V18ZM20 18H16V16H20V18ZM4 16H2V14H4V16ZM10 16H8V14H10V16ZM16 16H14V14H16V16ZM22 16H20V14H22V16ZM2 14H0V10H2V14ZM14 14H12V12H14V14ZM24 14H22V10H24V14ZM12 12H10V10H12V12ZM4 10H2V8H4V10ZM10 10H8V8H10V10ZM16 10H14V8H16V10ZM22 10H20V8H22V10ZM8 8H4V6H8V8ZM20 8H16V6H20V8Z',
    'lock': 'M5 8h14v2H5zm0 12h14v2H5zM3 10h2v10H3zm16 0h2v10h-2zM7 4h2v4H7zm2-2h6v2H9zm6 2h2v4h-2z',
    'heart': 'M13 22h-2v-2h2v2Zm-2-2H9v-2h2v2Zm4 0h-2v-2h2v2Zm-6-2H7v-2h2v2Zm8 0h-2v-2h2v2ZM7 16H5v-2h2v2Zm12 0h-2v-2h2v2ZM5 14H3v-2h2v2Zm16 0h-2v-2h2v2ZM3 12H1V6h2v6Zm20 0h-2V6h2v6ZM13 8h-2V6h2v2ZM5 6H3V4h2v2Zm6 0H9V4h2v2Zm4 0h-2V4h2v2Zm6 0h-2V4h2v2ZM9 4H5V2h4v2Zm10 0h-4V2h4v2Z',
    'robot': 'M5 7h14v2H5zm0 12h14v2H5zM3 9h2v10H3zm16 0h2v10h-2zM1 13h2v2H1zm20 0h2v2h-2zM11 5h2v2h-2zM7 3h4v2H7zm1 9h2v4H8zm6 0h2v4h-2z',
    'skull': 'M7 20h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm-6-4h2v4H9zm4 0h2v4h-2zm-8-2h2v6H5zm12 0h2v6h-2z M3 14h4v2H3zM1 4h2v10H1zm20 0h2v10h-2zM3 2h18v2H3zm14 12h4v2h-4zM8 7h2v4H8zm6 0h2v4h-2z',
    'sun': 'M13 22h-2v-3h2v3Zm-6-3H5v-2h2v2Zm12 0h-2v-2h2v2Zm-4-2H9v-2h6v2Zm-6-2H7V9h2v6Zm8 0h-2V9h2v6ZM5 13H2v-2h3v2Zm17 0h-3v-2h3v2Zm-7-4H9V7h6v2ZM7 7H5V5h2v2Zm12 0h-2V5h2v2Zm-6-2h-2V2h2v3Z',
    'crown': 'M3 3h2v12H3zm16 0h2v12h-2zm-8 0h2v2h-2zM9 5h2v2H9zM5 5h2v2H5z M3 3h2v2H3zm4 4h2v2H7zm6-2h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zM5 15h14v2H5zm-2 4h18v2H3z',
    'sliders': 'M8 14H7v6H5v-6H2v-2h6v2Zm5 6h-2V10h2v10Zm9-2h-3v2h-2v-2h-1v-2h6v2Zm-3-4h-2V4h2v10ZM7 10H5V4h2v6Zm6-4h2v2H9V6h2V4h2v2Z',
    'zap': 'M4 13h8v6h2v2h-2v2h-2v-8H2v-4h2v2Zm12 6h-2v-2h2v2Zm2-2h-2v-2h2v2Zm2-2h-2v-2h2v2Zm-6-6h8v4h-2v-2h-8V5h-2V3h2V1h2v8Zm-8 2H4V9h2v2Zm2-2H6V7h2v2Zm2-2H8V5h2v2Z',
    'money': 'M8 8h12v2H8zm0 10h12v2H8zm-2-8h2v8H6zm14 0h2v8h-2zM4 4h12v2H4zm0 10h2v2H4zM2 6h2v8H2zm14 0h2v2h-2zm-4 6h4v4h-4z',
    'clock': 'M6 2h12v2H6zM2 6h2v12H2zm18 0h2v12h-2zm-2-2h2v2h-2zM4 4h2v2H4zm2 18h12v-2H6zm12-2h2v-2h-2zM4 20h2v-2H4zm7-14h2v7h-2zm2 7h2v2h-2zm2 2h2v2h-2z',
    'map': 'M4 20h2v2H2V6h2v14Zm12 0h2v2h-4v-2h-2v-2h2V8h-2V6h4v14Zm-8 0H6v-2h2v2Zm12 0h-2v-2h2v2ZM10 4h2v2h-2v10h2v2H8V4H6V2h4v2Zm12 14h-2V4h-2V2h4v16ZM6 6H4V4h2v2Zm12 0h-2V4h2v2Z',
    'human': 'M10 2h4v4h-4zM3 7h18v2H3zm6 2h2v7H9zm4 0h2v7h-2zm-4 7h2v6H9zm4 0h2v6h-2zm-2-2h2v2h-2z',
    'teach': 'M3 2h4v4H3zM2 8h12v2H2zm7-4h11v2H9zm1 10h10v2H10z M2 9h6v7H2zm0 7h2v4H2zm4 0h2v4H6zM20 6h2v8h-2z',
    'calendar': 'M5 4h14v2H5zm0 16h14v2H5zM3 10h2v10H3zm0-4h2v2H3zm16 0h2v2h-2zm0 4h2v10h-2zM3 8h18v2H3zm12-6h2v2h-2zM7 2h2v2H7z',
  };
  LES.icon = (name, size = 16, cls = '') => (P[name] ? `<svg class="px-icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${P[name]}"/></svg>` : '');
  // Put an icon in front of every element marked data-icon (tab buttons and so on).
  LES.decorateIcons = function (root) {
    if (typeof document === 'undefined') return;
    for (const el of (root || document).querySelectorAll('[data-icon]')) {
      if (el.querySelector('.px-icon')) continue;
      el.insertAdjacentHTML('afterbegin', LES.icon(el.dataset.icon, 18));
    }
  };
  if (typeof document !== 'undefined') LES.decorateIcons();
})(globalThis.LES = globalThis.LES || {});
