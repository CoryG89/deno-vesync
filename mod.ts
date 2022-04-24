const BASE_URL = 'https://smartapi.vesync.com';

export function login(account: string, password: string) {
    return fetch(`${BASE_URL}/vold/user/login`, {
        method: 'POST',
        body: JSON.stringify({ account, password, devToken: '' })
    });
}

export function devices(accountId: string, token: string) {
    return fetch(`${BASE_URL}/vold/user/devices`, {
        method: 'GET',
        headers: {
            accountid: accountId,
            tk: token
        }
    });
}

export function status(accountId: string, token: string, deviceType: string, deviceId: string, value: string) {
    return fetch(`${BASE_URL}/v1/${deviceType}/${deviceId}/status/${value}`, {
        method: 'PUT',
        headers: {
            accountid: accountId,
            tk: token
        }
    });
}