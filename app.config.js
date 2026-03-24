const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    },
  },
};
