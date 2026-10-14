import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { FakeBackend, TEST_PASSWORD } from "../testing/fake-backend";

function start(options = {}) {
  new FakeBackend({ signedIn: false, ...options }).install();
  render(<App />);
  return userEvent.setup();
}

describe("sign-in mask", () => {
  it("asks for the username first and offers no password field yet", async () => {
    start();
    expect(await screen.findByRole("heading", { name: "Welcome back!" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveFocus();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("moves to the password with Enter and shows the username with a way back", async () => {
    const user = start();
    await user.type(await screen.findByRole("textbox", { name: "Username" }), "alice{Enter}");
    expect(await screen.findByLabelText("Password")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back to username" })).toHaveTextContent("alice");
    await user.click(screen.getByRole("button", { name: "Back to username" }));
    expect(await screen.findByRole("textbox", { name: "Username" })).toHaveValue("alice");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("does not leave the username step with an empty name", async () => {
    const user = start();
    await user.type(await screen.findByRole("textbox", { name: "Username" }), "   {Enter}");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("signs in with Enter on the password step", async () => {
    const user = start();
    await user.type(await screen.findByRole("textbox", { name: "Username" }), "alice{Enter}");
    await user.type(await screen.findByLabelText("Password"), `${TEST_PASSWORD}{Enter}`);
    expect(await screen.findByRole("navigation", { name: "Categories" })).toBeInTheDocument();
  });

  it("keeps the password step and shows the error after a wrong password", async () => {
    const user = start();
    await user.type(await screen.findByRole("textbox", { name: "Username" }), "alice{Enter}");
    await user.type(await screen.findByLabelText("Password"), "wrong-password-1{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The username, password or code is wrong.",
    );
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("is available in German", async () => {
    localStorage.setItem("datadrive.language", "de");
    start();
    expect(await screen.findByRole("heading", { name: "Willkommen zurück!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });
});
