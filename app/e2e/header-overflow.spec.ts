import { expect, test, type Page } from "@playwright/test";

async function assertHeaderFitsViewport(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/inicio");

  const header = page.getByTestId("site-header");
  await expect(header).toBeVisible();

  const overflow = await header.evaluate((el, viewportWidth) => {
    const headerRect = el.getBoundingClientRect();
    if (headerRect.right > viewportWidth + 0.5 || headerRect.left < -0.5) {
      return {
        ok: false,
        reason: "header-box",
        right: headerRect.right,
        left: headerRect.left,
      };
    }

    const children = Array.from(el.querySelectorAll("*"));
    for (const child of children) {
      const rect = child.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        continue;
      }
      if (rect.right > viewportWidth + 0.5 || rect.left < -0.5) {
        return {
          ok: false,
          reason: "child",
          tag: child.tagName,
          className: (child as HTMLElement).className || "",
          right: rect.right,
          left: rect.left,
        };
      }
    }

    return { ok: true };
  }, width);

  expect(
    overflow,
    `header overflow at ${width}px: ${JSON.stringify(overflow)}`,
  ).toEqual({
    ok: true,
  });
}

test.describe("header overflow", () => {
  test("no header element exceeds viewport at 1773px", async ({ page }) => {
    await assertHeaderFitsViewport(page, 1773, 900);
  });

  test("no header element exceeds viewport at 375px", async ({ page }) => {
    await assertHeaderFitsViewport(page, 375, 812);
  });
});
