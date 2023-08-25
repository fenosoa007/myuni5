import * as cdk from 'aws-cdk-lib';
import * as constructs from 'constructs';
import { BitbucketPipeline, IctUtils } from '@usyd/cdk-constructs';

interface PipelineStackProps extends cdk.StackProps {
  envVars: { [key: string]: any };
}

export class PipelineStack extends cdk.Stack {
  constructor(
    scope: constructs.Construct,
    id: string,
    props: PipelineStackProps,
  ) {
    super(scope, id, props);
    const prefix = `${props.envVars.RESOURCE_PREFIX}Pipeline`;

    new BitbucketPipeline(
      this,
      `${props.envVars.RESOURCE_PREFIX}BitbucketPipeline`,
      {
        prefix,
        synth: {
          bitbucket: {
            owner: props.envVars.BITBUCKET_OWNER,
            repo: props.envVars.BITBUCKET_REPO,
            branch: props.envVars.BITBUCKET_BRANCH,
          },
          outputPath: props.envVars.BUILD_OUTPUT_INFRA,
          commands: [
            IctUtils.getArtifactLoginCommand(),
            'npm install -g yarn',
            'rm -rf node_modules && yarn install --immutable',
            'cd $CODEBUILD_SRC_DIR/app',
            'rm -rf node_modules && yarn install --immutable',
            'yarn test --watchAll=false',
            'cd $CODEBUILD_SRC_DIR/infra',
            'rm -rf node_modules && yarn install --immutable',
            'cd lambda/MyUni5API',
            'rm -rf node_modules && yarn install --immutable',
            'cd ../..',
            `npx cdk -c account=${props.envVars.ACCOUNT} deploy --all --require-approval never`,
            'mv cdk.out ../', // fix for code pipeline issue: https://stackoverflow.com/questions/65811487/cloud-evelopment-kit-for-codepipeline-fails-no-matching-base-directory-path-foun
          ],
        },
        stages: [],
      },
    );
  }
}
