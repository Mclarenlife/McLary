import { savedTimeMode, timeOptions } from "./day-cycle.js";

const icon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4"/><g class="time-rays"><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></g></svg>`;
export const timeControlMarkup = `<div class="time-control"><button class="time-toggle" aria-label="场景时间" aria-expanded="false" aria-controls="time-options">${icon}</button><div class="time-options" id="time-options" role="group" aria-label="场景时间" hidden>${timeOptions.map(([id, label]) => `<button data-time="${id}" aria-pressed="false"><span class="time-dot time-dot-${id}" aria-hidden="true"></span>${label}<span class="time-check" aria-hidden="true">✓</span></button>`).join("")}</div></div>`;

export function bindTimeControl(onSelect, onFeedback = () => {}) {
  const root = document.querySelector(".time-control"),
    toggle = root.querySelector(".time-toggle"),
    panel = root.querySelector(".time-options");
  const buttons = [...panel.querySelectorAll("button")];
  let mode = savedTimeMode();
  function refresh() {
    buttons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.time === mode)),
    );
    toggle.dataset.time = mode;
    toggle.setAttribute(
      "aria-label",
      `场景时间：${timeOptions.find(([id]) => id === mode)[1]}`,
    );
  }
  function close(returnFocus = false) {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  }
  toggle.onclick = () => {
    const open = panel.hidden;
    onFeedback(open ? "open" : "close");
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) buttons.find((button) => button.dataset.time === mode).focus();
  };
  buttons.forEach(
    (button) =>
      (button.onclick = () => {
        onFeedback("select");
        mode = button.dataset.time;
        try {
          localStorage.setItem("mclary-time", mode);
        } catch {
          /* Private browsing may disable storage. */
        }
        refresh();
        onSelect(mode);
        close(true);
      }),
  );
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
    }
    const index = buttons.indexOf(document.activeElement);
    if (
      index >= 0 &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? 4
            : (index + (event.key === "ArrowDown" ? 1 : 4)) % 5;
      buttons[next].focus();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!root.contains(event.target)) close();
  });
  document.addEventListener("focusin", (event) => {
    if (!root.contains(event.target)) close();
  });
  refresh();
  return { close };
}
