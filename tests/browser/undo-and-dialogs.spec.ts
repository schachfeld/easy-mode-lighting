import { test, expect } from "@playwright/test";

// Each test sets up the demo state it needs; the demo home is shared across
// the whole browser run.

test("all lights off can be undone, restoring each light as it was", async ({
  page,
}) => {
  await page.goto("/#/rooms/office");
  const power = page.getByRole("switch", {
    name: "Office all lights",
    exact: true,
  });
  if (!(await power.isChecked())) await power.click();
  await expect(power).toBeChecked();
  await page
    .getByRole("slider", { name: "Room brightness", exact: true })
    .fill("42");
  await expect(
    page.getByRole("slider", { name: "Desk lamp brightness", exact: true }),
  ).toHaveValue("42");

  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  await page
    .getByRole("button", { name: "All lights off", exact: true })
    .click();
  await expect(page.getByText("0 lights on", { exact: true })).toBeVisible();
  const toast = page.getByRole("status").filter({ hasText: "Turned off" });
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("switch", { name: "Office lights", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("slider", { name: "Office brightness", exact: true }),
  ).toHaveValue("42");
  await expect(toast).toHaveCount(0);
});

test("going back closes a dialog instead of leaving the page", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog");
  const office = page.getByRole("button", { name: "Open Office", exact: true });
  await page.goto("/");
  await office.click();
  await expect(page).toHaveURL(/#\/rooms\/office$/);
  await page.getByRole("button", { name: "Adjust light" }).first().click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#\/rooms\/office$/);
  await expect(
    page.getByRole("heading", { name: "Office", level: 1 }),
  ).toBeVisible();

  // A dialog closed with its own buttons leaves no extra step behind.
  await page.getByRole("button", { name: "Adjust light" }).first().click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.waitForFunction(() => !history.state?.glowDialog);
  await page.goBack();
  await expect(office).toBeVisible();

  // Navigating while a closed dialog is still stepping back through history
  // must not be undone when that step lands. Close the dialog, let its step
  // back start, and navigate before the browser finishes it.
  await office.click();
  await page.getByRole("button", { name: "Adjust light" }).first().click();
  await expect(dialog).toBeVisible();
  await page.evaluate(async () => {
    const done = [...document.querySelectorAll("dialog button")].find(
      (button) => button.textContent?.includes("Done"),
    ) as HTMLButtonElement;
    done.click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    (document.querySelector(".back-link") as HTMLButtonElement).click();
  });
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/#\/rooms$/);
  await expect(office).toBeVisible();
});

test("the scene editor asks before discarding unsaved changes", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog");
  const name = page.getByLabel("Scene name", { exact: true });
  await page.goto("/#/rooms/bedroom");
  // An untouched editor closes straight away.
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await name.fill("Half finished");
  await page.keyboard.press("Escape");
  const confirm = dialog.getByRole("alert");
  await expect(confirm).toContainText("Discard your changes to this scene?");
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(name).toHaveValue("Half finished");

  // Going back asks too, and the editor keeps its place in history.
  await page.goBack();
  await expect(confirm).toBeVisible();
  await expect(page).toHaveURL(/#\/rooms\/bedroom$/);
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await page.goBack();
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Discard changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#\/rooms\/bedroom$/);
  await expect(
    page.getByRole("button", { name: /^Activate Half finished/ }),
  ).toHaveCount(0);
});
