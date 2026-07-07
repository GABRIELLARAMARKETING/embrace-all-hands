import { useEffect, useRef } from "react";
import { CONSTANTS } from "@/game/config/constants";

// Writes into targetRotationRef (the intent). The scene lerps its actual
// rotation toward it every frame for a smooth, precise feel.
export function useTowerControls(
  targetRotationRef: React.MutableRefObject<number>,
  active: boolean,
  onFirstInput: () => void,
) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const keys = useRef({ left: false, right: false });
  const firedFirst = useRef(false);

  useEffect(() => {
    if (!active) return;

    const fireFirst = () => {
      if (!firedFirst.current) {
        firedFirst.current = true;
        onFirstInput();
      }
    };

    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      lastX.current = e.clientX;
      fireFirst();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      const sens =
        e.pointerType === "touch"
          ? CONSTANTS.TOUCH_ROTATION_SENSITIVITY
          : CONSTANTS.ROTATION_SENSITIVITY;
      targetRotationRef.current += dx * sens;
    };
    const onUp = () => {
      dragging.current = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        keys.current.left = true;
        fireFirst();
      }
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        keys.current.right = true;
        fireFirst();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.current.left = false;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.current.right = false;
    };

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const speed = CONSTANTS.KEYBOARD_ROTATION_SPEED;
      if (keys.current.left) targetRotationRef.current -= speed * dt;
      if (keys.current.right) targetRotationRef.current += speed * dt;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(raf);
    };
  }, [active, onFirstInput, targetRotationRef]);
}
