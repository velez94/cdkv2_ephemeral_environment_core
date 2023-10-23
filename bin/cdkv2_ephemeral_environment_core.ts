#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Cdkv2EphemeralEnvironmentCoreStack } from '../lib/cdkv2_ephemeral_environment_core-stack';
import input from "../environment-properties.json";
// Use environment variables when needed.
import {env} from "process";


const deploymentEnv = {
  account: env.CDK_DEPLOY_ACCOUNT ?? env.CDK_DEFAULT_ACCOUNT,  //'123456789102',
  region: env.CDK_DEPLOY_REGION ?? env.CDK_DEFAULT_REGION, //'us-east-2'
};

const stackName = input.environment.name;

const app = new cdk.App();

const stack = new Cdkv2EphemeralEnvironmentCoreStack(app, 'Cdkv2EphemeralEnvironmentCoreStack', {
  env: deploymentEnv,
  stackName: stackName,
 
});
//*/