import { colors, flags, path } from './deps.ts';
import { VERSION } from './version.ts';

const isPiped = !Deno.isatty(1);

if (isPiped) colors.setColorEnabled(false);

const usage = () => {
    console.log(`lbstatus ${VERSION}
=========
A tool for getting an overview of deployed commits in Lookback's micro services.

USAGE
-----

  lbstatus [-h/--help] [-w/--watch] [-l/--list] [-b/--bootstrap] [environment] [service]

EXAMPLES
--------

$ lbstatus testing
$ lbstatus testing lookback-ultron

* Note that the "service" argument is the name of the GitHub repo.
* "environment" argument is usually "testing | production".
* "environment" defaults to "production".
* Use "-" string for default: "lbstatus - lookback-ultron" will use "production".

If you have the GitHub CLI installed ("gh"), the output will be enriched with
commit messages for each service.

SERVICES
--------
The list of services (the name of their GitHub repositories) checked is:

* player
* dashboard
* settings
* zodiac
* nebula
* que
* umar
* lookback-participate-web
* lookback-ultron

Use the --list option to print the definite list of services checked.

You can provide your own custom list by creating a file .lbstatus in your $HOME
directory, where the keys are services and values are URLs:

$ cat ~/.lbstatus
player=https://$domain.$tld/play

Do NOT add the full URL to the /ping endpoint – we'll handle that.

In the URL string, we will replace:

* $domain with "lookback" or "$env.lookback".
* $tld with ".com" or ".io".
* $svcDomain with "svc.$env.lookback".

where $env is the "environment" argument to lbstatus.

To boostrap a ~/.lbstatus file run:
$ lbstatus -l -b > ~/.lbstatus
`);
};

const SERVICES_LOC = (() => {
    let home = Deno.env.get('HOME');
    if (!home) return null;

    return path.join(home, '.lbstatus');
})();
const PING_ENDPOINT = '/ping';

const HARDCODED_SERVICES = {
    player: 'https://$domain.$tld/play',
    dashboard: 'https://$domain.$tld/org',
    settings: 'https://$domain.$tld/settings',
    zodiac: 'https://auth.$domain.$tld',
    'lookback-ultron': 'https://graph.$svc_domain.$tld',
    nebula: 'https://join.$domain.$tld/session',
    'lookback-participate-web': 'https://participate.$domain.$tld',
    que: 'https://que.$domain.$tld',
    umar: 'https://umar-segment.$svc_domain.$tld',
};

interface Args {
    environment?: string;
    service?: string;
    watch: boolean;
    help: boolean;
    list: boolean;
    bootstrap: boolean;
}

const run = async (args: Args) => {
    if (args.help) {
        usage();
        Deno.exit(0);
    }

    const allServices = await getServices();

    if (args.list) {
        listServices(allServices, args.bootstrap);
        Deno.exit(0);
    }

    const env = args.environment ?? 'production';

    const todo = (() => {
        if (args.service) {
            if (!allServices[args.service]) {
                return crash(`"${args.service}" isn't a service we know. Currently got:

${Object.keys(allServices).map((s) => `* ${s}`).join('\n')}`);
            }

            return { [args.service]: allServices[args.service] };
        }

        return allServices;
    })();

    const doRun = () =>
        Promise.allSettled(
            Object.entries(todo).map(([service, url]) => fetchStatus(service, url, env)),
            // Deno still shows status as "fulfilled" even for rejected promises :O
        ).then((res) => res.map((r) => (r as PromiseFulfilledResult<Result>).value));

    const print = (results: Result[]) => {
        const out = results.map((res): string => {
            const prefix = colors.dim('[' + formatTime(new Date()) + '] ');

            switch (res.kind) {
                case 'success':
                    return prefix + colors.green(`${res.service.padEnd(30)}`) +
                        ' ' +
                        env +
                        (res.gitHash ? ' ' + colors.cyan(res.gitHash.substring(0, 8)) : '') +
                        ' ' +
                        (res.commit ? colors.blue(formatCommit(res.commit).padEnd(65)) : '') +
                        colors.dim(
                            `uptime: ${res.uptime ? humanTimeOf(res.uptime) : '-'}`,
                        );
                case 'err':
                    return prefix + colors.red(`%c${res.service.padEnd(10)}\t${res.msg}`);
            }
        });

        console.log(out.join('\n'));
    };

    if (args.watch) {
        const prevHashes: Record<string, string | null> = {};
        let first = true;

        while (1) {
            const results = await doRun();

            const diff: Result[] = [];

            for (const res of results) {
                const hash = (res.kind == 'success' ? res.gitHash : null) ?? null;
                if (prevHashes[res.service] != hash) {
                    diff.push(res);
                    prevHashes[res.service] = hash;
                }
            }

            if (diff.length > 0) {
                if (!first) sep();
                print(diff);
                first = false;
            }

            await sleep(2000);
        }
    } else {
        print(await doRun());
    }
};

const sep = () =>
    console.log(
        colors.dim(
            '------------------------------------------------------------------------------------------------------------------------------------',
        ),
    );

interface Err {
    kind: 'err';
    service: string;
    msg: string;
}

interface Success {
    kind: 'success';
    service: string;
    gitHash?: string;
    uptime?: number;
    commit?: Commit;
}

type Result = Err | Success;

const fetchStatus = async (service: string, url: string, env: string): Promise<Result> => {
    try {
        const res = await fetch(mkUrl(url, env));

        if (!res.ok || res.status != 200) {
            return {
                kind: 'err',
                service,
                msg: `Service responded with status: ${res.status} ${res.statusText}`,
            };
        }

        const contentType = res.headers.get('content-type')?.split(';')[0] ?? 'text/plain';

        const { version, uptime } =
            await (async (): Promise<{ version?: string; uptime?: number }> => {
                switch (contentType) {
                    case 'application/json':
                        return res.json();
                    case 'text/plain':
                    default: {
                        const body = await res.text();
                        const version = body.match(/\b([a-f0-9]{5,40})\b/)?.[0];
                        return { version };
                    }
                }
            })();

        const commit = version ? await fetchCommit(service, version) : undefined;

        return {
            kind: 'success',
            service,
            gitHash: version,
            uptime,
            commit: commit ?? undefined,
        };
    } catch (err) {
        return {
            kind: 'err',
            service,
            msg: err.message,
        };
    }
};

const mkUrl = (url: string, env: string) => {
    const tld = env == 'testing' ? 'com' : 'io';
    // $service.testing.lookback.com, ...
    const domain = env == 'production' ? 'lookback' : `${env}.lookback`;
    // $service.svc.testing.lookback.com, ...
    const svcDomain = `svc.${env}.lookback`;

    return url
        .replace('$tld', tld)
        .replace('$svc_domain', svcDomain)
        .replace(
            '$domain',
            domain,
        ) + PING_ENDPOINT;
};

interface Commit {
    message: string;
    author: {
        name: string;
    };
}

const fetchCommit = async (service: string, gitHash: string): Promise<Commit | null> => {
    try {
        const proc = Deno.run({
            cmd: [
                'gh',
                'api',
                '-HAccept: application/vnd.github.v3.raw+json',
                `/repos/lookback/${service}/commits/${gitHash}`,
            ],
            stdout: 'piped',
            stderr: 'piped',
        });

        const { code } = await proc.status();
        const output = await proc.output();
        const err = await proc.stderrOutput();

        if (code == 0) {
            const json = JSON.parse(new TextDecoder().decode(output));
            return json.commit;
        }

        const decodedErr = new TextDecoder().decode(err);

        return crash(
            `Could not fetch commit via gh for service: ${service}`,
            new Error(decodedErr),
        );
    } catch (ex) {
        // if gh isn't installed, this is a no-op:
        if (ex.message.includes('No such file or directory')) return null;

        return crash(
            `Exception when fetching commit via gh for service: ${service}`,
            ex,
        );
    }
};

const sleep = (ms: number) => new Promise((rs) => setTimeout(rs, ms));

const parseArgs = (args: Array<string>): Args => {
    const { _, help, watch, list, bootstrap } = flags.parse(args, {
        alias: {
            help: 'h',
            watch: 'w',
            list: 'l',
            bootstrap: 'b',
        },
    });

    // "-" means default
    const get = (idx: number) => !_[idx] || _[idx] == '-' ? undefined : String(_[idx]);

    const environment = get(0);
    const service = get(1);

    return {
        environment,
        service,
        watch,
        help,
        list,
        bootstrap,
    };
};

const getServices = (): Promise<Record<string, string>> => {
    if (!SERVICES_LOC) {
        return Promise.resolve(HARDCODED_SERVICES);
    }

    return Deno.readTextFile(SERVICES_LOC)
        .then((text) =>
            // array pairs to dict
            Object.assign(
                {},
                ...text.split('\n').map((line) => line.trim()).filter((line) =>
                    !line.startsWith('#') && line.length > 0
                ).map((line) => {
                    const [service, url] = line.split('=');
                    return { [service.trim()]: url.trim() };
                }),
            )
        )
        .catch((err) => {
            if (err instanceof Deno.errors.NotFound) {
                return HARDCODED_SERVICES;
            }

            crash(`Error when reading ${SERVICES_LOC}:`, err);
        });
};

const listServices = (
    services: Record<string, string>,
    configCompatible?: boolean,
) => {
    for (const [name, url] of Object.entries(services)) {
        if (configCompatible) {
            console.log(`${name}=${url}`);
        } else {
            console.log(`${name.padEnd(30)} ${colors.dim(url)}`);
        }
    }
};

// Kick it off

run(parseArgs(Deno.args)).catch((err) => crash('Error when running lbstatus:', err));

// Small helpers

const crash = (msg: string, err?: Error): never => {
    console.error(`%c${msg}`, 'color: red');
    console.error(err);
    Deno.exit(1);
};

const humanTimeOf = (sec: number): string => {
    if (sec < 60) return `${sec}s`;
    if (sec < 60 * 60) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    if (sec < 60 * 60 * 24) {
        return `${Math.floor(sec / 60 / 60)}h ${Math.floor((sec / 60) % 60)}m`;
    }

    return `${Math.floor(sec / 60 / 60 / 24)}d`;
};

const formatCommit = (commit: Commit): string => {
    const msg = truncate(commit.message.split('\n')[0], 60);
    const author = initials(commit.author.name).toLowerCase();
    return `${author}: ${msg}`;
};

const formatter = new Intl.DateTimeFormat(undefined, {
    timeStyle: 'medium',
});

const formatTime = (d: Date): string => formatter.format(d);

const truncate = (s: string, max: number) => s.length > max ? s.substring(0, max - 1) + '…' : s;
const initials = (s: string) => s.split(' ').map((st) => st[0]).join('');
