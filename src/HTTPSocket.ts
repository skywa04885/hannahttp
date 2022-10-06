import { Server, Socket } from "net";
import { EventEmitter } from "stream";
import { TLSSocket } from "tls";

export enum HTTPServerSocketEvent {
  ClientConnected = "ClientConnected",
  Listening = "listening",
  Error = "error",
  Close = "close",
}

export class HTTPServerSocket extends EventEmitter {
  public constructor(public readonly server: Server) {
    super();
  }

  /**
   * Wraps the given socket in a http server.
   * @param server the server to wrap.
   * @returns the wrapped server.
   */
  public static fromServer(server: Server) {
    return new HTTPServerSocket(server);
  }

  /**
   * Listens the current server.
   * @param port the port to listen on.
   * @param hostname the hostname to listen on.
   * @param backlog the backlog.
   */
  public listen(port: number, hostname: string, backlog: number): this {
    // Registers the other listeners.
    this._registerListeners();

    // Starts listening.
    this.server.listen(port, hostname, backlog);

    // Returns the current instance.
    return this;
  }

  /**
   * Destroys the http server socket.
   * @returns the current instance.
   */
  public destroy(): this {
    // Unregisters all the listener.
    this.removeAllListeners();

    // Returns the current instance.
    return this;
  }

  /**
   * Registers all the listeners.
   */
  protected _registerListeners(): void {
    this.server.on("close", () => this._onCloseEvent());
    this.server.on("listening", () => this._onListeningEvent());
    this.server.on("connection", (clientSocket: Socket) => this._onConnectionEvent(clientSocket));
    this.server.on("error", (error: Error) => this._onError(error));
  }

  /**
   * Gets called when the server has emitted a close event.
   */
  protected _onCloseEvent(): void {
    // Emits the event.
    this.emit(HTTPServerSocketEvent.Close);
  }

  /**
   * Gets called when a new client socket has connected.
   * @param clientSocket the client socket that connected.
   */
  protected _onConnectionEvent(clientSocket: Socket): void {
    // Wraps the client socket in the http client socket.
    const httpClientSocket: HTTPClientSocket =
      HTTPClientSocket.fromSocket(clientSocket);

    // Emits the event with the new client socket.
    this.emit(HTTPServerSocketEvent.ClientConnected, httpClientSocket);
  }

  /**
   * Gets called when the server is listening.
   */
  protected _onListeningEvent(): void {
    // Emits the event.
    this.emit(HTTPServerSocketEvent.Listening);
  }

  /**
   * Gets called when an error has been emitted.
   * @param error the error that has been emitted.
   */
  protected _onError(error: Error): void {
    // Emits the event.
    this.emit(HTTPServerSocketEvent.Error, error);
  }
}

export class HTTPClientSocket {
  public constructor(public readonly socket: Socket) {}

  /**
   * Wraps the given socket in a http client socket.
   * @param socket the socket to wrap.
   * @returns the wrapped socket.
   */
  public static fromSocket(socket: Socket) {
    return new HTTPClientSocket(socket);
  }

  /**
   * If the socket is tls or not.
   * @returns the boolean indicating if the socket is tls or not.
   */
  public get secure(): boolean {
    return this.socket instanceof TLSSocket;
  }

  /**
   * Destroys the socket.
   * @returns the current instance.
   */
  public destroy(): this {
    this.socket.destroy();
    return this;
  }

  /**
   * Writes the given buffer.
   * @param buffer the buffer to write.
   * @returns the current instance.
   */
  public write(buffer: Buffer): this {
    this.socket.write(buffer);
    return this;
  }
}
