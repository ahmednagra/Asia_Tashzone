const { AndroidConfig, withAndroidManifest, withStringsXml } = require('@expo/config-plugins');

const META_KEY = 'com.google.android.gms.games.APP_ID';
const STRING_NAME = 'game_services_project_id';

function playGamesAppId() {
  const id = (process.env.PLAY_GAMES_APP_ID ?? '').trim();
  if (id && !/^\d{6,20}$/.test(id)) throw new Error(`with-play-games: PLAY_GAMES_APP_ID must be the numeric Play Games project id, got "${id}"`);
  return id;
}

module.exports = function withPlayGames(config) {
  const id = playGamesAppId();
  if (!id) return config;
  const withString = withStringsXml(config, (cfg) => {
    cfg.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: STRING_NAME, translatable: 'false' }, _: id }],
      cfg.modResults,
    );
    return cfg;
  });
  return withAndroidManifest(withString, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, META_KEY, `@string/${STRING_NAME}`);
    return cfg;
  });
};

module.exports.playGamesAppId = playGamesAppId;
