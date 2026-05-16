import { describe, expect, it } from "vitest";
import { parseDictionaryRecordHtml } from "../../../electron/dictionary/html";

describe("parseDictionaryRecordHtml", () => {
  it("normalizes OALD-style HTML into app dictionary fields", () => {
    const entry = parseDictionaryRecordHtml(
      "sample",
      `
        <div class="entry">
          <h1 class="headword">sample</h1>
          <span class="pos">phrasal verb</span>
          <a href="entry://@ox3000&level=b2"><span>B2</span></a>
          <div class="phons_br"><span class="phon">/ˈsɑːmpəl/</span></div>
          <div class="phons_n_am"><span class="phon">/ˈsæmpəl/</span></div>
          <a href="sound://sample__gb_1.mp3"></a>
          <a href="sound://sampled__gb_2.mp3"></a>
          <a href="sound://sample__us_1.mp3"></a>
          <a href="sound://samples__us_2.mp3"></a>
          <img src="fullsize_sample.png" alt="Sample diagram" />
          <li class="sense">
            <span class="labels">(formal)</span>
            <span class="def">to test a small amount of something</span>
            <span class="x">Researchers sampled the water.</span>
          </li>
        </div>
      `,
      "fixture.mdx",
    );

    expect(entry.headword).toBe("sample");
    expect(entry.posKey).toBe("phrasal_verb");
    expect(entry.cefr).toBe("B2");
    expect(entry.ipaUk).toBe("/ˈsɑːmpəl/");
    expect(entry.ipaUs).toBe("/ˈsæmpəl/");
    expect(entry.senses[0]?.definitionEn).toBe("to test a small amount of something");
    expect(entry.senses[0]?.examples).toEqual(["Researchers sampled the water."]);
    expect(entry.audio.map((audio) => audio.ref)).toEqual([
      "sound://sample__gb_1.mp3",
      "sound://sample__us_1.mp3",
    ]);
    expect(entry.images).toEqual([{ ref: "asset://fullsize_sample.png", alt: "Sample diagram" }]);
    expect(entry.related).toEqual([]);
    expect(entry.lessonEntries).toEqual([]);
  });
});
