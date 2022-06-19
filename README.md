# lbstatus

Command line tool for checking the deployed commit at various Lookback web services.

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
