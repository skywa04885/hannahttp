import { HTTPClientSocket, HTTPServerSocket, HTTPServerSocketEvent } from "./HTTPSocket";
import net from 'net';
import { HTTPClientHandler } from "./HTTPClientHandler";
import { HTTPRouter } from "./HTTPRouter";

export class HTTPServer {
  public constructor(
    public readonly httpServerSocket: HTTPServerSocket,
    public readonly httpRouter: HTTPRouter,
  ) {

  }

  protected _onClientConnected(clientSocket: HTTPClientSocket): void {
    HTTPClientHandler.fromHttpClientSocket(clientSocket, this.httpRouter);
  }
}

export class HTTPServerPlain extends HTTPServer {
  public constructor(httpRouter: HTTPRouter) {
    super(HTTPServerSocket.fromServer(net.createServer()), httpRouter);

    // Registers the event listeners.
    this.httpServerSocket.on(HTTPServerSocketEvent.ClientConnected, (httpClientSocket: HTTPClientSocket) => this._onClientConnected(httpClientSocket));
  }

  public destroy() {
    // Removes the event listeners.
    this.httpServerSocket.removeAllListeners();

    // Destroys the socket.
    this.httpServerSocket.destroy();
  }
}
