/**
 * Specimen papers for the portal's "Use a sample": an ID (passport or ID card), a selfie and a
 * proof of address, clean or flawed, for Camille Rousseau, the demo's applicant. Flawed: the ID's
 * surname is misspelt, the selfie shows another face, the bill is addressed to someone else.
 */
const fs = require('fs');
const path = require('path');

const FILES = {
  passport: 'passport',
  national_id: 'carte_identite',
  selfie: 'selfie',
  address: 'facture_edf',
};

/** One sample: { buffer, name } (a PDF). The identity typed in the portal is not drawn on it. */
function sample(kind, person, flawed) {
  const base = FILES[kind];
  if (!base) throw Object.assign(new Error(`No sample of kind ${kind}`), { status: 400 });
  const name = `${base}${flawed ? '_flawed' : ''}.pdf`;

  return { buffer: fs.readFileSync(path.join(__dirname, 'samples', name)), name };
}

module.exports = { sample };
