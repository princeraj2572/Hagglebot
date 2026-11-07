/**
 * Plays a short "this went there" animation: a copy of the product flies from where it was clicked to the want
 * it was added to in the sidebar (or the Negotiate tab on a phone), the target bumps, and a tag floats up from it.
 * Returns how long the flight takes in milliseconds, or 0 when nothing was animated.
 */
export function flyToWant(from: DOMRect, image: string | null, tag: string): number {
  if (typeof document === "undefined") return 0;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;

  // The want row in the sidebar when it is on screen, otherwise the Negotiate tab in the top bar.
  const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getBoundingClientRect().width > 0;
  const row = document.querySelector('aside button[aria-pressed="true"]');
  const tab = document.querySelector('header nav[aria-label="Pages"] button');
  const target = visible(row) ? row : visible(tab) ? tab : null;
  if (!target) return 0;

  const size = 56;
  const t = target.getBoundingClientRect();
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + Math.min(from.height / 2, 90) - size / 2;
  const dx = t.left + Math.min(t.width / 2, 60) - size / 2 - startX;
  const dy = t.top + t.height / 2 - size / 2 - startY;

  const chip = document.createElement("div");
  Object.assign(chip.style, {
    position: "fixed", left: `${startX}px`, top: `${startY}px`, width: `${size}px`, height: `${size}px`,
    zIndex: "60", pointerEvents: "none", borderRadius: "16px", background: "#fff", overflow: "hidden",
    boxShadow: "0 1px 2px rgba(14,20,36,.08), 0 14px 32px -10px rgba(14,20,36,.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
  } as Partial<CSSStyleDeclaration>);
  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    Object.assign(img.style, { width: "100%", height: "100%", objectFit: "contain" } as Partial<CSSStyleDeclaration>);
    chip.appendChild(img);
  } else {
    chip.style.background = "#2F63F3";
    chip.style.color = "#fff";
    chip.style.fontWeight = "700";
    chip.style.fontSize = "22px";
    chip.textContent = "+";
  }
  document.body.appendChild(chip);

  const duration = 720;
  const flight = chip.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) scale(0.85)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0.55 },
    ],
    { duration, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" },
  );

  flight.onfinish = () => {
    chip.remove();
    // The target bumps once and flashes a ring.
    target.animate(
      [
        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(43,63,214,0.45)" },
        { transform: "scale(1.035)", boxShadow: "0 0 0 8px rgba(43,63,214,0.18)", offset: 0.4 },
        { transform: "scale(1)", boxShadow: "0 0 0 14px rgba(43,63,214,0)" },
      ],
      { duration: 520, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
    // A tag floats up from it, saying what changed.
    const label = document.createElement("div");
    label.textContent = tag;
    Object.assign(label.style, {
      position: "fixed", left: `${t.right - 8}px`, top: `${t.top + 4}px`, transform: "translateX(-100%)", zIndex: "60",
      pointerEvents: "none", background: "#2F63F3", color: "#fff", fontSize: "12px", fontWeight: "700",
      padding: "3px 10px", borderRadius: "999px", whiteSpace: "nowrap",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(label);
    const rise = label.animate(
      [
        { transform: "translate(-100%, 6px)", opacity: 0 },
        { transform: "translate(-100%, -6px)", opacity: 1, offset: 0.25 },
        { transform: "translate(-100%, -22px)", opacity: 0 },
      ],
      { duration: 1100, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
    rise.onfinish = () => label.remove();
  };
  flight.oncancel = () => chip.remove();
  return duration;
}
