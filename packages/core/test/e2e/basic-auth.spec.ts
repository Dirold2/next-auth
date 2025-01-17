import { test, expect } from "@playwright/test"

test.describe("Basic Auth", () => {
  test("Credentials signin / signout", async ({ page }) => {
    await test.step("should signin", async () => {
      await page.goto("http://localhost:3000/auth/signin")
      await page.getByLabel("Password").fill("password")
      await page
        .getByRole("button", { name: "signin with Credentials" })
        .click()
      const session = await page.locator("pre").textContent()

      expect(JSON.parse(session ?? "{}")).toEqual({
        user: {
          email: "test@example.com",
          name: "Test User",
          sub: expect.any(String),
          iat: expect.any(Number),
          exp: expect.any(Number),
          jti: expect.any(String),
        },
        expires: expect.any(String),
      })
    })

    await test.step("should signout", async () => {
      await page
        .getByRole("banner")
        .getByRole("button", { name: "Sign out" })
        .click()

      // Wait on server-side signout req
      await page.waitForTimeout(1000)

      const session = await page.locator("pre").textContent()
      expect(JSON.parse(session ?? "{}")).toBeNull()
    })
  })

  test("Keycloak signin / signout", async ({ page }) => {
    if (
      !process.env.TEST_KEYCLOAK_USERNAME ||
      !process.env.TEST_KEYCLOAK_PASSWORD
    )
      throw new TypeError("Missing TEST_KEYCLOAK_{USERNAME,PASSWORD}")

    await test.step("should login", async () => {
      await page.goto("http://localhost:3000/auth/signin")
      await page.getByText("Keycloak").click()
      await page
        .getByLabel("Username or email")
        .fill(process.env.TEST_KEYCLOAK_USERNAME!)
      await page.locator("#password").fill(process.env.TEST_KEYCLOAK_PASSWORD!)
      await page.getByRole("button", { name: "Authorized" }).click()
      const session = await page.locator("pre").textContent()

      expect(JSON.parse(session ?? "{}")).toEqual({
        user: {
          email: "bob@alice.com",
          name: "Bob Alice",
          picture: "https://avatars.githubusercontent.com/u/67470890?s=200&v=4",
          sub: expect.any(String),
          iat: expect.any(Number),
          exp: expect.any(Number),
          jti: expect.any(String),
        },
        expires: expect.any(String),
      })
    })

    await test.step("should signout", async () => {
      await page
        .getByRole("banner")
        .getByRole("button", { name: "Sign out" })
        .click()

      // Wait on server-side signout req
      await page.waitForTimeout(1000)

      const session = await page.locator("pre").textContent()
      expect(JSON.parse(session ?? "{}")).toBeNull()
    })
  })
})
