import SftpClient from "ssh2-sftp-client";

/**
 * @param {{ host: string, port: number, username: string, password: string, remoteName: string, php: string, deleteBefore?: string[] }} input
 */
export async function uploadMuPlugin(input) {
  if (!input.host) throw new Error("SFTP host is required");
  if (!input.username) throw new Error("SFTP user is required");
  if (!input.password) throw new Error("WPE_SFTP_PASS is required");
  if (!input.remoteName) throw new Error("remoteName is required");
  if (!input.php) throw new Error("php is required");

  const sftp = new SftpClient();
  await sftp.connect({
    host: input.host,
    port: Number(input.port || 2222),
    username: input.username,
    password: input.password,
    readyTimeout: 30000,
  });
  try {
    if (Array.isArray(input.deleteBefore)) {
      for (const rel of input.deleteBefore) {
        if (rel && (await sftp.exists(rel))) {
          await sftp.delete(rel);
        }
      }
    }
    await sftp.mkdir("./wp-content/mu-plugins", true);
    const remote = `./wp-content/mu-plugins/${input.remoteName}`;
    await sftp.put(Buffer.from(input.php, "utf8"), remote);
    return remote;
  } finally {
    await sftp.end();
  }
}
