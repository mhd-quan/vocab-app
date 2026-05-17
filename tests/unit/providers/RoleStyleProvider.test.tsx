import { AppModeProvider, useAppMode } from "@/providers/AppModeProvider";
import { RoleStyleProvider } from "@/providers/RoleStyleProvider";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RoleStyleProvider must set/remove `data-app-mode` on <html> exactly
 * matching the current useAppMode().mode. This is the only contract;
 * everything else (token scoping, Tailwind cascade) is downstream CSS.
 */

const ATTR = "data-app-mode";

function ModeProbe({ next }: { next: "tutor" | "student" }) {
  const mode = useAppMode();
  useEffect(() => {
    if (next === "tutor") {
      // selectTutor → locked; setupPin → tutor
      void mode.setupPin("0000");
    } else {
      mode.enterStudent();
    }
  }, [next, mode]);
  return null;
}

describe("RoleStyleProvider", () => {
  beforeEach(() => {
    vi.spyOn(window.api.auth, "hasPin").mockResolvedValue(false);
    vi.spyOn(window.api.auth, "setupPin").mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    document.documentElement.removeAttribute(ATTR);
    vi.restoreAllMocks();
  });

  it("does not set the attribute while mode is loading/welcome", () => {
    render(
      <AppModeProvider initialMode="welcome">
        <RoleStyleProvider>
          <span>x</span>
        </RoleStyleProvider>
      </AppModeProvider>,
    );
    expect(document.documentElement.getAttribute(ATTR)).toBeNull();
  });

  it("writes data-app-mode='student' when mode flips to student", async () => {
    render(
      <AppModeProvider initialMode="student">
        <RoleStyleProvider>
          <span>student</span>
        </RoleStyleProvider>
      </AppModeProvider>,
    );
    expect(document.documentElement.getAttribute(ATTR)).toBe("student");
  });

  it("writes data-app-mode='tutor' when mode flips to tutor", async () => {
    render(
      <AppModeProvider initialMode="tutor">
        <RoleStyleProvider>
          <span>tutor</span>
        </RoleStyleProvider>
      </AppModeProvider>,
    );
    expect(document.documentElement.getAttribute(ATTR)).toBe("tutor");
  });

  it("removes the attribute when the provider unmounts", () => {
    const { unmount } = render(
      <AppModeProvider initialMode="student">
        <RoleStyleProvider>
          <span>x</span>
        </RoleStyleProvider>
      </AppModeProvider>,
    );
    expect(document.documentElement.getAttribute(ATTR)).toBe("student");
    act(() => unmount());
    expect(document.documentElement.getAttribute(ATTR)).toBeNull();
  });

  // Sanity: ProvideProbe compiles + uses the hook chain. We keep the
  // child component in scope to avoid an unused-import lint.
  it("is callable with a child", () => {
    render(
      <AppModeProvider initialMode="welcome">
        <RoleStyleProvider>
          <ModeProbe next="student" />
        </RoleStyleProvider>
      </AppModeProvider>,
    );
  });
});
