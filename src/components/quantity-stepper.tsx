"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

export function QuantityStepper({
  name = "quantity",
  defaultValue = 1,
  min = 1,
  max = 9999,
  ariaLabel = "Quantity",
}: {
  name?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  ariaLabel?: string;
}) {
  const [quantity, setQuantity] = useState(() =>
    Math.min(max, Math.max(min, Math.trunc(defaultValue) || min)),
  );
  const update = (next: number) =>
    setQuantity(Math.min(max, Math.max(min, Math.trunc(next) || min)));

  return (
    <div className="flex h-[50px] min-w-36 overflow-hidden border border-[#3b3b3b] bg-[#111] focus-within:border-[#fd7803]">
      <button
        className="grid w-11 shrink-0 place-items-center border-r border-[#333] text-[#aaa] transition-colors hover:bg-[#1b1b1b] hover:text-white"
        type="button"
        aria-label={`Decrease ${ariaLabel.toLowerCase()}`}
        onClick={() => update(quantity - 1)}
        disabled={quantity <= min}
      >
        <Minus size={16} />
      </button>
      <input
        className="min-w-0 flex-1 bg-transparent px-2 text-center font-mono text-sm font-bold text-white outline-none"
        aria-label={ariaLabel}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={quantity}
        onChange={(event) => update(Number(event.target.value))}
      />
      <button
        className="grid w-11 shrink-0 place-items-center border-l border-[#333] text-[#aaa] transition-colors hover:bg-[#1b1b1b] hover:text-white"
        type="button"
        aria-label={`Increase ${ariaLabel.toLowerCase()}`}
        onClick={() => update(quantity + 1)}
        disabled={quantity >= max}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
