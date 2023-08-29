import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export const getVpcAvailableZones = () => {
  return (process.env.VPC_AVAILABLE_ZONES || "").split(",");
};

export const getPrivateSubnetIds = () => {
  return (process.env.VPC_PRIVATE_SUBNETS || "").split(",");
};

export const getVPC = (construct: Construct, id: string) => {
  return Vpc.fromVpcAttributes(construct, id, {
    vpcId: process.env.VPC_ID || "",
    availabilityZones: getVpcAvailableZones(),
    privateSubnetIds: getPrivateSubnetIds(),
  });
};
