import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as constructs from 'constructs';
import * as path from 'path';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';

import { AcmCertificate, DnsRecord, S3CloudFront } from '@usyd/cdk-constructs';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import {
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
} from 'aws-cdk-lib/aws-cloudfront';

interface CloudFrontStackProps extends cdk.StackProps {
  envVars: { [key: string]: any };
  apiGateway: LambdaRestApi;
}
export class CloudFrontStack extends cdk.Stack {
  constructor(
    scope: constructs.Construct,
    id: string,
    props: CloudFrontStackProps,
  ) {
    super(scope, id, props);
    const prefix = `${props.envVars.RESOURCE_PREFIX}CF`;

    const appUrl = `https://${props.envVars.DOMAIN_NAME.toLowerCase()}`;

    const oktaClientId = ssm.StringParameter.valueForStringParameter(
      this,
      props.envVars.PARAMETER_OKTA_CLIENT_ID,
    );

    const oktaDomain = ssm.StringParameter.valueForStringParameter(
      this,
      props.envVars.PARAMETER_OKTA_DOMAIN,
    );

    const acmCertificate = new AcmCertificate(this, 'AcmCertificateCF', {
      prefix: prefix,
      domain: props.envVars.DOMAIN_NAME,
      app: props.envVars.APP_ABBREVIATION,
      cloudFront: true,
    });

    const s3CloudFront = new S3CloudFront(this, 'S3CloudFront', {
      prefix: prefix,
      originPath: props.envVars.ORIGIN_PATH,
      defaultRootObject: props.envVars.DEFAULT_ROOT_OBJECT,
      domain: {
        name: props.envVars.DOMAIN_NAME,
        certificateArn: acmCertificate.certificate.certificateArn,
      },
      deployment: {
        sourcePath: path.join(__dirname, '../..', 'app'),
        outputPath: 'build',
        buildCommands: [
          'npm install -g yarn',
          'rm -rf node_modules && yarn install --immutable',
          `export REACT_APP_RESOURCE_PREFIX=${props.envVars.RESOURCE_PREFIX}`,
          `export REACT_APP_REGION=${this.region}`,
          `export REACT_APP_URL=${appUrl}`,
          `export REACT_APP_OKTA_CLIENT_ID=${oktaClientId}`,
          `export REACT_APP_OKTA_BASE_URL=${oktaDomain}`,
          `export REACT_APP_API_URL=${props.envVars.MYUNI_API}`,
          `export REACT_APP_CAMPUS_MAP_URL=${props.envVars.CAMPUS_MAP_URL}`,
          'export GENERATE_SOURCEMAP=false',
          'yarn build',
        ],
        memoryLimit: 1024,
      },
    });
    s3CloudFront.node.addDependency(acmCertificate);

    // ripped from https://medium.com/@gwieser/aws-api-gateway-with-authorization-behind-cloudfront-what-a-header-ache-400c9edbeb85
    const apigBehaviourOptions = {
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      compress: false,
      cachePolicy: new CachePolicy(this, 'ApiGatewayCachePolicy', {
        headerBehavior: CacheHeaderBehavior.allowList(
          'Authorization',
          'Origin',
          'Referer',
        ),
        queryStringBehavior: CacheQueryStringBehavior.all(),
        cachePolicyName: 'ApiGatewayWithAuthorization',
        cookieBehavior: CacheCookieBehavior.all(),
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true,
        maxTtl: cdk.Duration.seconds(3600),
        minTtl: cdk.Duration.seconds(0),
        defaultTtl: cdk.Duration.seconds(0),
      }),
      originRequestPolicy: new OriginRequestPolicy(
        this,
        'ApiGatewayOriginRequestPolicy',
        {
          headerBehavior: OriginRequestHeaderBehavior.none(),
          queryStringBehavior: OriginRequestQueryStringBehavior.all(),
          cookieBehavior: OriginRequestCookieBehavior.none(),
          originRequestPolicyName: 'ApiGatewayWithAuthorization',
        },
      ),
    };

    const apigNoCDNCachBehaviourOptions = {
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
    };

    s3CloudFront.distribution.addBehavior(
      '/api',
      new cloudfront_origins.RestApiOrigin(props.apiGateway),
      apigNoCDNCachBehaviourOptions,
    );

    s3CloudFront.distribution.addBehavior(
      '/api/*',
      new cloudfront_origins.RestApiOrigin(props.apiGateway),
      apigNoCDNCachBehaviourOptions,
    );

    new ssm.StringParameter(this, 'ParamS3DeployUri', {
      parameterName: props.envVars.PARAMETER_S3_DEPLOY_URI,
      stringValue: s3CloudFront.originBucket.bucket.s3UrlForObject(
        props.envVars.ORIGIN_PATH,
      ),
      description: `S3 deployment URI for ${prefix}`,
    });
    new ssm.StringParameter(this, 'ParamS3BucketArn', {
      parameterName: props.envVars.PARAMETER_S3_BUCKET_ARN,
      stringValue: s3CloudFront.originBucket.bucket.bucketArn,
      description: `S3 Bucket ARN for ${prefix}`,
    });
    new ssm.StringParameter(this, 'ParamCloudFrontDistributionId', {
      parameterName: props.envVars.PARAMETER_CLOUDFRONT_DISTRIBUTION_ID,
      stringValue: s3CloudFront.distribution.distributionId,
      description: `CloudFront distribution ID for ${prefix}`,
    });

    /* CloudFormation outputs for local development */
    new cdk.CfnOutput(this, 'ApplicationURL', {
      exportName: `${prefix}URL`,
      description: 'Expected URL of application from domain name.',
      value: `https://${props.envVars.DOMAIN_NAME}/`,
    });

    new DnsRecord(this, 'DnsRecord', {
      prefix: prefix,
      type: DnsRecord.RecordType.CNAME,
      name: props.envVars.DOMAIN_NAME,
      value: s3CloudFront.distribution.distributionDomainName,
      app: props.envVars.APP_ABBREVIATION,
    });
  }
}
