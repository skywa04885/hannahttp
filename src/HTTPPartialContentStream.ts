import crypto from "crypto";
import { Readable } from "stream";
import { HTTPResponse } from "./HTTPResponse";

export class HTTPPartialContent {
  protected constructor(
    public readonly response: HTTPResponse,
    public readonly boundary: string
  ) {}

  /**
   * Generates a random boundary for the partial content.
   * @returns the random boundary.
   */
  protected static _generateBoundary(): string {
    const randomString: string = crypto.randomBytes(6).toString("hex");
    const timeString: string = Date.now().toString();
    return `HannahTTP_${timeString}_${randomString}`;
  }

  public static new(response: HTTPResponse): HTTPPartialContent {
    // Generates the random boundary.
    const boundary: string = this._generateBoundary();

    // Returns the new partial content.
    return new this(response, boundary);
  }

  public async startRange(): Promise<void> {}
}
