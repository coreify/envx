import { describe, expect, it } from "vitest";
import {
  EnvValidationError,
  createEnv,
  enumType,
  formatValidationIssues,
  number,
  string
} from "../src";

describe("validation errors", () => {
  it("aggregates user-friendly validation issues", () => {
    expect(() =>
      createEnv(
        {
          DATABASE_URL: string().url(),
          PORT: number(),
          NODE_ENV: enumType(["development", "production", "test"])
        },
        {
          env: {
            DATABASE_URL: "not-a-url",
            PORT: "abc",
            NODE_ENV: "staging"
          },
          validateExample: "off"
        }
      )
    ).toThrowError(EnvValidationError);

    try {
      createEnv(
        {
          DATABASE_URL: string().url(),
          PORT: number(),
          NODE_ENV: enumType(["development", "production", "test"])
        },
        {
          env: {
            DATABASE_URL: "not-a-url",
            PORT: "abc",
            NODE_ENV: "staging"
          },
          validateExample: "off"
        }
      );
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).issues).toEqual([
        "DATABASE_URL must be a valid URL",
        'PORT must be a number (received: "abc")',
        "NODE_ENV must be one of: development | production | test"
      ]);
    }
  });

  it("formats grouped messages", () => {
    expect(
      formatValidationIssues([
        "DATABASE_URL is missing",
        'PORT must be a number (received: "abc")'
      ])
    ).toContain("❌ Invalid environment variables:");
  });
});
