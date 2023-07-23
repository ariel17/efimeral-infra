const Sentry = require("@sentry/serverless");


Sentry.AWSLambda.init({
  dsn: process.env.LAMBDAS_SENTRY_DSN,
  tracesSampleRate: 0.1,
  timeoutWarningLimit: 40000,
});

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  console.log("Received event: ", event);
});