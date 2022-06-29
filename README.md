# lbstatus

Command line tool for checking the deployed commit of various Lookback web services.

## Installing

### Prebuilt binaries

1. Grab the latest [release](https://github.com/lookback/lbstatus/releases) for your platform.
2. Rename it `lbstatus` and put it somewhere in your `PATH`.
   ```bash
   # Example
   $ mv ~/Downloads/lbstatus-aarch64-apple-darwin /usr/local/bin/lbstatus
   ```
### Using deno

1. Install [Deno](https://deno.land/#installation).
2. Install `lbstatus` from GitHub:

```bash
deno install \
    # Allow running as a CLI
    --allow-run \
    # Allow reading local config file
    --allow-read \
    # Allow HTTP calls
    --allow-net \
    # Preferred name as CLI program
    -n lbstatus \
    https://raw.githubusercontent.com/lookback/lbstatus/main/main.ts
```

Adjust the GitHub URL for another tag or hash version.

If upgrading `lbstatus` via this method, you might need to tack on `-r` switch to reload Deno's local cache.

## Options and arguments

```bash
lbstatus [-h/--help] [-w/--watch] [-l/--list] [environment] [service]
```

* `--watch` will check every 2 seconds and log when a new commit hash is detected in the service(s).
* `--list` prints all available services to check.
* `--help` shows usage help.
* `environment` defaults to "production".
* Use a `-` string for default: `lbstatus - lookback-ultron` will use "production" environment.

## Development

Requirements:

- [Deno](https://deno.land/#installation)

Install on Mac/Linux with:

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### Running

```bash
deno task run [args to main.ts]
```

### Compile binaries

```bash
./build
```
Will output binaries for all relevant platforms into `target` dir.

### To do

- [x] Parse non-JSON responses.
- [x] Watch mode.
- [x] Docs.
