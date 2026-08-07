// computer-bridge-utils.ts
//
// Pure utility functions for the Computer bridge error handling.
// Extracted from overseer.ts so they can be unit-tested without pulling
// in the entire Overseer module's dependency chain (capnweb, typed-storage,
// yjs, etc.).
//
// These functions are the real shipped error-handling logic that
// sendComputerCommand and #streamComputerPrompt call.

/**
 * Error thrown when the Computer bridge returns a structured error response.
 * Carries a typed `code` (e.g. "container_not_ready", "grok_agent_not_running")
 * so the catch block in #runComputerAgentTurn can propagate it to the frontend
 * via postAgentErrorMessage with a meaningful error code.
 */
export class ComputerBridgeError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ComputerBridgeError";
    this.code = code;
  }
}

/**
 * Parses the HTTP response from the bridge's /command endpoint into the
 * result shape expected by the frontend terminal.
 *
 * On success (2xx): returns the JSON body as-is ({ stdout, stderr, exitCode }).
 * On error (4xx/5xx): parses the bridge's structured error response
 * ({ error, errorType, recoverable }) and returns an error-shaped result
 * with exitCode=1, stderr=errorMessage, and errorType set — so the frontend
 * terminal displays a clear error badge instead of "exit undefined".
 *
 * Exported for testing — drives the real shipped error-handling logic.
 */
export async function parseComputerCommandResponse(response: Response): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  errorType?: string;
}> {
  if (!response.ok) {
    let errorType = "bridge_error";
    let errorMessage = `Bridge error: ${response.status}`;
    try {
      const errorBody = await response.json() as {
        error?: string;
        errorType?: string;
      };
      if (errorBody.errorType) errorType = errorBody.errorType;
      if (errorBody.error) errorMessage = errorBody.error;
    } catch { /* not JSON, use generic message */ }
    return {
      stdout: "",
      stderr: errorMessage,
      exitCode: 1,
      errorType,
    };
  }

  return response.json();
}
