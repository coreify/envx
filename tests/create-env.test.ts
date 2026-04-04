import { describe, expect, it } from "vitest";
import { EnvValidationError, boolean, createEnv, enumType, number, string } from "../src";

describe("createEnv", () => {
  it("parses values with defaults and optional keys", () => {
    const env = createEnv(
      {
        PORT: number().default(3000),
        DATABASE_URL: string().url(),
        NODE_ENV: enumType(["development", "production", "test"]),
        DEBUG: boolean().optional()
      },
      {
        env: {
          DATABASE_URL: "https://db.example.com",
          NODE_ENV: "development"
        },
        validateExample: "off"
      }
    );

    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_URL).toBe("https://db.example.com");
    expect(env.NODE_ENV).toBe("development");
    expect(env.DEBUG).toBeUndefined();
  });

  it("supports number ranges, booleans, and regex validation", () => {
    const env = createEnv(
      {
        PORT: number().min(1).max(65535),
        DEBUG: boolean(),
        API_KEY: string().regex(/^key_[a-z0-9]+$/u)
      },
      {
        env: {
          PORT: "3001",
          DEBUG: "yes",
          API_KEY: "key_abc123"
        },
        validateExample: "off"
      }
    );

    expect(env.PORT).toBe(3001);
    expect(env.DEBUG).toBe(true);
    expect(env.API_KEY).toBe("key_abc123");
  });

  it("keeps regex validation stable with global patterns", () => {
    const schema = {
      API_KEY: string().regex(/^key_[a-z0-9]+$/gu)
    };

    const first = createEnv(schema, {
      env: {
        API_KEY: "key_abc123"
      },
      validateExample: "off"
    });

    const second = createEnv(schema, {
      env: {
        API_KEY: "key_abc123"
      },
      validateExample: "off"
    });

    expect(first.API_KEY).toBe("key_abc123");
    expect(second.API_KEY).toBe("key_abc123");
  });

  it("supports server and client schemas", () => {
    const env = createEnv(
      {
        server: {
          DATABASE_URL: string(),
          INTERNAL_TIMEOUT: number().default(30)
        },
        client: {
          PUBLIC_API_URL: string().url(),
          PUBLIC_DEBUG: boolean().optional()
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

    expect(env.server.DATABASE_URL).toBe("postgres://db.example.com/app");
    expect(env.server.INTERNAL_TIMEOUT).toBe(30);
    expect(env.client.PUBLIC_API_URL).toBe("https://api.example.com");
    expect(env.client.PUBLIC_DEBUG).toBeUndefined();
  });

  it("enforces strict public prefix rules for split schemas", () => {
    expect(() =>
      createEnv(
        {
          server: {
            DATABASE_URL: string()
          },
          client: {
            API_URL: string()
          }
        },
        {
          env: {
            DATABASE_URL: "postgres://db.example.com/app",
            API_URL: "https://api.example.com"
          },
          validateExample: "off"
        }
      )
    ).toThrowError(EnvValidationError);
  });
});
