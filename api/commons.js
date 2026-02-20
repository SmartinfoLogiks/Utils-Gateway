//All General Purpose Functions are defined here

const crypto = require('crypto');

module.exports = {

}

global._log = function(logLevel = 'info', ...logObject) {
  try {
    if(typeof console[logLevel] == "function") console[logLevel](...logObject);
    else console.log(...logObject);
  } catch(e) {
    console.error(e);
  }
}

global.generateId = function(size = 10) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError('Size must be a positive integer.');
  }

  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const alphabetLength = alphabet.length;

  // Rejection sampling: we only accept bytes < mask to keep modulo unbiased.
  const mask = 255 - (256 % alphabetLength);
  let id = '';

  // Loop until we have enough characters.
  // Each iteration pulls a batch of random bytes and consumes from it.
  while (id.length < size) {
    // Batch size can be tuned; using `size` is simple and usually enough.
    const bytes = crypto.randomBytes(size);

    for (let i = 0; i < bytes.length && id.length < size; i++) {
      const byte = bytes[i];

      if (byte >= mask) {
        // This would introduce bias, skip.
        continue;
      }

      const index = byte % alphabetLength;
      id += alphabet[index];
    }
  }

  return id;
}