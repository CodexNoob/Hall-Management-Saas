import { beforeEach, describe, expect, it, vi } from "vitest";

const driveMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  drive: vi.fn()
}));

const envMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("server-only", () => ({}));
vi.mock("googleapis", () => ({
  google: {
    drive: driveMocks.drive
  }
}));
vi.mock("@/lib/google/oauth", () => ({
  createGoogleOAuthClient: vi.fn().mockReturnValue({ mock: "auth" })
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => envMock.value
}));

import {
  ensureDriveFolderPath,
  getDriveStatus,
  uploadToDrive
} from "@/lib/google/drive";

const fullConfig = {
  GOOGLE_CLIENT_ID: "client",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_REDIRECT_URI: "https://app.example/callback",
  ENCRYPTION_KEY: "key",
  GOOGLE_DRIVE_ENCRYPTED_REFRESH_TOKEN: "encrypted",
  GOOGLE_DRIVE_FOLDER_ID: "root-folder"
};

describe("google drive configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.value = { ...fullConfig };
    driveMocks.drive.mockReturnValue({
      files: { list: driveMocks.list, create: driveMocks.create }
    });
  });

  it("reports configured only when every credential is present", () => {
    expect(getDriveStatus()).toEqual({ configured: true, missing: [] });
  });

  it("names what is missing rather than just reporting off", () => {
    envMock.value = {
      ...fullConfig,
      GOOGLE_DRIVE_FOLDER_ID: undefined,
      ENCRYPTION_KEY: undefined
    };

    const status = getDriveStatus();
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual([
      "ENCRYPTION_KEY",
      "GOOGLE_DRIVE_FOLDER_ID"
    ]);
  });

  it("refuses to act when unconfigured instead of half-running", async () => {
    envMock.value = { ...fullConfig, GOOGLE_DRIVE_FOLDER_ID: undefined };

    await expect(ensureDriveFolderPath(["Anything"])).rejects.toThrow(
      /not configured/i
    );
    expect(driveMocks.create).not.toHaveBeenCalled();
  });
});

describe("google drive folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.value = { ...fullConfig };
    driveMocks.drive.mockReturnValue({
      files: { list: driveMocks.list, create: driveMocks.create }
    });
  });

  it("reuses a folder that already exists instead of duplicating it", async () => {
    driveMocks.list.mockResolvedValue({
      data: { files: [{ id: "existing", name: "Contracts" }] }
    });

    const id = await ensureDriveFolderPath(["Contracts"]);

    expect(id).toBe("existing");
    expect(driveMocks.create).not.toHaveBeenCalled();
  });

  it("creates each missing level under the nominated root", async () => {
    driveMocks.list.mockResolvedValue({ data: { files: [] } });
    driveMocks.create
      .mockResolvedValueOnce({ data: { id: "event-folder" } })
      .mockResolvedValueOnce({ data: { id: "section-folder" } });

    const id = await ensureDriveFolderPath(["Cohen Wedding", "Contracts"]);

    expect(id).toBe("section-folder");
    // The first level hangs off the configured root, never off My Drive - the
    // integration must not be able to write outside the nominated folder.
    expect(driveMocks.create.mock.calls[0][0].requestBody.parents).toEqual([
      "root-folder"
    ]);
    expect(driveMocks.create.mock.calls[1][0].requestBody.parents).toEqual([
      "event-folder"
    ]);
  });

  it("escapes quotes in a client name so the query cannot be broken", async () => {
    driveMocks.list.mockResolvedValue({ data: { files: [] } });
    driveMocks.create.mockResolvedValue({ data: { id: "created" } });

    await ensureDriveFolderPath(["O'Brien Wedding"]);

    // An unescaped apostrophe would close the quoted string and change the
    // meaning of the search - the Drive equivalent of an injection.
    const query = driveMocks.list.mock.calls[0][0].q as string;
    expect(query).toContain("O\\'Brien Wedding");
  });

  it("skips empty path segments rather than creating a blank folder", async () => {
    driveMocks.list.mockResolvedValue({ data: { files: [] } });
    driveMocks.create.mockResolvedValue({ data: { id: "created" } });

    await ensureDriveFolderPath(["", "  ", "Contracts"]);

    expect(driveMocks.create).toHaveBeenCalledTimes(1);
    expect(driveMocks.create.mock.calls[0][0].requestBody.name).toBe(
      "Contracts"
    );
  });

  it("fails loudly when Drive returns no id", async () => {
    driveMocks.list.mockResolvedValue({ data: { files: [] } });
    driveMocks.create.mockResolvedValue({ data: {} });

    await expect(ensureDriveFolderPath(["Contracts"])).rejects.toThrow(
      /did not return an id/i
    );
  });
});

describe("google drive upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.value = { ...fullConfig };
    driveMocks.drive.mockReturnValue({
      files: { list: driveMocks.list, create: driveMocks.create }
    });
  });

  it("uploads into the resolved folder and returns the file id", async () => {
    driveMocks.list.mockResolvedValue({
      data: { files: [{ id: "contracts", name: "Contracts" }] }
    });
    driveMocks.create.mockResolvedValue({
      data: { id: "file-1", webViewLink: "https://drive.example/file-1" }
    });

    const result = await uploadToDrive({
      body: Buffer.from("hello"),
      fileName: "agreement.pdf",
      contentType: "application/pdf",
      folderPath: ["Contracts"]
    });

    expect(result).toEqual({
      id: "file-1",
      webViewLink: "https://drive.example/file-1"
    });
    expect(driveMocks.create.mock.calls[0][0].requestBody).toEqual({
      name: "agreement.pdf",
      parents: ["contracts"]
    });
  });
});
