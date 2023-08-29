import * as cdk from "aws-cdk-lib";
import { EventCenterStack } from "../lib/event-center-stack";
import { config as dotenvConfig } from "dotenv";

const app = new cdk.App();

// Retrieve the environment from context
const env = app.node.tryGetContext("env");

// If an environment is provided through context, load its specific .env file
if (env) {
  dotenvConfig({ path: `properties/.env.${env}` });
} else {
  // Default .env file in the 'properties' folder
  dotenvConfig({ path: "properties/.env" });
}

console.log(process.env.ENV);

new EventCenterStack(app, `${process.env.ENV}EventsCenterStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

//npm run synth --env=dev
//npm run deploy  --env=dev
