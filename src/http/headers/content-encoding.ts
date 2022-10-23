/*
  HannaHTTP extremely fast and customizable HTTP server.
  Copyright (C) Luke A.C.A. Rieff 2022

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { HTTPCommaSeparatedValueHeaderBase } from "./base";

export enum HTTPContentEncoding {
  Brotli = "br",
  Compress = "compress",
  Deflate = "deflate",
  Gzip = "gzip",
}

export class HTTPContentEncodingHeader extends HTTPCommaSeparatedValueHeaderBase<HTTPContentEncoding> {
  public constructor() {
    super();
  }
}
