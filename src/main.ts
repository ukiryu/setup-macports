import * as core from "@actions/core";
import { getInputs } from "./input-helper";
import { MacPortsProvider, cleanup } from "./providers/macports-provider";

async function run(): Promise<void> {
  try {
    core.info("Setting up MacPorts...");

    // Get and validate inputs
    const settings = await getInputs();

    core.debug(`Settings: ${JSON.stringify(settings, null, 2)}`);

    // Create provider and setup MacPorts
    const provider = new MacPortsProvider(settings);
    const installInfo = await provider.setup();

    core.info("MacPorts setup complete!");
    core.info(`Version: ${installInfo.version}`);
    core.info(`Prefix: ${installInfo.prefix}`);
    core.info(`Cache Key: ${installInfo.cacheKey}`);
  } catch (error) {
    core.setFailed(`${(error as any)?.message ?? error}`);
  }
}

// Main
// Check if this is a post execution
if (process.env["STATE_isPost"] === "true") {
  cleanup();
} else {
  run();
}
