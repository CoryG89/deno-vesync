/// <reference types="./types/vesync.d.ts" />

import { parse, crypto, ensureDir } from './deps.ts';
import { promptSecret } from './helpers/prompt-secret.ts';
import { login, devices, status } from './mod.ts';

const [command, ...restArgs] = Deno.args;
const args = parse(restArgs, {
    alias: {
        account: 'a',
        device: 'd'
    }
});

const cacheDir = Deno.env.get('XDG_CACHE_HOME') || `${Deno.env.get('HOME') || '~'}/.cache`;
const moduleCacheDir = `${cacheDir}/deno-vesync`;
const moduleCacheFile = `${moduleCacheDir}/config.json`;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

async function readConfig() {
    let config
    try {
        config = JSON.parse(decoder.decode(await Deno.readFile(moduleCacheFile)));
    } catch (_error) {
        console.error('Could not read cached login configuration. Please run login command.');
    }
    return config;
}

async function writeConfig(config: { account: string, password: string, devices?: Array<Device>}) {
    const encodedConfig = encoder.encode(JSON.stringify(config));
    await ensureDir(moduleCacheDir);
    await Deno.writeFile(moduleCacheFile, encodedConfig);
    console.log(`Configuration successfully cached at ${moduleCacheFile}`);
}

if (/^login$/i.test(command)) {
    const { account } = args;
    const password = await promptSecret('Please enter your password: ');

    const encodedPassword = encoder.encode(password);
    const digest = await crypto.subtle.digest('MD5', encodedPassword);
    const hash = Array.from(new Uint8Array(digest))
        .map(i => i.toString(16).padStart(2, '0'))
        .join('');

    const res = await login(account, hash);
    const { accountID, tk } = await res.json();
    if (!accountID || !tk || typeof accountID !== 'string' || typeof tk !== 'string') {
        console.error('Could not get account id and token from VeSync API');
        Deno.exit(1);
    }

    writeConfig({ account, password: hash });
} else if (/^devices$/i.test(command)) {
    const { account, password } = await readConfig();
    const loginResponse = await login(account, password);
    const { accountID, tk } = await loginResponse.json();
    const res = await devices(accountID, tk);
    const devicesList = await res.json();
    console.log('Got devices:', devicesList);

    writeConfig({ account, password, devices: devicesList });
} else if (/^(on|off)$/i.test(command)) {
    if (!args.device) {
        console.error('Must pass arg --device with device name');
        Deno.exit(1);
    }
    const { account, password, ...restConfig } = await readConfig();
    let { devices: devicesList } = restConfig;
    const loginResponse = await login(account, password);
    const { accountID, tk } = await loginResponse.json();

    if (!devicesList) {
        const res = await devices(accountID, tk);
        devicesList = await res.json();
    }

    const { cid: deviceId, deviceType } = devicesList && devicesList.find(({ deviceName } : Device) => deviceName === args.device);
    if (!deviceId || !deviceType || typeof deviceId !== 'string' || typeof deviceType !== 'string') {
        console.error(`Could not get device id or device type for device ${args.device}`);
        Deno.exit(1);
    }

    const res = await status(accountID, tk, deviceType, deviceId, command.toLowerCase());
    if (res.ok) {
        console.log('Device status updated successfully');
    }
}

