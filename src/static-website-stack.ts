import { CfnOutput, RemovalPolicy, Stack } from '@aws-cdk/core'
import { Bucket } from '@aws-cdk/aws-s3'
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment'
import * as route53 from '@aws-cdk/aws-route53'
import * as targets from '@aws-cdk/aws-route53-targets'
import * as acm from '@aws-cdk/aws-certificatemanager'
import {
  CloudFrontWebDistribution,
  OriginAccessIdentity,
  ViewerCertificate,
  ViewerProtocolPolicy,
} from '@aws-cdk/aws-cloudfront'
import { existsSync } from 'fs'
import { RocketUtils } from '@boostercloud/framework-provider-aws-infrastructure'

export type AWSStaticSiteParams = {
  rootPath?: string
  indexFile?: string
  errorFile?: string
  bucketName: string
  domainName?: string
}

export class StaticWebsiteStack {
  public static mountStack(params: AWSStaticSiteParams, stack: Stack): void {
    const rootPath = params.rootPath ?? './public'
    const indexFile = params.indexFile ?? 'index.html'
    const errorFile = params.errorFile ?? '404.html'
    const domainName = params.domainName
    if (existsSync(rootPath)) {
      const staticWebsiteOIA = new OriginAccessIdentity(stack, 'staticWebsiteOIA', {
        comment: 'Allows static site to be reached only via CloudFront',
      })
      const staticSiteBucket = new Bucket(stack, 'staticWebsiteBucket', {
        websiteIndexDocument: indexFile,
        websiteErrorDocument: errorFile,
        bucketName: params.bucketName,
        removalPolicy: RemovalPolicy.DESTROY,
      })

      staticSiteBucket.grantRead(staticWebsiteOIA)

      // We are using a Zone that already exists so we can use a lookup on the Zone name.
      const zone = domainName ? route53.HostedZone.fromLookup(stack, 'baseZone', { domainName: domainName }) : undefined

      // Request the wildcard TLS certificate, CDK will take care of domain ownership validation via
      // CNAME DNS entries in Route53, a custom resource will be used on our behalf
      const myCertificate =
        domainName && zone
          ? new acm.DnsValidatedCertificate(stack, 'staticWebsiteCert', {
            domainName: domainName,
            hostedZone: zone,
            region: 'us-east-1',
          })
          : undefined

      const cloudFrontDistribution = new CloudFrontWebDistribution(stack, 'staticWebsiteDistribution', {
        defaultRootObject: indexFile,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        viewerCertificate:
          domainName && myCertificate
            ? ViewerCertificate.fromAcmCertificate(myCertificate, { aliases: [domainName] })
            : ViewerCertificate.fromCloudFrontDefaultCertificate(),
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: staticSiteBucket,
              originAccessIdentity: staticWebsiteOIA,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
      })

      if (zone) {
        // Create the wildcard DNS entry in route53 as an alias to the new CloudFront Distribution.
        new route53.ARecord(stack, 'AliasRecord', {
          zone,
          recordName: domainName,
          target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(cloudFrontDistribution)),
        })
      }

      new BucketDeployment(stack, 'staticWebsiteDeployment', {
        sources: [Source.asset(rootPath)],
        destinationBucket: staticSiteBucket,
        distribution: cloudFrontDistribution,
      })

      new CfnOutput(stack, 'staticWebsiteURL', {
        value: `https://${cloudFrontDistribution.distributionDomainName}`,
        description: `The URL for the static website generated from ${rootPath} directory.`,
      })
    } else {
      throw new Error(
        `The rocket '${
          require('package.json').name
        }' tried to deploy a static site from local folder ${rootPath}, but couldn't find it. Please review the configuration and parameters for this rocket.`
      )
    }
  }

  public static async unmountStack(params: AWSStaticSiteParams, utils: RocketUtils): Promise<void> {
    // The bucket must be empty for the stack deletion to succeed
    await utils.s3.emptyBucket(params.bucketName)
  }
}
