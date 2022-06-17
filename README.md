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
deno task run [args]
```

### Compile binaries

```bash
deno task compile
```
Will output binaries in `target` dir.

### To do

- [x] Parse non-JSON responses.
- [ ] Watch mode. Clear buffer correctly for selected services while watching.
- [ ] Docs.
- [ ] Build releases with GitHub Actions.
