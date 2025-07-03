import {
	decode,
	encode,
	default as punynode,
	toASCII,
	toUnicode,
} from "../punynode.js";

describe("punynode", () => {
	test("should preserve an empty string", () => {
		expect(encode("")).toEqual("");
		expect(decode("")).toEqual("");
	});

	test("should convert a hyphen to double hyphen", () => {
		expect(encode("-")).toEqual("--");
		expect(decode("--")).toEqual("-");
	});

	test("should convert hyphen+letter to hyphen+letter+hyphen", () => {
		for (let c = 97; c <= 122; c++) {
			// a-z
			const letter = String.fromCharCode(c);
			const encoded = encode("-" + letter);
			expect(encoded).toEqual(`-${letter}-`);
			expect(decode(encoded)).toEqual(`-${letter}`);
		}
	});

	test("should encode and decode ASCII letters", () => {
		for (let c = 65; c <= 90; c++) {
			// A-Z
			const letter = String.fromCharCode(c);
			expect(decode(encode(letter))).toEqual(letter);
		}
		for (let c = 97; c <= 122; c++) {
			// a-z
			const letter = String.fromCharCode(c);
			expect(decode(encode(letter))).toEqual(letter);
		}
	});

	test("should encode and decode numbers", () => {
		for (let n = 0; n <= 9; n++) {
			const num = n.toString();
			expect(decode(encode(num))).toEqual(num);
		}
	});

	test("should encode and decode mixed strings", () => {
		const samples = [
			"hello",
			"world-123",
			"foo-bar",
			"puny--node",
			"a-b-c",
			"--",
			"-a-b-",
			"test--case",
			"123-abc",
			"hyphen-",
			"-hyphen",
			"multi--hyphen",
			"ends-with--",
			"--starts-with",
			"a--b--c",
		];
		for (const s of samples) {
			expect(decode(encode(s))).toEqual(s);
		}
	});

	test("should handle unicode and non-ASCII characters", () => {
		const samples = [
			"你好",
			"café",
			"mañana",
			"über",
			"façade",
			"crème-brûlée",
			"😀",
			"𝔘𝔫𝔦𝔠𝔬𝔡𝔢",
			"emoji-😀",
			"hyphén-é",
			"♡.com",
		];
		for (const s of samples) {
			expect(decode(encode(s))).toEqual(s);
		}
	});

	test("should throw or handle invalid encoded input gracefully", () => {
		const invalids = [
			"-", // single hyphen
			"---", // triple hyphen
			"-a--", // ambiguous
			"a--b-", // ambiguous
			"--a", // double hyphen at start
			"a--", // double hyphen at end
		];
		for (const s of invalids) {
			try {
				decode(s);
			} catch (e) {
				expect(e).toBeInstanceOf(Error);
			}
		}
	});

	test("toASCII should convert Unicode domains/emails to Punycode", () => {
		const cases = [
			{ input: "mañana.com", output: "xn--maana-pta.com" },
			{ input: "bücher.de", output: "xn--bcher-kva.de" },
			{ input: "xn--bcher-kva.de", output: "xn--bcher-kva.de" }, // already ASCII
			{ input: "user@façade.com", output: "user@xn--faade-zra.com" },
			{ input: "emoji-😀.com", output: "xn--emoji--8v74e.com" },
			{ input: "你好.com", output: "xn--6qq79v.com" },
			{ input: "example.com", output: "example.com" }, // pure ASCII
			{ input: "xn--6qq79v.com", output: "xn--6qq79v.com" }, // already punycode
		];
		for (const { input, output } of cases) {
			expect(toASCII(input)).toEqual(output);
		}
	});

	test("toUnicode should convert Punycode domains/emails to Unicode", () => {
		const cases = [
			{ input: "xn--maana-pta.com", output: "mañana.com" },
			{ input: "xn--bcher-kva.de", output: "bücher.de" },
			{ input: "bücher.de", output: "bücher.de" }, // already Unicode
			{ input: "user@xn--faade-zra.com", output: "user@façade.com" },
			{ input: "xn--emoji--8v74e.com", output: "emoji-😀.com" },
			{ input: "xn--6qq79v.com", output: "你好.com" },
			{ input: "example.com", output: "example.com" }, // pure ASCII
		];
		for (const { input, output } of cases) {
			expect(toUnicode(input)).toEqual(output);
		}
	});

	test("ucs2.encode should encode array of code points to string", () => {
		expect(punynode.ucs2.encode([0x61, 0x62, 0x63])).toEqual("abc");
		expect(punynode.ucs2.encode([0x1f600])).toEqual("😀");
		expect(punynode.ucs2.encode([0x2661, 0x2e, 0x63, 0x6f, 0x6d])).toEqual(
			"♡.com",
		);
		expect(punynode.ucs2.encode([0x4f60, 0x597d])).toEqual("你好");
	});

	test("ucs2.decode should decode string to array of code points", () => {
		expect(punynode.ucs2.decode("abc")).toEqual([0x61, 0x62, 0x63]);
		expect(punynode.ucs2.decode("😀")).toEqual([0x1f600]);
		expect(punynode.ucs2.decode("♡.com")).toEqual([
			0x2661, 0x2e, 0x63, 0x6f, 0x6d,
		]);
		expect(punynode.ucs2.decode("你好")).toEqual([0x4f60, 0x597d]);
	});
});
