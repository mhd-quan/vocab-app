import { arpabetToIpa } from "@/modules/pronunciation";
import { describe, expect, it } from "vitest";

describe("arpabetToIpa", () => {
  it("renders a single-word ARPABET sequence as IPA with primary stress", () => {
    expect(arpabetToIpa(["JH", "OY", "N"], [null, 1, null])).toBe("dʒˈɔɪn");
  });

  it("inserts spaces at word boundaries for multi-word targets", () => {
    expect(arpabetToIpa(["JH", "OY", "N", "IH", "N"], [null, 1, null, 1, null], [3])).toBe(
      "dʒˈɔɪn ˈɪn",
    );
  });

  it("returns empty when any phoneme cannot be mapped", () => {
    expect(arpabetToIpa(["JH", "ZZZ"], [null, null])).toBe("");
  });

  it("renders secondary stress via the wedge marker", () => {
    expect(arpabetToIpa(["AA", "P"], [2, null])).toBe("ˌɑp");
  });
});
