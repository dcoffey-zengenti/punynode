// --- Constants ---

/** Highest positive signed 32-bit float value (2^31 - 1) */
const maxInt: number = 2147483647;

/** Bootstring parameters */
const base: number = 36;
const tMin: number = 1;
const tMax: number = 26;
const skew: number = 38;
const damp: number = 700;
const initialBias: number = 72;
const initialN: number = 128; // 0x80
const delimiter: string = '-'; // '\x2D'

/** Regular expressions */
const regexPunycode: RegExp = /^xn--/;
const regexNonASCII: RegExp = /[^\0-\x7F]/; // Non-ASCII chars
const regexSeparators: RegExp = /[\x2E\u3002\uFF0E\uFF61]/g; // Separators

/** Error messages */
const errors: Record<string, string> = {
    'overflow': 'Overflow: input needs wider integers to process',
    'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
    'invalid-input': 'Invalid input'
};

// --- Private utility functions ---

/**
 * Throws a RangeError with a specific error message.
 * @param {string} type The error type key.
 * @throws {RangeError}
 */
const error = (type: keyof typeof errors): never => {
    throw new RangeError(errors[type]);
};

/**
 * Converts a string of Unicode symbols to an array of their code points.
 * `Array.from` correctly handles surrogate pairs.
 * @param {string} str The string to decode.
 * @returns {number[]} An array of Unicode code points.
 */
const ucs2decode = (str: string): number[] => Array.from(str).map(char => char.codePointAt(0) ?? 0);

/**
 * Converts a basic code point into its numeric value.
 * @param {number} codePoint The basic code point.
 * @returns {number} The numeric value.
 */
const basicToDigit = (codePoint: number): number => {
    if (codePoint >= 0x30 && codePoint < 0x3A) { // 0-9
        return 26 + (codePoint - 0x30);
    }
    if (codePoint >= 0x41 && codePoint < 0x5B) { // A-Z
        return codePoint - 0x41;
    }
    if (codePoint >= 0x61 && codePoint < 0x7B) { // a-z
        return codePoint - 0x61;
    }
    return base;
};

/**
 * Converts a numeric value into a basic code point.
 * @param {number} digit The numeric value.
 * @param {boolean} flag Uppercase flag.
 * @returns {number} The basic code point.
 */
const digitToBasic = (digit: number, flag: boolean): number => {
    // 0-25 map to ASCII a-z or A-Z
    // 26-35 map to ASCII 0-9
    return digit + 22 + 75 * (digit < 26 ? 1 : 0) - ((flag ? 1 : 0) << 5);
};

/**
 * Bias adaptation function (RFC 3492 section 3.4).
 */
const adapt = (delta: number, numPoints: number, firstTime: boolean): number => {
    let k = 0;
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    const baseMinusTMin = base - tMin;

    for (; delta > (baseMinusTMin * tMax) >> 1; k += base) {
        delta = Math.floor(delta / baseMinusTMin);
    }

    return Math.floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};

// --- Core API ---

/**
 * Converts a Punycode string of ASCII-only symbols to a string of Unicode symbols.
 * @param {string} input The Punycode string.
 * @returns {string} The resulting Unicode string.
 */
export const decode = (input: string): string => {
    const output: number[] = [];
    const inputLength = input.length;
    let n: number = initialN;
    let i: number = 0;
    let bias: number = initialBias;

    let basic: number = input.lastIndexOf(delimiter);
    if (basic < 0) {
        basic = 0;
    }

    for (let j = 0; j < basic; ++j) {
        const charCode = input.charCodeAt(j);
        if (charCode >= 0x80) {
            error('not-basic');
        }
        output.push(charCode);
    }

    let index = basic > 0 ? basic + 1 : 0;
    while (index < inputLength) {
        const oldi = i;
        let w = 1;
        for (let k = base; ; k += base) {
            if (index >= inputLength) {
                error('invalid-input');
            }
            const digit = basicToDigit(input.charCodeAt(index++));
            if (digit >= base) {
                error('invalid-input');
            }
            if (digit > Math.floor((maxInt - i) / w)) {
                error('overflow');
            }

            i += digit * w;
            const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;

            if (digit < t) {
                break;
            }

            const baseMinusT = base - t;
            if (w > Math.floor(maxInt / baseMinusT)) {
                error('overflow');
            }
            w *= baseMinusT;
        }

        const out = output.length + 1;
        bias = adapt(i - oldi, out, oldi === 0);

        if (Math.floor(i / out) > maxInt - n) {
            error('overflow');
        }

        n += Math.floor(i / out);
        i %= out;
        output.splice(i++, 0, n);
    }

    return String.fromCodePoint(...output);
};

/**
 * Converts a string of Unicode symbols to a Punycode string of ASCII-only symbols.
 * @param {string} input The string of Unicode symbols.
 * @returns {string} The resulting Punycode string.
 */
export const encode = (input: string): string => {
    const codePoints = ucs2decode(input);
    const output: string[] = [];
    let n: number = initialN;
    let delta: number = 0;
    let bias: number = initialBias;

    // Handle the basic code points
    for (const codePoint of codePoints) {
        if (codePoint < 0x80) {
            output.push(String.fromCharCode(codePoint));
        }
    }

    const basicLength = output.length;
    let handledCPCount = basicLength;

    if (basicLength > 0) {
        output.push(delimiter);
    }

    while (handledCPCount < codePoints.length) {
        const m = codePoints.filter(cp => cp >= n).reduce((min, cp) => Math.min(min, cp), maxInt);
        const handledCPCountPlusOne = handledCPCount + 1;

        if (m - n > Math.floor((maxInt - delta) / handledCPCountPlusOne)) {
            error('overflow');
        }

        delta += (m - n) * handledCPCountPlusOne;
        n = m;

        for (const currentValue of codePoints) {
            if (currentValue < n) {
                if (++delta > maxInt) {
                    error('overflow');
                }
            }
            if (currentValue === n) {
                let q = delta;
                for (let k = base; ; k += base) {
                    const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                    if (q < t) {
                        break;
                    }
                    const qMinusT = q - t;
                    const baseMinusT = base - t;
                    output.push(String.fromCharCode(digitToBasic(t + qMinusT % baseMinusT, false)));
                    q = Math.floor(qMinusT / baseMinusT);
                }

                output.push(String.fromCharCode(digitToBasic(q, false)));
                bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
                delta = 0;
                ++handledCPCount;
            }
        }
        ++delta;
        ++n;
    }

    return output.join('');
};

/**
 * A utility function for mapping over domain name labels or email address parts.
 * @param {string} domain The domain name or email address.
 * @param {(label: string) => string} callback The function to apply to each label.
 * @returns {string} The processed string.
 */
const mapDomain = (domain: string, callback: (label: string) => string): string => {
    const parts = domain.split('@');
    let result = '';

    if (parts.length > 1) {
        result = `${parts[0]}@`;
        domain = parts[1];
    }
    
    const labels = domain.replace(regexSeparators, '\x2E').split('.');
    const encoded = labels.map(callback).join('.');
    
    return result + encoded;
};

/**
 * Converts a Punycode string representing a domain name or an email address to Unicode.
 * @param {string} input The Punycoded domain name or email address.
 * @returns {string} The Unicode representation.
 */
export const toUnicode = (input: string): string =>
    mapDomain(input, (str) =>
        regexPunycode.test(str) ? decode(str.slice(4).toLowerCase()) : str
    );

/**
 * Converts a Unicode string representing a domain name or an email address to Punycode.
 * @param {string} input The Unicode domain name or email address.
 * @returns {string} The Punycode representation.
 */
export const toASCII = (input: string): string =>
    mapDomain(input, (str) =>
        regexNonASCII.test(str) ? `xn--${encode(str)}` : str
    );

// --- Public API Export ---

export interface Ucs2 {
    decode: (str: string) => number[];
    encode: (codePoints: number[]) => string;
}

export interface PunycodeApi {
    ucs2: Ucs2;
    decode: (input: string) => string;
    encode: (input: string) => string;
    toASCII: (input: string) => string;
    toUnicode: (input: string) => string;
}

const punycode: PunycodeApi = {
    ucs2: {
        decode: ucs2decode,
        encode: (codePoints: number[]) => String.fromCodePoint(...codePoints),
    },
    decode,
    encode,
    toASCII,
    toUnicode,
};

export default punycode;