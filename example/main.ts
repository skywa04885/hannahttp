import {
  HTTPPathMatch,
  HTTPRequest,
  HTTPResponse,
  HTTPServerPlain,
  HTTPSettings,
  HTTPSimpleRouter,
} from "../src/index";
import { useLetsEncrypt } from "../src/middleware/letsencrypt";

(async () => {
  const router = new HTTPSimpleRouter();
  const settings = new HTTPSettings();

  router.get(
    ...(await useLetsEncrypt({
      email: "luke.rieff@gmail.com",
      certificates: [
        {
          name: "fannst.nl",
          domains: ["hannahttp.fannst.nl"],
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

  const server = new HTTPServerPlain(router, settings);
  server.listen(8080, "0.0.0.0", 100);
})();
