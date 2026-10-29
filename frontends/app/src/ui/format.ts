/**
 * KES amounts arrive from the API as integer cents. Formatting is done
 * here, not with Intl, so it is identical on every phone and browser.
 */
export function kes(cents: number, { withCents = true }: { withCents?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}KES ${whole}${withCents ? `.${fraction}` : ''}`;
}

/** "29 Oct 2026, 14:05" in the phone's own time zone. */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
