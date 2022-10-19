import { HTTPCommaSeparatedValueHeader } from "./HTTPHeader";

export enum HTTPContentEncoding {
  Brotli = "br",
  Compress = "compress",
  Deflate = "deflate",
  Gzip = "gzip",
}

export class HTTPContentEncodingHeader extends HTTPCommaSeparatedValueHeader<HTTPContentEncoding> {
  public constructor() {
    super();
  }
}
