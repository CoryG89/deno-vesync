/// <reference types="./types/vesync.d.ts" />

import { parse, crypto, ensureDir } from './deps.ts';
import { promptSecret } from './helpers/prompt-secret.ts';
import { login, devices, status } from './mod.ts';

const [command, ...restArgs] = Deno.args;
const args = parse(restArgs, { string: ['account', 'device', 'value'], boolean: ['help'] });

const cacheDir = Deno.env.get('XDG_CACHE_HOME') || `${Deno.env.get('HOME') || '~'}/.cache`;
const moduleCacheDir = `${cacheDir}/deno-vesync`;
const moduleCacheFile = `${moduleCacheDir}/config.json`;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

function printUsage() {
    Deno.stderr.write(encoder.encode(
        '\nUsage:\n\nAccount Login)\n\n\tvesync-cli login --account <account>'
        + '\n\nDevice Listing)\n\n\tvesync-cli devices'
        + '\n\nUpdate Device)\n\n\tvesync-cli status --device <device> --value <on|off>\n\n'
    ));
}

async function readConfig() {
    let config
    try {
        config = JSON.parse(decoder.decode(await Deno.readFile(moduleCacheFile)));
    } catch (_error) {
        console.error('Could not read cached login configuration. Please run login command.');
    }
    return config;
}

function writeConfig(config: { account: string, password: string, devices?: Array<Device>}) {
    const configString = JSON.stringify(config, null, 4);
    console.log(configString);
    return ensureDir(moduleCacheDir)
        .then(() => Deno.writeFile(moduleCacheFile, encoder.encode(configString)));
}

if (args.help) {
    printUsage();
    Deno.exit(1);
}

if (/^login$/i.test(command)) {
    const { account } = args;
    if (!account) {
        Deno.stderr.write(encoder.encode('Error: Must pass argument --account with VeSync account email when logging in'));
        printUsage();
        Deno.exit(1);
    }
    const password = await promptSecret('Please enter your password: ');

    const encodedPassword = encoder.encode(password);
    const digest = await crypto.subtle.digest('MD5', encodedPassword);
    const hash = Array.from(new Uint8Array(digest))
        .map(i => i.toString(16).padStart(2, '0'))
        .join('');

    const res = await login(account, hash);
    const { accountID, tk } = await res.json();
    if (!accountID || !tk || typeof accountID !== 'string' || typeof tk !== 'string') {
        Deno.stderr.write(encoder.encode(`Error: Could not get account id/token from VeSync API for account ${account}`));
        Deno.exit(1);
    }

    await writeConfig({ account, password: hash });
    await Deno.stderr.write(encoder.encode(`Login config successfully saved to local cache: ${moduleCacheFile}`));
} else if (/^devices$/i.test(command)) {
    const config = await readConfig();
    const { account, password } = config;
    const loginResponse = await login(account, password);
    const { accountID, tk } = await loginResponse.json();
    const res = await devices(accountID, tk);
    config.devices = await res.json();
    await writeConfig(config);
    await Deno.stderr.write(encoder.encode(`Device config successfully saved to local cache: ${moduleCacheFile}`));
} else if (/^(status)$/i.test(command)) {
    const { device, value } = args;
    if (!device) {
        Deno.stderr.write(encoder.encode('Error: Must pass argument --device with VeSync device name to update device status'));
        printUsage();
        Deno.exit(1);
    }
    if (!value || !/^(on|off)$/.test(value.toLowerCase())) {
        Deno.stderr.write(encoder.encode('Error: Must pass argument --value as one of \'on\' or \'off\' to update device status'));
        printUsage();
        Deno.exit(1);
    }
    const config = await readConfig();
    const { account, password } = config;
    const { accountID, tk } = await (await login(account, password)).json();

    let { cid: deviceId, deviceType } = config.devices && config.devices.find(({ deviceName } : Device) => deviceName === device);
    if (!deviceId || !deviceType || typeof deviceId !== 'string' || typeof deviceType !== 'string') {
        const res = await devices(accountID, tk);
        config.devices = await res.json();
        await writeConfig(config);
        await Deno.stderr.write(encoder.encode(`Device config successfully saved to local cache: ${moduleCacheFile}`));

        ({ cid: deviceId, deviceType } = config.devices && config.devices.find(({ deviceName } : Device) => deviceName === device));
        if (!deviceId || !deviceType || typeof deviceId !== 'string' || typeof deviceType !== 'string') {
            Deno.stderr.write(encoder.encode(`Error: Could not get device id/type from VeSync API for device ${device}`));
            Deno.exit(1);
        }
    }

    const deviceStatus = value.toLowerCase();
    const res = await status(accountID, tk, deviceType, deviceId, deviceStatus);
    if (res.ok) {
        Deno.stderr.write(encoder.encode(`Successfully updated device ${device} (${deviceId}) with new status: ${deviceStatus}`));
    } else {
        Deno.stderr.write(encoder.encode(`Error: Failed to update ${device} (${deviceId}) with new status: ${deviceStatus}`));
        Deno.exit(1);
    }
} else {
    printUsage();
    Deno.exit(1);
}
