import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_xytyfpzffwgnjepcbpon",
  dirs: ["./src/trigger"],
  // Transcribing and reviewing a creator's video is the slowest thing we run;
  // five minutes is generous for it and still short enough that a wedged task
  // surfaces as a failure rather than hanging.
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 30_000,
      randomize: true,
    },
  },
});
