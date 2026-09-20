/**
 * Probe Phoenix Painting + flowbie.ca WP Engine SFTP/SSH for a clone restore.
 * Does not print passwords.
 */
import { readFileSync } from "fs";
import { join } from "path";
import SftpClient from "ssh2-sftp-client";
import { Client as SshClient } from "ssh2";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
const phoenix = catalog.rows.find((r) => r.site === "phoenixpainting.ca" && !r.isStaging);
const flowbie = catalog.rows.find((r) => r.site === "flowbie.ca" && !r.isStaging);
if (!phoenix || !flowbie) {
  console.error("Missing catalog rows");
  process.exit(1);
}

const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
  ],
};

function mb(n) {
  if (n == null || Number.isNaN(n)) return "n/a";
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function probeSftp(label, site) {
  const sftp = new SftpClient();
  const out = { label, host: site.host, user: site.username, ok: false };
  try {
    await sftp.connect({
      host: site.host,
      port: site.port,
      username: site.username,
      password: site.password,
      readyTimeout: 45000,
      algorithms: ALGOS,
    });
    out.ok = true;
    out.cwd = await sftp.cwd();
    const paths = [
      "./wp-content/mysql.sql",
      "./wp-config.php",
      "./.htaccess",
      "./_wpeprivate",
      "./wp-content",
      "./wp-content/uploads",
      "./wp-content/themes",
      "./wp-content/plugins",
    ];
    out.stats = {};
    for (const p of paths) {
      try {
        const st = await sftp.stat(p);
        out.stats[p] = { isDir: st.isDirectory, size: st.size };
      } catch (e) {
        out.stats[p] = { error: e.message };
      }
    }
    try {
      const privateList = await sftp.list("./_wpeprivate");
      out.wpeprivate = privateList.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      }));
    } catch (e) {
      out.wpeprivate = e.message;
    }
    try {
      const content = await sftp.list("./wp-content");
      out.wpContent = content.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      }));
    } catch (e) {
      out.wpContent = e.message;
    }
    try {
      const plugins = await sftp.list("./wp-content/plugins");
      out.plugins = plugins.filter((f) => f.type === "d").map((f) => f.name);
    } catch (e) {
      out.plugins = e.message;
    }
  } catch (e) {
    out.error = e.message;
  } finally {
    try {
      await sftp.end();
    } catch {
      /* ignore */
    }
  }
  return out;
}

function sshExec(host, site, command) {
  return new Promise((resolve) => {
    const conn = new SshClient();
    const timer = setTimeout(() => {
      conn.end();
      resolve({ host, ok: false, error: "timeout 20s" });
    }, 20000);
    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            resolve({ host, ok: false, error: err.message });
            return;
          }
          let stdout = "";
          let stderr = "";
          stream.on("data", (d) => {
            stdout += d.toString();
          });
          stream.stderr.on("data", (d) => {
            stderr += d.toString();
          });
          stream.on("close", (code) => {
            clearTimeout(timer);
            conn.end();
            resolve({
              host,
              ok: true,
              code,
              stdout: stdout.slice(0, 800),
              stderr: stderr.slice(0, 400),
            });
          });
        });
      })
      .on("error", (e) => {
        clearTimeout(timer);
        resolve({ host, ok: false, error: e.message });
      })
      .connect({
        host,
        port: 22,
        username: site.username,
        password: site.password,
        readyTimeout: 15000,
        algorithms: ALGOS,
      });
  });
}

const phoenixSftp = await probeSftp("phoenixpainting.ca", phoenix);
const flowbieSftp = await probeSftp("flowbie.ca", flowbie);

const phoenixInstall = phoenix.host.split(".")[0];
const flowbieInstall = flowbie.host.split(".")[0];
const sshHostsPhoenix = [
  `${phoenixInstall}.ssh.wpengine.net`,
  `${phoenixInstall}.ssh.wpengine.com`,
];
const sshHostsFlowbie = [
  `${flowbieInstall}.ssh.wpengine.net`,
  `${flowbieInstall}.ssh.wpengine.com`,
];

const phoenixSsh = [];
for (const h of sshHostsPhoenix) {
  phoenixSsh.push(await sshExec(h, phoenix, "wp --info && pwd"));
}
const flowbieSsh = [];
for (const h of sshHostsFlowbie) {
  flowbieSsh.push(await sshExec(h, flowbie, "wp --info && pwd"));
}

function summarize(probe) {
  const sql = probe.stats?.["./wp-content/mysql.sql"];
  return {
    label: probe.label,
    sftpOk: probe.ok,
    host: probe.host,
    user: probe.user,
    cwd: probe.cwd,
    error: probe.error,
    mysqlSql: sql,
    mysqlSqlMb: sql?.size != null ? mb(sql.size) : sql?.error,
    wpeprivate: probe.wpeprivate,
    wpContent: probe.wpContent,
    plugins: probe.plugins,
  };
}

console.log(
  JSON.stringify(
    {
      phoenix: summarize(phoenixSftp),
      flowbie: summarize(flowbieSftp),
      phoenixSsh,
      flowbieSsh,
    },
    null,
    2,
  ),
);
