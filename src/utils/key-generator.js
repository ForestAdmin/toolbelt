class KeyGenerator {
  constructor({ assertPresent, crypto }) {
    assertPresent({
      crypto,
    });
    this.crypto = crypto;
    this.length = 24;
  }

  generate() {
    return this.crypto.randomBytes(this.length).toString('hex');
  }
}

module.exports = KeyGenerator;
