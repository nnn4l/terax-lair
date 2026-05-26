import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LairFloatingSidebar } from "@/lair/components/LairFloatingSidebar";

describe("LairFloatingSidebar", () => {
  test("renders nothing while closed", () => {
    const html = renderToStaticMarkup(<LairFloatingSidebar open={false} />);
    expect(html).toBe("");
  });

  test("renders a right floating sidebar while open", () => {
    const html = renderToStaticMarkup(<LairFloatingSidebar open />);
    expect(html).toContain("data-lair-floating-sidebar");
    expect(html).toContain("fixed");
    expect(html).toContain("right-4");
    expect(html).toContain("w-[min(24rem,calc(100vw-2rem))]");
    expect(html).not.toContain("w-[min(34rem,calc(100vw-2rem))]");
  });
});
