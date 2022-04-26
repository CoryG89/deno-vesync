/// <reference types="./types/vesync.d.ts" />

import { parse, crypto, ensureDir } from './deps.ts';
import { promptSecret } from './helpers/prompt-secret.ts';
import { login, devices, status } from './mod.ts';

const [command, ...restArgs] = Deno.args;
const args = parse(restArgs, { string: ['account', 'device', 'value'] });

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

function writeConfig(config: { account: string, password: string, devices?: Array<Device>}) {
    const configString = JSON.stringify(config, null, 4);
    console.log(configString);
    return ensureDir(moduleCacheDir)
        .then(() => Deno.writeFile(moduleCacheFile, encoder.encode(configString)));
}

if (/^login$/i.test(command)) {
    const { account } = args;
    if (!account) {
        console.error('Must pass arg --account with VeSync account email');
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
        console.error(`Could not get account id/token from VeSync API for account ${account}`);
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
        console.error('Must pass arg --device with VeSync device name');
        Deno.exit(1);
    }
    if (!value || !/^(on|off)$/.test(value.toLowerCase())) {
        console.error('Must pass arg --value as one of \'on\' or \'off\'');
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
            console.error(`Could not get device id/type from VeSync API for device ${device}`);
            Deno.exit(1);
        }    
    }

    const deviceStatus = value.toLowerCase();
    const res = await status(accountID, tk, deviceType, deviceId, deviceStatus);
    if (res.ok) {
        await Deno.stderr.write(encoder.encode(`Successfully updated device ${device} (${deviceId}) with new status: ${deviceStatus}`));
    } else {
        console.error(`Failed to update ${device} (${deviceId}) with new status: ${deviceStatus}`);
        Deno.exit(1);
    }
}

