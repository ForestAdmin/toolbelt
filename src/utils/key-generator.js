class KeyGenerator {
  constructor({
    assertPresent,
    crypto,
  }) {
    assertPresent({
      crypto,
    });
    this.crypto = crypto;
  }

  generate() {
    return this.crypto.randomBytes(48).toString('hex');
  }
}

module.exports = KeyGenerator;
