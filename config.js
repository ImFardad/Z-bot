require('dotenv').config();

const isCodespaces =
  process.env.CODESPACE_NAME &&
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const miniAppPort = 8081;

let miniAppUrl;

if (isCodespaces) {
  // Construct the URL dynamically for Codespaces
  miniAppUrl = `https://${process.env.CODESPACE_NAME}-${miniAppPort}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  console.log(
    `Codespaces environment detected. Mini App URL set to: ${miniAppUrl}`
  );
} else {
  // Fallback to .env file for local development
  miniAppUrl = process.env.MINI_APP_URL;
  if (miniAppUrl) {
    console.log(
      `Local environment detected. Mini App URL loaded from .env: ${miniAppUrl}`
    );
  } else {
    console.log('Warning: MINI_APP_URL not set in .env for local development.');
  }
}

module.exports = {
  token: process.env.TELEGRAM_TOKEN,
  adminId: process.env.ADMIN_USER_ID,
  miniAppUrl: miniAppUrl,
};
