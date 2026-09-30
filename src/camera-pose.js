import * as THREE from "three";
export function applyCameraView(
  camera,
  view,
  page,
  pointer,
  { mobile = false, reduced = false, contact = 0, drag = 0 } = {},
) {
  const gallery = page === "gallery";
  const parallax =
    mobile || reduced
      ? 0
      : gallery
        ? Math.min(0.9, (view.z - view.tz) * 0.09)
        : 6 - contact * 5.65;
  camera.position.set(
    view.x + pointer.x * parallax + (gallery ? 0 : drag),
    view.y - pointer.y * parallax * 0.46,
    view.z + (mobile && page === "work" ? 4 : 0),
  );
  camera.lookAt(
    view.tx + (gallery ? 0 : drag * 0.5) - pointer.x * parallax * 0.13,
    view.ty + pointer.y * parallax * 0.1,
    view.tz,
  );
  camera.rotateZ(-pointer.x * parallax * 0.004);
  return camera;
}
