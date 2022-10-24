import {
  HTTPPathMatch,
  HTTPRequest,
  HTTPResponse,
  HTTPServerPlain,
  HTTPSettings,
  HTTPSimpleRouter,
} from "../src/index";
import { Logger, LoggerLevel } from "../src/logger";
import { useLetsEncrypt } from "../src/middleware/letsencrypt";
import { HTTPServerSecure } from "../src/server/secure";
import { Scheduler } from "../src/misc/scheduler";

(async () => {
  const router = new HTTPSimpleRouter();
  const settings = new HTTPSettings();

  const plainServer = new HTTPServerPlain(
    8080,
    "0.0.0.0",
    100,
    router,
    settings
  );
  const secureServer = new HTTPServerSecure(
    {
      key: "./env/letsencrypt/config/live/test-eu001.fannst.nl/privkey.pem",
      cert: "./env/letsencrypt/config/live/test-eu001.fannst.nl/cert.pem",
    },
    8030,
    "0.0.0.0",
    100,
    router,
    settings
  );

  router.get(
    ...(await useLetsEncrypt(secureServer, {
      logger: new Logger("LetsEncrypt", LoggerLevel.Trace),
      email: "luke.rieff@gmail.com",
      certificates: [
        {
          name: "test-eu001.fannst.nl",
          domains: ["test-eu001.fannst.nl"],
          rsaPrivateKeys: ["web.pem"],
        },
      ],
    }))
  );

  router.get(
    "/*",
    async (match: HTTPPathMatch, req: HTTPRequest, res: HTTPResponse) => {
      await res.text("", 404);

      return false;
    }
  );

  await plainServer.start();
  await secureServer.start();
})();
