import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import {
  FakeBackend,
  TEST_OTP,
  TEST_PASSWORD,
  type FakeBackendOptions,
} from "./testing/fake-backend";

function start(options: FakeBackendOptions = {}): FakeBackend {
  const backend = new FakeBackend(options);
  backend.install();
  return backend;
}

async function signIn(user: ReturnType<typeof userEvent.setup>, password = TEST_PASSWORD) {
  await user.type(await screen.findByLabelText("Username"), "alice");
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("sign in", () => {
  it("shows the login page when there is no session", async () => {
    start({ signedIn: false });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("signs in and shows the personal drive", async () => {
    const backend = start({ signedIn: false });
    backend.addFolder("Fotos");
    const user = userEvent.setup();
    render(<App />);
    await signIn(user);
    expect(await screen.findByRole("button", { name: /Fotos/u })).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("shows an error for wrong credentials", async () => {
    start({ signedIn: false });
    const user = userEvent.setup();
    render(<App />);
    await signIn(user, "wrong-password-1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The username, password or code is wrong.",
    );
  });

  it("asks for the one-time code when the account needs one", async () => {
    start({ signedIn: false, requireOtp: true });
    const user = userEvent.setup();
    render(<App />);
    await signIn(user);
    await user.type(await screen.findByLabelText(/One-time code/u), TEST_OTP);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("navigation", { name: "Drives" })).toBeInTheDocument();
  });

  it("signs out", async () => {
    start();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("language", () => {
  it("switches between English and German and remembers the choice", async () => {
    start();
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Language" }), "de");
    expect(await screen.findByRole("button", { name: "Abmelden" })).toBeInTheDocument();
    expect(localStorage.getItem("datadrive.language")).toBe("de");
  });
});

describe("browsing", () => {
  it("opens folders, shows breadcrumbs and navigates back", async () => {
    const backend = start();
    const docs = backend.addFolder("Docs");
    backend.addFile("plan.txt", 2048, { parentId: docs.id });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /Docs/u }));
    expect(await screen.findByText("plan.txt")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Location" });
    expect(within(crumbs).getByRole("button", { name: "Docs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(within(crumbs).getByRole("button", { name: "My Drive" }));
    expect(await screen.findByRole("button", { name: /Docs/u })).toBeInTheDocument();
    expect(screen.queryByText("plan.txt")).not.toBeInTheDocument();
  });

  it("offers a download link for files", async () => {
    const backend = start();
    const file = backend.addFile("report.pdf", 100);
    render(<App />);
    const link = await screen.findByRole("link", { name: "Download" });
    expect(link).toHaveAttribute("href", `/api/v1/files/${file.id}/content`);
  });

  it("shows an empty state", async () => {
    start();
    render(<App />);
    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();
  });
});

describe("changing content", () => {
  it("creates a folder and reports name conflicts", async () => {
    const backend = start();
    backend.addFolder("Existing");
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "New folder" }));
    await user.type(screen.getByLabelText("Folder name"), "existing{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An item with this name already exists here.",
    );

    await user.click(await screen.findByRole("button", { name: "New folder" }));
    await user.type(screen.getByLabelText("Folder name"), "Neu{Enter}");
    expect(await screen.findByRole("button", { name: /Neu/u })).toBeInTheDocument();
  });

  it("moves an item to the trash and restores it from there", async () => {
    const backend = start();
    backend.addFolder("Weg");
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: /Weg/u });
    await user.click(screen.getByRole("button", { name: "Move to trash" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Weg/u })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Trash" }));
    expect(await screen.findByText("Weg", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText("The trash is empty.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /My Drive/u }));
    expect(await screen.findByRole("button", { name: /Weg/u })).toBeInTheDocument();
  });

  it("uploads selected files into the current folder", async () => {
    const backend = start();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "Upload" });
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await user.upload(screen.getByTestId("upload-input"), file);
    expect(await screen.findByText("hello.txt")).toBeInTheDocument();
    expect(backend.calls.some((c) => c.method === "PUT" && c.path.includes("name=hello.txt"))).toBe(
      true,
    );
  });
});

describe("team drives", () => {
  it("lets viewers read but hides editing actions", async () => {
    const backend = start({ teamRole: "viewer" });
    backend.addFolder("Kampagne", "t1");
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /Marketing/u }));
    expect(await screen.findByRole("button", { name: /Kampagne/u })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move to trash" })).not.toBeInTheDocument();
  });

  it("shows quota usage for drives with a limit", async () => {
    start({ teamRole: "editor" });
    render(<App />);
    expect(await screen.findByText("500 B of 9.8 KB used")).toBeInTheDocument();
  });
});
