# deno-vesync

API module and CLI tool for interacting with Vesync based WiFi outlets, written in TypeScript using Deno.

## Install

First install the only dependency [Deno](https://deno.land) and then run the following to install the CLI:

```sh
deno install --unstable --allow-env --allow-read --allow-write --allow-net='smartapi.vesync.com' 'https://deno.land/x/vesync@0.0.5/cli.ts'
```

## Usage

After installation, you can run the CLI.

First login with your VeSync account name (e-mail), this will prompt you for your password:

```sh
vesync login --account user@domain.tld
```

Next you can get a list of devices associated with your VeSync account by running the following:

```sh
vesync devices
```

You can turn on one of your devices by noting the desired deviceName from the previous listing of devices and running:

```sh
vesync status --device MY_DEVICE_NAME --value on
```

Or turn off the same device with:

```sh
vesync status --device MY_DEVICE_NAME --value off
```