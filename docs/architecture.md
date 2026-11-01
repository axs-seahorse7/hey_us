# Architecture

```text
React web app -> Express API on EC2 -> MongoDB
      |                |
      +---- private S3 bucket (short-lived upload/download URLs)
```

## Media flow

1. Client asks the API for an upload URL after authentication and membership checks.
2. API creates an S3 object key scoped to the couple space and returns a short-lived presigned `PUT` URL.
3. Client uploads directly to S3.
4. Client creates the `Memory` metadata record via the API.
5. API returns short-lived download URLs when displaying private media.

## AWS baseline

- Keep the S3 bucket private and block public access.
- Add S3 CORS only for client domains.
- Give EC2 a least-privilege IAM role for the bucket/prefix.
- Keep production secrets out of source control.
- Terminate HTTPS at an Application Load Balancer with an ACM certificate.
- Enable S3 versioning, encryption, lifecycle rules, and monitoring.
