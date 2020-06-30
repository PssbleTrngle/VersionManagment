import * as core from '@actions/core';
import * as github from '@actions/github';
import { Webhooks } from '@octokit/webhooks'

const fragments = ['major', 'release', 'bug'];

function versionRegex() {
    const prefix = core.getInput('prefix');
    return new RegExp(`${prefix}(\\d+)\\.(\\d+)\\.(\\d+)`);
}

async function findLastVersion() {
    const token = core.getInput('token');

    const { data } = await github.getOctokit(token).repos.listTags({ ...github.context.repo });

    const regex = versionRegex();
    const versions = data.map(t => t.name.match(regex)).filter(v => !!v) as RegExpMatchArray[];

    const s = (a: RegExpMatchArray) => {
        const [, m, r, b] = a.map(v => Number.parseInt(v));
        return m * 1000000 + r * 1000 + b
    };
    const latest = versions.sort((a, b) => s(a) - s(b))[0];

    return data[versions.indexOf(latest)].name;
}

function increment(version: string, by: string) {
    const match = version.match(versionRegex())
    const prefix = core.getInput('prefix');

    if (!match) throw new Error(`'${version}' is not a valid version`)

    const inc = fragments.indexOf(by);
    if (inc < 0) throw new Error(`'${by} is not a valid fragment`)
    const v = match.slice(1, match.length).map(d => Number.parseInt(d));

    const incremented = v.map((n, i) => {
        if (i === inc) return n + 1;
        if (i > inc) return 0;
        else return n;
    })

    return prefix + incremented.join('.');
}

function findFragment() {
    const { eventName } = github.context;

    const labels = (() => {
        switch (eventName) {
            case 'pull_request': {
                console.log('Triggered on pull request');
                const payload = github.context.payload as Webhooks.WebhookPayloadPullRequest;
                return payload.pull_request.labels.map(l => l.name);
            }
            case 'repository_dispatch': {
                console.log('Triggered on repository dispatch');
                const { client_payload } = github.context.payload as any;
                return [client_payload.fragment];
            }
        }
    })() ?? [];

    console.log('Found possible fragments', labels)

    return labels
        .filter(l => fragments.includes(l))
        .sort(l => fragments.indexOf(l))
        .reverse()[0];
}

async function run() {

    const last_version = core.getInput('last-version') ?? await findLastVersion();

    if (last_version) {
        const fragment = findFragment() ?? core.getInput('default-fragment')
        console.log('Using version fragment', fragment)
        console.log('Found last version', last_version)
        const next = increment(last_version, fragment);
        core.setOutput('next', next)
    } else {
        const fallback = core.getInput('fallback')
        console.log('Did not find last version, using fallback', fallback)
        if (!versionRegex().test(fallback)) throw new Error(`Fallback '${fallback}' is not a valid version`)
        core.setOutput('next', fallback);
    }

}

run().catch(e => core.setFailed(e.message));