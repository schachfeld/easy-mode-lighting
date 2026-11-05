import { test, expect, type Page } from "@playwright/test";

const background = (page: Page) =>
  page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
const themeColor = (page: Page) =>
  page.locator('meta[name="theme-color"]').getAttribute("content");

test("Firefly is the default theme, and Daylight can be chosen and is remembered", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(await background(page)).toBe("rgb(18, 21, 17)");
  expect(await themeColor(page)).toBe("#121511");

  await page.getByRole("button", { name: "Settings & help" }).click();
  const daylight = page.getByRole("radio", { name: /Daylight/ });
  await expect(page.getByRole("radio", { name: /Firefly/ })).toBeChecked();
  await daylight.check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "daylight");
  expect(await background(page)).toBe("rgb(248, 247, 244)");
  expect(await themeColor(page)).toBe("#f8f7f4");

  // Applied before the app loads, so a reload never shows the other theme.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "daylight");
  expect(await themeColor(page)).toBe("#f8f7f4");

  await page.getByRole("button", { name: "Settings & help" }).click();
  await expect(daylight).toBeChecked();
  await page.getByRole("radio", { name: /Firefly/ }).check();
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(await background(page)).toBe("rgb(18, 21, 17)");
});

test("Phones reach Settings & help from the navigation bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const settings = page.getByRole("button", { name: "Settings & help" });
  await expect(settings).toBeVisible();
  await expect(settings).toBeInViewport({ ratio: 1 });
  await settings.click();
  await expect(
    page.getByRole("dialog", { name: "Settings & help" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Daylight/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "daylight");
});
