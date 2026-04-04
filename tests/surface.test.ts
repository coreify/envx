import { describe, expect, it } from "vitest";
import * as envPackage from "../src";

describe("public surface", () => {
  it("exports the core runtime API", () => {
    expect(envPackage.createEnv).toBeTypeOf("function");
    expect(envPackage.string).toBeTypeOf("function");
    expect(envPackage.number).toBeTypeOf("function");
    expect(envPackage.boolean).toBeTypeOf("function");
    expect(envPackage.enumType).toBeTypeOf("function");
    expect(envPackage.defineConfig).toBeTypeOf("function");
    expect(envPackage.loadEnvFiles).toBeTypeOf("function");
    expect(envPackage.validateExampleFile).toBeTypeOf("function");
    expect(envPackage.generateExampleFile).toBeTypeOf("function");
    expect(envPackage.syncExampleFile).toBeTypeOf("function");
    expect(envPackage.diagnoseEnv).toBeTypeOf("function");
  });
});
