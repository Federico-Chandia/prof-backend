// Middleware para agregar io a req
module.exports = (io) => {
  return (req, res, next) => {
    req.io = io;
    next();
  };
};
