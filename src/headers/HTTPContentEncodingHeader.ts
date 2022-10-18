import { HTTPCommaSeparatedValueHeader } from "./HTTPHeader";

export enum HTTPContentEncoding {
  Br = "br",
  Compress = "compress",
  Deflate = "deflate",
  Gzip = "gzip",
}

export class HTTPContentEncodingHeader extends HTTPCommaSeparatedValueHeader<HTTPContentEncoding> {
  public constructor() {
    super();
  }
}
