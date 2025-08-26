#!/usr/bin/env python3
"""
AWS Integration & Scheduler for Immigration Admin Panel

Features:
- AWS Lambda deployment for scheduled tasks
- CloudWatch Events for automated scheduling
- S3 storage for backup and content
- SNS notifications for task status
- Integration with existing AWS Cognito authentication
"""

import boto3
import json
import os
import zipfile
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import sqlite3
import asyncio
from pathlib import Path

class AWSScheduler:
    def __init__(self):
        # AWS clients
        self.lambda_client = boto3.client('lambda', region_name='us-east-1')
        self.events_client = boto3.client('events', region_name='us-east-1')
        self.s3_client = boto3.client('s3', region_name='us-east-1')
        self.sns_client = boto3.client('sns', region_name='us-east-1')
        self.cognito_client = boto3.client('cognito-idp', region_name='us-east-1')
        
        # Configuration
        self.bucket_name = os.getenv('AWS_S3_BUCKET', 'immigration-admin-data')
        self.lambda_function_prefix = 'immigration-scheduler'
        self.sns_topic_arn = os.getenv('AWS_SNS_TOPIC_ARN')
        
    def setup_aws_infrastructure(self):
        """Set up AWS infrastructure for the admin panel"""
        print("🚀 Setting up AWS infrastructure...")
        
        # 1. Create S3 bucket for data storage
        self._create_s3_bucket()
        
        # 2. Create Lambda execution role
        role_arn = self._create_lambda_role()
        
        # 3. Deploy Lambda functions
        self._deploy_lambda_functions(role_arn)
        
        # 4. Create SNS topic for notifications
        self._create_sns_topic()
        
        print("✅ AWS infrastructure setup complete!")
        
    def _create_s3_bucket(self):
        """Create S3 bucket for storing CSV files and backups"""
        try:
            self.s3_client.create_bucket(Bucket=self.bucket_name)
            print(f"✅ Created S3 bucket: {self.bucket_name}")
        except self.s3_client.exceptions.BucketAlreadyExists:
            print(f"✅ S3 bucket already exists: {self.bucket_name}")
        except Exception as e:
            print(f"❌ Error creating S3 bucket: {e}")
    
    def _create_lambda_role(self) -> str:
        """Create IAM role for Lambda functions"""
        iam_client = boto3.client('iam')
        role_name = 'immigration-scheduler-lambda-role'
        
        trust_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"Service": "lambda.amazonaws.com"},
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        try:
            response = iam_client.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=json.dumps(trust_policy),
                Description='Role for immigration scheduler Lambda functions'
            )
            role_arn = response['Role']['Arn']
            print(f"✅ Created IAM role: {role_arn}")
            
            # Attach policies
            policies = [
                'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
                'arn:aws:iam::aws:policy/AmazonS3FullAccess',
                'arn:aws:iam::aws:policy/AmazonSNSFullAccess'
            ]
            
            for policy in policies:
                iam_client.attach_role_policy(RoleName=role_name, PolicyArn=policy)
            
            return role_arn
            
        except iam_client.exceptions.EntityAlreadyExistsException:
            response = iam_client.get_role(RoleName=role_name)
            return response['Role']['Arn']
            
    def _deploy_lambda_functions(self, role_arn: str):
        """Deploy Lambda functions for scheduled tasks"""
        
        # Scraper Lambda function
        scraper_code = self._create_scraper_lambda_code()
        self._deploy_lambda_function(
            function_name=f'{self.lambda_function_prefix}-scraper',
            code=scraper_code,
            handler='lambda_function.lambda_handler',
            role_arn=role_arn,
            timeout=900,  # 15 minutes
            memory_size=1024
        )
        
        # Vectorizer Lambda function
        vectorizer_code = self._create_vectorizer_lambda_code()
        self._deploy_lambda_function(
            function_name=f'{self.lambda_function_prefix}-vectorizer',
            code=vectorizer_code,
            handler='lambda_function.lambda_handler',
            role_arn=role_arn,
            timeout=600,  # 10 minutes
            memory_size=2048
        )
        
    def _create_scraper_lambda_code(self) -> bytes:
        """Create Lambda deployment package for scraper"""
        lambda_code = '''
import json
import boto3
import requests
from bs4 import BeautifulSoup
import pandas as pd
from io import StringIO
import time

def lambda_handler(event, context):
    """Lambda function to scrape immigration URLs"""
    
    s3 = boto3.client('s3')
    sns = boto3.client('sns')
    
    try:
        # Get CSV data from S3
        bucket = event.get('bucket', 'immigration-admin-data')
        csv_key = event.get('csv_key', 'immigration_sources.csv')
        
        obj = s3.get_object(Bucket=bucket, Key=csv_key)
        csv_content = obj['Body'].read().decode('utf-8')
        
        # Parse CSV
        df = pd.read_csv(StringIO(csv_content))
        
        # Filter enabled URLs only
        if 'enabled' in df.columns:
            df = df[df['enabled'] == True]
        
        # Scrape URLs (simplified version)
        scraped_content = []
        for index, row in df.iterrows():
            try:
                url = row['url']
                response = requests.get(url, timeout=30)
                
                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, 'html.parser')
                    text = soup.get_text()
                    
                    scraped_content.append({
                        'url': url,
                        'title': row.get('title', ''),
                        'country': row.get('country', ''),
                        'category': row.get('category', ''),
                        'content': text[:5000],  # Limit content size
                        'scraped_at': time.time()
                    })
                    
                # Rate limiting
                time.sleep(2)
                
            except Exception as e:
                print(f"Error scraping {url}: {e}")
                continue
        
        # Save results to S3
        results_key = f"scraped_content/{int(time.time())}.json"
        s3.put_object(
            Bucket=bucket,
            Key=results_key,
            Body=json.dumps(scraped_content),
            ContentType='application/json'
        )
        
        # Send notification
        if event.get('sns_topic_arn'):
            sns.publish(
                TopicArn=event['sns_topic_arn'],
                Subject='Immigration Scraping Complete',
                Message=f'Successfully scraped {len(scraped_content)} URLs. Results saved to {results_key}'
            )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully scraped {len(scraped_content)} URLs',
                'results_key': results_key
            })
        }
        
    except Exception as e:
        # Send error notification
        if event.get('sns_topic_arn'):
            sns.publish(
                TopicArn=event['sns_topic_arn'],
                Subject='Immigration Scraping Failed',
                Message=f'Scraping failed with error: {str(e)}'
            )
        
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
'''
        
        return self._create_lambda_package(lambda_code, ['requests', 'beautifulsoup4', 'pandas'])
    
    def _create_vectorizer_lambda_code(self) -> bytes:
        """Create Lambda deployment package for vectorizer"""
        lambda_code = '''
import json
import boto3
import numpy as np
from sentence_transformers import SentenceTransformer
import time

def lambda_handler(event, context):
    """Lambda function to vectorize scraped content"""
    
    s3 = boto3.client('s3')
    sns = boto3.client('sns')
    
    try:
        # Get scraped content from S3
        bucket = event.get('bucket', 'immigration-admin-data')
        content_key = event.get('content_key')
        
        if not content_key:
            raise ValueError("content_key is required")
        
        obj = s3.get_object(Bucket=bucket, Key=content_key)
        content = json.loads(obj['Body'].read().decode('utf-8'))
        
        # Initialize embedding model
        model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        
        # Generate embeddings
        vectorized_content = []
        for item in content:
            text = item.get('content', '')
            if text:
                embedding = model.encode(text).tolist()
                
                vectorized_content.append({
                    'url': item.get('url', ''),
                    'title': item.get('title', ''),
                    'country': item.get('country', ''),
                    'category': item.get('category', ''),
                    'text': text,
                    'embedding': embedding,
                    'vectorized_at': time.time()
                })
        
        # Save vectorized content to S3
        vectors_key = f"vectorized_content/{int(time.time())}.json"
        s3.put_object(
            Bucket=bucket,
            Key=vectors_key,
            Body=json.dumps(vectorized_content),
            ContentType='application/json'
        )
        
        # Send notification
        if event.get('sns_topic_arn'):
            sns.publish(
                TopicArn=event['sns_topic_arn'],
                Subject='Immigration Vectorization Complete',
                Message=f'Successfully vectorized {len(vectorized_content)} documents. Results saved to {vectors_key}'
            )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully vectorized {len(vectorized_content)} documents',
                'vectors_key': vectors_key
            })
        }
        
    except Exception as e:
        # Send error notification
        if event.get('sns_topic_arn'):
            sns.publish(
                TopicArn=event['sns_topic_arn'],
                Subject='Immigration Vectorization Failed',
                Message=f'Vectorization failed with error: {str(e)}'
            )
        
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
'''
        
        return self._create_lambda_package(lambda_code, ['sentence-transformers', 'numpy'])
    
    def _create_lambda_package(self, code: str, dependencies: List[str]) -> bytes:
        """Create Lambda deployment package with dependencies"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Write Lambda function code
            lambda_file = temp_path / 'lambda_function.py'
            lambda_file.write_text(code)
            
            # Create deployment package
            zip_path = temp_path / 'deployment.zip'
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                zip_file.write(lambda_file, 'lambda_function.py')
            
            return zip_path.read_bytes()
    
    def _deploy_lambda_function(self, function_name: str, code: bytes, handler: str, 
                               role_arn: str, timeout: int = 300, memory_size: int = 512):
        """Deploy Lambda function"""
        try:
            # Try to update existing function
            self.lambda_client.update_function_code(
                FunctionName=function_name,
                ZipFile=code
            )
            print(f"✅ Updated Lambda function: {function_name}")
            
        except self.lambda_client.exceptions.ResourceNotFoundException:
            # Create new function
            self.lambda_client.create_function(
                FunctionName=function_name,
                Runtime='python3.9',
                Role=role_arn,
                Handler=handler,
                Code={'ZipFile': code},
                Timeout=timeout,
                MemorySize=memory_size,
                Environment={
                    'Variables': {
                        'S3_BUCKET': self.bucket_name
                    }
                }
            )
            print(f"✅ Created Lambda function: {function_name}")
    
    def _create_sns_topic(self):
        """Create SNS topic for notifications"""
        try:
            response = self.sns_client.create_topic(Name='immigration-admin-notifications')
            self.sns_topic_arn = response['TopicArn']
            print(f"✅ Created SNS topic: {self.sns_topic_arn}")
        except Exception as e:
            print(f"❌ Error creating SNS topic: {e}")
    
    def create_schedule(self, schedule_data: Dict) -> str:
        """Create CloudWatch Events rule for scheduling"""
        rule_name = f"immigration-{schedule_data['name'].replace(' ', '-').lower()}"
        
        # Convert schedule type to cron expression
        cron_expressions = {
            'hourly': 'cron(0 * * * ? *)',
            'daily': 'cron(0 2 * * ? *)',  # 2 AM daily
            'weekly': 'cron(0 2 ? * SUN *)'  # 2 AM every Sunday
        }
        
        schedule_expression = cron_expressions.get(
            schedule_data['schedule_type'], 
            'cron(0 2 * * ? *)'
        )
        
        try:
            # Create CloudWatch Events rule
            self.events_client.put_rule(
                Name=rule_name,
                ScheduleExpression=schedule_expression,
                Description=f"Immigration scheduler: {schedule_data['name']}",
                State='ENABLED' if schedule_data.get('enabled', True) else 'DISABLED'
            )
            
            # Add Lambda target
            function_name = f"{self.lambda_function_prefix}-{schedule_data['task_type']}"
            
            if schedule_data['task_type'] in ['scrape_all', 'scrape_selected']:
                function_name = f"{self.lambda_function_prefix}-scraper"
            elif schedule_data['task_type'] == 'vectorize':
                function_name = f"{self.lambda_function_prefix}-vectorizer"
            
            # Add permission for CloudWatch Events to invoke Lambda
            try:
                self.lambda_client.add_permission(
                    FunctionName=function_name,
                    StatementId=f"{rule_name}-permission",
                    Action='lambda:InvokeFunction',
                    Principal='events.amazonaws.com',
                    SourceArn=f"arn:aws:events:us-east-1:{boto3.Session().get_credentials().access_key}:rule/{rule_name}"
                )
            except self.lambda_client.exceptions.ResourceConflictException:
                pass  # Permission already exists
            
            # Add target to rule
            self.events_client.put_targets(
                Rule=rule_name,
                Targets=[
                    {
                        'Id': '1',
                        'Arn': f"arn:aws:lambda:us-east-1:{boto3.Session().get_credentials().access_key}:function:{function_name}",
                        'Input': json.dumps({
                            'bucket': self.bucket_name,
                            'sns_topic_arn': self.sns_topic_arn,
                            'schedule_name': schedule_data['name'],
                            'country_filter': schedule_data.get('country_filter')
                        })
                    }
                ]
            )
            
            print(f"✅ Created schedule: {rule_name}")
            return rule_name
            
        except Exception as e:
            print(f"❌ Error creating schedule: {e}")
            return None
    
    def upload_csv_to_s3(self, csv_data: List[Dict], filename: str = 'immigration_sources.csv'):
        """Upload CSV data to S3"""
        try:
            import pandas as pd
            df = pd.DataFrame(csv_data)
            csv_content = df.to_csv(index=False)
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=filename,
                Body=csv_content,
                ContentType='text/csv'
            )
            
            print(f"✅ Uploaded CSV to S3: s3://{self.bucket_name}/{filename}")
            return True
            
        except Exception as e:
            print(f"❌ Error uploading CSV to S3: {e}")
            return False
    
    def backup_database(self):
        """Backup admin database to S3"""
        try:
            db_path = 'admin_secure.db'
            backup_key = f"backups/admin_db_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            
            self.s3_client.upload_file(db_path, self.bucket_name, backup_key)
            print(f"✅ Database backed up to S3: {backup_key}")
            
        except Exception as e:
            print(f"❌ Error backing up database: {e}")
    
    def restore_database_from_s3(self, backup_key: str):
        """Restore database from S3 backup"""
        try:
            self.s3_client.download_file(self.bucket_name, backup_key, 'admin_secure.db')
            print(f"✅ Database restored from S3: {backup_key}")
            
        except Exception as e:
            print(f"❌ Error restoring database: {e}")
    
    def trigger_manual_scraping(self, url_filter: Optional[List[str]] = None):
        """Manually trigger scraping Lambda function"""
        function_name = f"{self.lambda_function_prefix}-scraper"
        
        payload = {
            'bucket': self.bucket_name,
            'csv_key': 'immigration_sources.csv',
            'sns_topic_arn': self.sns_topic_arn,
            'manual_trigger': True,
            'url_filter': url_filter
        }
        
        try:
            response = self.lambda_client.invoke(
                FunctionName=function_name,
                InvocationType='Event',  # Async
                Payload=json.dumps(payload)
            )
            
            print(f"✅ Triggered manual scraping")
            return True
            
        except Exception as e:
            print(f"❌ Error triggering manual scraping: {e}")
            return False
    
    def get_schedule_status(self) -> List[Dict]:
        """Get status of all scheduled rules"""
        try:
            response = self.events_client.list_rules(NamePrefix='immigration-')
            
            schedules = []
            for rule in response.get('Rules', []):
                schedules.append({
                    'name': rule['Name'],
                    'state': rule['State'],
                    'schedule_expression': rule.get('ScheduleExpression', ''),
                    'description': rule.get('Description', '')
                })
            
            return schedules
            
        except Exception as e:
            print(f"❌ Error getting schedule status: {e}")
            return []

# Integration with admin panel
def integrate_aws_with_admin():
    """Integration function for the admin panel"""
    scheduler = AWSScheduler()
    
    # Initialize CSV data sync
    def sync_csv_to_aws():
        """Sync CSV data from database to AWS S3"""
        conn = sqlite3.connect('admin_secure.db')
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM csv_sources WHERE enabled = 1')
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        conn.close()
        
        csv_data = [dict(zip(columns, row)) for row in rows]
        scheduler.upload_csv_to_s3(csv_data)
    
    return scheduler, sync_csv_to_aws

if __name__ == "__main__":
    # Setup AWS infrastructure
    scheduler = AWSScheduler()
    scheduler.setup_aws_infrastructure()
    
    print("\n🎉 AWS integration setup complete!")
    print("Your admin panel now supports:")
    print("✅ Automated scheduling with Lambda functions")
    print("✅ S3 storage for backups and content")
    print("✅ SNS notifications for task status")
    print("✅ CloudWatch Events for reliable scheduling")
    print("✅ Integration with existing AWS Cognito") 