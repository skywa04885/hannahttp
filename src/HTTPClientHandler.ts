import { HTTPRequest, HTTPRequestEvent } from "./HTTPRequest";
import { HTTPResponse } from "./HTTPResponse";
import { HTTPRouter } from "./HTTPRouter";
import { HTTPClientSocket } from "./HTTPSocket";

export class HTTPClientHandler {
  public httpRequest: HTTPRequest; // The request object & parser (allows pipelining).
  
  public constructor(public readonly httpClientSocket: HTTPClientSocket, public readonly httpRouter: HTTPRouter) {
    this.httpRequest = new HTTPRequest();

    // Registers the socket events.
    this.httpClientSocket.socket.on('data', (chunk: Buffer) => this._onHttpClientSocketDataEvent(chunk));
  }

  /**
   * Processes a new request.
   */
  public processRequest(): void {
    this.httpRequest.once(HTTPRequestEvent.RequestFinishedLoading, () => this._onRequestFinishedLoadingEvent());
  }

  /**
   * Gets called when a request finished the loading phase.
   */
  protected _onRequestFinishedLoadingEvent() {
    // Creates the response.
    const httpResponse: HTTPResponse = new HTTPResponse(this.httpRequest.version!, this.httpClientSocket);

    // Handles the request and response in the router.
    this.httpRouter.handle(this.httpRequest, httpResponse);
  }

  /**
   * Forwards the received data from the socket to the request.
   * @param chunk the chunk of data we've received.
   */
  protected _onHttpClientSocketDataEvent(chunk: Buffer): void {
    this.httpRequest.write(chunk);
  }

  public static fromHttpClientSocket(httpClientSocket: HTTPClientSocket, httpRouter: HTTPRouter): HTTPClientHandler {
    // Creates the http client handler.
    const httpClientHandler: HTTPClientHandler = new HTTPClientHandler(httpClientSocket, httpRouter);

    // Starts processing the request.
    httpClientHandler.processRequest();

    // Returns the client handler.
    return httpClientHandler;
  }
}