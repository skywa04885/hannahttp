import { HTTPClientSocket } from "./HTTPClientSocket";
import { HTTPServer } from "./HTTPServer";

export enum HTTPSessionLogLevel {
  Trace = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export class HTTPSession {
  /**
   * Constructs a new http session.
   * @param client the socket.
   * @param server the server.
   */
  public constructor(public readonly client: HTTPClientSocket, public readonly server: HTTPServer) {}

  /**
   * Checks if we should log trace.
   * @param callback the callback to call if we should log.
   * @returns the current instance.
   */
  public shouldTrace(callback: () => void): this {
    return this.shouldLog(HTTPSessionLogLevel.Trace, callback);
  }

  /**
   * Checks if we should log error.
   * @param callback the callback to call if we should log.
   * @returns the current instance.
   */
  public shouldError(callback: () => void): this {
    return this.shouldLog(HTTPSessionLogLevel.Error, callback);
  }

  /**
   * A function to make logging take up less time.
   * @param level the desired level.
   * @param callback the callback.
   * @returns the current instance.
   */
  public shouldLog(level: HTTPSessionLogLevel, callback: () => void): this {
    // If we're not allowed to lock this, just return.
    if (this.server.settings.sessionLogLevel > level) return this;

    // Calls the callback to log.
    callback();

    // Returns the current instance.
    return this;
  }

  /**
   * Performs a trace log.
   * @param items the items to log.
   * @returns the current instance.
   */
  public trace(...items: any[]): this {
    return this.log(HTTPSessionLogLevel.Trace, ...items);
  }

  /**
   * Performs a info log.
   * @param items the items to log.
   * @returns the current instance.
   */
  public info(...items: any[]): this {
    return this.log(HTTPSessionLogLevel.Info, ...items);
  }

  /**
   * Performs a warn log.
   * @param items the items to log.
   * @returns the current instance.
   */
  public warn(...items: any[]): this {
    return this.log(HTTPSessionLogLevel.Warn, ...items);
  }

  /**
   * Performs a error log.
   * @param items the items to log.
   * @returns the current instance.
   */
  public error(...items: any[]): this {
    return this.log(HTTPSessionLogLevel.Error, ...items);
  }

  /**
   * Logs the given items with the given level.
   * @param level the level to log at.
   * @param items the items to log.
   * @returns the current instance.
   */
  public log(level: HTTPSessionLogLevel, ...items: any[]): this {
    // Produces the line we'll print.
    const line: string = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} [${this.client.socket.remoteFamily} ${
      this.client.socket.remoteAddress
    }:${this.client.socket.remotePort} ${level}] ${items
      .map((item: any): string => item.toString())
      .join(" ")}`;

    // Prints the line.
    if (level === HTTPSessionLogLevel.Error) console.error(line);
    else console.log(line);

    // Returns the current instance.
    return this;
  }
}
