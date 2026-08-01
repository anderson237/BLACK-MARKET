import serverless from "serverless-http";
import { connectLambda } from "@netlify/blobs";
import { createApp } from "../../src/server-app";

const app = createApp();
const serverlessHandler = serverless(app);

// Netlify Functions v1 (export const handler) does NOT inject the Netlify Blobs
// configuration automatically. connectLambda(event) must be called at the start
// of every invocation so that getStore() inside the Express app can locate the
// siteID/token from the current Lambda event. Without this, every Blobs call
// throws "MissingBlobsEnvironmentError".
export const handler = async (event: any, context: any) => {
  try {
    connectLambda(event);
  } catch (err) {
    console.error("[BLOBS] connectLambda failed:", err);
  }
  return serverlessHandler(event, context);
};
