import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const Uuid = Schema.String.check(Schema.isUUID());

// RFC 3339 with a required offset and any fractional precision. Timestamps
// stay strings to preserve the host's full precision.
export const Timestamp = Schema.String.check(
  Schema.isPattern(
    /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/
  )
);

/** A nullable field that decodes to `null` when the host omits it. */
export function NullDefault<S extends Schema.Top>(schema: S) {
  return Schema.NullOr(schema).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  );
}

/**
 * A struct that rejects unknown keys when decoding, for edits the host rejects
 * them in. Plain structs strip unknown keys instead, as encoding this does.
 */
export function ExactStruct<const Fields extends Schema.Struct.Fields>(
  fields: Fields
) {
  return Schema.Record(Schema.String, Schema.Unknown)
    .check(
      Schema.makeFilter(
        (input) =>
          Object.keys(input).every((key) => Object.hasOwn(fields, key)) ||
          "Unexpected key"
      )
    )
    .pipe(Schema.decodeTo(Schema.Struct(fields)));
}
