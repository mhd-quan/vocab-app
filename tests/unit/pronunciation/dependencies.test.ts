import { describe, expect, it } from "vitest";
import { _internal } from "../../../electron/pronunciation/dependencies";

describe("pronunciation runtime dependency diagnostics", () => {
  it("turns Windows ONNX native loader failures into actionable recovery copy", () => {
    const message = _internal.describeNativeOnnxRuntimeLoadError(
      new Error(
        "A dynamic link library (DLL) initialization routine failed. \\\\?\\C:\\Program Files\\Vocab App\\resources\\app.asar.unpacked\\node_modules\\onnxruntime-node\\bin\\napi-v6\\win32\\x64\\onnxruntime_binding.node",
      ),
    );

    expect(message).toContain("ONNX Runtime native binding");
    expect(message).toContain("Microsoft Visual C++ 2015-2022 Redistributable (x64)");
    expect(message).toContain("Native loader error:");
  });

  it("preserves non-native dependency failures without adding Windows guidance", () => {
    const message = _internal.describeNativeOnnxRuntimeLoadError(
      new Error("CAPT model manifest is missing"),
    );

    expect(message).toBe("CAPT model manifest is missing");
  });
});
