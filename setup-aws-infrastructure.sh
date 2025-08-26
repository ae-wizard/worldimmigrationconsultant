#!/bin/bash

# AWS Infrastructure Setup for World Immigration Consultant
# This script creates all necessary AWS resources for ECS deployment

set -e

REGION="us-east-1"
CLUSTER_NAME="worldimmigration-cluster"
ECR_REPO="worldimmigration-backend"
VPC_NAME="worldimmigration-vpc"
ALB_NAME="worldimmigration-lb"

echo "🏗️ Setting up AWS infrastructure..."

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "Unknown")
echo "AWS Account ID: $ACCOUNT_ID"

echo "📦 Creating ECR repository..."
aws ecr create-repository \
    --repository-name $ECR_REPO \
    --region $REGION \
    --image-scanning-configuration scanOnPush=true \
    2>/dev/null || echo "ECR repository already exists"

echo "📝 Creating CloudWatch log group..."
aws logs create-log-group \
    --log-group-name "/ecs/worldimmigration-backend" \
    --region $REGION \
    2>/dev/null || echo "Log group already exists"

echo "🔐 Creating IAM roles..."

# Create ECS task execution role
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
    --role-name ecsTaskExecutionRole \
    --assume-role-policy-document file://trust-policy.json \
    2>/dev/null || echo "ecsTaskExecutionRole already exists"

aws iam attach-role-policy \
    --role-name ecsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
    2>/dev/null || echo "Policy already attached"

# Create ECS task role
aws iam create-role \
    --role-name ecsTaskRole \
    --assume-role-policy-document file://trust-policy.json \
    2>/dev/null || echo "ecsTaskRole already exists"

rm trust-policy.json

echo "🌐 Getting default VPC information..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)
echo "Using VPC: $VPC_ID"

SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text)
echo "Subnets: $SUBNET_IDS"

# Create security group
echo "🔒 Creating security group..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name worldimmigration-sg \
    --description "Security group for World Immigration Consultant" \
    --vpc-id $VPC_ID \
    --query 'GroupId' --output text \
    2>/dev/null || aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=worldimmigration-sg" \
    --query 'SecurityGroups[0].GroupId' --output text)

echo "Security Group ID: $SECURITY_GROUP_ID"

# Add inbound rules
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    2>/dev/null || echo "Port 80 rule already exists"

aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    2>/dev/null || echo "Port 443 rule already exists"

echo "🏢 Creating ECS cluster..."
aws ecs create-cluster \
    --cluster-name $CLUSTER_NAME \
    --capacity-providers FARGATE \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
    2>/dev/null || echo "ECS cluster already exists"

echo "⚖️ Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name $ALB_NAME \
    --subnets $SUBNET_IDS \
    --security-groups $SECURITY_GROUP_ID \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4 \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text \
    2>/dev/null || aws elbv2 describe-load-balancers \
    --names $ALB_NAME \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)

echo "Load Balancer ARN: $ALB_ARN"

# Create target group
echo "🎯 Creating target group..."
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
    --name worldimmigration-targets \
    --protocol HTTP \
    --port 80 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path "/health" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 5 \
    --query 'TargetGroups[0].TargetGroupArn' --output text \
    2>/dev/null || aws elbv2 describe-target-groups \
    --names worldimmigration-targets \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "Target Group ARN: $TARGET_GROUP_ARN"

# Create listener
echo "👂 Creating load balancer listener..."
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
    2>/dev/null || echo "Listener already exists"

echo "📄 Creating ECS service configuration..."
cat > service-definition.json << EOF
{
  "serviceName": "worldimmigration-backend-service",
  "cluster": "$CLUSTER_NAME",
  "taskDefinition": "worldimmigration-backend",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": [$(echo $SUBNET_IDS | sed 's/ /","/g' | sed 's/^/"/' | sed 's/$/"/')],
      "securityGroups": ["$SECURITY_GROUP_ID"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "$TARGET_GROUP_ARN",
      "containerName": "worldimmigration-backend",
      "containerPort": 80
    }
  ]
}
EOF

echo "✅ AWS infrastructure setup complete!"
echo ""
echo "📋 Summary:"
echo "- ECS Cluster: $CLUSTER_NAME"
echo "- ECR Repository: $ECR_REPO"
echo "- Security Group: $SECURITY_GROUP_ID"
echo "- Load Balancer: $ALB_ARN"
echo "- Target Group: $TARGET_GROUP_ARN"
echo ""
echo "🚀 Ready for deployment! Run ./deploy-aws.sh to deploy your backend."

# Get load balancer DNS
LB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text)
echo "🌐 Your API will be available at: http://$LB_DNS" 

# AWS Infrastructure Setup for World Immigration Consultant
# This script creates all necessary AWS resources for ECS deployment

set -e

REGION="us-east-1"
CLUSTER_NAME="worldimmigration-cluster"
ECR_REPO="worldimmigration-backend"
VPC_NAME="worldimmigration-vpc"
ALB_NAME="worldimmigration-lb"

echo "🏗️ Setting up AWS infrastructure..."

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "Unknown")
echo "AWS Account ID: $ACCOUNT_ID"

echo "📦 Creating ECR repository..."
aws ecr create-repository \
    --repository-name $ECR_REPO \
    --region $REGION \
    --image-scanning-configuration scanOnPush=true \
    2>/dev/null || echo "ECR repository already exists"

echo "📝 Creating CloudWatch log group..."
aws logs create-log-group \
    --log-group-name "/ecs/worldimmigration-backend" \
    --region $REGION \
    2>/dev/null || echo "Log group already exists"

echo "🔐 Creating IAM roles..."

# Create ECS task execution role
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
    --role-name ecsTaskExecutionRole \
    --assume-role-policy-document file://trust-policy.json \
    2>/dev/null || echo "ecsTaskExecutionRole already exists"

aws iam attach-role-policy \
    --role-name ecsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
    2>/dev/null || echo "Policy already attached"

# Create ECS task role
aws iam create-role \
    --role-name ecsTaskRole \
    --assume-role-policy-document file://trust-policy.json \
    2>/dev/null || echo "ecsTaskRole already exists"

rm trust-policy.json

echo "🌐 Getting default VPC information..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)
echo "Using VPC: $VPC_ID"

SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text)
echo "Subnets: $SUBNET_IDS"

# Create security group
echo "🔒 Creating security group..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name worldimmigration-sg \
    --description "Security group for World Immigration Consultant" \
    --vpc-id $VPC_ID \
    --query 'GroupId' --output text \
    2>/dev/null || aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=worldimmigration-sg" \
    --query 'SecurityGroups[0].GroupId' --output text)

echo "Security Group ID: $SECURITY_GROUP_ID"

# Add inbound rules
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    2>/dev/null || echo "Port 80 rule already exists"

aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    2>/dev/null || echo "Port 443 rule already exists"

echo "🏢 Creating ECS cluster..."
aws ecs create-cluster \
    --cluster-name $CLUSTER_NAME \
    --capacity-providers FARGATE \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
    2>/dev/null || echo "ECS cluster already exists"

echo "⚖️ Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name $ALB_NAME \
    --subnets $SUBNET_IDS \
    --security-groups $SECURITY_GROUP_ID \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4 \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text \
    2>/dev/null || aws elbv2 describe-load-balancers \
    --names $ALB_NAME \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)

echo "Load Balancer ARN: $ALB_ARN"

# Create target group
echo "🎯 Creating target group..."
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
    --name worldimmigration-targets \
    --protocol HTTP \
    --port 80 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path "/health" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 5 \
    --query 'TargetGroups[0].TargetGroupArn' --output text \
    2>/dev/null || aws elbv2 describe-target-groups \
    --names worldimmigration-targets \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "Target Group ARN: $TARGET_GROUP_ARN"

# Create listener
echo "👂 Creating load balancer listener..."
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
    2>/dev/null || echo "Listener already exists"

echo "📄 Creating ECS service configuration..."
cat > service-definition.json << EOF
{
  "serviceName": "worldimmigration-backend-service",
  "cluster": "$CLUSTER_NAME",
  "taskDefinition": "worldimmigration-backend",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": [$(echo $SUBNET_IDS | sed 's/ /","/g' | sed 's/^/"/' | sed 's/$/"/')],
      "securityGroups": ["$SECURITY_GROUP_ID"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "$TARGET_GROUP_ARN",
      "containerName": "worldimmigration-backend",
      "containerPort": 80
    }
  ]
}
EOF

echo "✅ AWS infrastructure setup complete!"
echo ""
echo "📋 Summary:"
echo "- ECS Cluster: $CLUSTER_NAME"
echo "- ECR Repository: $ECR_REPO"
echo "- Security Group: $SECURITY_GROUP_ID"
echo "- Load Balancer: $ALB_ARN"
echo "- Target Group: $TARGET_GROUP_ARN"
echo ""
echo "🚀 Ready for deployment! Run ./deploy-aws.sh to deploy your backend."

# Get load balancer DNS
LB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text)
echo "🌐 Your API will be available at: http://$LB_DNS" 
 
 