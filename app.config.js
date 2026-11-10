// Two installs of the same app from one codebase, each pointing at its own
// Firebase project:
//   masajista — the masseur's real app     (Firebase: massagebook-terapeuta)
//   mio       — my portfolio/demo copy     (Firebase: massagebook-639a4)
// APP_VARIANT picks one. Locally it's written to .env by
// `npm run use:masajista` / `npm run use:mio`; on EAS each build profile in
// eas.json sets it. Different package names let both be installed on the
// same phone. app.json holds everything the two share.
const fs = require('node:fs');
const path = require('node:path');

const VARIANTS = {
  masajista: { name: 'MassageBook', androidPackage: 'io.github.ruuby666.massagebook' },
  mio: { name: 'MassageBook Demo', androidPackage: 'io.github.ruuby666.massagebook.demo' },
};

// Each Firebase project has its own google-services.json (needed for push
// on Android). EAS builds get it from the GOOGLE_SERVICES_JSON file env
// var; locally it's google-services.<variant>.json in the project root.
function googleServicesFile(variantName) {
  if (process.env.GOOGLE_SERVICES_JSON) return process.env.GOOGLE_SERVICES_JSON;
  const local = `./google-services.${variantName}.json`;
  return fs.existsSync(path.join(__dirname, local)) ? local : undefined;
}

module.exports = ({ config }) => {
  // Defaults to the demo so a build never ends up as the therapist's app
  // by accident.
  const variantName = process.env.APP_VARIANT || 'mio';
  const variant = VARIANTS[variantName];
  if (!variant) {
    throw new Error(
      `Unknown APP_VARIANT "${variantName}". Expected one of: ${Object.keys(VARIANTS).join(', ')}.`
    );
  }

  return {
    ...config,
    name: variant.name,
    android: {
      ...config.android,
      package: variant.androidPackage,
      googleServicesFile: googleServicesFile(variantName),
    },
    extra: { ...config.extra, appVariant: variantName },
  };
};
