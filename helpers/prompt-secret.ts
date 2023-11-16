export async function promptSecret(message : string) : Promise<string> {
    const encoder = new TextEncoder();
	Deno.stdout.write(encoder.encode(message));
	Deno.stdin.setRaw(true);

	let input = '';
	while (true) {
		const data = new Uint8Array(1);
		const rawInput = await Deno.stdin.read(data);
		if (!rawInput) { break; }
		for (const char of new TextDecoder().decode(data.slice(0, rawInput))) {
			switch (char) {
				case '\u0003':
				case '\u0004': {
					Deno.stdin.setRaw(false);
                    Deno.stdout.write(encoder.encode('\n'));
					throw new Error('Could not get secret from prompt');
                }
				case '\r':
				case '\n': {
					Deno.stdin.setRaw(false);
                    Deno.stdout.write(encoder.encode('\n'));
					return input;
                }
				case '\u0008': {
					input = input.slice(0, input.length - 1);
					break;
                }
				default: {
					input += char;
					break;
                }
			}
		}
	}
    Deno.stdout.write(encoder.encode('\n'));
	throw new Error('Could not get secret from prompt');
}
