const app = require("../backend/mongoApp");

module.exports = (req, res) => {
  const originalUrl = req.url || "/";
  req.url = originalUrl.replace(/^\/api(?:\/index\.js)?/, "") || "/";

  if (!req.url.startsWith("/")) {
    req.url = `/${req.url}`;
  }

  return app(req, res);
};
