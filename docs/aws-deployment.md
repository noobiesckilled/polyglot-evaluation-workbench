# AWS deployment guide

Start with a private, single-instance staging deployment. It exercises image delivery, host permissions, persistent storage, application logs, token management, and recovery without exposing a development API to the internet. AWS resources have not been created or tested for this project yet.

## Services and boundaries

| Service         | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| ECR             | Private container images, deployed by immutable digest      |
| EC2             | One Linux application host, managed through Session Manager |
| EBS             | Encrypted local storage for SQLite and local backup staging |
| IAM             | Instance role and scoped operator permissions               |
| Systems Manager | Private access and SecureString token storage               |
| CloudWatch Logs | Structured application logs and alarms                      |
| S3              | Private, versioned database backups                         |

Use an x86-64 Amazon Linux 2023 instance with at least 2 GiB memory, such as `t3.small`, for the initial trial. The current container is limited to 768 MiB and one CPU. Measure resource use under the expected workload before changing those limits. This configuration has one failure domain; it is not highly available.

Session Manager supports access without opening inbound ports. Follow the [AWS Session Manager documentation](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html) to configure the operator role, instance role, agent, and required connectivity. Port-forwarding sessions do not provide application request logging, which is why the application logs separately to CloudWatch.

## 1. Prepare the account and cost controls

Choose the AWS account, region, resource prefix, and monthly budget before creating anything. Sign in through IAM Identity Center or another short-lived role-based workflow. Install AWS CLI v2 and the Session Manager plugin on your workstation.

```bash
aws sts get-caller-identity
export AWS_REGION="your-chosen-region"
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export REPOSITORY_NAME=polyglot-evaluation-workbench
export ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPOSITORY_NAME"
```

The following command examples use Bash. Review each resource creation against the selected account and region. Configure an AWS Budget alert. A budget alert is not an automatic spending cap. Estimate EC2, EBS, public IPv4 if used, ECR storage, log ingestion/retention, S3 storage, and data transfer using the [AWS Pricing Calculator](https://calculator.aws/). No fixed monthly price is assumed here.

## 2. Create the image repository and publish a verified image

```bash
aws ecr create-repository --region "$AWS_REGION" \
  --repository-name "$REPOSITORY_NAME" \
  --image-tag-mutability IMMUTABLE \
  --image-scanning-configuration scanOnPush=true
aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
export RELEASE="$(git rev-parse --short=12 HEAD)"
docker build --platform linux/amd64 -t "$ECR_URI:$RELEASE" .
docker push "$ECR_URI:$RELEASE"
aws ecr describe-images --region "$AWS_REGION" \
  --repository-name "$REPOSITORY_NAME" \
  --image-ids "imageTag=$RELEASE" \
  --query 'imageDetails[0].imageDigest' --output text
```

Record the returned digest. Deploy `repository-uri@sha256:...`, not a moving `latest` tag. Check ECR scan findings before rollout. ECR scanning and npm auditing cover different layers; neither is a complete security assessment.

## 3. Prepare storage, logs, and the token

Create a uniquely named S3 bucket in the chosen region. Block all public access, enable default encryption and versioning, and configure a lifecycle policy suitable for your recovery needs. Keep at least one verified backup before any deployment. The provided backup script uses S3-managed encryption; if you choose a customer-managed KMS key, update the command and IAM permissions accordingly.

Create the CloudWatch log group before starting Docker:

```bash
aws logs create-log-group --region "$AWS_REGION" --log-group-name /workbench/application
aws logs put-retention-policy --region "$AWS_REGION" \
  --log-group-name /workbench/application --retention-in-days 14
```

Generate a token locally with `openssl rand -hex 32`. Store it in Systems Manager Parameter Store as a **SecureString** named `/workbench/operator-token`. Use the AWS console or a controlled local input flow so the secret does not enter shell history. Do not put its value in the service configuration, GitHub, screenshots, or deployment documentation.

## 4. Configure the EC2 role and network

Create an EC2 instance role with `AmazonSSMManagedInstanceCore` and a narrowly scoped application policy:

- ECR: `GetAuthorizationToken` on `*`; `BatchCheckLayerAvailability`, `GetDownloadUrlForLayer`, and `BatchGetImage` on this repository ARN.
- SSM: `GetParameter` on the operator-token parameter ARN only. If it uses a customer-managed KMS key, allow `kms:Decrypt` for that key with appropriate service conditions.
- CloudWatch Logs: `CreateLogStream` and `PutLogEvents` on `/workbench/application` log-stream ARNs.
- S3: `PutObject` on the bucket's `database/*` prefix. Grant restoration access to an operator role; routine backup creation does not require deletion permissions.

Launch Amazon Linux 2023 x86-64 with that instance profile, IMDSv2 required, and an encrypted gp3 EBS root volume large enough for the container image and retained data. Twenty GiB is a starting allocation, not a monitored capacity guarantee. Keep the security group's **inbound rules empty**; do not open SSH or the application port.

The host needs outbound HTTPS to SSM, ECR, S3, CloudWatch, and operating-system package endpoints. For a simple trial, a public subnet with a public IPv4 address and no inbound rules can provide outbound access. A private subnet needs the relevant VPC endpoints or NAT; evaluate their cost rather than adding them blindly. Docker registry authentication occurs on the host, not in application code.

## 5. Install and configure the service

Connect with Session Manager. Install Docker and Git using the supported Amazon Linux packages, confirm AWS CLI v2 is available, and enable Docker. Clone the repository on the host; do not copy local `.env`, database, or credential files.

```bash
sudo dnf install -y docker git
sudo systemctl enable --now docker
git clone https://github.com/noobiesckilled/polyglot-evaluation-workbench.git
cd polyglot-evaluation-workbench
sudo install -d -m 0755 /usr/local/lib/workbench
sudo install -m 0755 deploy/start.sh deploy/backup.sh /usr/local/lib/workbench/
sudo install -m 0644 deploy/workbench.service deploy/workbench-backup.service deploy/workbench-backup.timer /etc/systemd/system/
sudo install -m 0600 deploy/workbench.conf.example /etc/workbench.conf
sudoedit /etc/workbench.conf
```

Set the actual region, digest-pinned ECR URI, token parameter name, log group, and backup bucket. This file contains references, not the token itself. The host script fetches the token into a root-only file under `/run` and passes it to the unprivileged container. AWS administrators and host root remain trusted and can inspect container configuration.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now workbench.service
sudo systemctl status workbench.service
curl --fail http://127.0.0.1:4173/api/health
```

The service mounts `/srv/workbench/data` on the encrypted local disk. Docker image replacement does not replace this directory. Do not delete the instance or its volume without a verified off-host backup.

## 6. Open the private application

On your workstation, forward a local port to the instance:

```bash
aws ssm start-session --region "$AWS_REGION" \
  --target "your-instance-id" \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["4173"],"localPortNumber":["4173"]}'
```

Open `http://localhost:4173` and unlock with the deployment token. The application remains on host loopback; traffic reaches it through the authenticated Session Manager tunnel. If your local preview already uses that port, choose a different local forwarding port.

## 7. Run acceptance and recovery checks

Verify all five runtimes are available, run the 49-case suite with the bug demo, and confirm five correct implementations pass while the demo fails. Save a review and confirm it survives both a browser refresh and a service restart. Try an invalid token and confirm access is denied.

Check the CloudWatch log stream, container memory/CPU, disk space, and EC2 status checks. Configure alerts for instance status failure, API errors, disk pressure, and backup failure. Native EC2 metrics do not include filesystem free space; install and configure the CloudWatch agent if you need that metric.

Run the backup service manually and verify a new S3 object exists. Restore it into a separate test location and validate a known run and review before enabling the daily timer. Use [operations.md](operations.md) for the procedure.

## Public hosting is a separate decision

Do not make the current HTTP port public. Public use needs TLS termination, an identity provider with individual users, an appropriate application server, perimeter controls, and a revised threat model. Horizontal scaling also needs a shared database and durable queue. Those changes should follow a defined use case rather than a claim that the current private trial is already production-certified.

## Cleanup

Stop the service, make and verify a final backup, and record the image digest and configuration. Then remove only this project's EC2, EBS, ECR, log, parameter, and optional network resources when no longer needed. Preserve backups for the agreed retention period. Instance termination, volume deletion, and S3 version cleanup can destroy data, so review each target before removing it.
