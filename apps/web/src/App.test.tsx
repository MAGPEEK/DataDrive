import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { startDownload } from "./files/download";
import {
  FakeBackend,
  TEST_OTP,
  TEST_PASSWORD,
  type FakeBackendOptions,
} from "./testing/fake-backend";

vi.mock("./files/download", () => ({ startDownload: vi.fn() }));

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.mocked(startDownload).mockClear();
});

function start(options: FakeBackendOptions = {}): FakeBackend {
  const backend = new FakeBackend(options);
  backend.install();
  return backend;
}

const row = (name: string | RegExp) =>
  screen.findByRole("row", { name: typeof name === "string" ? new RegExp(name, "u") : name });
const queryRow = (name: string) => screen.queryByRole("row", { name: new RegExp(name, "u") });

async function signIn(user: User, password = TEST_PASSWORD) {
  await user.type(await screen.findByRole("textbox", { name: "Username" }), "alice");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.type(await screen.findByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

async function open(backend: FakeBackend) {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("toolbar", { name: "Actions" });
  return { user, backend };
}

class FakeDataTransfer {
  private readonly store = new Map<string, string>();
  types: string[] = [];
  files: File[] = [];
  effectAllowed = "all";
  setData(type: string, value: string) {
    this.store.set(type, value);
    this.types = [...this.store.keys()];
  }
  getData(type: string) {
    return this.store.get(type) ?? "";
  }
}

describe("sign in", () => {
  it("shows the login page when there is no session", async () => {
    start({ signedIn: false });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Welcome back!" })).toBeInTheDocument();
  });

  it("signs in and shows the personal drive", async () => {
    const backend = start({ signedIn: false });
    backend.addFolder("Fotos");
    const user = userEvent.setup();
    render(<App />);
    await signIn(user);
    expect(await row("Fotos")).toBeInTheDocument();
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
    await user.type(await screen.findByLabelText("One-time code"), TEST_OTP);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("navigation", { name: "Categories" })).toBeInTheDocument();
  });

  it("signs out", async () => {
    start();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Welcome back!" })).toBeInTheDocument();
  });

  it("switches between English and German and remembers the choice", async () => {
    start();
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Language" }), "de");
    expect(await screen.findByRole("button", { name: "Abmelden" })).toBeInTheDocument();
    expect(await screen.findByRole("navigation", { name: "Kategorien" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Kategorien" })).getByRole("button", {
        name: /Mein Laufwerk/u,
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("datadrive.language")).toBe("de");
  });
});

describe("browsing", () => {
  it("opens folders on double click and navigates back with the path", async () => {
    const backend = start();
    const docs = backend.addFolder("Docs");
    backend.addFile("plan.txt", 2048, { parentId: docs.id });
    const { user } = await open(backend);
    await user.dblClick(await row("Docs"));
    expect(await row("plan.txt")).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Location" });
    expect(within(crumbs).getByRole("button", { name: "Docs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(within(crumbs).getByRole("button", { name: "My Drive" }));
    expect(await row("Docs")).toBeInTheDocument();
    expect(queryRow("plan.txt")).not.toBeInTheDocument();
  });

  it("downloads a file on double click", async () => {
    const backend = start();
    const file = backend.addFile("report.pdf", 100);
    const { user } = await open(backend);
    await user.dblClick(await row("report.pdf"));
    expect(startDownload).toHaveBeenCalledWith(`/api/v1/files/${file.id}/content`);
  });

  it("sorts by name with folders first and by clicking the headers", async () => {
    const backend = start();
    backend.addFile("b.txt", 5);
    backend.addFile("a.txt", 9);
    backend.addFolder("Zeta");
    const { user } = await open(backend);
    await screen.findByRole("row", { name: /Zeta/u });
    const names = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((r) => r.textContent ?? "");
    expect(names()[0]).toContain("Zeta");
    expect(names()[1]).toContain("a.txt");
    await user.click(screen.getByRole("button", { name: "Size" }));
    await user.click(screen.getByRole("button", { name: "Size" }));
    expect(names()[1]).toContain("a.txt");
    await user.click(screen.getByRole("button", { name: "Name" }));
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(names()[1]).toContain("b.txt");
  });

  it("shows an empty state and the item count", async () => {
    const backend = start();
    const { user } = await open(backend);
    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
  });

  it("shows the number of items and the selection in the status bar", async () => {
    const backend = start();
    backend.addFile("a.txt", 1);
    backend.addFile("b.txt", 1);
    const { user } = await open(backend);
    expect(await screen.findByText("2 items")).toBeInTheDocument();
    await user.click(await row("a.txt"));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});

describe("selection", () => {
  it("selects with click, ctrl+click and shift+click and adapts the toolbar", async () => {
    const backend = start();
    ["a.txt", "b.txt", "c.txt"].forEach((n) => backend.addFile(n, 1));
    const { user } = await open(backend);
    await user.click(await row("a.txt"));
    expect(await row("a.txt")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();

    await user.keyboard("{Control>}");
    await user.click(await row("c.txt"));
    await user.keyboard("{/Control}");
    expect(await row("a.txt")).toHaveAttribute("aria-selected", "true");
    expect(await row("c.txt")).toHaveAttribute("aria-selected", "true");
    expect(await row("b.txt")).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();

    await user.click(await row("a.txt"));
    await user.keyboard("{Shift>}");
    await user.click(await row("c.txt"));
    await user.keyboard("{/Shift}");
    expect(await row("b.txt")).toHaveAttribute("aria-selected", "true");
  });

  it("is operated from the keyboard: arrows, enter, ctrl+a, escape", async () => {
    const backend = start();
    const dir = backend.addFolder("Docs");
    backend.addFile("inner.txt", 1, { parentId: dir.id });
    backend.addFile("z.txt", 1);
    const { user } = await open(backend);
    await user.click(await row("z.txt"));
    await user.keyboard("{ArrowUp}");
    expect(await row("Docs")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Control>}a{/Control}");
    expect(await row("z.txt")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(await row("z.txt")).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(await row("inner.txt")).toBeInTheDocument();
  });

  it("opens a context menu with the actions of the item and closes it with escape", async () => {
    const backend = start();
    backend.addFile("a.txt", 1);
    const { user } = await open(backend);
    await user.pointer({ keys: "[MouseRight]", target: await row("a.txt") });
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Open", "Download", "Rename", "Add star", "Move to…", "Delete"]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});

describe("creating and renaming", () => {
  it("creates a folder that is immediately in rename mode", async () => {
    const backend = start();
    backend.addFolder("New folder");
    const { user } = await open(backend);
    await user.click(await screen.findByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("menuitem", { name: "Folder" }));
    const input = await screen.findByLabelText("Rename");
    expect(input).toHaveValue("New folder (2)");
    await user.keyboard("{Control>}a{/Control}Projekte{Enter}");
    expect(await row("Projekte")).toBeInTheDocument();
    expect(backend.find("Projekte")).toBeDefined();
  });

  it("renames with F2 and reverts with an error when the name is taken", async () => {
    const backend = start();
    backend.addFile("a.txt", 1);
    backend.addFile("b.txt", 1);
    const { user } = await open(backend);
    await user.click(await row("a.txt"));
    await user.keyboard("{F2}");
    await user.keyboard("{Control>}a{/Control}B.TXT{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An item with this name already exists here.",
    );
    expect(await row("a.txt")).toBeInTheDocument();
  });

  it("cancels renaming with escape", async () => {
    const backend = start();
    backend.addFile("a.txt", 1);
    const { user } = await open(backend);
    await user.click(await row("a.txt"));
    await user.keyboard("{F2}x{Escape}");
    expect(await row("a.txt")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rename")).not.toBeInTheDocument();
  });
});

describe("stars", () => {
  it("stars an item, lists it under Starred and removes it from there again", async () => {
    const backend = start();
    backend.addFile("wichtig.txt", 1);
    backend.addFile("egal.txt", 1);
    const { user } = await open(backend);
    await user.click(within(await row("wichtig.txt")).getByRole("button", { name: "Add star" }));
    expect(
      within(await row("wichtig.txt")).getByRole("button", { name: "Remove star" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Starred" }));
    expect(await row("wichtig.txt")).toBeInTheDocument();
    expect(queryRow("egal.txt")).not.toBeInTheDocument();
    await user.click(within(await row("wichtig.txt")).getByRole("button", { name: "Remove star" }));
    expect(await screen.findByText(/Nothing starred yet/u)).toBeInTheDocument();
  });
});

describe("deleting", () => {
  it("moves items to the recycle bin at once and brings them back with undo", async () => {
    const backend = start();
    backend.addFile("weg.txt", 1);
    const { user } = await open(backend);
    await user.click(await row("weg.txt"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(queryRow("weg.txt")).not.toBeInTheDocument();
    expect(await screen.findByText(/moved to the recycle bin/u)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(await row("weg.txt")).toBeInTheDocument();
  });

  it("deletes with the Delete key and restores from the recycle bin", async () => {
    const backend = start();
    backend.addFile("a.txt", 1);
    backend.addFile("b.txt", 1);
    const { user } = await open(backend);
    await user.click(await row("a.txt"));
    await user.keyboard("{Delete}");
    await waitFor(() => expect(queryRow("a.txt")).not.toBeInTheDocument());
    expect(await row("b.txt")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recycle Bin" }));
    await user.click(await row("a.txt"));
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText("The recycle bin is empty.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "My Drive" }));
    expect(await row("a.txt")).toBeInTheDocument();
  });
});

describe("moving", () => {
  it("moves selected items through the dialog", async () => {
    const backend = start();
    backend.addFolder("Ziel");
    backend.addFile("datei.txt", 1);
    const { user } = await open(backend);
    await user.click(await row("datei.txt"));
    await user.click(screen.getByRole("button", { name: "Move to…" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: /Ziel/u }));
    await user.click(within(dialog).getByRole("button", { name: "Move here" }));
    await waitFor(() => expect(queryRow("datei.txt")).not.toBeInTheDocument());
    expect(backend.find("datei.txt")?.parentId).toBe(backend.find("Ziel")?.id);
  });

  it("moves items by dragging them onto a folder", async () => {
    const backend = start();
    const target = backend.addFolder("Ziel");
    backend.addFile("datei.txt", 1);
    await open(backend);
    const transfer = new FakeDataTransfer();
    fireEvent.dragStart(await row("datei.txt"), { dataTransfer: transfer });
    fireEvent.dragOver(await row("Ziel"), { dataTransfer: transfer });
    fireEvent.drop(await row("Ziel"), { dataTransfer: transfer });
    await waitFor(() => expect(backend.find("datei.txt")?.parentId).toBe(target.id));
    expect(queryRow("datei.txt")).not.toBeInTheDocument();
  });

  it("moves items back by dropping them on a breadcrumb", async () => {
    const backend = start();
    const dir = backend.addFolder("Docs");
    backend.addFile("tief.txt", 1, { parentId: dir.id });
    const { user } = await open(backend);
    await user.dblClick(await row("Docs"));
    const transfer = new FakeDataTransfer();
    fireEvent.dragStart(await row("tief.txt"), { dataTransfer: transfer });
    const crumbs = screen.getByRole("navigation", { name: "Location" });
    const root = within(crumbs).getByRole("button", { name: "My Drive" });
    fireEvent.dragOver(root, { dataTransfer: transfer });
    fireEvent.drop(root, { dataTransfer: transfer });
    await waitFor(() => expect(backend.find("tief.txt")?.parentId).toBeNull());
  });
});

describe("uploading", () => {
  it("uploads through the create menu and shows the upload tray", async () => {
    const backend = start();
    const { user } = await open(backend);
    await screen.findByRole("button", { name: "Create" });
    await user.upload(
      screen.getByTestId("upload-input"),
      new File(["hello"], "hello.txt", { type: "text/plain" }),
    );
    expect(await row("hello.txt")).toBeInTheDocument();
    expect(backend.calls.some((c) => c.method === "PUT" && c.path.includes("name=hello.txt"))).toBe(
      true,
    );
    expect(screen.getByRole("region", { name: "Upload" })).toBeInTheDocument();
  });

  it("uploads files dropped from the desktop onto the list", async () => {
    const backend = start();
    await open(backend);
    const transfer = new FakeDataTransfer();
    transfer.types = ["Files"];
    transfer.files = [new File(["x"], "dropped.txt")];
    const area = (await screen.findByRole("toolbar", { name: "Actions" }))
      .parentElement as HTMLElement;
    fireEvent.dragOver(area, { dataTransfer: transfer });
    expect(await screen.findByText("Drop files here to upload")).toBeInTheDocument();
    fireEvent.drop(area, { dataTransfer: transfer });
    expect(await row("dropped.txt")).toBeInTheDocument();
  });
});

describe("search, recent and details", () => {
  it("searches as you type and jumps to the folder of a result", async () => {
    const backend = start();
    const dir = backend.addFolder("Archiv");
    backend.addFile("urlaubsplan.txt", 1, { parentId: dir.id });
    backend.addFile("anderes.txt", 1);
    const { user } = await open(backend);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "urlaub");
    expect(await row("urlaubsplan.txt")).toBeInTheDocument();
    expect(queryRow("anderes.txt")).not.toBeInTheDocument();
    await user.pointer({ keys: "[MouseRight]", target: await row("urlaubsplan.txt") });
    await user.click(await screen.findByRole("menuitem", { name: "Show in folder" }));
    const crumbs = await screen.findByRole("navigation", { name: "Location" });
    expect(within(crumbs).getByRole("button", { name: "Archiv" })).toBeInTheDocument();
    expect(await row("urlaubsplan.txt")).toHaveAttribute("aria-selected", "true");
  });

  it("says so when nothing matches and returns when the search is cleared", async () => {
    const backend = start();
    backend.addFile("a.txt", 1);
    const { user } = await open(backend);
    const box = screen.getByRole("searchbox", { name: "Search" });
    await user.type(box, "zzz");
    expect(await screen.findByText("No results for “zzz”.")).toBeInTheDocument();
    await user.clear(box);
    expect(await row("a.txt")).toBeInTheDocument();
  });

  it("lists recent files", async () => {
    const backend = start();
    backend.addFolder("Ordner");
    backend.addFile("neu.txt", 1);
    const { user } = await open(backend);
    await user.click(screen.getByRole("button", { name: "Recent" }));
    expect(await row("neu.txt")).toBeInTheDocument();
    expect(queryRow("Ordner")).not.toBeInTheDocument();
  });

  it("shows the details of the selected item", async () => {
    const backend = start();
    backend.addFile("a.txt", 2048);
    const { user } = await open(backend);
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(await row("a.txt"));
    const panel = screen.getByRole("complementary", { name: "Details" });
    expect(within(panel).getByText("a.txt")).toBeInTheDocument();
    expect(within(panel).getByText("2 KB")).toBeInTheDocument();
  });
});

describe("team drives", () => {
  it("lets viewers read but hides editing actions", async () => {
    const backend = start({ teamRole: "viewer" });
    backend.addFile("kampagne.txt", 1, { driveId: "t1" });
    const { user } = await open(backend);
    await user.click(await screen.findByRole("button", { name: "Marketing" }));
    await user.click(await row("kampagne.txt"));
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add star" }).length).toBeGreaterThan(0);
  });

  it("lists team folders under their own heading with quota usage", async () => {
    start({ teamRole: "editor" });
    render(<App />);
    expect(await screen.findByText("Team Folder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketing" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Marketing" }));
    expect(await screen.findByText("500 B of 9.8 KB used")).toBeInTheDocument();
  });
});
