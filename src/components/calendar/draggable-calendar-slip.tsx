"use client";

import { useDraggable } from "@dnd-kit/core";
import type { ComponentProps } from "react";
import { CalendarSlip } from "./calendar-slip";

/** dnd-kit handle around {@link CalendarSlip}. */
export function DraggableCalendarSlip(
  props: Omit<ComponentProps<typeof CalendarSlip>, "drag" | "dragging">,
) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.slip.card.id,
  });
  return (
    <CalendarSlip
      {...props}
      dragging={isDragging}
      drag={{ attributes, listeners, setNodeRef }}
    />
  );
}
