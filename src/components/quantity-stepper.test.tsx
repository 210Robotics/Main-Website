// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { QuantityStepper } from "@/components/quantity-stepper";

describe("QuantityStepper", () => {
  it("increments, decrements, and respects its minimum", () => {
    render(<QuantityStepper defaultValue={2} ariaLabel="Part quantity" />);
    const input = screen.getByRole("spinbutton", { name: "Part quantity" });
    expect(input).toHaveValue(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Increase part quantity" }),
    );
    expect(input).toHaveValue(3);

    fireEvent.click(
      screen.getByRole("button", { name: "Decrease part quantity" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Decrease part quantity" }),
    );
    expect(input).toHaveValue(1);
    expect(
      screen.getByRole("button", { name: "Decrease part quantity" }),
    ).toBeDisabled();
  });
});
