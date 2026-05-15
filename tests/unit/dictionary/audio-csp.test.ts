import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dictionary audio CSP", () => {
  it("allows dictionary media data URLs in the Electron renderer", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");

    expect(html).toContain("media-src");
    expect(html).toContain("data:");
    expect(html).toContain("blob:");
  });
});
