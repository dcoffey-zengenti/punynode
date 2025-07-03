# punynode

An ES6/TypeScript port of [punycode.js](https://github.com/bestiejs/punycode.js), providing robust Punycode and IDNA (Internationalized Domain Names in Applications) support for Node.js and browser environments.

## Features

- Encode and decode Punycode strings
- Convert Unicode domain names and email addresses to ASCII (Punycode) and back
- UCS-2 encoding/decoding utilities

## Installation

You can install `punynode` using your favorite package manager:

### npm
```sh
npm install punynode
```

### yarn
```sh
yarn add punynode
```

### pnpm
```sh
pnpm add punynode
```

## Usage

### Importing

```js
// ES6/TypeScript
import { encode, decode, toASCII, toUnicode, default as punynode } from 'punynode';
```

### API

#### encode(input: string): string
Encodes a Unicode string to Punycode.

#### decode(input: string): string
Decodes a Punycode string to Unicode.

#### toASCII(domain: string): string
Converts a Unicode domain name or email address to ASCII (Punycode). Only the non-ASCII parts are converted.

#### toUnicode(domain: string): string
Converts a Punycode domain name or email address to Unicode. Only the Punycode parts are converted.

#### punynode.ucs2.encode(codePoints: number[]): string
Creates a string from an array of Unicode code points.

#### punynode.ucs2.decode(string: string): number[]
Splits a string into an array of Unicode code points.

### Examples

```js
import { encode, decode, toASCII, toUnicode, default as punynode } from 'punynode';

encode('mañana'); // 'maana-pta'
decode('maana-pta'); // 'mañana'
toASCII('mañana.com'); // 'xn--maana-pta.com'
toUnicode('xn--maana-pta.com'); // 'mañana.com'
punynode.ucs2.encode([0x1F600]); // '😀'
punynode.ucs2.decode('😀'); // [0x1F600]
```

## License

MIT