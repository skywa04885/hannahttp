import crypto from "crypto";
import { Readable, Writable } from "stream";
import { HTTPResponse } from "./HTTPResponse";

export class HTTPPartialContent {
  protected constructor(
    public readonly writable: Writable,
    public readonly boundary: string
  ) {}

  protected _write(buffer: Buffer): Promise<void> {
    return new Promise<void>((resolve, reject): void => {
      this.writable.write(buffer, (error?: Error | null) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Generates a random boundary for the partial content.
   * @returns the random boundary.
   */
  protected static _generateBoundary(): string {
    const randomString: string = crypto.randomBytes(6).toString("hex");
    const timeString: string = Date.now().toString();
    return `HannahTTP_${timeString}_${randomString}`;
  }

  public static new(writable: Writable): HTTPPartialContent {
    // Generates the random boundary.
    const boundary: string = this._generateBoundary();

    // Returns the new partial content.
    return new this(writable, boundary);
  }

  /**
   * Begins a new range by writing a starting boundary.
   * @returns a promise that resolves once written.
   */
  public async range(): Promise<void> {
    // Creates the start boundary.
    const startBoundaryString: string = `--${this.boundary}`;
    const startBoundaryBuffer: Buffer = Buffer.from(startBoundaryString, "utf-8");

    // Writes the data to the socket.
    await this._write(startBoundaryBuffer);
  }

  public async header(key: string, value: string): Promise<void> {}

  /**
   * Ends the partial content by writing the closing boundary.
   * @returns a promise that resolves once written.
   */
  public async end(): Promise<void> {
    // Creates the end boundary.
    const endBoundaryString: string = `--${this.boundary}--`;
    const endBoundaryBuffer: Buffer = Buffer.from(endBoundaryString, "utf-8");

    // Writes the data to the socket.
    await this._write(endBoundaryBuffer);
  }
}
