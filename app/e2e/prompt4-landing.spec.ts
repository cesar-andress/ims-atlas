import { expect, test } from "@playwright/test";

test.describe("Prompt 4 public landing", () => {
  test("landing shows hero and seven publications without illustrative ranking chrome", async ({
    page,
  }) => {
    const dataReqs: string[] = [];
    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("/data/") || u.includes("/status/")) {
        dataReqs.push(u);
      }
    });

    await page.goto("/");
    await expect(page.getByTestId("landing-hero")).toBeVisible();
    await expect(page.getByTestId("landing-enter")).toBeVisible();
    await expect(page.getByTestId("landing-pubs")).toBeVisible();

    for (const id of [
      "dyo-2018",
      "infotec-2020",
      "labr-2021",
      "ribs-2021",
      "ram-2022",
      "pjms-2023",
      "gbr-2026",
    ]) {
      await expect(page.getByTestId(`landing-pub-${id}`)).toBeVisible();
    }

    for (const shot of [
      "landing-shot-ranking",
      "landing-shot-matriz",
      "landing-shot-mapa",
    ]) {
      const img = page.getByTestId(shot).locator("img");
      await expect(img).toBeVisible();
      await expect
        .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Ejemplo ilustrativo/i);
    // No ranking score lines like "1. … 0.9"
    expect(body).not.toMatch(/\bIMSFE\b/);
    expect(dataReqs).toEqual([]);
  });

  test("metodologia and privacy pages load", async ({ page }) => {
    await page.goto("/metodologia");
    await expect(page.getByTestId("metodologia-page")).toBeVisible();
    await page.goto("/privacidad");
    await expect(page.getByTestId("privacy-view")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/pendiente César/i);
    await page.goto("/aviso-legal");
    await expect(page.getByTestId("legal-view")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/pendiente César/i);
  });
});
