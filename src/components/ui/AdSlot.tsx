import React from "react";

export default function AdSlot({
  slotName = "Ad Slot",
  width = "100%",
  height = "90px",
}: {
  slotName?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <div
      className="flex items-center justify-center bg-slate-100 text-slate-400
                 border border-dashed border-slate-300 rounded-xl my-4"
      style={{ width, height }}
      aria-label={`${slotName} placeholder`}
    >
      {slotName}
    </div>
  );
}
