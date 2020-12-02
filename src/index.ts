import * as core from '@actions/core';
import * as github from '@actions/github';
import { Webhooks } from '@octokit/webhooks';

const fragments = ['major', 'feature', 'bug'];
const types = ['beta', 'alpha'];

function versionRegex() {
    const prefix = core.getInput('prefix');
    return new RegExp(`${prefix}(\\d+)\\.(\\d+)\\.(\\d+)`);
}

async function getReleaseType() {
    const labels = getLabels();

    return labels
        .filter(l => types.includes(l))
        .sort(l => types.indexOf(l))
        .reverse()[0] ?? 'release';
}

async function findLastVersion(): Promise<string | undefined> {
    const token = core.getInput('token');

    const { data } = await github.getOctokit(token).repos.listTags({ ...github.context.repo });
    console.log('Found tags', data.map(t => t.name))

    const regex = versionRegex();
    const versions = data.map(t => t.name.match(regex)).filter(v => !!v) as RegExpMatchArray[];

    const s = (a: RegExpMatchArray) => {
        const [, m, r, b] = a.map(v => Number.parseInt(v));
        return m * 1000000 + r * 1000 + b
    };
    const latest = versions.sort((a, b) => s(a) - s(b))[0];

    return data[versions.indexOf(latest)]?.name;
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

function getLabels(): string[] {
    const { eventName } = github.context;

    switch (eventName) {
        case 'pull_request': {
            console.log('Triggered on pull request');
            const payload = github.context.payload as Webhooks.WebhookPayloadPullRequest;
            return payload.pull_request.labels.map(l => l.name);
        }
        case 'repository_dispatch': {
            console.log('Triggered on repository dispatch');
            const { client_payload } = github.context.payload as any;
            return [client_payload.fragment, client_payload.type].filter(l => !!l);
        }
        default: return [];
    }
}

function findFragment() {
    const labels = getLabels();

    return labels
        .filter(l => fragments.includes(l))
        .sort(l => fragments.indexOf(l))
        .reverse()[0];
}

async function lastVersion() {
    const input = core.getInput('last-version');
    if(input) return input;
    else return findLastVersion();
}

async function run() {

    const last_version = await lastVersion();

    if (last_version) {
        const fragment = findFragment() ?? core.getInput('default-fragment')
        console.log('Using version fragment', fragment)
        console.log('Found last version', last_version)
        const next = increment(last_version, fragment);
        core.setOutput('next', next)
    } else {
        const prefix = core.getInput('prefix');
        const fallback = core.getInput('fallback') || `${prefix}1.0.0`
        console.log('Did not find last version, using fallback', fallback)
        if (!versionRegex().test(fallback)) throw new Error(`Fallback '${fallback}' is not a valid version`)
        core.setOutput('next', fallback);
    }

    const type = getReleaseType();
    console.log(`Using release type '${type}'`)
    core.setOutput("type", type);

}

run().catch(e => core.setFailed(e.message));