const app = require("../backend/mongoApp");

module.exports = (req, res) => {
  req.url = req.url.replace(/^\/api/, "") || "/";
  return app(req, res);
};
