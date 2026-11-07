# Local verification runtime (this workstation only)

The normal portable checkout workflow is in README. This note records the temporary fallback used on 2026-11-06 when Docker Desktop's Linux engine could not start. These binaries/data are not part of source control and are not required when using Compose.

From `C:\my-projects\DigiTuck` in PowerShell:

```powershell
# Use the downloaded official Node 24.22.2 for this terminal only.
$env:PATH = (Join-Path (Get-Location) '.git') + ';' + $env:PATH
node --version
```

The existing native MySQL data directory has already been initialized and passwords configured. **Do not initialize it again.** If port 3307 is no longer listening, restart it using:

```powershell
Start-Process -FilePath 'C:\my-projects\DigiTuck\.git\mysql-runtime\mysql-8.4.13-winx64\bin\mysqld.exe' -ArgumentList '--no-defaults','--basedir=C:/my-projects/DigiTuck/.git/mysql-runtime/mysql-8.4.13-winx64','--datadir=C:/my-projects/DigiTuck/.git/mysql-data','--port=3307','--bind-address=127.0.0.1','--mysqlx=0','--default-time-zone=+00:00','--log-bin-trust-function-creators=ON','--console' -WindowStyle Hidden -RedirectStandardOutput 'C:\my-projects\DigiTuck\.git\mysql-out.log' -RedirectStandardError 'C:\my-projects\DigiTuck\.git\mysql-error.log'
npm run db:check
npm run dev
```

Root `.env` contains generated local credentials and separate `digituck` / `digituck_test` connections on port 3307. It is ignored. Do not print it or replace it with example placeholders unless deliberately rebuilding the local environment. The README Docker example uses port 3308 for its independent test container.

For a graceful database shutdown, invoke the official `mysqladmin.exe` from the same runtime directory with `--host=127.0.0.1 --port=3307 --user=root --password shutdown`, entering the local root secret at the prompt. Do not include the password in command arguments. Stop the app with Ctrl+C first. Do not start Docker MySQL on the same port while this native instance is running.

The downloaded MySQL ZIP was `https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip`; its MD5 matched the [official Windows download listing](https://dev.mysql.com/downloads/mysql/8.4.html?os=3). Node came from `https://nodejs.org/dist/v24.22.2/win-x64/node.exe`. Runtime files remain local; no service was installed or cloud resources provisioned.

Git history is a separate limitation: connector access works, local credential-manager authentication does not. Preserve this working directory when restoring Git access; reconcile the remote's specification history before making commits or pushing. Do not force-push a new root commit over the existing repository.
