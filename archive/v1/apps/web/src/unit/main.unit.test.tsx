import { describe, expect, it, vi } from "vitest";

describe("unit: app bootstrap", () => {
  it("mounts app into #root", async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';

    const render = vi.fn();
    const createRoot = vi.fn(() => ({ render }));

    vi.doMock("react-dom/client", () => ({
      default: {
        createRoot
      }
    }));

    await import("../main");

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).toHaveBeenCalledWith(document.getElementById("root"));
    expect(render).toHaveBeenCalledTimes(1);
  });
});
