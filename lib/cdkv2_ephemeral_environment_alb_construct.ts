import { StackProps, CfnOutput, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lb from "aws-cdk-lib/aws-elasticloadbalancingv2";

export interface AlbStackProps extends StackProps {
  stackName: string | undefined;
  vpc: ec2.IVpc;
  public: boolean;
}

export class AlbStack extends Construct {
  public lbSecGrp: ec2.SecurityGroup;
  public loadBalancer: lb.IApplicationLoadBalancer;
  public targetGroup: lb.ApplicationTargetGroup;
  public lbListener: lb.IApplicationListener;

  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id);

    const lbSubnets = props.vpc.selectSubnets({
      subnetType: props.public
        ? ec2.SubnetType.PUBLIC
        : ec2.SubnetType.PRIVATE_WITH_EGRESS,
    });

    this.lbSecGrp = new ec2.SecurityGroup(this, "LbSecGrp", {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    this.loadBalancer = new lb.ApplicationLoadBalancer(this, "ECSSvcALB", {
      loadBalancerName: `ALB-${props.stackName}`,
      vpc: props.vpc,
      internetFacing: props.public,
      vpcSubnets: lbSubnets,
      securityGroup: this.lbSecGrp,
      
    });
   
    new CfnOutput(this, "LBDNSName", {
      value: this.loadBalancer.loadBalancerDnsName,
      exportName: `LBDNSName-${props.stackName}`,
    });

    new CfnOutput(this, "ARNALB", {
      value: this.loadBalancer.loadBalancerArn,
      exportName: `ARNALB-${props.stackName}`,
    });

    new CfnOutput(this, "SGALB", {
      value: this.lbSecGrp.securityGroupId,
      exportName: `SGALB-${props.stackName}`,
    });
  }
}
