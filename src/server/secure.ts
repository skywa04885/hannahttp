import tls from "tls";
import fs from "fs/promises";
import { HTTPClientHandler } from "../client-handler";
import { HTTPClientSocket } from "../client-socket";
import { HTTPRouter } from "../router/base";
import { HTTPSettings } from "../settings";
import { HTTPServer } from "./base";
import { Logger, LoggerLevel } from "../logger";

export interface IHTTPServerSecureOptions {
  key: string;
  cert: string;
}

export class HTTPServerSecure extends HTTPServer {
  protected _server?: tls.Server;

  public constructor(
    public readonly options: IHTTPServerSecureOptions,
    port: number,
    hostname: string,
    backlog: number,
    router: HTTPRouter,
    settings: HTTPSettings,
    protected _logger: Logger = new Logger(
      `HTTPS ${hostname} ${port}`,
      LoggerLevel.Info
    )
  ) {
    super(port, hostname, backlog, router, settings);
  }

  protected _onConnection(client: tls.TLSSocket): void {
    const httpClientSocket: HTTPClientSocket =
      HTTPClientSocket.fromSocket(client);
    HTTPClientHandler.fromClientAndServer(httpClientSocket, this);
  }

  public async start(): Promise<void> {
    // Throws an error if the server is there.
    if (this._server) throw new Error(`Cannot start server when defined.`);

    // Logs.
    this._logger.shouldInfo(() => this._logger.info(`Starting server ...`));

    // Reads the key and the cert.
    let key: Buffer | undefined;
    let cert: Buffer | undefined;
    try {
      key = await fs.readFile(this.options.key);
      cert = await fs.readFile(this.options.cert);
    } catch (e) {
      this._logger.shouldError(() =>
        this._logger.error(`Failed to read key/ cert: ${e}`)
      );
    }

    // Creates the tls server.
    this._server = tls.createServer({
      key,
      cert,
    });

    // Adds the event listeners.
    this._server.on("secureConnection", (client: tls.TLSSocket) =>
      this._onConnection(client)
    );

    // Listens the server.
    await new Promise<void>((resolve, reject): void => {
      this._server!.listen(this.port, this.hostname, this.backlog, () =>
        resolve()
      );
    });

    this._logger.shouldInfo(() => this._logger.info(`Started server!`));
  }

  public stop(): Promise<void> {
    return new Promise<void>((resolve, reject): void => {
      // Throws an error if the server isn't there.
      if (!this._server)
        return reject(new Error(`Cannot stop server when not defined.`));

      this._logger.shouldInfo(() => this._logger.info(`Stopping server ...`));

      // Closes the server.
      this._server.close((err?: Error) => {
        this._server = undefined;
        if (err) reject(err);

        this._logger.shouldInfo(() => this._logger.info(`Stopped server!`));

        resolve();
      });
    });
  }

  public async restart(): Promise<void> {
    this._logger.shouldInfo(() => this._logger.info(`Restarting server ...`));

    // Stops then starts.
    await this.stop();
    await this.start();

    this._logger.shouldInfo(() => this._logger.info(`Restarted server!`));
  }
}
