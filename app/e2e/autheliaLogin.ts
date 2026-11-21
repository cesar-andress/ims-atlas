import type { Page } from "@playwright/test";

/**
 * Log in through Authelia using ATLAS_E2E_USER / ATLAS_E2E_PASS from the
 * environment. Never hard-code credentials. Returns false when unset.
 */
export function e2eCredentials(): { user: string; pass: string } | null {
  const user = process.env.ATLAS_E2E_USER?.trim();
  const pass = process.env.ATLAS_E2E_PASS;
  if (!user || pass == null || pass === "") return null;
  return { user, pass };
}

/**
 * If the current page is Authelia (or redirects there), fill username/password
 * and submit. Safe to call when already authenticated (no-op).
 */
export async function loginViaAutheliaIfNeeded(page: Page): Promise<boolean> {
  const creds = e2eCredentials();
  if (!creds) return false;

  const url = page.url();
  const onAuthelia =
    /authelia|auth\.|\/login/i.test(url) ||
    (await page.locator("#username, input[name='username']").count()) > 0;

  if (!onAuthelia) {
    // Maybe a soft gate on the landing — try the team login control.
    const login = page
      .getByTestId("landing-enter")
      .or(page.getByTestId("access-login"));
    if (
      await login
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await login.first().click();
      await page.waitForLoadState("domcontentloaded");
    }
  }

  const userInput = page.locator("#username, input[name='username']").first();
  if (!(await userInput.isVisible().catch(() => false))) {
    return true; // already in the app
  }

  await userInput.fill(creds.user);
  const passInput = page.locator("#password, input[name='password']").first();
  await passInput.fill(creds.pass);
  const submit = page
    .locator(
      "button[type='submit'], button#next-button, button:has-text('Sign in'), button:has-text('Iniciar')",
    )
    .first();
  await submit.click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // Second factor / continue if present (one-factor deployments skip this).
  const again = page.locator("#password, input[name='password']");
  if (await again.isVisible().catch(() => false)) {
    // leave for TOTP — cannot automate without a seed
    return false;
  }
  return true;
}
