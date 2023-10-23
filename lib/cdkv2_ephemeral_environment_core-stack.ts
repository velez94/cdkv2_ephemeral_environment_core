import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import input from "../environment-properties.json";
import { AlbStack } from "./cdkv2_ephemeral_environment_alb_construct";
import { NagSuppressions } from 'cdk-nag';

export class Cdkv2EphemeralEnvironmentCoreStack extends cdk.Stack {
  public readonly natGatewayProvider =  ec2.NatProvider.gateway();
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const environmentInputs = input.environment.inputs;
    const envName =  input.environment.inputs.env ?? "dev" ;
    const stackName =  `${envName}-${props.stackName}` ?? input.environment.name ;
    
     // Configure the `natGatewayProvider` when defining a Vpc
     //const natGatewayProvider = ec2.NatProvider.gateway();
     if (environmentInputs.nat_provider === "instance") {
      this.natGatewayProvider = ec2.NatProvider.instance({
      instanceType: new ec2.InstanceType('t3.nano'),
      });
      
    }
 

    const vpc = new ec2.Vpc(this, "EnvVPC", {
      vpcName: stackName,
      natGatewayProvider: this.natGatewayProvider,
      natGateways: environmentInputs.nat_gateways,
      ipAddresses: ec2.IpAddresses.cidr(environmentInputs.vpc_cidr_block),
      
      
    });
    // Define Flow logs
    // Only reject traffic and interval every minute.
    vpc.addFlowLog('FlowLogCloudWatch', {
      trafficType: ec2.FlowLogTrafficType.REJECT,
      maxAggregationInterval: ec2.FlowLogMaxAggregationInterval.ONE_MINUTE,
    });
    

    const sharedSvcSecGrp = new ec2.SecurityGroup(this, "SharedSecurityGroup", {

      vpc: vpc,
      allowAllOutbound: true,
    });

    sharedSvcSecGrp.addIngressRule(
      sharedSvcSecGrp,
      ec2.Port.allTraffic(),
      "Shared security group for services running in ecs cluster"
    );

    new cdk.CfnOutput(this, "SharedSecGrp", {
      value: sharedSvcSecGrp.securityGroupId,
    });

    let clusterInputs: ecs.ClusterProps = {
      vpc: vpc,
      enableFargateCapacityProviders: true,
      containerInsights: environmentInputs.enhanced_cluster_monitoring,
      clusterName: stackName,
          defaultCloudMapNamespace: {
        name: environmentInputs.service_discovery_namespace,

        useForServiceConnect: true,
      },
    };

    if (environmentInputs.allow_ecs_exec) {
      const ecsExecConfig: ecs.ExecuteCommandConfiguration = {
        logging: ecs.ExecuteCommandLogging.DEFAULT,
      };
      clusterInputs = {
        ...clusterInputs,
        executeCommandConfiguration: ecsExecConfig,
      };
    }

    const ecsCluster = new ecs.Cluster(this, "ECSCluster", clusterInputs);

    if (environmentInputs.ec2_capacity) {
      const launchTemplate = new ec2.LaunchTemplate(
        this,
        "ASG-LaunchTemplate",
        {
          instanceType: new ec2.InstanceType(
            environmentInputs.ec2_instance_type
          ),
          machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
          userData: ec2.UserData.forLinux(),
          role: new iam.Role(this, "LaunchTemplateEC2Role", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
          }),
        }
      );
      const autoScalingGroup = new autoscaling.AutoScalingGroup(this, "ASG", {
        vpc,
        mixedInstancesPolicy: {
          instancesDistribution: {
            onDemandPercentageAboveBaseCapacity: 50,
          },
          launchTemplate: launchTemplate,
        },
      });

      const clusterCP = new ecs.AsgCapacityProvider(
        this,
        "ECSCapacityProvider",
        {
          autoScalingGroup: autoScalingGroup,
          capacityProviderName: `${stackName}-cp`,
          enableManagedScaling: true,
          enableManagedTerminationProtection: true,
          machineImageType: ecs.MachineImageType.AMAZON_LINUX_2,
        }
      );

      ecsCluster.addAsgCapacityProvider(clusterCP);

      new cdk.CfnOutput(this, "EC2CapacityProvider", {
        value: clusterCP.capacityProviderName,
        exportName: `EC2CapacityProvider-${stackName}`,
      });
    }

    let clusterSecGrps: any = ecsCluster.connections.securityGroups.filter(
      function getId(x) {
        x.securityGroupId;
      }
    );

    if (clusterSecGrps.length === 0) {
      clusterSecGrps = "[]";
    }

    if (environmentInputs.load_balanced) {
        new AlbStack(this, "LB", {
        //containerPort: environmentInputs.port,
        //listenerPort: 80,
        public: environmentInputs.load_balanced_public,
        vpc: vpc,
        stackName: stackName,
      });
    }
    // put value for lookups import
   new ssm.StringParameter(this, 'VPCID', {
      parameterName: `/${stackName}/VPCID`,
      stringValue: vpc.vpcId,
   });
    // CFN outputs for Environment to expose
    new cdk.CfnOutput(this, "ECSClusterName", {
      value: ecsCluster.clusterName,
      exportName: `ECSClusterName-${stackName}`,
    });
    
   
    new cdk.CfnOutput(this, "ECSClusterArn", {
      value: ecsCluster.clusterArn,
      exportName: `ECSClusterArn-${stackName}`,
    });
    new cdk.CfnOutput(this, "ECSClusterSecGrps", {
      value: `${clusterSecGrps}`,
      exportName: `ECSClusterSecGrps-${stackName}`,
    });
    new cdk.CfnOutput(this, "ECSClusterSDNamespace", {
      value: ecsCluster.defaultCloudMapNamespace?.namespaceName ?? "None",
      exportName: `ServiceDiscoveryNS-${stackName}`,
    });
    new cdk.CfnOutput(this, "VPCId", {
      value: vpc.vpcId,
      exportName: `VPCID-${stackName}`,
    });

    // Namespace outputs
    const nArn= ecsCluster.defaultCloudMapNamespace?.namespaceArn ?? "None"
    new cdk.CfnOutput(this, "CloudMapNamespaceArn", {
      value: nArn,
      exportName: `CloudMapNamespaceArn-${stackName}`,
    });
    const nName= ecsCluster.defaultCloudMapNamespace?.namespaceName ?? "None"
    new cdk.CfnOutput(this, "CloudMapNamespaceName", {
      value: nName,
      exportName: `CloudMapNamespaceName-${stackName}`,
    });
    const nId= ecsCluster.defaultCloudMapNamespace?.namespaceId ?? "None"
    new cdk.CfnOutput(this, "CloudMapNamespaceId", {
      value: nId,
      exportName: `CloudMapNamespaceId-${stackName}`,
    });

   // add supression by path 
    NagSuppressions.addResourceSuppressionsByPath(this, '/Cdkv2EphemeralEnvironmentCoreStack/EnvVPC/PublicSubnet1/NatInstance/Resource', [
      
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
      }
    ]);
  
    NagSuppressions.addResourceSuppressionsByPath(this, '/Cdkv2EphemeralEnvironmentCoreStack/EnvVPC/NatSecurityGroup/Resource', [
      {
        id: 'AwsSolutions-EC23',
        reason: ' The Security Group allows for 0.0.0.0/0 or ::/0 inbound access.. Suppression.'
      },
    ]);
  }
}
