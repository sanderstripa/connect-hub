import './connect-brand.css';
// Canvas charts must measure the bundled typeface, rather than a temporary
// system fallback. A transient font failure must not prevent panel access.
export function readyBrandFonts(): Promise<unknown> {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load('400 14px Montserrat', 'Connect. Hub Настройки'),
    document.fonts.load('600 14px Montserrat', 'Connect. Hub Настройки'),
  ]).catch(() => undefined);
}
