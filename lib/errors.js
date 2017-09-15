const appError = (message, status, context) => {
  const error = new Error(message);
  error.status = status;
  error.context = context;
  error.response = {
    error: error.message || "unknown error",
    status: error.status || 500,
    context: error.context || {}
  };
  return error;
};


module.exports = {
  badParameters: (msg, ctx) => appError(msg, 400, ctx),
  notFound: (msg, ctx) => appError(msg, 404, ctx),
  notAuthorized: (msg, ctx) => appError(msg, 401, ctx),
  forbidden: (msg, ctx) => appError(msg, 403, ctx),
  appError
};
