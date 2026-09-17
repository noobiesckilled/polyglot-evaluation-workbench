import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("all runtimes, mutation detection, review persistence and mobile layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByLabel("Access token")
    .fill(process.env.WORKBENCH_TOKEN || "ci-only-token-not-for-deployment");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "New evaluation" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  for (const name of ["Python", "JavaScript", "Java", "Go", "Rust"])
    await expect(
      page.getByRole("checkbox", { name, exact: false }).first(),
    ).toBeEnabled();
  await page.getByLabel("Boundary bug demo").check();
  await page.getByLabel("Test suite").selectOption("regression");
  await page.getByRole("button", { name: "Run evaluation" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Evaluation complete. Results saved.",
  );
  await expect(page.getByText("5 / 6 passed")).toBeVisible();
  await page
    .getByRole("button", { name: "Boundary bug demo", exact: true })
    .click();
  await page.getByLabel("Failures only").check();
  await page
    .locator("summary")
    .filter({ hasText: "touching boundaries" })
    .click();
  await expect(page.getByText("[[1,5]]", { exact: true })).toBeVisible();
  await page.getByLabel("Verdict").selectOption("needs-work");
  await page
    .getByLabel("Review notes")
    .fill(
      "The mutant fails touching boundaries. Use <= when merging closed intervals.",
    );
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByRole("status")).toHaveText("Review saved.");
  await expect(page.getByText(/Review history/)).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/workbench-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Access token")).toBeVisible();
  await page
    .getByLabel("Access token")
    .fill(process.env.WORKBENCH_TOKEN || "ci-only-token-not-for-deployment");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.locator(".history-item").first().click();
  await expect(page.getByLabel("Review notes")).toHaveValue(
    "The mutant fails touching boundaries. Use <= when merging closed intervals.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/workbench-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("read-only token can inspect history but cannot submit evaluations", async ({
  page,
  request,
}) => {
  const seed = await request.post("/api/runs", {
    headers: {
      Authorization: `Bearer ${process.env.WORKBENCH_TOKEN || "ci-only-token-not-for-deployment"}`,
    },
    data: { languages: ["python"], suite: "boundaries" },
  });
  expect(seed.status()).toBe(201);
  await page.goto("/");
  await page
    .getByLabel("Access token")
    .fill("ci-only-viewer-token-not-for-deployment");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByText("Read-only access. Open a saved run to inspect it."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run evaluation" }),
  ).toBeDisabled();
  await page.locator(".history-item").first().click();
  await expect(
    page.getByRole("heading", { name: "Saved assessment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save review" }),
  ).toBeDisabled();
});
