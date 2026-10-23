// Stop on the final row. Short viewports get just enough extra travel to read
// its caption above the fixed footer, without a blank descent after the list.
export function workScrollLimit(contentHeight, rowPitch, height, start) {
  if (contentHeight <= 0) return 0;
  return Math.max(0, contentHeight - rowPitch, start + contentHeight - height + 100);
}
