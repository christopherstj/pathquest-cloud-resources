import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";

export const PROJECT_ID = "pathquest";

const location = "us-central1";

const envType = pulumi.getStack();

const cfg = new pulumi.Config();

const network = new gcp.compute.Network(`${envType}-vpc-network`, {
    name: `${envType}-vpc-network`,
    autoCreateSubnetworks: false,
});

const subnetwork1 = new gcp.compute.Subnetwork(
    `${envType}-gke-webserver-subnetwork1`,
    {
        ipCidrRange: "10.128.0.0/12",
        network: network.id,
        privateIpGoogleAccess: true,
        region: location,
    }
);

const mysqlDbInstance = new gcp.sql.DatabaseInstance("mysql-db-instance", {
    databaseVersion: "MYSQL_8_0",
    region: location,
    project: PROJECT_ID,
    rootPassword: cfg.requireSecret("db-root-password"),
    settings: {
        tier: "db-f1-micro",
        databaseFlags: [
            {
                name: "cloudsql_iam_authentication",
                value: "on",
            },
        ],
    },
});

const mysqlDb = new gcp.sql.Database(`${envType}-db`, {
    instance: mysqlDbInstance.name,
    project: PROJECT_ID,
    collation: "utf8mb3_general_ci",
    name: `${envType}-db`,
});

const localUser = new gcp.sql.User("web-app-bi", {
    project: PROJECT_ID,
    instance: mysqlDbInstance.name,
    type: "BUILT_IN",
    name: "local-user",
    password: cfg.requireSecret("mysql-password"),
});

const dockerRegistry = new gcp.artifactregistry.Repository("pathquest", {
    description: "Image repo for PathQuest",
    format: "DOCKER",
    location: location,
    repositoryId: "pathquest",
});

const apiCloudService = new gcp.cloudrunv2.Service("pathquest-api", {
    name: "pathquest-api",
    location: location,
    template: {
        containers: [
            {
                image: `${location}-docker.pkg.dev/${PROJECT_ID}/pathquest/pathquest-api:latest`,
            },
        ],
    },
});
