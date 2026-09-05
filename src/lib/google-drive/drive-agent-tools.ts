import {
  findDriveFolder,
  moveDriveFile,
  renameDriveFile,
  resolveDriveFolderPath,
  type DriveFolderMatch,
} from "@/lib/google-drive/drive-folder-api";
import { disambiguateDriveFolder } from "@/lib/google-drive/disambiguate-drive-folder";

export type DriveAgentToolContext = {
  openRouterApiKey?: string;
  openRouterModel?: string;
  siteName?: string;
  siteUrl?: string;
  signal?: AbortSignal;
};

export async function driveAgentFindOrCreateFolder(args: {
  parentFolderId: string;
  name: string;
  fuzzy?: boolean;
  purpose?: string;
  context?: DriveAgentToolContext;
}): Promise<DriveFolderMatch & { created?: boolean }> {
  const matches = await findDriveFolder({
    parentFolderId: args.parentFolderId,
    name: args.name,
    fuzzy: args.fuzzy,
  });
  if (matches.length === 0) {
    const created = await resolveDriveFolderPath({
      rootFolderId: args.parentFolderId,
      segments: [args.name],
      createMissing: true,
    });
    return {
      folderId: created.folderId,
      name: args.name,
      webViewLink:
        created.webViewLink ??
        `https://drive.google.com/drive/folders/${encodeURIComponent(created.folderId)}`,
      created: true,
    };
  }
  if (matches.length === 1) {
    return matches[0]!;
  }

  const match = await driveAgentFindFolder(args);
  return match;
}

export async function driveAgentFindFolder(args: {
  parentFolderId: string;
  name: string;
  fuzzy?: boolean;
  purpose?: string;
  context?: DriveAgentToolContext;
}): Promise<DriveFolderMatch> {
  const matches = await findDriveFolder({
    parentFolderId: args.parentFolderId,
    name: args.name,
    fuzzy: args.fuzzy,
  });
  if (matches.length === 0) {
    throw new Error(`No Google Drive folder named "${args.name}" found.`);
  }
  if (matches.length === 1) {
    return matches[0]!;
  }

  const apiKey = args.context?.openRouterApiKey?.trim();
  const model = args.context?.openRouterModel?.trim();
  if (!apiKey || !model) {
    throw new Error(
      `Multiple Google Drive folders matched "${args.name}". Connect OpenRouter or pick a folder manually.`,
    );
  }

  const picked = await disambiguateDriveFolder({
    apiKey,
    model,
    siteName: args.context?.siteName?.trim() || args.name,
    siteUrl: args.context?.siteUrl,
    purpose: args.purpose?.trim() || args.name,
    candidates: matches,
    signal: args.context?.signal,
  });
  const match = matches.find((item) => item.folderId === picked.folderId);
  if (!match) {
    throw new Error("Drive agent could not resolve a folder match.");
  }
  return match;
}

export async function driveAgentEnsureFolderPath(args: {
  rootFolderId: string;
  segments: string[];
  createMissing?: boolean;
}): Promise<{ folderId: string; webViewLink?: string; created?: string[] }> {
  return resolveDriveFolderPath(args);
}

export async function driveAgentMoveFile(args: {
  fileId: string;
  destinationFolderId: string;
}): Promise<{ fileId: string; name?: string; webViewLink?: string }> {
  return moveDriveFile(args);
}

export async function driveAgentRenameFile(args: {
  fileId: string;
  newName: string;
}): Promise<{ fileId: string; name?: string; webViewLink?: string }> {
  return renameDriveFile(args);
}
