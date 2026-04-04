type ParseSuccess<TValue> = {
  ok: true;
  value: TValue;
};

type ParseFailure = {
  ok: false;
  issue: string;
};

export type ParseResult<TValue> = ParseSuccess<TValue> | ParseFailure;
export type SchemaKind = "string" | "number" | "boolean" | "enum";

type BaseSchemaDefinition<TValue> = {
  defaultValue?: TValue;
  hasDefault: boolean;
  optional: boolean;
};

type StringSchemaDefinition = BaseSchemaDefinition<string> & {
  regex?: RegExp;
  url: boolean;
};

type NumberSchemaDefinition = BaseSchemaDefinition<number> & {
  max?: number;
  min?: number;
};

type BooleanSchemaDefinition = BaseSchemaDefinition<boolean>;

type EnumSchemaDefinition<TValues extends readonly [string, ...string[]]> =
  BaseSchemaDefinition<TValues[number]> & {
    values: TValues;
  };

type BaseSchemaMetadata<TValue> = {
  defaultValue?: TValue;
  hasDefault: boolean;
  kind: SchemaKind;
  optional: boolean;
};

export type StringSchemaMetadata = BaseSchemaMetadata<string> & {
  kind: "string";
  regex?: RegExp;
  url: boolean;
};

export type NumberSchemaMetadata = BaseSchemaMetadata<number> & {
  kind: "number";
  max?: number;
  min?: number;
};

export type BooleanSchemaMetadata = BaseSchemaMetadata<boolean> & {
  kind: "boolean";
};

export type EnumSchemaMetadata = BaseSchemaMetadata<string> & {
  kind: "enum";
  values: readonly string[];
};

export type SchemaMetadata =
  | StringSchemaMetadata
  | NumberSchemaMetadata
  | BooleanSchemaMetadata
  | EnumSchemaMetadata;

export abstract class BaseSchema<TValue, TOptional extends boolean = false> {
  readonly __coreifySchema = true;
  declare readonly __coreifyOutput: TValue;
  declare readonly __coreifyOptional: TOptional;

  protected resolveMissing(
    key: string,
    definition: BaseSchemaDefinition<TValue>
  ): ParseResult<TValue | undefined> {
    if (definition.hasDefault) {
      return {
        ok: true,
        value: definition.defaultValue as TValue
      };
    }

    if (definition.optional) {
      return {
        ok: true,
        value: undefined
      };
    }

    return {
      ok: false,
      issue: `${key} is missing`
    };
  }

  abstract parse(key: string, rawValue: string | undefined): ParseResult<TValue | undefined>;
  abstract isRequired(): boolean;
  abstract describe(): SchemaMetadata;
}

export class StringSchema<TOptional extends boolean = false> extends BaseSchema<
  string,
  TOptional
> {
  constructor(private readonly definition: StringSchemaDefinition = defaultStringDefinition()) {
    super();
  }

  optional(): StringSchema<true> {
    return new StringSchema({
      ...this.definition,
      optional: true
    });
  }

  default(value: string): StringSchema<false> {
    return new StringSchema({
      ...this.definition,
      defaultValue: value,
      hasDefault: true,
      optional: false
    });
  }

  regex(pattern: RegExp): StringSchema<TOptional> {
    return new StringSchema({
      ...this.definition,
      regex: cloneRegex(pattern)
    });
  }

  url(): StringSchema<TOptional> {
    return new StringSchema({
      ...this.definition,
      url: true
    });
  }

  isRequired(): boolean {
    return !this.definition.optional && !this.definition.hasDefault;
  }

  describe(): StringSchemaMetadata {
    const metadata: StringSchemaMetadata = {
      kind: "string",
      optional: this.definition.optional,
      hasDefault: this.definition.hasDefault,
      url: this.definition.url
    };

    if (this.definition.defaultValue !== undefined) {
      metadata.defaultValue = this.definition.defaultValue;
    }

    if (this.definition.regex !== undefined) {
      metadata.regex = this.definition.regex;
    }

    return metadata;
  }

  parse(key: string, rawValue: string | undefined): ParseResult<string | undefined> {
    if (rawValue === undefined) {
      return this.resolveMissing(key, this.definition);
    }

    if (this.definition.regex && !testRegex(this.definition.regex, rawValue)) {
      return {
        ok: false,
        issue: `${key} does not match ${this.definition.regex}`
      };
    }

    if (this.definition.url) {
      try {
        new URL(rawValue);
      } catch {
        return {
          ok: false,
          issue: `${key} must be a valid URL`
        };
      }
    }

    return {
      ok: true,
      value: rawValue
    };
  }
}

export class NumberSchema<TOptional extends boolean = false> extends BaseSchema<
  number,
  TOptional
> {
  constructor(private readonly definition: NumberSchemaDefinition = defaultNumberDefinition()) {
    super();
  }

  optional(): NumberSchema<true> {
    return new NumberSchema({
      ...this.definition,
      optional: true
    });
  }

  default(value: number): NumberSchema<false> {
    return new NumberSchema({
      ...this.definition,
      defaultValue: value,
      hasDefault: true,
      optional: false
    });
  }

  min(value: number): NumberSchema<TOptional> {
    return new NumberSchema({
      ...this.definition,
      min: value
    });
  }

  max(value: number): NumberSchema<TOptional> {
    return new NumberSchema({
      ...this.definition,
      max: value
    });
  }

  isRequired(): boolean {
    return !this.definition.optional && !this.definition.hasDefault;
  }

  describe(): NumberSchemaMetadata {
    const metadata: NumberSchemaMetadata = {
      kind: "number",
      optional: this.definition.optional,
      hasDefault: this.definition.hasDefault
    };

    if (this.definition.defaultValue !== undefined) {
      metadata.defaultValue = this.definition.defaultValue;
    }

    if (this.definition.min !== undefined) {
      metadata.min = this.definition.min;
    }

    if (this.definition.max !== undefined) {
      metadata.max = this.definition.max;
    }

    return metadata;
  }

  parse(key: string, rawValue: string | undefined): ParseResult<number | undefined> {
    if (rawValue === undefined) {
      return this.resolveMissing(key, this.definition);
    }

    if (rawValue.trim() === "") {
      return {
        ok: false,
        issue: `${key} must be a number (received: "")`
      };
    }

    const parsed = Number(rawValue);

    if (Number.isNaN(parsed)) {
      return {
        ok: false,
        issue: `${key} must be a number (received: "${rawValue}")`
      };
    }

    if (this.definition.min !== undefined && parsed < this.definition.min) {
      return {
        ok: false,
        issue: `${key} must be at least ${this.definition.min}`
      };
    }

    if (this.definition.max !== undefined && parsed > this.definition.max) {
      return {
        ok: false,
        issue: `${key} must be at most ${this.definition.max}`
      };
    }

    return {
      ok: true,
      value: parsed
    };
  }
}

export class BooleanSchema<TOptional extends boolean = false> extends BaseSchema<
  boolean,
  TOptional
> {
  constructor(
    private readonly definition: BooleanSchemaDefinition = defaultBooleanDefinition()
  ) {
    super();
  }

  optional(): BooleanSchema<true> {
    return new BooleanSchema({
      ...this.definition,
      optional: true
    });
  }

  default(value: boolean): BooleanSchema<false> {
    return new BooleanSchema({
      ...this.definition,
      defaultValue: value,
      hasDefault: true,
      optional: false
    });
  }

  isRequired(): boolean {
    return !this.definition.optional && !this.definition.hasDefault;
  }

  describe(): BooleanSchemaMetadata {
    const metadata: BooleanSchemaMetadata = {
      kind: "boolean",
      optional: this.definition.optional,
      hasDefault: this.definition.hasDefault
    };

    if (this.definition.defaultValue !== undefined) {
      metadata.defaultValue = this.definition.defaultValue;
    }

    return metadata;
  }

  parse(key: string, rawValue: string | undefined): ParseResult<boolean | undefined> {
    if (rawValue === undefined) {
      return this.resolveMissing(key, this.definition);
    }

    const normalized = rawValue.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(normalized)) {
      return {
        ok: true,
        value: true
      };
    }

    if (["false", "0", "no", "off"].includes(normalized)) {
      return {
        ok: true,
        value: false
      };
    }

    return {
      ok: false,
      issue: `${key} must be a boolean (received: "${rawValue}")`
    };
  }
}

export class EnumSchema<
  TValues extends readonly [string, ...string[]],
  TOptional extends boolean = false
> extends BaseSchema<TValues[number], TOptional> {
  constructor(
    private readonly definition: EnumSchemaDefinition<TValues>
  ) {
    super();
  }

  optional(): EnumSchema<TValues, true> {
    return new EnumSchema({
      ...this.definition,
      optional: true
    });
  }

  default(value: TValues[number]): EnumSchema<TValues, false> {
    return new EnumSchema({
      ...this.definition,
      defaultValue: value,
      hasDefault: true,
      optional: false
    });
  }

  isRequired(): boolean {
    return !this.definition.optional && !this.definition.hasDefault;
  }

  describe(): EnumSchemaMetadata {
    const metadata: EnumSchemaMetadata = {
      kind: "enum",
      optional: this.definition.optional,
      hasDefault: this.definition.hasDefault,
      values: this.definition.values
    };

    if (this.definition.defaultValue !== undefined) {
      metadata.defaultValue = this.definition.defaultValue;
    }

    return metadata;
  }

  parse(
    key: string,
    rawValue: string | undefined
  ): ParseResult<TValues[number] | undefined> {
    if (rawValue === undefined) {
      return this.resolveMissing(key, this.definition);
    }

    if (!this.definition.values.includes(rawValue)) {
      return {
        ok: false,
        issue: `${key} must be one of: ${this.definition.values.join(" | ")}`
      };
    }

    return {
      ok: true,
      value: rawValue
    };
  }
}

export function string(): StringSchema<false> {
  return new StringSchema();
}

export function number(): NumberSchema<false> {
  return new NumberSchema();
}

export function boolean(): BooleanSchema<false> {
  return new BooleanSchema();
}

export function enumType<const TValues extends readonly [string, ...string[]]>(
  values: TValues
): EnumSchema<TValues, false> {
  return new EnumSchema({
    hasDefault: false,
    optional: false,
    values
  });
}

function defaultStringDefinition(): StringSchemaDefinition {
  return {
    hasDefault: false,
    optional: false,
    url: false
  };
}

function defaultNumberDefinition(): NumberSchemaDefinition {
  return {
    hasDefault: false,
    optional: false
  };
}

function defaultBooleanDefinition(): BooleanSchemaDefinition {
  return {
    hasDefault: false,
    optional: false
  };
}

function cloneRegex(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags);
}

function testRegex(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}
