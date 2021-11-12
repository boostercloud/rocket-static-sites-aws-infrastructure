# Static Sites Booster Rocket for AWS

This package is a configurable Booster rocket to add static site deployment to your Booster applications. It uploads your root.

## Usage

Install this package as a dev dependency in your Booster project (It's a dev dependency because it's only used during deployment, but we don't want this code to be uploaded to the project lambdas)

```sh
npm install --save-dev @boostercloud/rocket-static-sites-aws-infrastructure
```

In your Booster config file, pass a `RocketDescriptor` array to the AWS' `Provider` initializer configuring the static site rocket:

```typescript
import { Booster } from '@boostercloud/framework-core'
import { BoosterConfig } from '@boostercloud/framework-types'
import * as AWS from '@boostercloud/framework-provider-aws'

Booster.configure('development', (config: BoosterConfig): void => {
  config.appName = 'my-store'
  config.provider = Provider([{
    packageName: '@boostercloud/rocket-static-sites-aws-infrastructure', 
    parameters: {
      bucketName: 'test-bucket-name', // Required
      rootPath: './frontend/dist', // Defaults to ./public
      indexFile: 'main.html', // File to render when users access the CLoudFormation URL. Defaults to index.html
      errorFile: 'error.html', // File to render when there's an error. Defaults to 404.html
      cloudfrontErrorConfigurations: undefined, // needed for single-page applications. Defaults to undefined
    }
  }])
})
```

If you’re building a single-page application, it can also be useful to configure what CloudFront does in the case of a 404 or 403 error to allow your application to respond `cloudfrontErrorConfigurations`:

```typescript
parameters: {
  bucketName: 'test-bucket-name', // Required
  rootPath: './frontend/dist', // Defaults to ./public
  indexFile: 'main.html', // File to render when users access the CLoudFormation URL. Defaults to index.html
  errorFile: 'error.html', // File to render when there's an error. Defaults to 404.html
  cloudfrontErrorConfigurations: [
    {
      errorCode: 403,
      responsePagePath: "/",
      responseCode: 200,
    },
    {
      errorCode: 404,
      responsePagePath: "/main.html",
      responseCode: 200,
    },
  ]
}
```