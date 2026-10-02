module.exports = function (api) {
  api.cache(true);
  return {
    // zustand's ESM build reads import.meta.env, which a classic web script can't parse.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
