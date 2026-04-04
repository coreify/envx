import { describe, expect, it } from "vitest";
import { boolean, createEnv, enumType, number, string } from "../src";

describe("type inference", () => {
  it("infers schema output correctly", () => {
    const env = createEnv(
      {
        PORT: number().default(3000),
        DATABASE_URL: string(),
        NODE_ENV: enumType(["development", "production", "test"]),
        DEBUG: boolean().optional()
      },
      {
        env: {
          DATABASE_URL: "postgres://db.example.com/app",
          NODE_ENV: "test"
        },
        validateExample: "off"
      }
    );

    expectNumber(env.PORT);
    expectString(env.DATABASE_URL);
    expectNodeEnv(env.NODE_ENV);
    expectBooleanOrUndefined(env.DEBUG);

    expect(env.PORT).toBe(3000);

    // @ts-expect-error - PORT is a number
    expectString(env.PORT);

    // @ts-expect-error - DEBUG is optional
    expectBoolean(env.DEBUG);
  });

  it("infers split schema output", () => {
    const env = createEnv(
      {
        server: {
          DATABASE_URL: string()
        },
        client: {
          PUBLIC_API_URL: string()
        }
      },
      {
        env: {
          DATABASE_URL: "postgres://db.example.com/app",
          PUBLIC_API_URL: "https://api.example.com"
        },
        validateExample: "off"
      }
    );

    expectString(env.server.DATABASE_URL);
    expectString(env.client.PUBLIC_API_URL);

    // @ts-expect-error - server env should not appear on client section
    expectString(env.client.DATABASE_URL);
  });
});

function expectString(_value: string): void {
  void _value;
}

function expectNumber(_value: number): void {
  void _value;
}

function expectBoolean(_value: boolean): void {
  void _value;
}

function expectBooleanOrUndefined(_value: boolean | undefined): void {
  void _value;
}

function expectNodeEnv(_value: "development" | "production" | "test"): void {
  void _value;
}
