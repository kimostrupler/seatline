// Seatline on Azure (Plan A, ~CHF 20–30/month), all in Switzerland North.
// Deployed by infra/azure/setup.sh; app images are updated by .github/workflows/deploy.yml.

@description('Azure region — data must stay in Switzerland.')
param location string = 'switzerlandnorth'

@description('Short name used in resource names.')
@maxLength(12)
param prefix string = 'seatline'

@description('Container images. The placeholder is used until the first deploy pushes real ones.')
param apiImage string = 'mcr.microsoft.com/k8se/quickstart:latest'
param webImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@secure()
@description('PostgreSQL admin password (owner of the tables; used only by the migration job).')
param pgAdminPassword string

@secure()
@description('Password of seatline_app, the least-privilege role the API connects as.')
param appDbPassword string

@secure()
param sessionSecret string

@secure()
param internalAuthSecret string

@description('Entra app registration (Sign in with Microsoft + people sync).')
param entraClientId string

@secure()
param entraClientSecret string

var suffix = uniqueString(resourceGroup().id)
var pgAdmin = 'seatlineadmin'

resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: json('0.5') } // keeps logging cost near zero
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${prefix}${suffix}'
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

// The apps pull images with this identity (no registry passwords).
resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-pull'
  location: location
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, pullIdentity.id, 'acrpull')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: take('${prefix}${suffix}', 24)
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false // floor plans are only served through the API
    supportsHttpsTrafficOnly: true
  }
}

resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource plans 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobs
  name: 'floor-plans'
  properties: { publicAccess: 'None' }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: '${prefix}-db-${suffix}'
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: pgAdmin
    administratorLoginPassword: pgAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' } // backups stay in Switzerland
    highAvailability: { mode: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: postgres
  name: 'seatline'
}

// Only Azure services (our container apps) may connect; TLS is required by default.
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

var dbHost = postgres.properties.fullyQualifiedDomainName
var ownerDbUrl = 'postgresql://${pgAdmin}:${pgAdminPassword}@${dbHost}:5432/seatline?sslmode=require'
var appDbUrl = 'postgresql://seatline_app:${appDbPassword}@${dbHost}:5432/seatline?sslmode=require'
var storageConnection = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
var webUrl = 'https://web.${env.properties.defaultDomain}'
var apiUrl = 'https://api.internal.${env.properties.defaultDomain}'

var identity = {
  type: 'UserAssigned'
  userAssignedIdentities: { '${pullIdentity.id}': {} }
}
var registries = [{ server: registry.properties.loginServer, identity: pullIdentity.id }]

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'api'
  location: location
  identity: identity
  dependsOn: [acrPull]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: false, targetPort: 3001 } // only reachable from the web app
      registries: registries
      secrets: [
        { name: 'app-database-url', value: appDbUrl }
        { name: 'storage-connection', value: storageConnection }
        { name: 'internal-auth-secret', value: internalAuthSecret }
        { name: 'entra-client-secret', value: entraClientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3001' }
            { name: 'APP_DATABASE_URL', secretRef: 'app-database-url' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'storage-connection' }
            { name: 'AZURE_STORAGE_CONTAINER', value: 'floor-plans' }
            { name: 'INTERNAL_AUTH_SECRET', secretRef: 'internal-auth-secret' }
            { name: 'ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'ENTRA_CLIENT_SECRET', secretRef: 'entra-client-secret' }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'web'
  location: location
  identity: identity
  dependsOn: [acrPull]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 3000 }
      registries: registries
      secrets: [
        { name: 'session-secret', value: sessionSecret }
        { name: 'internal-auth-secret', value: internalAuthSecret }
        { name: 'entra-client-secret', value: entraClientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AUTH_MODE', value: 'entra' }
            { name: 'APP_URL', value: webUrl }
            { name: 'API_URL', value: apiUrl }
            { name: 'ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'ENTRA_CLIENT_SECRET', secretRef: 'entra-client-secret' }
            { name: 'SESSION_SECRET', secretRef: 'session-secret' }
            { name: 'INTERNAL_AUTH_SECRET', secretRef: 'internal-auth-secret' }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

// Applies database migrations and lets seatline_app log in. Started by the deploy workflow.
resource migrate 'Microsoft.App/jobs@2024-03-01' = {
  name: 'migrate'
  location: location
  identity: identity
  dependsOn: [acrPull]
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 600
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      registries: registries
      secrets: [
        { name: 'owner-database-url', value: ownerDbUrl }
        { name: 'app-db-password', value: appDbPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: apiImage
          command: ['sh', '-c', 'node_modules/.bin/prisma migrate deploy && node dist/jobs/setup-db.js']
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'DATABASE_URL', secretRef: 'owner-database-url' }
            { name: 'APP_DB_PASSWORD', secretRef: 'app-db-password' }
          ]
        }
      ]
    }
  }
}

// Nightly people sync from Microsoft 365 (01:00 UTC = 02:00/03:00 in Switzerland).
resource nightlySync 'Microsoft.App/jobs@2024-03-01' = {
  name: 'nightly-sync'
  location: location
  identity: identity
  dependsOn: [acrPull]
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 1800
      replicaRetryLimit: 1
      scheduleTriggerConfig: { cronExpression: '0 1 * * *', parallelism: 1, replicaCompletionCount: 1 }
      registries: registries
      secrets: [
        { name: 'app-database-url', value: appDbUrl }
        { name: 'entra-client-secret', value: entraClientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'nightly-sync'
          image: apiImage
          command: ['node', 'dist/jobs/nightly-sync.js']
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'APP_DATABASE_URL', secretRef: 'app-database-url' }
            { name: 'ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'ENTRA_CLIENT_SECRET', secretRef: 'entra-client-secret' }
          ]
        }
      ]
    }
  }
}

output webUrl string = webUrl
output registryName string = registry.name
output registryServer string = registry.properties.loginServer
output postgresServer string = postgres.name
