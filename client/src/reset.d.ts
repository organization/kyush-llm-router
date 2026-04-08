// Activate ts-reset's improved built-in types globally for the client.
// See https://www.totaltypescript.com/ts-reset for the rules this enables —
// it sharpens types like `JSON.parse`, `Array.prototype.filter`, `fetch`,
// `Object.entries`, etc., so we don't need to widen them with manual casts.
import '@total-typescript/ts-reset';
