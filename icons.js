/* One consistent line-icon set (24px grid, 1.75 stroke, round caps). Inline SVG, inherits text colour. */
(function (root) {
  const P = {
    book:     '<path d="M12 6.5C10.3 5.2 8 4.5 4 4.5v13c4 0 6.3.7 8 2 1.7-1.3 4-2 8-2v-13c-4 0-6.3.7-8 2z"/><path d="M12 6.5v13"/>',
    stopwatch:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 3h5M12 3v3M18.2 6.8l1.3-1.3"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    equals:   '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 10h7M8.5 14h7"/>',
    chart:    '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    check:    '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close:    '<path d="M6 6l12 12M18 6L6 18"/>',
    lock:     '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
    chevR:    '<path d="M9.5 6l6 6-6 6"/>',
    chevL:    '<path d="M14.5 6l-6 6 6 6"/>',
    bulb:     '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 00-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0012 3.5z"/>',
    bolt:     '<path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12L13 3z"/>',
    camera:   '<path d="M4 8.5a2 2 0 012-2h2l1.2-2h5.6l1.2 2h2a2 2 0 012 2V17a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><circle cx="12" cy="12.5" r="3.3"/>',
    download: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19.5h14"/>',
    upload:   '<path d="M12 15V4m0 0L8 8m4-4l4 4M5 19.5h14"/>',
    copy:     '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 00-2-2h-7a2 2 0 00-2 2v7a2 2 0 002 2h2"/>',
    flame:    '<path d="M12 3.5c.6 3-1.6 4.6-3.2 6.6C7.5 11.7 7 13 7 14.3a5 5 0 0010 0c0-2-.9-3.3-1.9-4.5-.4 1-.9 1.6-1.6 1.9.5-2.9-.2-6.2-1.5-8.2z"/>',
    refresh:  '<path d="M19 12a7 7 0 11-2.1-5"/><path d="M19 4.5V8h-3.5"/>',
    play:     '<path d="M8 5.5v13l10.5-6.5z"/>',
    flag:     '<path d="M6 21V4.5"/><path d="M6 5.5c3-1.5 5.5 1.5 8.5 0 1.6-.8 2.8-.5 3.5 0v7c-.7-.5-1.9-.8-3.5 0-3 1.5-5.5-1.5-8.5 0"/>'
  };
  function icon(name, size) {
    const s = size || 20;
    return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ""}</svg>`;
  }
  // Replace <i data-icon="name" data-size="22"></i> placeholders in static HTML.
  function hydrate(scope) {
    (scope || document).querySelectorAll("[data-icon]").forEach(el => {
      const t = document.createElement("template"); t.innerHTML = icon(el.dataset.icon, +el.dataset.size || 22);
      el.replaceWith(t.content.firstChild);
    });
  }
  root.Icons = { icon, hydrate, names: Object.keys(P) };
})(globalThis);
