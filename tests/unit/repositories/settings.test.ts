import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { freshDb } from "../../helpers";

describe("SettingsRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("returns undefined for missing keys", () => {
    expect(repos.settings.get("anything")).toBeUndefined();
  });

  it("set + get round-trips JSON values", () => {
    repos.settings.set("theme", "dark");
    repos.settings.set("locale", "en");
    repos.settings.set("featureFlags", { spaced_repetition: true, sound: false });

    expect(repos.settings.get<string>("theme")).toBe("dark");
    expect(repos.settings.get<string>("locale")).toBe("en");
    expect(repos.settings.get<{ spaced_repetition: boolean }>("featureFlags")).toEqual({
      spaced_repetition: true,
      sound: false,
    });
  });

  it("set on existing key overwrites in place", () => {
    repos.settings.set("theme", "light");
    repos.settings.set("theme", "dark");
    expect(repos.settings.get<string>("theme")).toBe("dark");
    expect(Object.keys(repos.settings.getAll())).toHaveLength(1);
  });

  it("delete removes the row", () => {
    repos.settings.set("k", 1);
    repos.settings.delete("k");
    expect(repos.settings.get("k")).toBeUndefined();
  });

  it("getAll returns every key/value", () => {
    repos.settings.set("a", 1);
    repos.settings.set("b", "two");
    expect(repos.settings.getAll()).toEqual({ a: 1, b: "two" });
  });
});
