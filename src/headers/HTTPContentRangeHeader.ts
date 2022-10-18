import { HTTPHeader } from "./HTTPHeader";

export enum HTTPContentRangeUnit {
  Bytes = "bytes",
}

export class HTTPContentRangeHeader extends HTTPHeader {
  public constructor(
    public readonly unit: HTTPContentRangeUnit,
    public readonly rangeStart: number,
    public readonly rangeEnd: number,
    public readonly size: number | null
  ) {
    super();
  }

  /**
   * Encodes the header.
   * @returns the encoded value.
   */
  public encode(): string {
    // Gets copies of the values so they can be converted.
    let rangeStart: number = this.rangeStart;
    let rangeEnd: number = this.rangeEnd;
    let size: number | null = this.size;

    // Converts the ranges/ sizes from bytes to the actual units.
    // TODO: Add conversions.

    // Returns the encoded string.
    return `${this.unit} ${rangeStart}-${rangeEnd}/${size ?? "*"}`;
  }

  /**
   * Decodes the given header value.
   * @param raw the raw header value.
   * @returns the decoded header value.
   */
  public static decode(raw: string): HTTPContentRangeHeader {
    // The regular expression we'll use to parse the header.
    const regularExpression: RegExp =
      /^(?<unit>[a-zA-Z0-9]+)\s+(?<rangeStart>[0-9]+)\-(?<rangeEnd>[0-9]+)\/(?<size>\*|[0-9]+)$/;

    // Matches the regular expession, and if it did not match, throw syntax error.
    const match: RegExpMatchArray | null = raw.match(regularExpression);
    if (match === null)
      throw new Error(`"Content-Range" value syntax not valid.`);

    // Makes sure the unit is valid.
    if (!Object.values(HTTPContentRangeUnit).includes(match.groups!.unit! as HTTPContentRangeUnit))
      throw new Error(`"Content-Range" invalid unit given: "${match.groups!.unit!}"`);

    // Preprocesses the values.
    const unit: HTTPContentRangeUnit = match.groups!.unit as HTTPContentRangeUnit;
    const rangeStart: number = parseInt(match.groups!.rangeStart!);
    const rangeEnd = parseInt(match.groups!.rangeEnd!);
    const size = match.groups!.size! === '*' ? null : parseInt(match.groups!.size!);

    // Returns the decoded header.
    return new HTTPContentRangeHeader(unit, rangeStart, rangeEnd, size);
  }
}
