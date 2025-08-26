#!/bin/bash

# World Immigration Consultant - AWS Deployment Script
# This script deploys the FastAPI backend to AWS ECS/Fargate

set -e

# Configuration
REGION="us-east-1"
CLUSTER_NAME="worldimmigration-cluster"
SERVICE_NAME="worldimmigration-backend-service"
TASK_DEFINITION="worldimmigration-backend"
ECR_REPO="worldimmigration-backend"

echo "🚀 Starting deployment to AWS ECS..."

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Update task definition with actual account ID
sed "s/YOUR_ACCOUNT_ID/$ACCOUNT_ID/g" aws-task-definition.json > aws-task-definition-updated.json

echo "📦 Building and pushing Docker image..."

# Build Docker image
cd backend
docker build -t $ECR_REPO .

# Tag for ECR
docker tag $ECR_REPO:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:latest

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Push to ECR
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:latest

cd ..

echo "🏗️ Registering task definition..."

# Register new task definition
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://aws-task-definition-updated.json \
    --query taskDefinition.taskDefinitionArn --output text)

echo "New task definition: $TASK_DEFINITION_ARN"

# Check if service exists
SERVICE_EXISTS=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --query 'services[0].serviceName' --output text 2>/dev/null || echo "None")

if [ "$SERVICE_EXISTS" = "None" ] || [ "$SERVICE_EXISTS" = "" ]; then
    echo "🆕 Creating new ECS service..."
    
    # Create service using the service definition
    if [ -f "service-definition.json" ]; then
        aws ecs create-service --cli-input-json file://service-definition.json
    else
        echo "⚠️ Service definition not found. Run ./setup-aws-infrastructure.sh first"
        exit 1
    fi
else
    echo "🔄 Updating existing ECS service..."
    
    # Update service
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition $TASK_DEFINITION_ARN \
        --desired-count 1
fi

echo "✅ Deployment initiated! Waiting for service to stabilize..."

# Wait for deployment to complete
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME

echo "🎉 Deployment complete!"

# Get the service endpoint
LOAD_BALANCER_DNS=$(aws elbv2 describe-load-balancers \
    --names worldimmigration-lb \
    --query 'LoadBalancers[0].DNSName' \
    --output text 2>/dev/null || echo "Load balancer not found")

if [ "$LOAD_BALANCER_DNS" != "Load balancer not found" ] && [ "$LOAD_BALANCER_DNS" != "" ]; then
    echo "🌐 Your API is available at: http://$LOAD_BALANCER_DNS"
    echo "🔍 Test your API: curl http://$LOAD_BALANCER_DNS/health"
else
    echo "⚠️ Load balancer not found. Checking service status..."
    aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
fi

echo "✅ Deployment complete!" 

# World Immigration Consultant - AWS Deployment Script
# This script deploys the FastAPI backend to AWS ECS/Fargate

set -e

# Configuration
REGION="us-east-1"
CLUSTER_NAME="worldimmigration-cluster"
SERVICE_NAME="worldimmigration-backend-service"
TASK_DEFINITION="worldimmigration-backend"
ECR_REPO="worldimmigration-backend"

echo "🚀 Starting deployment to AWS ECS..."

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Update task definition with actual account ID
sed "s/YOUR_ACCOUNT_ID/$ACCOUNT_ID/g" aws-task-definition.json > aws-task-definition-updated.json

echo "📦 Building and pushing Docker image..."

# Build Docker image
cd backend
docker build -t $ECR_REPO .

# Tag for ECR
docker tag $ECR_REPO:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:latest

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Push to ECR
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:latest

cd ..

echo "🏗️ Registering task definition..."

# Register new task definition
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://aws-task-definition-updated.json \
    --query taskDefinition.taskDefinitionArn --output text)

echo "New task definition: $TASK_DEFINITION_ARN"

# Check if service exists
SERVICE_EXISTS=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --query 'services[0].serviceName' --output text 2>/dev/null || echo "None")

if [ "$SERVICE_EXISTS" = "None" ] || [ "$SERVICE_EXISTS" = "" ]; then
    echo "🆕 Creating new ECS service..."
    
    # Create service using the service definition
    if [ -f "service-definition.json" ]; then
        aws ecs create-service --cli-input-json file://service-definition.json
    else
        echo "⚠️ Service definition not found. Run ./setup-aws-infrastructure.sh first"
        exit 1
    fi
else
    echo "🔄 Updating existing ECS service..."
    
    # Update service
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition $TASK_DEFINITION_ARN \
        --desired-count 1
fi

echo "✅ Deployment initiated! Waiting for service to stabilize..."

# Wait for deployment to complete
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME

echo "🎉 Deployment complete!"

# Get the service endpoint
LOAD_BALANCER_DNS=$(aws elbv2 describe-load-balancers \
    --names worldimmigration-lb \
    --query 'LoadBalancers[0].DNSName' \
    --output text 2>/dev/null || echo "Load balancer not found")

if [ "$LOAD_BALANCER_DNS" != "Load balancer not found" ] && [ "$LOAD_BALANCER_DNS" != "" ]; then
    echo "🌐 Your API is available at: http://$LOAD_BALANCER_DNS"
    echo "🔍 Test your API: curl http://$LOAD_BALANCER_DNS/health"
else
    echo "⚠️ Load balancer not found. Checking service status..."
    aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
fi

echo "✅ Deployment complete!" 
 
 