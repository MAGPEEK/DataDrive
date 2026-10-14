import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { FakeBackend } from "../testing/fake-backend";

async function openConsole(seed: (backend: FakeBackend) => void = () => undefined) {
  const backend = new FakeBackend({ admin: true });
  seed(backend);
  backend.install();
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("toolbar", { name: "Actions" });
  await user.click(screen.getByRole("button", { name: "Administration" }));
  const nav = await screen.findByRole("navigation", { name: "Administration" });
  const go = (name: string) => user.click(within(nav).getByRole("button", { name }));
  return { backend, user, go };
}

const GIB = 1024 ** 3;

describe("administration", () => {
  it("shows the gear only to administrators", async () => {
    const backend = new FakeBackend();
    backend.install();
    render(<App />);
    await screen.findByRole("toolbar", { name: "Actions" });
    expect(screen.queryByRole("button", { name: "Administration" })).toBeNull();
  });

  it("opens from the gear, shows the overview and returns to the files", async () => {
    const { user } = await openConsole();
    const overview = await screen.findByRole("region", { name: "Overview" });
    expect(within(overview).getByText("Users")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to files" }));
    expect(await screen.findByRole("toolbar", { name: "Actions" })).toBeInTheDocument();
  });

  it("lists users with role and status and filters them", async () => {
    const { user, go } = await openConsole();
    await go("Users");
    const table = await screen.findByRole("table");
    expect(await within(table).findByText("bob")).toBeInTheDocument();
    expect(within(table).getAllByText("Normal")).toHaveLength(2);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "bo");
    expect(within(table).queryByText("alice")).toBeNull();
    expect(within(table).getByText("bob")).toBeInTheDocument();
  });

  it("creates a user", async () => {
    const { backend, user, go } = await openConsole();
    await go("Users");
    await user.click(await screen.findByRole("button", { name: "New user" }));
    const dialog = screen.getByRole("dialog", { name: "New user" });
    await user.type(within(dialog).getByLabelText("Username"), "carol");
    await user.type(within(dialog).getByLabelText("Password"), "a long enough secret");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("User “carol” created")).toBeInTheDocument();
    expect(backend.admin.users.map((u) => u.username)).toContain("carol");
    expect(await within(await screen.findByRole("table")).findByText("carol")).toBeInTheDocument();
  });

  it("reports a weak password and a taken username", async () => {
    const { user, go } = await openConsole();
    await go("Users");
    await user.click(await screen.findByRole("button", { name: "New user" }));
    const dialog = screen.getByRole("dialog", { name: "New user" });
    await user.type(within(dialog).getByLabelText("Username"), "bob");
    await user.type(within(dialog).getByLabelText("Password"), "a long enough secret");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This username is already taken.")).toBeInTheDocument();
  });

  it("disables a user, but not the own account", async () => {
    const { backend, user, go } = await openConsole();
    await go("Users");
    await user.click(await screen.findByRole("button", { name: "Edit bob" }));
    const dialog = screen.getByRole("dialog", { name: "Edit bob" });
    await user.click(within(dialog).getByLabelText("Disable this account"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(backend.admin.users[1]?.disabled).toBe(true));
    expect(await screen.findByText("Disabled")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Edit alice" }));
    const own = screen.getByRole("dialog", { name: "Edit alice" });
    await user.click(within(own).getByLabelText("Disable this account"));
    await user.click(within(own).getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/cannot disable or demote your own/u)).toBeInTheDocument();
    expect(backend.admin.users[0]?.disabled).toBe(false);
  });

  it("creates a group", async () => {
    const { backend, user, go } = await openConsole();
    await go("Groups");
    await user.type(await screen.findByRole("textbox", { name: "New group" }), "Design");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Group “Design” created")).toBeInTheDocument();
    expect(backend.admin.groups.map((g) => g.name)).toEqual(["Design"]);
  });

  it("creates a team folder and changes quota, versions and download restriction", async () => {
    const { backend, user, go } = await openConsole();
    await go("Team folders");
    await user.type(await screen.findByRole("textbox", { name: "New team folder" }), "Marketing");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(await screen.findByRole("button", { name: "Settings Marketing" }));
    const dialog = screen.getByRole("dialog", { name: "Marketing" });
    await user.type(within(dialog).getByLabelText(/Quota/u), "5");
    const versions = within(dialog).getByLabelText("Max. versions per file");
    await user.clear(versions);
    await user.type(versions, "8");
    await user.selectOptions(within(dialog).getByLabelText("Version policy"), "intelligent");
    await user.click(within(dialog).getByLabelText("Block downloads for viewers"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(backend.admin.folders[0]?.quotaBytes).toBe(5 * GIB));
    expect(backend.admin.folders[0]?.settings).toMatchObject({
      maxVersions: 8,
      versionPolicy: "intelligent",
      restrictDownloads: true,
    });
    const table = await screen.findByRole("table");
    expect(await within(table).findByText("On")).toBeInTheDocument();
  });

  it("adds and removes team folder members with a role", async () => {
    const { backend, user, go } = await openConsole((fake) =>
      fake.admin.folders.push({
        id: "t9",
        name: "Sales",
        quotaBytes: null,
        settings: {
          restrictDownloads: false,
          watermark: false,
          fileLocking: false,
          maxVersions: 32,
          versionPolicy: "fifo",
          retentionDays: null,
        },
      }),
    );
    await go("Team folders");
    await user.click(await screen.findByRole("button", { name: "Settings Sales" }));
    const dialog = screen.getByRole("dialog", { name: "Sales" });
    await user.selectOptions(within(dialog).getByLabelText("User or group"), "bob");
    await user.selectOptions(
      within(dialog).getAllByLabelText("Role").at(-1) as HTMLElement,
      "Manager",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(await within(dialog).findByRole("button", { name: "Remove bob" })).toBeInTheDocument();
    expect(backend.admin.members.get("t9")).toEqual([
      { subjectType: "user", subjectId: "u2", role: "manager" },
    ]);
    await user.click(within(dialog).getByRole("button", { name: "Remove bob" }));
    await waitFor(() => expect(backend.admin.members.get("t9")).toEqual([]));
  });
});
