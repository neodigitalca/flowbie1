import { describe, expect, it } from "vitest";
import {
  cleanFaqEntriesForDisplay,
  stripFaqQaLabelsForDisplay,
} from "@/lib/faq-entries";

describe("stripFaqQaLabelsForDisplay", () => {
  it("strips leading A: from answers and trailing Q:", () => {
    expect(stripFaqQaLabelsForDisplay("A: We offer blinds. Q:", "answer")).toBe(
      "We offer blinds.",
    );
    expect(stripFaqQaLabelsForDisplay("A: Yes, we offer help.", "answer")).toBe(
      "Yes, we offer help.",
    );
  });

  it("strips leading Q: from questions", () => {
    expect(stripFaqQaLabelsForDisplay("Q: What types are available?", "question")).toBe(
      "What types are available?",
    );
  });

  it("recovers question after bleed from prior answer", () => {
    expect(
      stripFaqQaLabelsForDisplay(
        "will fit precisely and enhance your home. Q: What are the benefits of installation?",
        "question",
      ),
    ).toBe("What are the benefits of installation?");
  });
});

describe("cleanFaqEntriesForDisplay", () => {
  it("cleans both fields and drops empty questions", () => {
    const out = cleanFaqEntriesForDisplay([
      { question: "Q: One?", answer: "A: Yes. Q:" },
      { question: "  ", answer: "A: Nope" },
    ]);
    expect(out).toEqual([{ question: "One?", answer: "Yes." }]);
  });
});
