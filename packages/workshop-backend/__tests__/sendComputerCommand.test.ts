// sendComputerCommand.test.ts
//
// Tests for the parseComputerCommandResponse function exported from overseer.ts.
// This function is the real shipped error-handling logic that sendComputerCommand
// calls after fetching from the bridge. It ensures bridge 4xx/5xx errors are
// surfaced as error-shaped results (exitCode=1, errorType set) instead of
// being silently returned as "successful" results with undefined fields.
//
// The test creates real Response objects and passes them to the real function,
// verifying both the success and error paths.

import { describe, expect, it } from "vitest";
import { parseComputerCommandResponse } from "../src/computer-bridge-utils.js";

describe("parseComputerCommandResponse", () => {
  // ─── Success path ─────────────────────────────────────────────────────────

  it("returns the JSON body as-is on a 200 response", async () => {
    const mockResponse = new Response(
      JSON.stringify({ stdout: "hello\n", stderr: "", exitCode: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    const result = await parseComputerCommandResponse(mockResponse);

    expect(result.stdout).toBe("hello\n");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.errorType).toBeUndefined();
  });

  it("returns non-zero exit code from a successful command", async () => {
    const mockResponse = new Response(
      JSON.stringify({ stdout: "", stderr: "command not found", exitCode: 127 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    const result = await parseComputerCommandResponse(mockResponse);

    expect(result.exitCode).toBe(127);
    expect(result.stderr).toBe("command not found");
    expect(result.errorType).toBeUndefined();
  });

  // ─── Error path: bridge returns structured error ─────────────────────────

  it("surfaces a 401 unauthorized error with errorType", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "unauthorized",
        errorType: "unauthorized",
        recoverable: false,
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );

    const result = await parseComputerCommandResponse(mockResponse);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("unauthorized");
    expect(result.errorType).toBe("unauthorized");
  });

  it("surfaces a 400 validation_error with the bridge message", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "command is required",
        errorType: "validation_error",
        recoverable: false,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );

    const result = await parseComputerCommandResponse(mockResponse);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("command is required");
    expect(result.errorType).toBe("validation_error");
  });

  it("surfaces a 503 grok_agent_not_running error", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "grok agent not running",
        errorType: "grok_agent_not_running",
        recoverable: true,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );

    const result = await parseComputerCommandResponse(mockResponse);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("grok agent not running");
    expect(result.errorType).toBe("grok_agent_not_running");
  });

  it("surfaces a 500 boot_failed error", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "Failed to clone repo: invalid URL",
        errorType: "boot_failed",
        recoverable: false,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );

    const result = await parseComputerCommandResponse(mockResponse);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("Failed to clone repo: invalid URL");
    expect(result.errorType).toBe("boot_failed");
  });

  // ─── Error path: non-JSON response ───────────────────────────────────────

  it("falls back to generic error message when response body is not JSON", async () => {
    const mockResponse = new Response("Internal Server Error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });

    const result = await parseComputerCommandResponse(mockResponse);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("Bridge error: 500");
    expect(result.errorType).toBe("bridge_error");
  });

  it("falls back to bridge_error type when errorType is missing", async () => {
    const mockResponse = new Response(
      JSON.stringify({ error: "something went wrong" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );

    const result = await parseComputerCommandResponse(mockResponse);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("something went wrong");
    expect(result.errorType).toBe("bridge_error");
  });
});
