const crypto = require("crypto");

function generateLicenseKey() {
  const segment = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `LAI-${segment()}-${segment()}-${segment()}-${segment()}`;
}

function generateTempPassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = { generateLicenseKey, generateTempPassword, generateSecureToken };
