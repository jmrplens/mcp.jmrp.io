import { expect, test } from "@playwright/test";

// Fakes: GitLab is never involved. If either shows up in a `Referer`, the code
// would reach the access log of the origin that serves the subresource.
const CODE = "fake-authorization-code";
const STATE = "fake-state";

test("the callback's subresources never repeat the code in Referer", async ({
  page,
}) => {
  const sent: { url: string; referer: string }[] = [];
  page.on("request", (request) => {
    sent.push({
      url: request.url(),
      referer: request.headers().referer ?? "",
    });
  });

  await page.goto(`/inspector/callback/?code=${CODE}&state=${STATE}`);
  // The fonts an inline style asks for are the last to leave and the ones that
  // ignore the referrer policy, so the load event alone would miss them.
  await page.evaluate(() => document.fonts.ready.then(() => true));

  // More than the document itself, or this would pass by asking nothing.
  expect(sent.length).toBeGreaterThan(1);
  expect(
    sent.filter(({ referer }) => referer.includes(CODE)),
    "these requests carried the authorization code",
  ).toEqual([]);
});

test("the callback takes the code out of its own address", async ({ page }) => {
  await page.goto(`/inspector/callback/?code=${CODE}&state=${STATE}`);
  await expect(page).toHaveURL(/\/inspector\/callback\/$/);
});
