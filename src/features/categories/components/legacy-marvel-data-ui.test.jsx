import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LegacyMarvelActionModal } from "./LegacyMarvelActionModal";
import {
  LegacyMarvelDataPanelView,
  shouldShowLegacyMarvelPanel,
} from "./LegacyMarvelDataPanel";

describe("legacy Marvel dashboard UI", () => {
  it("shows the panel only for Marvel when legacy data is available", () => {
    expect(shouldShowLegacyMarvelPanel({ slug: "marvel" }, { available: true })).toBe(true);
    expect(shouldShowLegacyMarvelPanel({ slug: "noir" }, { available: true })).toBe(false);
    expect(shouldShowLegacyMarvelPanel({ slug: "marvel" }, { available: false })).toBe(false);
  });

  it("renders both legacy data choices and the local count", () => {
    const html = renderToStaticMarkup(
      <LegacyMarvelDataPanelView
        count={12}
        disabled={false}
        onMigrate={vi.fn()}
        onSynchronize={vi.fn()}
      />,
    );
    expect(html).toContain("Legacy Watch Marvel data found");
    expect(html).toContain("12 local titles found");
    expect(html).toContain("Migrate to Spreadsheet");
    expect(html).toContain("Synchronize from Spreadsheet");
  });

  it("shows accessible migration progress", () => {
    const html = renderToStaticMarkup(
      <LegacyMarvelActionModal
        mode="migrate"
        count={27}
        busy
        progress={{ stage: "migrating", completed: 10, total: 27 }}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(html).toContain("Migrating 10 of 27 titles");
    expect(html).toContain("aria-label=\"Migrating 10 of 27 titles\"");
  });

  it("shows the destructive synchronize warning and requested actions", () => {
    const html = renderToStaticMarkup(
      <LegacyMarvelActionModal
        mode="synchronize"
        count={4}
        busy={false}
        progress={null}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(html).toContain("Data Watch Marvel lama di browser ini akan dihapus");
    expect(html).toContain("Cancel");
    expect(html).toContain("Replace Local Data");
  });

  it("the panel visibility becomes false after local legacy data is cleared", () => {
    const category = { slug: "marvel" };
    expect(shouldShowLegacyMarvelPanel(category, { available: true })).toBe(true);
    expect(shouldShowLegacyMarvelPanel(category, { available: false })).toBe(false);
  });
});
