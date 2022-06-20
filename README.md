# lbstatus

Command line tool for checking the deployed commit of various Lookback web services.

## Installing

1. Grab the latest [release](https://github.com/lookback/lbstatus/releases) for your platform.
2. Rename it `lbstatus` and put it somewhere in your `PATH`.
   ```bash
   # Example
   $ mv ~/Downloads/lbstatus-aarch64-apple-darwin /usr/local/bin/lbstatus
   ```

## Options and arguments

TO DO.

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
- [ ] Docs.
- [x] Build releases with GitHub Actions.
