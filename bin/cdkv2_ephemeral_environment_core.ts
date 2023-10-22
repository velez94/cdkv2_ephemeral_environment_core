#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Cdkv2EphemeralEnvironmentCoreStack } from '../lib/cdkv2_ephemeral_environment_core-stack';
import input from "../environment-properties.json";
import { AwsSolutionsChecks,NagSuppressions } from 'cdk-nag'
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
// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

NagSuppressions.addResourceSuppressions(stack, [
  {
    id: 'AwsSolutions-ELB2',
    reason: 'Demonstrate a resource level suppression.'
  },
  {
    id: 'AwsSolutions-EC26',
    reason: 'The resource creates one or more EBS volumes that have encryption disabled. Suppression.'
  },
  {
    id: 'AwsSolutions-EC28',
    reason: 'The EC2 instance/AutoScaling launch configuration does not have detailed monitoring enabled. Suppression.'
  },
  {
    id: 'AwsSolutions-EC29',
    reason: 'The EC2 instance is not part of an ASG and has Termination Protection disabled. Suppression.'
  },
  {
    id: 'AwsSolutions-EC23',
    reason: ' The Security Group allows for 0.0.0.0/0 or ::/0 inbound access.. Suppression.'
  },
  {
    id: 'AwsSolutions-ELB2',
    reason: 'The ELB does not have access logs enabled.. Suppression.'
  },
]);
//*/