/** Load .env for local builds; set EXPO_PUBLIC_* in EAS Secrets for TestFlight/production. */
require('dotenv').config();

module.exports = ({ config }) => config;
