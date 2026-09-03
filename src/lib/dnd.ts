import type { Modifier } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";

/**
 * Center the drag overlay on the pointer.
 *
 * A slip collapses to its compact face when a drag starts, but dnd-kit keeps
 * the grab offset measured against the original rect — so the ghost trails
 * the cursor by wherever you happened to click. Snapping the overlay's
 * center to the pointer removes that offset entirely.
 * (Local copy of @dnd-kit/modifiers' snapCenterToCursor, saving the dep.)
 */
export const snapCenterToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (!draggingNodeRect || !activatorEvent) return transform;
  const activator = getEventCoordinates(activatorEvent);
  if (!activator) return transform;
  return {
    ...transform,
    x:
      transform.x +
      activator.x -
      draggingNodeRect.left -
      draggingNodeRect.width / 2,
    y:
      transform.y +
      activator.y -
      draggingNodeRect.top -
      draggingNodeRect.height / 2,
  };
};
